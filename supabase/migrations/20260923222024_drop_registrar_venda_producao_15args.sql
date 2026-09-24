-- Remove a versão antiga (15 argumentos, sem p_subcategoria) de
-- registrar_venda_producao, que ficou órfã depois que p_subcategoria foi
-- adicionado com DEFAULT NULL — o PostgREST não consegue mais escolher entre
-- as duas sobrecargas quando o frontend chama sem p_subcategoria, e retorna
-- "Could not choose the best candidate function". Nenhum call site do
-- frontend usa mais essa assinatura de 15 parâmetros.
DROP FUNCTION IF EXISTS public.registrar_venda_producao(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text, date, text, boolean, integer, date, text, numeric
);
