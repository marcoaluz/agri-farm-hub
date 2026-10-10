-- excluir_produto_completo: produto com QUALQUER lote (entrada de estoque) não pode ser excluído.
-- Antes, a função apagava os lotes sem uso e as despesas do Financeiro geradas por eles.
-- Agora recusa com ERRCODE 23503 (mesmo código dos outros bloqueios) e não apaga lotes nem despesas.
-- Mesma assinatura e mesmo formato de retorno; o resto da função é o original.
-- (O bloco de DELETE de lotes/despesas fica inalcançável quando há lote, e inofensivo quando não há.)

BEGIN;

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

  IF NOT public.is_admin() AND EXISTS (
    SELECT 1 FROM lotes l
    WHERE l.produto_id = p_produto_id
      AND NOT (l.propriedade_id = ANY (public.get_prop_ids_por_papel(v_papeis)))
  ) THEN
    RAISE EXCEPTION 'Não foi possível excluir: este produto tem entradas de estoque em outra propriedade à qual você não tem acesso.';
  END IF;

  SELECT COALESCE(array_agg(l.id), ARRAY[]::uuid[]) INTO v_lote_ids
  FROM lotes l WHERE l.produto_id = p_produto_id;

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

  -- NOVO: qualquer entrada de estoque (lote) bloqueia a exclusão; não apaga lotes nem despesas
  IF cardinality(v_lote_ids) > 0 THEN
    RAISE EXCEPTION 'Não foi possível excluir: este produto tem entradas de estoque. Exclua as entradas primeiro (Ver lotes).'
      USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(array_agg('lote:' || x::text), ARRAY[]::text[]) INTO v_origens FROM unnest(v_lote_ids) x;
  SELECT count(*) INTO v_transacoes FROM transacoes WHERE origem = ANY (v_origens);

  IF COALESCE(v_produto.nivel_minimo, 0) > 0 THEN
    UPDATE produtos SET nivel_minimo = 0 WHERE id = p_produto_id;
  END IF;

  DELETE FROM lotes WHERE produto_id = p_produto_id;
  GET DIAGNOSTICS v_lotes = ROW_COUNT;

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

COMMIT;
