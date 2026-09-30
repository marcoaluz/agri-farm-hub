-- Exclusão de produto "de verdade" (antes só fazia ativo=false e deixava
-- lotes e a despesa do Financeiro órfãos).
-- Migration aditiva: só cria funções novas.
--
-- Regras (definidas pelo Marco em 30/09/2026):
--   * Produto JÁ USADO nunca é apagado: a função recusa e nada é alterado.
--     "Uso" = qualquer referência de consumo/movimento: lançamentos
--     (produto_id ou lote no detalhamento_lotes), abastecimentos, manutenções,
--     eventos sanitários, vendas de estoque, ordenhas, ou lote com saída
--     registrada (quantidade_disponivel < quantidade_original).
--     Isso precisa ser checado aqui, e não só pelas FKs/triggers, porque:
--       - vendas_estoque -> produtos é ON DELETE CASCADE (apagaria as vendas);
--       - lancamentos_itens -> produtos é ON DELETE SET NULL (zeraria o vínculo);
--       - impedir_delete_lote_consumido só olha lancamentos_itens.
--   * Produto sem uso: apaga TODOS os lotes (o trigger fn_lote_para_financeiro
--     remove a despesa 'lote:<id>' de cada um e o saldo se ajusta) e depois:
--       - se o produto é referenciado só em modelos (itens / servicos_itens):
--         desativa (ativo=false) para os modelos não perderem o vínculo;
--       - senão: DELETE do produto.
--   * Tudo numa transação só: qualquer erro (inclusive o bloqueio de mês
--     contabilizado em transacoes) desfaz tudo e a mensagem do banco sobe.

CREATE OR REPLACE FUNCTION public.excluir_produto_completo(p_produto_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_produto RECORD;
  v_papeis papel_usuario[] := ARRAY['proprietario'::papel_usuario, 'gerente'::papel_usuario, 'operador'::papel_usuario];
  v_lote_ids uuid[];
  v_origens text[];
  v_usos text[] := ARRAY[]::text[];
  v_transacoes integer;
  v_lotes integer;
  v_restantes integer;
  v_so_modelos boolean;
BEGIN
  SELECT * INTO v_produto FROM produtos WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF NOT (public.is_admin() OR (
       v_produto.propriedade_id = ANY (public.get_prop_ids_por_papel(v_papeis))
       AND NOT public.usuario_e_somente_consulta()
     )) THEN
    RAISE EXCEPTION 'Acesso negado a este produto';
  END IF;

  -- Produto compartilhado pode ter lotes em outras propriedades: o usuário
  -- precisa ter permissão em todas elas para apagar.
  IF NOT public.is_admin() AND EXISTS (
    SELECT 1 FROM lotes l
    WHERE l.produto_id = p_produto_id
      AND NOT (l.propriedade_id = ANY (public.get_prop_ids_por_papel(v_papeis)))
  ) THEN
    RAISE EXCEPTION 'Não foi possível excluir: este produto tem entradas de estoque em outra propriedade à qual você não tem acesso.';
  END IF;

  SELECT COALESCE(array_agg(l.id), ARRAY[]::uuid[]) INTO v_lote_ids
  FROM lotes l WHERE l.produto_id = p_produto_id;

  -- ---------- Checagem de uso ----------
  IF EXISTS (
    SELECT 1 FROM lancamentos_itens li
    WHERE li.produto_id = p_produto_id
       OR (cardinality(v_lote_ids) > 0 AND EXISTS (
             SELECT 1 FROM unnest(v_lote_ids) lid
             WHERE li.detalhamento_lotes::text LIKE '%' || lid::text || '%'))
  ) THEN
    v_usos := array_append(v_usos, 'lançamentos');
  END IF;
  IF EXISTS (SELECT 1 FROM abastecimentos WHERE produto_id = p_produto_id) THEN
    v_usos := array_append(v_usos, 'abastecimentos');
  END IF;
  IF EXISTS (SELECT 1 FROM maquina_manutencoes WHERE produto_id = p_produto_id) THEN
    v_usos := array_append(v_usos, 'manutenções de máquinas');
  END IF;
  IF EXISTS (SELECT 1 FROM sanitario_eventos WHERE produto_id = p_produto_id) THEN
    v_usos := array_append(v_usos, 'eventos sanitários');
  END IF;
  IF EXISTS (SELECT 1 FROM vendas_estoque WHERE produto_id = p_produto_id) THEN
    v_usos := array_append(v_usos, 'vendas de estoque');
  END IF;
  IF cardinality(v_lote_ids) > 0 AND EXISTS (SELECT 1 FROM ordenhas WHERE lote_id = ANY (v_lote_ids)) THEN
    v_usos := array_append(v_usos, 'ordenhas');
  END IF;
  IF cardinality(v_usos) = 0 AND EXISTS (
    SELECT 1 FROM lotes l
    WHERE l.produto_id = p_produto_id
      AND COALESCE(l.quantidade_disponivel, 0) < COALESCE(l.quantidade_original, 0)
  ) THEN
    v_usos := array_append(v_usos, 'saídas de estoque');
  END IF;

  IF cardinality(v_usos) > 0 THEN
    RAISE EXCEPTION 'Não foi possível excluir: este produto já foi usado em %. Exclua primeiro esses registros.',
      CASE WHEN cardinality(v_usos) = 1 THEN v_usos[1]
           ELSE array_to_string(v_usos[1:cardinality(v_usos) - 1], ', ') || ' e ' || v_usos[cardinality(v_usos)]
      END
      USING ERRCODE = '23503';
  END IF;

  -- ---------- Exclusão ----------
  SELECT COALESCE(array_agg('lote:' || x::text), ARRAY[]::text[]) INTO v_origens FROM unnest(v_lote_ids) x;
  SELECT count(*) INTO v_transacoes FROM transacoes WHERE origem = ANY (v_origens);

  -- Evita o aviso "Estoque baixo" (sininho + push) disparado pelo
  -- trg_notificar_estoque_baixo quando o saldo cai a zero com a exclusão.
  IF COALESCE(v_produto.nivel_minimo, 0) > 0 THEN
    UPDATE produtos SET nivel_minimo = 0 WHERE id = p_produto_id;
  END IF;

  DELETE FROM lotes WHERE produto_id = p_produto_id;
  GET DIAGNOSTICS v_lotes = ROW_COUNT;

  -- Garantia: nenhuma despesa de lote pode sobrar órfã.
  SELECT count(*) INTO v_restantes FROM transacoes WHERE origem = ANY (v_origens);
  IF v_restantes > 0 THEN
    RAISE EXCEPTION 'Não foi possível excluir: % despesa(s) do Financeiro deste produto não puderam ser removidas.', v_restantes;
  END IF;

  v_so_modelos := EXISTS (SELECT 1 FROM itens WHERE produto_id = p_produto_id)
               OR EXISTS (SELECT 1 FROM servicos_itens WHERE produto_id = p_produto_id);

  IF v_so_modelos THEN
    UPDATE produtos
    SET ativo = false, nivel_minimo = v_produto.nivel_minimo
    WHERE id = p_produto_id;
  ELSE
    DELETE FROM produtos WHERE id = p_produto_id;
  END IF;

  RETURN json_build_object(
    'sucesso', true,
    'acao', CASE WHEN v_so_modelos THEN 'desativado' ELSE 'excluido' END,
    'lotes_excluidos', v_lotes,
    'transacoes_excluidas', v_transacoes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.excluir_produto_completo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_produto_completo(uuid) TO authenticated;

-- Lista os produtos desativados (aba "Desativados" do Estoque).
-- Mesmo filtro de propriedade/compartilhamento de listar_produtos_usuario,
-- só que com ativo = false. SECURITY INVOKER: RLS de produtos continua valendo.
CREATE OR REPLACE FUNCTION public.listar_produtos_desativados(p_propriedade_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, propriedade_id uuid, nome text, categoria text, unidade_medida text, saldo_atual numeric, compartilhado boolean, tipo_estoque text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    prod.id, prod.propriedade_id,
    prod.nome::text, prod.categoria::text, prod.unidade_medida::text,
    prod.saldo_atual, prod.compartilhado, prod.tipo_estoque::text
  FROM produtos prod
  WHERE prod.ativo = false
  AND (
    (NOT prod.compartilhado AND prod.propriedade_id = p_propriedade_id)
    OR
    (prod.compartilhado AND (
      EXISTS (SELECT 1 FROM propriedades pp WHERE pp.id = prod.propriedade_id AND pp.user_id = (SELECT pr.user_id FROM propriedades pr WHERE pr.id = p_propriedade_id))
      OR prod.usuario_id IN (
        SELECT pu.usuario_id FROM propriedades_usuarios pu
        WHERE pu.propriedade_id = p_propriedade_id AND pu.status = 'ativo'
      )
    ))
  )
  ORDER BY prod.nome;
END;
$function$;
