-- Relatórios > Operacional > "Custo por Categoria": filtro por talhão.
--
-- Nova função get_relatorio_por_categoria_talhao(prop, safra, talhao):
--   p_talhao_id NULL  -> geral (igual ao comportamento atual)
--   p_talhao_id = id  -> só lançamentos daquele talhão (categorias e itens do tooltip)
--
-- Também corrige o detalhe (itens) de categorias cujo serviço é compartilhado de
-- outra fazenda do mesmo dono: antes esses itens não apareciam.
--
-- A função antiga get_relatorio_por_categoria(prop, safra) continua com a MESMA
-- assinatura (usada no Dashboard, no hook useRelatorios e no Relatórios) e passa a
-- só chamar a nova com talhão NULL. Assim não há DROP/sobrecarga nem risco de cache
-- do PostgREST quebrar as telas que já usam a função antiga.

CREATE OR REPLACE FUNCTION public.get_relatorio_por_categoria_talhao(p_propriedade_id uuid, p_safra_id uuid, p_talhao_id uuid DEFAULT NULL)
 RETURNS TABLE(out_propriedade_id uuid, out_safra_id uuid, out_categoria text, total_lancamentos bigint, custo_total numeric, custo_medio numeric, itens json)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.propriedade_id, l.safra_id, sv.categoria::text,
    COUNT(DISTINCT l.id),
    SUM(l.custo_total),
    AVG(l.custo_total),
    (
      SELECT json_agg(
        json_build_object(
          'nome', ii.nome,
          'tipo_ref', ii.tipo_ref,
          'unidade', ii.unidade,
          'vezes', ii.vezes,
          'quantidade', ii.quantidade,
          'valor', ii.valor
        ) ORDER BY ii.valor DESC)
      FROM (
        SELECT
          COALESCE(pr.nome, mq.nome, sv2.nome, 'Item') as nome,
          li.tipo_ref::text as tipo_ref,
          CASE li.tipo_ref::text
            WHEN 'produto'         THEN pr.unidade_medida::text
            WHEN 'maquina'         THEN COALESCE(mq.unidade_calculo, 'hora')
            WHEN 'servico_simples' THEN sv2.unidade_medida::text
            WHEN 'abastecimento'   THEN 'litro'
            WHEN 'manutencao'      THEN 'unidade'
            ELSE NULL
          END as unidade,
          COUNT(*) as vezes,
          SUM(CASE WHEN li.tipo_ref::text = 'abastecimento' THEN li.litros ELSE li.quantidade END) as quantidade,
          SUM(li.custo_total) as valor
        FROM lancamentos_itens li
        JOIN lancamentos l2 ON l2.id = li.lancamento_id
        -- Categoria pelo serviço do PRÓPRIO lançamento (igual ao total da categoria).
        -- Antes exigia serviço cadastrado nesta fazenda; serviços compartilhados de
        -- outra fazenda do mesmo dono ficavam sem itens no detalhe/tooltip.
        JOIN servicos sv4 ON sv4.id = l2.servico_id
        LEFT JOIN produtos pr ON pr.id = li.produto_id
        LEFT JOIN maquinas mq ON mq.id = li.maquina_id
        LEFT JOIN servicos sv2 ON sv2.id = li.servico_ref_id
        WHERE sv4.categoria = sv.categoria
          AND l2.safra_id = p_safra_id AND l2.propriedade_id = p_propriedade_id
          AND (p_talhao_id IS NULL OR l2.talhao_id = p_talhao_id)
        GROUP BY
          COALESCE(pr.nome, mq.nome, sv2.nome, 'Item'),
          li.tipo_ref::text,
          CASE li.tipo_ref::text
            WHEN 'produto'         THEN pr.unidade_medida::text
            WHEN 'maquina'         THEN COALESCE(mq.unidade_calculo, 'hora')
            WHEN 'servico_simples' THEN sv2.unidade_medida::text
            WHEN 'abastecimento'   THEN 'litro'
            WHEN 'manutencao'      THEN 'unidade'
            ELSE NULL
          END
      ) ii
    )
  FROM lancamentos l
  JOIN servicos sv ON sv.id = l.servico_id
  WHERE l.propriedade_id = p_propriedade_id AND l.safra_id = p_safra_id
    AND (p_talhao_id IS NULL OR l.talhao_id = p_talhao_id)
  GROUP BY l.propriedade_id, l.safra_id, sv.categoria
  ORDER BY SUM(l.custo_total) DESC;
END;
$function$;

-- Mesmas permissões da função antiga: só usuário logado (e service_role).
REVOKE ALL ON FUNCTION public.get_relatorio_por_categoria_talhao(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_relatorio_por_categoria_talhao(uuid, uuid, uuid) TO authenticated, service_role;

-- Função antiga: mesma assinatura e retorno, agora delega para a nova (geral).
CREATE OR REPLACE FUNCTION public.get_relatorio_por_categoria(p_propriedade_id uuid, p_safra_id uuid)
 RETURNS TABLE(out_propriedade_id uuid, out_safra_id uuid, out_categoria text, total_lancamentos bigint, custo_total numeric, custo_medio numeric, itens json)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT * FROM public.get_relatorio_por_categoria_talhao(p_propriedade_id, p_safra_id, NULL);
END;
$function$;

NOTIFY pgrst, 'reload schema';
