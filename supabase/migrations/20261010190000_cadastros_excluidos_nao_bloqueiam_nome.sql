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

BEGIN;

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

COMMIT;
