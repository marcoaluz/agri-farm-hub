-- Corrige vazamento cross-tenant em categorias_transacao: a policy de SELECT
-- estava com qual = true (qualquer usuário autenticado via QUALQUER
-- propriedade/conta), e o dropdown de Categoria em Nova Transação buscava a
-- tabela direto, sem RPC nem filtro de dono. Mesmo padrão já usado em
-- listar_subcategorias_transacao/listar_contatos_usuario.

-- 1. Adiciona dono_id e faz backfill (dono = quem criou, para os registros
-- existentes — é a mesma suposição que criar_categoria_transacao já fazia
-- implicitamente ao gravar só usuario_id).
ALTER TABLE public.categorias_transacao ADD COLUMN IF NOT EXISTS dono_id uuid;
UPDATE public.categorias_transacao SET dono_id = usuario_id WHERE dono_id IS NULL;

-- 2. Trigger BEFORE INSERT — reaproveita fn_garantir_dono_id() (já criada
-- para contatos/categorias_produto/etc). categorias_transacao não tem
-- propriedade_id, então cai no mesmo ramo das outras 8 tabelas: se dono_id
-- vier nulo, bloqueia em vez de deixar a linha órfã. Como
-- criar_categoria_transacao (alterada abaixo) sempre preenche dono_id
-- explicitamente, isso nunca deve disparar em uso normal.
DROP TRIGGER IF EXISTS trg_garantir_dono_id ON public.categorias_transacao;
CREATE TRIGGER trg_garantir_dono_id
  BEFORE INSERT ON public.categorias_transacao
  FOR EACH ROW EXECUTE FUNCTION public.fn_garantir_dono_id();

-- 3. RPC de listagem escopada por propriedade — mesmo padrão de
-- listar_subcategorias_transacao: valida acesso à propriedade, resolve o
-- dono real via propriedades.user_id, filtra só por esse dono.
CREATE OR REPLACE FUNCTION public.listar_categorias_transacao(p_propriedade_id uuid)
 RETURNS TABLE(id uuid, nome_exibicao text, valor text, usuario_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono_id uuid;
BEGIN
  IF NOT (
    is_admin()
    OR EXISTS (SELECT 1 FROM propriedades pr WHERE pr.id = p_propriedade_id AND pr.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM propriedades_usuarios pu WHERE pu.propriedade_id = p_propriedade_id AND pu.usuario_id = auth.uid() AND pu.status = 'ativo')
  ) THEN
    RAISE EXCEPTION 'Acesso negado a esta propriedade';
  END IF;

  SELECT pr.user_id INTO v_dono_id FROM propriedades pr WHERE pr.id = p_propriedade_id;

  RETURN QUERY
  SELECT c.id, c.nome_exibicao, c.valor, c.usuario_id
  FROM categorias_transacao c
  WHERE c.ativo = true AND c.dono_id = v_dono_id
  ORDER BY c.nome_exibicao;
END;
$function$;

-- 4. Corrige a policy de SELECT — deixa de valer para qualquer autenticado
-- e passa a exigir ser dono ou ter vínculo ativo com uma propriedade daquele
-- dono (mesmo padrão das outras tabelas "compartilhadas" do projeto).
DROP POLICY IF EXISTS categorias_transacao_select ON public.categorias_transacao;
CREATE POLICY categorias_transacao_select ON public.categorias_transacao
  FOR SELECT
  USING (
    is_admin()
    OR dono_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM propriedades_usuarios pu
      JOIN propriedades p ON p.id = pu.propriedade_id
      WHERE pu.usuario_id = auth.uid() AND pu.status = 'ativo' AND p.user_id = categorias_transacao.dono_id
    )
  );

-- 5. criar_categoria_transacao passa a receber p_propriedade_id e preencher
-- dono_id a partir dela (não só usuario_id). Assinatura muda (adiciona um
-- parâmetro) — DROP explícito pra não deixar duas sobrecargas coexistindo
-- (mesmo problema de ambiguidade corrigido hoje em registrar_venda_producao).
-- Também escopa a checagem de "categoria já existe" por dono_id: antes ela
-- olhava a tabela inteira (valor tem UNIQUE global), então o segundo dono a
-- tentar criar uma categoria com o mesmo nome caía silenciosamente na linha
-- do PRIMEIRO dono, sem preencher o próprio dono_id — a categoria "criada"
-- nunca aparecia pra ele.
DROP FUNCTION IF EXISTS public.criar_categoria_transacao(text);

CREATE OR REPLACE FUNCTION public.criar_categoria_transacao(p_nome_exibicao text, p_propriedade_id uuid)
 RETURNS categorias_transacao
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valor text;
  v_dono_id uuid;
  v_existente categorias_transacao;
  v_nova categorias_transacao;
BEGIN
  IF p_nome_exibicao IS NULL OR trim(p_nome_exibicao) = '' THEN
    RAISE EXCEPTION 'Nome da categoria é obrigatório';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    is_admin()
    OR EXISTS (SELECT 1 FROM propriedades pr WHERE pr.id = p_propriedade_id AND pr.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM propriedades_usuarios pu WHERE pu.propriedade_id = p_propriedade_id AND pu.usuario_id = auth.uid() AND pu.status = 'ativo')
  ) THEN
    RAISE EXCEPTION 'Acesso negado a esta propriedade';
  END IF;

  SELECT pr.user_id INTO v_dono_id FROM propriedades pr WHERE pr.id = p_propriedade_id;

  v_valor := lower(trim(p_nome_exibicao));
  v_valor := translate(v_valor, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  v_valor := regexp_replace(v_valor, '[^a-z0-9]+', '_', 'g');
  v_valor := trim(both '_' from v_valor);

  SELECT * INTO v_existente FROM categorias_transacao WHERE valor = v_valor AND dono_id = v_dono_id;
  IF FOUND THEN
    IF NOT v_existente.ativo THEN
      UPDATE categorias_transacao SET ativo = true WHERE id = v_existente.id RETURNING * INTO v_existente;
    END IF;
    RETURN v_existente;
  END IF;

  INSERT INTO categorias_transacao (nome_exibicao, valor, usuario_id, dono_id)
  VALUES (trim(p_nome_exibicao), v_valor, auth.uid(), v_dono_id)
  RETURNING * INTO v_nova;

  RETURN v_nova;
END;
$function$;
