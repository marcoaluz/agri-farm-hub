-- Impede o bug "registro invisível pra todo mundo" que já ocorreu duas vezes
-- neste projeto (contatos, tipos_combustivel): uma tela insere direto numa
-- tabela "compartilhada" sem preencher dono_id, o registro fica com dono_id
-- NULL e some das listagens (que sempre filtram por dono_id) até alguém
-- corrigir manualmente no banco.
--
-- fn_garantir_dono_id() é um trigger BEFORE INSERT genérico, reaproveitado em
-- todas as tabelas afetadas por esse padrão, que:
--   - preenche usuario_id com auth.uid() quando vier nulo;
--   - preenche dono_id resolvendo a partir de propriedade_id quando a tabela
--     tiver essa coluna (hoje só "contatos" tem);
--   - nas demais tabelas (sem propriedade_id), não há como resolver dono_id
--     a partir da própria linha — bloqueia o insert com uma mensagem clara
--     em vez de deixar a linha órfã.

CREATE OR REPLACE FUNCTION public.fn_garantir_dono_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono_resolvido uuid;
BEGIN
  IF NEW.usuario_id IS NULL THEN
    NEW.usuario_id := auth.uid();
  END IF;

  IF NEW.dono_id IS NULL THEN
    IF TG_TABLE_NAME = 'contatos' THEN
      SELECT pr.user_id INTO v_dono_resolvido
      FROM propriedades pr
      WHERE pr.id = NEW.propriedade_id;

      IF v_dono_resolvido IS NULL THEN
        RAISE EXCEPTION 'dono_id não pode ser nulo em %', TG_TABLE_NAME;
      END IF;

      NEW.dono_id := v_dono_resolvido;
    ELSE
      RAISE EXCEPTION 'dono_id não pode ser nulo em %', TG_TABLE_NAME;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.contatos;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.contatos
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();

DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.categorias_produto;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.categorias_produto
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();

DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.categorias_contato;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.categorias_contato
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();

DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.categorias_manutencao;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.categorias_manutencao
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();

DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.descricoes_manutencao;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.descricoes_manutencao
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();

DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.categorias_servico;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.categorias_servico
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();

DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.tipos_combustivel;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.tipos_combustivel
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();

DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.tipos_racao;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.tipos_racao
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();

DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.subcategorias_transacao;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.subcategorias_transacao
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();
