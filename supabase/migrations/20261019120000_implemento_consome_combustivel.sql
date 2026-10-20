-- Abastecimento de implementos.
--
-- Implementos já são linhas de `maquinas` (categoria_equipamento = 'implemento'),
-- então abastecimentos/lancamentos_itens/transacoes já os referenciam via
-- maquina_id e o trigger fn_abastecimento_para_lancamento (financeiro só na
-- modalidade Livre, produto_id IS NULL) vale igual. Esta migration só:
--   1. adiciona o indicador "Consome combustível?" (default false — nenhum
--      implemento antigo passa a ser abastecível automaticamente);
--   2. bloqueia no banco o abastecimento de implemento sem esse indicador.
--
-- Não altera dados existentes nem o comportamento de máquinas.

ALTER TABLE public.maquinas
  ADD COLUMN IF NOT EXISTS consome_combustivel boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.maquinas.consome_combustivel IS
  'Só para categoria_equipamento = implemento: habilita o implemento para abastecimento. Ignorado para máquinas.';

CREATE OR REPLACE FUNCTION public.fn_validar_abastecimento_implemento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_categoria text;
  v_consome boolean;
  v_nome text;
BEGIN
  -- lancamentos_itens: só interessa o item de abastecimento
  IF TG_TABLE_NAME = 'lancamentos_itens' AND NEW.tipo_ref IS DISTINCT FROM 'abastecimento' THEN
    RETURN NEW;
  END IF;

  IF NEW.maquina_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT categoria_equipamento, consome_combustivel, nome
    INTO v_categoria, v_consome, v_nome
    FROM maquinas WHERE id = NEW.maquina_id;

  IF v_categoria = 'implemento' AND NOT COALESCE(v_consome, false) THEN
    RAISE EXCEPTION 'O implemento "%" não está marcado como "Consome combustível?" e não pode ser abastecido.', v_nome
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_abastecimento_implemento ON public.abastecimentos;
CREATE TRIGGER trg_validar_abastecimento_implemento
  BEFORE INSERT OR UPDATE OF maquina_id ON public.abastecimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_abastecimento_implemento();

DROP TRIGGER IF EXISTS trg_validar_abastecimento_implemento ON public.lancamentos_itens;
CREATE TRIGGER trg_validar_abastecimento_implemento
  BEFORE INSERT OR UPDATE OF maquina_id, tipo_ref ON public.lancamentos_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_abastecimento_implemento();

-- Faz o PostgREST enxergar a coluna nova imediatamente (evita
-- "could not find 'consome_combustivel' column ... in the schema cache").
NOTIFY pgrst, 'reload schema';
