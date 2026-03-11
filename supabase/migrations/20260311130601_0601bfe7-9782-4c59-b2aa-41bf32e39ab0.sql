
-- RPC: get_dashboard_consolidado
-- Returns per-property KPIs. When p_propriedade_id is null, returns all properties.
CREATE OR REPLACE FUNCTION public.get_dashboard_consolidado(
  p_propriedade_id uuid DEFAULT NULL,
  p_safra_id uuid DEFAULT NULL
)
RETURNS TABLE(
  propriedade_id uuid,
  propriedade_nome text,
  total_lancamentos bigint,
  custo_total numeric,
  area_operada_ha numeric,
  receitas_pagas numeric,
  despesas_pagas numeric,
  saldo numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS propriedade_id,
    p.nome::text AS propriedade_nome,
    COALESCE(l.cnt, 0)::bigint AS total_lancamentos,
    COALESCE(l.custo, 0)::numeric AS custo_total,
    COALESCE(l.area_ha, 0)::numeric AS area_operada_ha,
    COALESCE(t.receitas, 0)::numeric AS receitas_pagas,
    COALESCE(t.despesas, 0)::numeric AS despesas_pagas,
    (COALESCE(t.receitas, 0) - COALESCE(t.despesas, 0))::numeric AS saldo
  FROM propriedades p
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::bigint AS cnt,
      COALESCE(SUM(la.custo_total), 0) AS custo,
      COALESCE(SUM(DISTINCT CASE WHEN la.talhao_id IS NOT NULL THEN (
        SELECT COALESCE(ta.area_ha, 0) FROM talhoes ta WHERE ta.id = la.talhao_id
      ) ELSE 0 END), 0) AS area_ha
    FROM lancamentos la
    WHERE la.propriedade_id = p.id
      AND (p_safra_id IS NULL OR la.safra_id = p_safra_id)
  ) l ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(CASE WHEN tr.tipo = 'receita' AND tr.status = 'pago' THEN tr.valor ELSE 0 END), 0) AS receitas,
      COALESCE(SUM(CASE WHEN tr.tipo = 'despesa' AND tr.status = 'pago' THEN tr.valor ELSE 0 END), 0) AS despesas
    FROM transacoes tr
    WHERE tr.propriedade_id = p.id
      AND (p_safra_id IS NULL OR tr.safra_id = p_safra_id)
  ) t ON TRUE
  WHERE p.ativo = true
    AND (p_propriedade_id IS NULL OR p.id = p_propriedade_id)
  ORDER BY p.nome;
END;
$$;

-- RPC: get_estoque_producao
-- Returns production stock grouped by culture (and property if consolidated)
CREATE OR REPLACE FUNCTION public.get_estoque_producao(
  p_propriedade_id uuid DEFAULT NULL
)
RETURNS TABLE(
  propriedade_id uuid,
  propriedade_nome text,
  cultura_id uuid,
  cultura_nome text,
  unidade_label text,
  icone text,
  total_entradas numeric,
  total_saidas numeric,
  saldo_disponivel numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.propriedade_id,
    prop.nome::text AS propriedade_nome,
    pr.cultura_id,
    cc.nome_exibicao::text AS cultura_nome,
    COALESCE(cc.unidade_label, 'un')::text AS unidade_label,
    COALESCE(cc.icone, '')::text AS icone,
    COALESCE(SUM(pr.quantidade_colhida), 0)::numeric AS total_entradas,
    COALESCE(SUM(pr.quantidade_vendida), 0)::numeric AS total_saidas,
    COALESCE(SUM(pr.quantidade_disponivel), 0)::numeric AS saldo_disponivel
  FROM producoes pr
  JOIN propriedades prop ON prop.id = pr.propriedade_id
  LEFT JOIN culturas_config cc ON cc.id = pr.cultura_id
  WHERE (p_propriedade_id IS NULL OR pr.propriedade_id = p_propriedade_id)
  GROUP BY pr.propriedade_id, prop.nome, pr.cultura_id, cc.nome_exibicao, cc.unidade_label, cc.icone
  ORDER BY prop.nome, cc.nome_exibicao;
END;
$$;
