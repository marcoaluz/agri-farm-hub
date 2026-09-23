-- Corrige preenchimento de subcategoria em 3 triggers que geram lançamentos
-- financeiros automáticos, e ajusta a categoria gerada por fn_lote_para_financeiro
-- pra usar a categoria literal do produto (igual já era feito pro tipo_estoque
-- 'geral'), em vez de "baldes" fixos por regex nos tipos 'agricola'/'pecuario'.
--
-- Nenhuma assinatura muda (todas continuam RETURNS trigger, sem parâmetros) —
-- só o corpo, então não precisa DROP FUNCTION antes.

-- ═══ fn_abastecimento_para_financeiro — passa a preencher subcategoria = 'Combustível' ═══
CREATE OR REPLACE FUNCTION public.fn_abastecimento_para_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_propriedade_id UUID; v_maquina_nome TEXT; v_safra_id UUID; v_criado_por UUID;
BEGIN
  IF NEW.custo_total IS NULL OR NEW.custo_total <= 0 THEN RETURN NEW; END IF;
  SELECT propriedade_id, nome INTO v_propriedade_id, v_maquina_nome FROM maquinas WHERE id = NEW.maquina_id;
  IF v_propriedade_id IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_safra_id FROM safras WHERE propriedade_id = v_propriedade_id AND ativa = true LIMIT 1;
  SELECT usuario_id INTO v_criado_por FROM propriedades_usuarios
    WHERE propriedade_id = v_propriedade_id AND papel = 'proprietario' AND status = 'ativo' LIMIT 1;
  INSERT INTO transacoes (propriedade_id, safra_id, tipo, categoria, subcategoria, descricao, valor, data_vencimento, data_pagamento, status, origem, observacoes, criado_por)
  VALUES (v_propriedade_id, v_safra_id, 'despesa', 'combustivel', 'Combustível',
    'Abastecimento - ' || COALESCE(v_maquina_nome, 'Máquina') || COALESCE(' (' || NEW.combustivel_tipo || ')', ''),
    NEW.custo_total, NEW.data, NEW.data, 'pago',
    'abastecimento:' || NEW.id::text,
    NEW.quantidade_litros::text || ' L' || COALESCE(' @ ' || NEW.posto, ''), v_criado_por)
  ON CONFLICT (origem) WHERE origem IS NOT NULL AND origem <> 'manual' DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ═══ fn_manutencao_para_financeiro — passa a preencher subcategoria = 'Manutenção' ═══
CREATE OR REPLACE FUNCTION public.fn_manutencao_para_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_safra_id UUID;
BEGIN
  IF NEW.status <> 'realizada' OR NEW.custo IS NULL OR NEW.custo <= 0 THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'realizada' THEN RETURN NEW; END IF;
  SELECT id INTO v_safra_id FROM safras WHERE propriedade_id = NEW.propriedade_id AND ativa = true LIMIT 1;
  INSERT INTO transacoes (propriedade_id, safra_id, tipo, categoria, subcategoria, descricao, valor, data_vencimento, data_pagamento, status, origem, criado_por)
  VALUES (NEW.propriedade_id, v_safra_id, 'despesa', 'manutencao', 'Manutenção', initcap(NEW.tipo) || ' - ' || NEW.descricao, NEW.custo,
    COALESCE(NEW.data_realizada, CURRENT_DATE), COALESCE(NEW.data_realizada, CURRENT_DATE), 'pago',
    'maquina_manutencao:' || NEW.id::text, NEW.usuario_id)
  ON CONFLICT (origem) WHERE origem IS NOT NULL AND origem <> 'manual' DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ═══ fn_lote_para_financeiro — agricola/pecuario passam a usar a categoria literal do produto ═══
-- (subcategoria não muda: continua 'Pecuária'/'Geral'/'Insumos' por tipo_estoque)
CREATE OR REPLACE FUNCTION public.fn_lote_para_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valor_total numeric;
  v_produto_nome text;
  v_produto_categoria text;
  v_produto_tipo_estoque text;
  v_categoria text;
  v_subcategoria text;
  v_status transacao_status;
  v_data_pagamento date;
  v_origem text;
  v_safra_id uuid;
BEGIN
  v_origem := 'lote:' || COALESCE(NEW.id, OLD.id)::text;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM transacoes WHERE origem = v_origem;
    RETURN OLD;
  END IF;

  IF NEW.tipo_entrada = 'producao_propria' THEN
    IF TG_OP = 'UPDATE' AND OLD.tipo_entrada = 'compra' THEN
      DELETE FROM transacoes WHERE origem = v_origem;
    END IF;
    RETURN NEW;
  END IF;

  v_valor_total := COALESCE(NEW.custo_unitario, 0) * COALESCE(NEW.quantidade_original, 0);

  IF v_valor_total <= 0 THEN
    DELETE FROM transacoes WHERE origem = v_origem;
    RETURN NEW;
  END IF;

  SELECT nome, COALESCE(categoria, ''), COALESCE(tipo_estoque, 'agricola')
    INTO v_produto_nome, v_produto_categoria, v_produto_tipo_estoque
  FROM produtos WHERE id = NEW.produto_id;

  -- Subcategoria: reflete direto o tipo de estoque do produto.
  -- Categoria: usa sempre o nome exato da categoria escolhida no cadastro
  -- do produto (agrícola, pecuário ou geral), sem generalizar em baldes fixos.
  IF v_produto_tipo_estoque = 'pecuario' THEN
    v_subcategoria := 'Pecuária';
    v_categoria := COALESCE(NULLIF(v_produto_categoria, ''), 'insumos');
  ELSIF v_produto_tipo_estoque = 'geral' THEN
    v_subcategoria := 'Geral';
    v_categoria := COALESCE(NULLIF(v_produto_categoria, ''), 'insumos');
  ELSE
    v_subcategoria := 'Insumos';
    v_categoria := COALESCE(NULLIF(v_produto_categoria, ''), 'insumos');
  END IF;

  v_status := COALESCE(NEW.status_pagamento, 'pago')::transacao_status;
  v_data_pagamento := CASE
    WHEN NEW.status_pagamento = 'pago' OR NEW.status_pagamento IS NULL
      THEN NEW.data_entrada
    ELSE NULL
  END;

  SELECT id INTO v_safra_id
  FROM safras
  WHERE propriedade_id = NEW.propriedade_id AND ativa = true
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO transacoes (
      propriedade_id, safra_id, tipo, categoria, subcategoria, descricao, valor,
      data_vencimento, data_pagamento, status,
      origem, numero_nf, fornecedor_cliente, criado_por
    ) VALUES (
      NEW.propriedade_id, v_safra_id, 'despesa', v_categoria, v_subcategoria,
      'Entrada estoque: ' || COALESCE(v_produto_nome, 'produto')
        || ' (' || NEW.quantidade_original::text || ')',
      v_valor_total,
      COALESCE(NEW.data_vencimento, NEW.data_entrada),
      v_data_pagamento,
      v_status,
      v_origem,
      NEW.nota_fiscal,
      NEW.fornecedor,
      auth.uid()
    )
    ON CONFLICT (origem) WHERE origem IS NOT NULL AND origem <> 'manual' DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE transacoes
    SET valor = v_valor_total,
        safra_id = COALESCE(safra_id, v_safra_id),
        numero_nf = NEW.nota_fiscal,
        fornecedor_cliente = NEW.fornecedor,
        status = v_status,
        data_vencimento = COALESCE(NEW.data_vencimento, NEW.data_entrada),
        data_pagamento = v_data_pagamento,
        categoria = v_categoria,
        subcategoria = v_subcategoria,
        descricao = 'Entrada estoque: ' || COALESCE(v_produto_nome, 'produto')
                    || ' (' || NEW.quantidade_original::text || ')',
        updated_at = now()
    WHERE origem = v_origem;

    IF NOT FOUND THEN
      INSERT INTO transacoes (
        propriedade_id, safra_id, tipo, categoria, subcategoria, descricao, valor,
        data_vencimento, data_pagamento, status,
        origem, numero_nf, fornecedor_cliente, criado_por
      ) VALUES (
        NEW.propriedade_id, v_safra_id, 'despesa', v_categoria, v_subcategoria,
        'Entrada estoque: ' || COALESCE(v_produto_nome, 'produto')
          || ' (' || NEW.quantidade_original::text || ')',
        v_valor_total,
        COALESCE(NEW.data_vencimento, NEW.data_entrada),
        v_data_pagamento,
        v_status,
        v_origem,
        NEW.nota_fiscal,
        NEW.fornecedor,
        auth.uid()
      )
      ON CONFLICT (origem) WHERE origem IS NOT NULL AND origem <> 'manual' DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
