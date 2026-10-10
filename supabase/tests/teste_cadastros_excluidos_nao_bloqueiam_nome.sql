-- TESTE (não grava nada): aplica as migrations 20261010190000 e 20261010190100 DENTRO de uma transação,
-- roda os casos como authenticated (conta de teste) e termina SEMPRE com erro, que desfaz tudo.
-- O resultado aparece na mensagem de erro 'RESULTADO DO TESTE'. Gerado a partir das migrations: se mudarem, regenerar.
BEGIN;
-- Cadastros excluídos (soft delete, ativo = false) não podem bloquear o nome para sempre.
--
-- Sintoma: item aparece como "já cadastrado" ao recriar, mas não aparece em lista nenhuma,
-- porque o UNIQUE (ex.: propriedade_id + nome) valia também para linhas com ativo = false
-- e as listas filtram ativo = true.
--
-- NÃO troca a chave única das 8 tabelas preenchidas pelos fn_seed_* (categorias_produto,
-- categorias_servico, categorias_contato, categorias_manutencao, descricoes_manutencao,
-- tipos_combustivel, tipos_racao, subcategorias_transacao): os seeds usam
-- ON CONFLICT (usuario_id, nome) e um índice parcial quebraria a criação de fazenda nova.
-- Para essas, criar_categoria_compartilhada passa a reativar o registro excluído.
--
-- Rodar manualmente no SQL Editor do Supabase (funções/índices foram criados direto no banco).


-- 1) ativo: nunca NULL, default true
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'itens','servicos','contatos','talhao_culturas','rebanhos','culturas_config',
    'categorias_servico','talhoes','produtos','maquinas','categorias_produto',
    'categorias_manutencao','protocolos_sanitarios','categorias_contato','propriedades'
  ] LOOP
    EXECUTE format('UPDATE public.%I SET ativo = true WHERE ativo IS NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN ativo SET DEFAULT true', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN ativo SET NOT NULL', t);
  END LOOP;
END $$;

-- 2) UNIQUE vira índice único parcial (só registros ativos), mesmo nome e mesmas colunas.
--    Confirmado no banco: nenhuma função usa ON CONFLICT nestas 4 tabelas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('produtos',        'produtos_prop_nome_unique',                          'propriedade_id, nome'),
    ('itens',           'itens_prop_nome_unique',                             'propriedade_id, nome'),
    ('categorias_transacao','categorias_transacao_dono_valor_key',            'dono_id, valor'),
    ('talhao_culturas', 'talhao_culturas_talhao_id_safra_id_cultura_id_key',  'talhao_id, safra_id, cultura_id')
  ) AS v(tabela, indice, colunas) LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.tabela, r.indice);
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indice);
    EXECUTE format(
      'CREATE UNIQUE INDEX %I ON public.%I (%s) WHERE ativo = true',
      r.indice, r.tabela, r.colunas
    );
  END LOOP;
END $$;

-- 3) criar_categoria_compartilhada: reativa registro excluído com o mesmo nome
--    (o UNIQUE (usuario_id, nome) das tabelas de categoria vale também para inativos).
--    Mesma assinatura e retorno, então CREATE OR REPLACE não cria sobrecarga.
CREATE OR REPLACE FUNCTION public.criar_categoria_compartilhada(p_tabela text, p_propriedade_id uuid, p_nome text, p_icone text DEFAULT NULL::text, p_tipo_estoque text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_dono_id uuid; v_novo_id uuid;
BEGIN
  IF p_tabela NOT IN ('categorias_produto','categorias_contato','categorias_manutencao','descricoes_manutencao','categorias_servico','tipos_combustivel','tipos_racao','subcategorias_transacao') THEN
    RAISE EXCEPTION 'Tabela inválida: %', p_tabela;
  END IF;
  SELECT user_id INTO v_dono_id FROM propriedades WHERE id = p_propriedade_id;
  IF v_dono_id IS NULL OR NOT (auth.uid() = v_dono_id OR EXISTS (SELECT 1 FROM propriedades_usuarios WHERE propriedade_id = p_propriedade_id AND usuario_id = auth.uid() AND status = 'ativo')) THEN
    RAISE EXCEPTION 'Você não tem acesso a essa propriedade.';
  END IF;

  -- Reativa categoria excluída com o mesmo nome (no máximo 1: UNIQUE usuario_id + nome)
  IF p_tabela = 'categorias_servico' THEN
    UPDATE categorias_servico
       SET ativo = true, dono_id = v_dono_id, icone = COALESCE(p_icone, icone)
     WHERE usuario_id = auth.uid() AND nome = p_nome AND ativo = false
    RETURNING id INTO v_novo_id;
  ELSIF p_tabela = 'categorias_produto' THEN
    UPDATE categorias_produto
       SET ativo = true, dono_id = v_dono_id, tipo_estoque = COALESCE(p_tipo_estoque, tipo_estoque)
     WHERE usuario_id = auth.uid() AND nome = p_nome AND ativo = false
    RETURNING id INTO v_novo_id;
  ELSE
    EXECUTE format('UPDATE %I SET ativo = true, dono_id = $1 WHERE usuario_id = $2 AND nome = $3 AND ativo = false RETURNING id', p_tabela)
      INTO v_novo_id USING v_dono_id, auth.uid(), p_nome;
  END IF;
  IF v_novo_id IS NOT NULL THEN
    RETURN v_novo_id;
  END IF;

  IF p_tabela = 'categorias_servico' THEN
    INSERT INTO categorias_servico (usuario_id, dono_id, nome, icone) VALUES (auth.uid(), v_dono_id, p_nome, p_icone) RETURNING id INTO v_novo_id;
  ELSIF p_tabela = 'categorias_produto' THEN
    INSERT INTO categorias_produto (usuario_id, dono_id, nome, tipo_estoque) VALUES (auth.uid(), v_dono_id, p_nome, COALESCE(p_tipo_estoque, 'agricola')) RETURNING id INTO v_novo_id;
  ELSE
    EXECUTE format('INSERT INTO %I (usuario_id, dono_id, nome) VALUES ($1,$2,$3) RETURNING id', p_tabela) INTO v_novo_id USING auth.uid(), v_dono_id, p_nome;
  END IF;
  RETURN v_novo_id;
END;
$function$;

-- 4) criar_produto_compartilhado: grava ativo = true explicitamente e confere acesso à
--    propriedade (mesmo critério da policy produtos_insert). Mesma assinatura e retorno.
CREATE OR REPLACE FUNCTION public.criar_produto_compartilhado(
  p_propriedade_id uuid,
  p_nome text,
  p_categoria text,
  p_compartilhado boolean DEFAULT false,
  p_unidade_medida text DEFAULT NULL::text,
  p_unidade text DEFAULT NULL::text,
  p_descricao text DEFAULT NULL::text,
  p_preco_estimado numeric DEFAULT NULL::numeric,
  p_nivel_minimo numeric DEFAULT NULL::numeric,
  p_vendavel boolean DEFAULT false
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_produto_id uuid;
  v_unidade text;
BEGIN
  IF NOT (
    is_admin()
    OR (
      p_propriedade_id = ANY (get_prop_ids_por_papel(ARRAY['proprietario'::papel_usuario, 'gerente'::papel_usuario, 'operador'::papel_usuario]))
      AND NOT usuario_e_somente_consulta()
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar produto nesta propriedade' USING ERRCODE = '42501';
  END IF;

  v_unidade := COALESCE(p_unidade_medida, p_unidade, 'kg');

  INSERT INTO produtos (
    propriedade_id, usuario_id, nome, categoria,
    unidade_medida, compartilhado, nivel_minimo, vendavel, ativo
  ) VALUES (
    p_propriedade_id, auth.uid(), p_nome, p_categoria,
    v_unidade::item_unidade, p_compartilhado, COALESCE(p_nivel_minimo, 0), p_vendavel, true
  )
  RETURNING id INTO v_produto_id;

  RETURN json_build_object(
    'sucesso', true,
    'produto_id', v_produto_id,
    'compartilhado', p_compartilhado
  );
END;
$function$;

-- O Calcario 28b32483… NÃO é reativado: o proprietário vai cadastrar de novo.

-- excluir_produto_completo: produto com QUALQUER lote (entrada de estoque) não pode ser excluído.
-- Antes, a função apagava os lotes sem uso e as despesas do Financeiro geradas por eles.
-- Agora recusa com ERRCODE 23503 (mesmo código dos outros bloqueios) e não apaga lotes nem despesas.
-- Mesma assinatura e mesmo formato de retorno; o resto da função é o original.
-- (O bloco de DELETE de lotes/despesas fica inalcançável quando há lote, e inofensivo quando não há.)


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


-- ───────────── A PARTIR DAQUI: roda como a conta de teste (authenticated, com RLS) ─────────────
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"34e7126c-2d23-4395-bee7-072e357fb16e","role":"authenticated"}';

DO $teste$
DECLARE
  v_uid  uuid := '34e7126c-2d23-4395-bee7-072e357fb16e';
  v_prop uuid := '5a41ee23-e5d4-4454-957e-78a2984b9d0e';
  rel    text := '';
  v_json json;
  v_id   uuid;
  v_id2  uuid;
  v_n    int;
  v_safra uuid;
  v_ativo boolean;
BEGIN
  -- ── T1. Produto: criar → excluir pela RPC → criar de novo (mesmo nome) ──
  BEGIN
    v_json := criar_produto_compartilhado(p_propriedade_id => v_prop, p_nome => 'ZZ Teste Excluir', p_categoria => 'Calcário', p_unidade => 'kg');
    v_id := (v_json->>'produto_id')::uuid;
    SELECT count(*) INTO v_n FROM listar_produtos_usuario(v_prop) WHERE id = v_id;
    rel := rel || CASE WHEN v_n = 1 THEN E'\nOK    T1a criar produto e ele aparece em listar_produtos_usuario'
                       ELSE E'\nFALHA T1a produto criado NÃO aparece na lista' END;
  EXCEPTION WHEN OTHERS THEN rel := rel || format(E'\nFALHA T1a: [%s] %s', SQLSTATE, SQLERRM); END;

  BEGIN
    v_json := excluir_produto_completo(v_id);
    SELECT count(*) INTO v_n FROM listar_produtos_usuario(v_prop) WHERE id = v_id;
    rel := rel || CASE WHEN v_n = 0 THEN format(E'\nOK    T1b excluir pela RPC (acao=%s) e some da lista', v_json->>'acao')
                       ELSE E'\nFALHA T1b produto continua na lista após excluir' END;
  EXCEPTION WHEN OTHERS THEN rel := rel || format(E'\nFALHA T1b: [%s] %s', SQLSTATE, SQLERRM); END;

  BEGIN
    v_json := criar_produto_compartilhado(p_propriedade_id => v_prop, p_nome => 'ZZ Teste Excluir', p_categoria => 'Calcário', p_unidade => 'kg');
    v_id := (v_json->>'produto_id')::uuid;
    SELECT count(*) INTO v_n FROM listar_produtos_usuario(v_prop) WHERE id = v_id;
    rel := rel || CASE WHEN v_n = 1 THEN E'\nOK    T1c recriar com o mesmo nome e aparece na lista'
                       ELSE E'\nFALHA T1c recriado NÃO aparece' END;
  EXCEPTION WHEN OTHERS THEN rel := rel || format(E'\nFALHA T1c: [%s] %s', SQLSTATE, SQLERRM); END;

  -- ── T1d. O bug real: produto desativado (ativo=false) não pode bloquear o nome ──
  BEGIN
    UPDATE produtos SET ativo = false WHERE id = v_id;
    v_json := criar_produto_compartilhado(p_propriedade_id => v_prop, p_nome => 'ZZ Teste Excluir', p_categoria => 'Calcário', p_unidade => 'kg');
    v_id2 := (v_json->>'produto_id')::uuid;
    SELECT count(*) INTO v_n FROM listar_produtos_usuario(v_prop) WHERE id = v_id2;
    rel := rel || CASE WHEN v_n = 1 THEN E'\nOK    T1d nome de produto desativado pode ser reutilizado'
                       ELSE E'\nFALHA T1d novo produto não aparece' END;
  EXCEPTION WHEN OTHERS THEN rel := rel || format(E'\nFALHA T1d: [%s] %s', SQLSTATE, SQLERRM); END;

  -- ── T1e. Checagem de acesso: propriedade que não é do usuário ──
  BEGIN
    PERFORM criar_produto_compartilhado(p_propriedade_id => gen_random_uuid(), p_nome => 'ZZ Intruso', p_categoria => 'Calcário', p_unidade => 'kg');
    rel := rel || E'\nFALHA T1e criou produto em propriedade sem acesso';
  EXCEPTION WHEN OTHERS THEN
    rel := rel || CASE WHEN SQLSTATE = '42501' THEN E'\nOK    T1e bloqueado em propriedade sem acesso (42501)'
                       ELSE format(E'\nFALHA T1e erro inesperado: [%s] %s', SQLSTATE, SQLERRM) END;
  END;

  -- ── T2. Categoria: criar → desativar → recriar volta o MESMO id ativo ──
  BEGIN
    v_id := criar_categoria_compartilhada('categorias_produto', v_prop, 'ZZ Cat Teste', NULL, 'agricola');
    UPDATE categorias_produto SET ativo = false WHERE id = v_id;
    v_id2 := criar_categoria_compartilhada('categorias_produto', v_prop, 'ZZ Cat Teste', NULL, 'pecuario');
    SELECT ativo INTO v_ativo FROM categorias_produto WHERE id = v_id2;
    rel := rel || CASE WHEN v_id2 = v_id AND v_ativo THEN E'\nOK    T2a categorias_produto: recriar reativa o mesmo id'
                       ELSE format(E'\nFALHA T2a ids %s / %s, ativo=%s', v_id, v_id2, v_ativo) END;
  EXCEPTION WHEN OTHERS THEN rel := rel || format(E'\nFALHA T2a: [%s] %s', SQLSTATE, SQLERRM); END;

  BEGIN
    v_id := criar_categoria_compartilhada('tipos_racao', v_prop, 'ZZ Racao Teste');
    UPDATE tipos_racao SET ativo = false WHERE id = v_id;
    v_id2 := criar_categoria_compartilhada('tipos_racao', v_prop, 'ZZ Racao Teste');
    SELECT ativo INTO v_ativo FROM tipos_racao WHERE id = v_id2;
    rel := rel || CASE WHEN v_id2 = v_id AND v_ativo THEN E'\nOK    T2b tipos_racao: recriar reativa o mesmo id'
                       ELSE format(E'\nFALHA T2b ids %s / %s, ativo=%s', v_id, v_id2, v_ativo) END;
  EXCEPTION WHEN OTHERS THEN rel := rel || format(E'\nFALHA T2b: [%s] %s', SQLSTATE, SQLERRM); END;

  BEGIN
    v_id := criar_categoria_compartilhada('categorias_servico', v_prop, 'ZZ Serv Teste', 'wrench');
    UPDATE categorias_servico SET ativo = false WHERE id = v_id;
    v_id2 := criar_categoria_compartilhada('categorias_servico', v_prop, 'ZZ Serv Teste', 'tractor');
    SELECT ativo INTO v_ativo FROM categorias_servico WHERE id = v_id2;
    rel := rel || CASE WHEN v_id2 = v_id AND v_ativo THEN E'\nOK    T2c categorias_servico: recriar reativa o mesmo id'
                       ELSE format(E'\nFALHA T2c ids %s / %s, ativo=%s', v_id, v_id2, v_ativo) END;
  EXCEPTION WHEN OTHERS THEN rel := rel || format(E'\nFALHA T2c: [%s] %s', SQLSTATE, SQLERRM); END;

  -- categoria ativa duplicada continua dando 23505 (a tela mostra "já existe")
  BEGIN
    PERFORM criar_categoria_compartilhada('categorias_produto', v_prop, 'ZZ Cat Teste', NULL, 'agricola');
    rel := rel || E'\nFALHA T2d categoria ativa duplicada foi aceita';
  EXCEPTION WHEN OTHERS THEN
    rel := rel || CASE WHEN SQLSTATE = '23505' THEN E'\nOK    T2d categoria ativa duplicada continua dando 23505'
                       ELSE format(E'\nFALHA T2d erro inesperado: [%s] %s', SQLSTATE, SQLERRM) END;
  END;

  -- ── T3. Triggers fn_seed_* ao criar propriedade nova ──
  BEGIN
    INSERT INTO propriedades (nome, user_id) VALUES ('ZZ Fazenda Teste Seed', v_uid);
    rel := rel || E'\nOK    T3  INSERT em propriedades sem erro (fn_seed_* funcionando)';
  EXCEPTION WHEN OTHERS THEN rel := rel || format(E'\nFALHA T3: [%s] %s', SQLSTATE, SQLERRM); END;

  -- ── T4. Excluir produto que tem lote (entrada de estoque) deve ser BLOQUEADO ──
  --    (só passa depois da migration 20261010190100, que altera excluir_produto_completo)
  BEGIN
    SELECT id INTO v_safra FROM safras WHERE propriedade_id = v_prop AND ativa AND NOT COALESCE(fechada, false) LIMIT 1;
    IF v_safra IS NULL THEN
      rel := rel || E'\nPULOU T4  propriedade de teste sem safra ativa para registrar entrada';
    ELSE
      rel := rel || format(E'\n      T4 usando a safra ativa %s', v_safra);
      v_json := criar_produto_compartilhado(p_propriedade_id => v_prop, p_nome => 'ZZ Teste com Lote', p_categoria => 'Calcário', p_unidade => 'kg');
      v_id := (v_json->>'produto_id')::uuid;
      PERFORM registrar_entrada_estoque(
        p_propriedade_id => v_prop, p_produto_id => v_id, p_safra_id => v_safra,
        p_quantidade => 10, p_custo_unitario => 5, p_data_entrada => current_date,
        p_data_validade => NULL, p_fornecedor => NULL, p_nota_fiscal => NULL,
        p_status_pagamento => 'pago', p_data_vencimento => NULL);
      BEGIN
        PERFORM excluir_produto_completo(v_id);
        rel := rel || E'\nFALHA T4  excluiu produto que tem lote (bloqueio por lotes ainda não aplicado?)';
      EXCEPTION WHEN OTHERS THEN
        rel := rel || CASE WHEN SQLSTATE = '23503' AND SQLERRM ILIKE '%entradas de estoque%'
                           THEN E'\nOK    T4  exclusão com lote bloqueada (23503, mensagem de entradas de estoque)'
                           ELSE format(E'\nFALHA T4  bloqueou com outro erro: [%s] %s', SQLSTATE, SQLERRM) END;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN rel := rel || format(E'\nFALHA T4 (preparação): [%s] %s', SQLSTATE, SQLERRM); END;

  -- Sempre termina com erro: isso DESFAZ tudo (migration + dados de teste) e mostra o relatório.
  RAISE EXCEPTION E'RESULTADO DO TESTE (transação desfeita, nada foi gravado):\n%', rel;
END
$teste$;
