-- Corrige vazamento cross-tenant em 6 RPCs de listagem.
--
-- Bug: cada função filtrava linhas com "is_admin() OR dono_id = auth.uid() OR EXISTS(...)".
-- Como is_admin() é avaliado dentro do próprio filtro de linhas (não só como checagem de
-- acesso), qualquer usuário admin recebia a linha de TODOS os donos do sistema de uma vez
-- (ex: várias linhas "Administrativo" repetidas, uma por dono), em vez de só a linha
-- relevante para a propriedade que ele está usando no momento.
--
-- Fix: as funções passam a receber p_propriedade_id, resolver o dono real da propriedade
-- (propriedades.user_id) e filtrar estritamente por esse dono — is_admin() continua
-- valendo só para a checagem de acesso (permite o admin consultar qualquer propriedade),
-- nunca mais para ampliar o conjunto de linhas retornado. Mesmo padrão já usado em
-- listar_contatos_usuario.

-- ═══ listar_subcategorias_transacao ═══
DROP FUNCTION IF EXISTS public.listar_subcategorias_transacao();

CREATE OR REPLACE FUNCTION public.listar_subcategorias_transacao(p_propriedade_id uuid)
 RETURNS SETOF subcategorias_transacao
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono_id uuid;
BEGIN
  IF NOT (
    is_admin()
    OR EXISTS (SELECT 1 FROM propriedades pr WHERE pr.id = p_propriedade_id AND pr.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM propriedades_usuarios pu WHERE pu.propriedade_id = p_propriedade_id AND pu.usuario_id = auth.uid() AND pu.status = 'ativo')
  ) THEN
    RAISE EXCEPTION 'Acesso negado a esta propriedade';
  END IF;

  SELECT pr.user_id INTO v_dono_id FROM propriedades pr WHERE pr.id = p_propriedade_id;

  RETURN QUERY
  SELECT s.* FROM subcategorias_transacao s
  WHERE s.ativo = true AND s.dono_id = v_dono_id
  ORDER BY s.nome;
END;
$function$;

-- ═══ listar_categorias_manutencao ═══
DROP FUNCTION IF EXISTS public.listar_categorias_manutencao();

CREATE OR REPLACE FUNCTION public.listar_categorias_manutencao(p_propriedade_id uuid)
 RETURNS SETOF categorias_manutencao
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono_id uuid;
BEGIN
  IF NOT (
    is_admin()
    OR EXISTS (SELECT 1 FROM propriedades pr WHERE pr.id = p_propriedade_id AND pr.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM propriedades_usuarios pu WHERE pu.propriedade_id = p_propriedade_id AND pu.usuario_id = auth.uid() AND pu.status = 'ativo')
  ) THEN
    RAISE EXCEPTION 'Acesso negado a esta propriedade';
  END IF;

  SELECT pr.user_id INTO v_dono_id FROM propriedades pr WHERE pr.id = p_propriedade_id;

  RETURN QUERY
  SELECT cm.* FROM categorias_manutencao cm
  WHERE cm.ativo = true AND cm.dono_id = v_dono_id
  ORDER BY cm.nome;
END;
$function$;

-- ═══ listar_categorias_produto ═══
DROP FUNCTION IF EXISTS public.listar_categorias_produto(text);

CREATE OR REPLACE FUNCTION public.listar_categorias_produto(p_propriedade_id uuid, p_tipo_estoque text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, nome text, tipo_estoque text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono_id uuid;
BEGIN
  IF NOT (
    is_admin()
    OR EXISTS (SELECT 1 FROM propriedades pr WHERE pr.id = p_propriedade_id AND pr.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM propriedades_usuarios pu WHERE pu.propriedade_id = p_propriedade_id AND pu.usuario_id = auth.uid() AND pu.status = 'ativo')
  ) THEN
    RAISE EXCEPTION 'Acesso negado a esta propriedade';
  END IF;

  SELECT pr.user_id INTO v_dono_id FROM propriedades pr WHERE pr.id = p_propriedade_id;

  RETURN QUERY
  SELECT cp.id, cp.nome::text, cp.tipo_estoque::text
  FROM categorias_produto cp
  WHERE cp.ativo = true
    AND cp.dono_id = v_dono_id
    AND (p_tipo_estoque IS NULL OR cp.tipo_estoque = p_tipo_estoque)
  ORDER BY cp.tipo_estoque, cp.nome;
END;
$function$;

-- ═══ listar_categorias_servico ═══
DROP FUNCTION IF EXISTS public.listar_categorias_servico();

CREATE OR REPLACE FUNCTION public.listar_categorias_servico(p_propriedade_id uuid)
 RETURNS TABLE(id uuid, nome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono_id uuid;
BEGIN
  IF NOT (
    is_admin()
    OR EXISTS (SELECT 1 FROM propriedades pr WHERE pr.id = p_propriedade_id AND pr.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM propriedades_usuarios pu WHERE pu.propriedade_id = p_propriedade_id AND pu.usuario_id = auth.uid() AND pu.status = 'ativo')
  ) THEN
    RAISE EXCEPTION 'Acesso negado a esta propriedade';
  END IF;

  SELECT pr.user_id INTO v_dono_id FROM propriedades pr WHERE pr.id = p_propriedade_id;

  RETURN QUERY
  SELECT cs.id, cs.nome::text FROM categorias_servico cs
  WHERE cs.ativo = true AND cs.dono_id = v_dono_id
  ORDER BY cs.nome;
END;
$function$;

-- ═══ listar_descricoes_manutencao ═══
DROP FUNCTION IF EXISTS public.listar_descricoes_manutencao();

CREATE OR REPLACE FUNCTION public.listar_descricoes_manutencao(p_propriedade_id uuid)
 RETURNS SETOF descricoes_manutencao
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono_id uuid;
BEGIN
  IF NOT (
    is_admin()
    OR EXISTS (SELECT 1 FROM propriedades pr WHERE pr.id = p_propriedade_id AND pr.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM propriedades_usuarios pu WHERE pu.propriedade_id = p_propriedade_id AND pu.usuario_id = auth.uid() AND pu.status = 'ativo')
  ) THEN
    RAISE EXCEPTION 'Acesso negado a esta propriedade';
  END IF;

  SELECT pr.user_id INTO v_dono_id FROM propriedades pr WHERE pr.id = p_propriedade_id;

  RETURN QUERY
  SELECT dm.* FROM descricoes_manutencao dm
  WHERE dm.ativo = true AND dm.dono_id = v_dono_id
  ORDER BY dm.nome;
END;
$function$;

-- ═══ listar_tipos_combustivel ═══
DROP FUNCTION IF EXISTS public.listar_tipos_combustivel();

CREATE OR REPLACE FUNCTION public.listar_tipos_combustivel(p_propriedade_id uuid)
 RETURNS SETOF tipos_combustivel
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono_id uuid;
BEGIN
  IF NOT (
    is_admin()
    OR EXISTS (SELECT 1 FROM propriedades pr WHERE pr.id = p_propriedade_id AND pr.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM propriedades_usuarios pu WHERE pu.propriedade_id = p_propriedade_id AND pu.usuario_id = auth.uid() AND pu.status = 'ativo')
  ) THEN
    RAISE EXCEPTION 'Acesso negado a esta propriedade';
  END IF;

  SELECT pr.user_id INTO v_dono_id FROM propriedades pr WHERE pr.id = p_propriedade_id;

  RETURN QUERY
  SELECT tc.* FROM tipos_combustivel tc
  WHERE tc.ativo = true AND tc.dono_id = v_dono_id
  ORDER BY tc.nome;
END;
$function$;
