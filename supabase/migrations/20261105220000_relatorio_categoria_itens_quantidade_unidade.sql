-- Relatórios > Operacional > gráfico "Custo por Categoria":
-- o tooltip mostrava "Diária 3x = R$ 3.950,00" (quantas VEZES o item apareceu).
-- Agora cada item de `itens` também traz a quantidade total e a unidade de medida,
-- para o front mostrar "Diária 27(d) = R$ 3.950,00".
--
-- Mudança aditiva: assinatura e tipo de retorno idênticos (itens continua json),
-- então CREATE OR REPLACE é suficiente (não cria sobrecarga). As chaves antigas
-- (nome, vezes, valor) continuam existindo, então o front antigo segue funcionando.
--
-- Chaves novas em cada item: tipo_ref, unidade, quantidade.
-- Regra de quantidade/unidade (mesma lógica do get_relatorio_custos_detalhado_v3):
--   produto          -> quantidade, unidade do produto
--   maquina          -> quantidade, unidade_calculo da máquina (padrão 'hora')
--   servico_simples  -> quantidade, unidade do serviço (ex.: 'diaria')
--   abastecimento    -> litros, 'litro'
--   manutencao       -> quantidade, 'unidade'
-- O agrupamento passa a ser por nome + tipo_ref + unidade, para nunca somar
-- unidades diferentes na mesma linha (ex.: litros de abastecimento com qtd de produto).

CREATE OR REPLACE FUNCTION public.get_relatorio_por_categoria(p_propriedade_id uuid, p_safra_id uuid)
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
      -- Por item dentro da categoria: quantas VEZES ele apareceu, a quantidade
      -- total (na unidade do item) e o valor total gasto com ele.
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
        LEFT JOIN produtos pr ON pr.id = li.produto_id
        LEFT JOIN maquinas mq ON mq.id = li.maquina_id
        LEFT JOIN servicos sv2 ON sv2.id = li.servico_ref_id
        WHERE l2.servico_id IN (SELECT sv3.id FROM servicos sv3 WHERE sv3.categoria = sv.categoria AND sv3.propriedade_id = p_propriedade_id)
          AND l2.safra_id = p_safra_id AND l2.propriedade_id = p_propriedade_id
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
  GROUP BY l.propriedade_id, l.safra_id, sv.categoria
  ORDER BY SUM(l.custo_total) DESC;
END;
$function$;
