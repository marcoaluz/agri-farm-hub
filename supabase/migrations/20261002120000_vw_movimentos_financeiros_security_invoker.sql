-- Corrige vazamento entre clientes: vw_movimentos_financeiros rodava com o
-- privilégio do dono (postgres) e ignorava o RLS de transacoes/parcelas, então
-- qualquer usuário logado lia o financeiro de todas as propriedades via
-- /rest/v1/vw_movimentos_financeiros (e via funções SECURITY INVOKER que a
-- consultam, ex.: get_breakdown_custos_interna em propriedade alheia).
--
-- Com security_invoker a view passa a respeitar o RLS de quem consulta.
-- Definição da view, policies e frontend não mudam.
--
-- NÃO aplicar em vw_auditoria_geral_completa / vw_lancamentos_historico_completo
-- (filtram dentro da própria view e leem auth.users) nem em vw_all_users_admin.

ALTER VIEW public.vw_movimentos_financeiros SET (security_invoker = true);
