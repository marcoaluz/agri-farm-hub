-- Listagens dos chamados com nomes (user_profiles só deixa cada um ler o próprio
-- perfil, então os nomes vêm por aqui, sempre com a mesma checagem de acesso).
CREATE OR REPLACE FUNCTION public.listar_chamados(p_propriedade_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid, numero bigint, propriedade_id uuid, propriedade_nome text, assunto text,
  tipo public.chamado_tipo, prioridade public.chamado_prioridade, status public.chamado_status,
  criado_por uuid, criado_por_nome text, created_at timestamptz, ultima_atividade_em timestamptz,
  finalizado_em timestamptz, qtd_mensagens bigint, ultima_do_suporte boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.id, c.numero, c.propriedade_id, p.nome::text, c.assunto, c.tipo, c.prioridade, c.status,
         c.criado_por, COALESCE(up.full_name, 'Usuário')::text, c.created_at, c.ultima_atividade_em, c.finalizado_em,
         (SELECT count(*) FROM public.chamado_mensagens m WHERE m.chamado_id = c.id AND NOT m.sistema),
         (SELECT m.do_suporte FROM public.chamado_mensagens m WHERE m.chamado_id = c.id AND NOT m.sistema
           ORDER BY m.created_at DESC LIMIT 1)
  FROM public.chamados c
  JOIN public.propriedades p ON p.id = c.propriedade_id
  LEFT JOIN public.user_profiles up ON up.id = c.criado_por
  WHERE (public.is_admin() OR c.propriedade_id = ANY (public.get_prop_ids_usuario()))
    AND (p_propriedade_id IS NULL OR c.propriedade_id = p_propriedade_id)
  ORDER BY c.ultima_atividade_em DESC;
$$;

CREATE OR REPLACE FUNCTION public.listar_mensagens_chamado(p_chamado_id uuid)
RETURNS TABLE(id uuid, autor_id uuid, autor_nome text, do_suporte boolean, sistema boolean, texto text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT m.id, m.autor_id,
         CASE WHEN m.do_suporte THEN 'Suporte Agro GFI' ELSE COALESCE(up.full_name, 'Usuário') END::text,
         m.do_suporte, m.sistema, m.texto, m.created_at
  FROM public.chamado_mensagens m
  LEFT JOIN public.user_profiles up ON up.id = m.autor_id
  WHERE m.chamado_id = p_chamado_id AND public.pode_ver_chamado(p_chamado_id)
  ORDER BY m.created_at, m.id;
$$;

REVOKE ALL ON FUNCTION public.listar_chamados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_chamados(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.listar_mensagens_chamado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_mensagens_chamado(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
