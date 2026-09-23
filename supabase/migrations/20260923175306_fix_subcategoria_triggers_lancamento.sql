-- Correção mínima: preenche subcategoria no INSERT INTO transacoes das duas
-- funções que REALMENTE estão conectadas por trigger em produção —
-- fn_abastecimento_para_lancamento (trg_abastecimento_para_lancamento em
-- abastecimentos) e fn_manutencao_para_lancamento (trg_manutencao_para_lancamento
-- em maquina_manutencoes). fn_abastecimento_para_financeiro e
-- fn_manutencao_para_financeiro não têm nenhum trigger associado (código morto)
-- e não são tocadas aqui.
--
-- Nada além da coluna/valor de subcategoria muda: mesma condição de
-- produto_id IS NULL/NOT NULL, mesma lógica de DELETE, mesmo ON CONFLICT,
-- mesma criação/atualização de lancamentos e lancamentos_itens.

CREATE OR REPLACE FUNCTION public.fn_abastecimento_para_lancamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_propriedade_id uuid;
  v_maquina_nome text;
  v_servico_id uuid;
  v_safra_id uuid;
  v_lancamento_id uuid;
  v_origem text;
  v_descricao text;
  v_fornecedor text;
BEGIN
  SELECT nome INTO v_maquina_nome FROM maquinas WHERE id = COALESCE(NEW.maquina_id, OLD.maquina_id);

  -- Propriedade certa: a que está gravada na própria linha (a que está
  -- sendo operada agora), com fallback pra da máquina só pra dado
  -- antigo que ainda não tenha essa coluna preenchida.
  v_propriedade_id := COALESCE(
    NEW.propriedade_id, OLD.propriedade_id,
    (SELECT m.propriedade_id FROM maquinas m WHERE m.id = COALESCE(NEW.maquina_id, OLD.maquina_id))
  );

  v_origem := 'abastecimento:' || COALESCE(NEW.id, OLD.id)::text;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM transacoes WHERE origem = v_origem;
    IF OLD.lancamento_id IS NULL THEN
      DELETE FROM lancamentos WHERE abastecimento_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  v_descricao := 'Abastecimento — ' || COALESCE(v_maquina_nome, 'Máquina') || ': ' ||
    NEW.quantidade_litros::text || 'L ' || COALESCE(NEW.combustivel_tipo, '') || COALESCE(' - ' || NEW.posto, '');
  SELECT nome INTO v_fornecedor FROM contatos WHERE id = NEW.contato_id;
  SELECT id INTO v_safra_id FROM safras WHERE propriedade_id = v_propriedade_id AND ativa = true LIMIT 1;

  IF COALESCE(NEW.custo_total, 0) <= 0 THEN
    IF NEW.lancamento_id IS NULL THEN
      DELETE FROM lancamentos WHERE abastecimento_id = NEW.id;
    END IF;
    DELETE FROM transacoes WHERE origem = v_origem;
    RETURN NEW;
  END IF;

  IF NEW.produto_id IS NULL THEN
    IF NEW.lancamento_id IS NULL THEN
      DELETE FROM lancamentos WHERE abastecimento_id = NEW.id;
    END IF;

    IF TG_OP = 'INSERT' THEN
      INSERT INTO transacoes (
        propriedade_id, safra_id, tipo, categoria, subcategoria, descricao, valor,
        data_vencimento, data_pagamento, status, origem, criado_por, contato_id, fornecedor_cliente
      ) VALUES (
        v_propriedade_id, v_safra_id, 'despesa', 'abastecimento', 'Combustível', v_descricao,
        NEW.custo_total, NEW.data, NEW.data, 'pago', v_origem, COALESCE(auth.uid(), NEW.criado_por),
        NEW.contato_id, v_fornecedor
      ) ON CONFLICT (origem) WHERE origem IS NOT NULL AND origem <> 'manual' DO NOTHING;
    ELSIF TG_OP = 'UPDATE' THEN
      UPDATE transacoes SET valor = NEW.custo_total, descricao = v_descricao, propriedade_id = v_propriedade_id,
        contato_id = NEW.contato_id, fornecedor_cliente = v_fornecedor, updated_at = now()
      WHERE origem = v_origem;
    END IF;
    RETURN NEW;
  END IF;

  DELETE FROM transacoes WHERE origem = v_origem;
  IF NEW.lancamento_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_servico_id := get_or_create_servico_abastecimento(v_propriedade_id, COALESCE(v_maquina_nome, 'Máquina'));
  SELECT id INTO v_lancamento_id FROM lancamentos WHERE abastecimento_id = NEW.id;

  IF v_lancamento_id IS NULL THEN
    INSERT INTO lancamentos (propriedade_id, safra_id, servico_id, data_execucao, custo_total, observacoes, abastecimento_id, criado_por)
    VALUES (v_propriedade_id, v_safra_id, v_servico_id, NEW.data, NEW.custo_total, v_descricao, NEW.id, auth.uid())
    RETURNING id INTO v_lancamento_id;

    INSERT INTO lancamentos_itens (lancamento_id, tipo_ref, maquina_id, quantidade, litros, custo_total)
    VALUES (v_lancamento_id, 'abastecimento', NEW.maquina_id, NEW.quantidade_litros, NEW.quantidade_litros, NEW.custo_total);
  ELSE
    UPDATE lancamentos SET data_execucao = NEW.data, custo_total = NEW.custo_total, observacoes = v_descricao, updated_at = now()
    WHERE id = v_lancamento_id;
    UPDATE lancamentos_itens SET custo_total = NEW.custo_total, litros = NEW.quantidade_litros, quantidade = NEW.quantidade_litros WHERE lancamento_id = v_lancamento_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_manutencao_para_lancamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_maquina_nome text;
  v_servico_id uuid;
  v_safra_id uuid;
  v_lancamento_id uuid;
  v_origem text;
  v_descricao text;
  v_fornecedor text;
BEGIN
  v_origem := 'manutencao:' || COALESCE(NEW.id, OLD.id)::text;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM transacoes WHERE origem = v_origem;
    IF OLD.lancamento_id IS NULL THEN
      DELETE FROM lancamentos WHERE manutencao_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.status <> 'realizada' OR NEW.data_realizada IS NULL OR COALESCE(NEW.custo, 0) <= 0 THEN
    IF NEW.lancamento_id IS NULL THEN
      DELETE FROM lancamentos WHERE manutencao_id = NEW.id;
    END IF;
    DELETE FROM transacoes WHERE origem = v_origem;
    RETURN NEW;
  END IF;

  SELECT nome INTO v_maquina_nome FROM maquinas WHERE id = NEW.maquina_id;
  v_descricao := 'Manutenção — ' || COALESCE(v_maquina_nome, 'Máquina') || COALESCE(': ' || NULLIF(NEW.descricao, ''), '');
  SELECT nome INTO v_fornecedor FROM contatos WHERE id = NEW.contato_id;
  SELECT id INTO v_safra_id FROM safras WHERE propriedade_id = NEW.propriedade_id AND ativa = true LIMIT 1;

  -- Caso 1: NÃO veio do estoque ("livre") -> Financeiro. Roda sempre.
  IF NEW.produto_id IS NULL THEN
    IF NEW.lancamento_id IS NULL THEN
      DELETE FROM lancamentos WHERE manutencao_id = NEW.id;
    END IF;

    INSERT INTO transacoes (
      propriedade_id, safra_id, tipo, categoria, subcategoria, descricao, valor,
      data_vencimento, data_pagamento, status, origem, criado_por, contato_id, fornecedor_cliente
    ) VALUES (
      NEW.propriedade_id, v_safra_id, 'despesa', 'manutencao', 'Manutenção', v_descricao,
      NEW.custo, NEW.data_realizada, NEW.data_realizada, 'pago', v_origem, auth.uid(),
      NEW.contato_id, v_fornecedor
    )
    ON CONFLICT (origem) WHERE origem IS NOT NULL AND origem <> 'manual'
    DO UPDATE SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao,
                  contato_id = EXCLUDED.contato_id, fornecedor_cliente = EXCLUDED.fornecedor_cliente,
                  data_vencimento = EXCLUDED.data_vencimento, data_pagamento = EXCLUDED.data_pagamento,
                  updated_at = now();
    RETURN NEW;
  END IF;

  -- Caso 2: veio do estoque -> Lançamento. Não duplica se já veio de um.
  DELETE FROM transacoes WHERE origem = v_origem;
  IF NEW.lancamento_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_servico_id := get_or_create_servico_manutencao(NEW.propriedade_id, COALESCE(v_maquina_nome, 'Máquina'));
  SELECT id INTO v_lancamento_id FROM lancamentos WHERE manutencao_id = NEW.id;

  IF v_lancamento_id IS NULL THEN
    INSERT INTO lancamentos (propriedade_id, safra_id, servico_id, data_execucao, custo_total, observacoes, manutencao_id, criado_por)
    VALUES (NEW.propriedade_id, v_safra_id, v_servico_id, NEW.data_realizada, NEW.custo, v_descricao, NEW.id, auth.uid())
    RETURNING id INTO v_lancamento_id;

    INSERT INTO lancamentos_itens (lancamento_id, tipo_ref, maquina_id, quantidade, custo_total)
    VALUES (v_lancamento_id, 'maquina', NEW.maquina_id, 1, NEW.custo);
  ELSE
    UPDATE lancamentos SET data_execucao = NEW.data_realizada, custo_total = NEW.custo, observacoes = v_descricao, updated_at = now()
    WHERE id = v_lancamento_id;
    UPDATE lancamentos_itens SET custo_total = NEW.custo WHERE lancamento_id = v_lancamento_id;
  END IF;

  RETURN NEW;
END;
$function$;
