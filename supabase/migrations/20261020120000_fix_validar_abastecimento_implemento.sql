-- Correção de 20261019120000_implemento_consome_combustivel.sql.
--
-- fn_validar_abastecimento_implemento é usada por triggers em duas tabelas
-- (abastecimentos e lancamentos_itens), mas lia NEW.tipo_ref direto. A
-- tabela abastecimentos não tem essa coluna, então TODO insert em
-- abastecimentos falhava com: record "new" has no field "tipo_ref"
-- (e, como o frontend ignorava esse erro, o Livre ficava sem financeiro).
--
-- Agora o campo é lido via to_jsonb(NEW), que funciona para qualquer tabela.
-- Assinatura e retorno são os mesmos (trigger sem argumentos), então
-- CREATE OR REPLACE basta — os triggers existentes passam a usar a versão nova.

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
  IF TG_TABLE_NAME = 'lancamentos_itens'
     AND (to_jsonb(NEW) ->> 'tipo_ref') IS DISTINCT FROM 'abastecimento' THEN
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
