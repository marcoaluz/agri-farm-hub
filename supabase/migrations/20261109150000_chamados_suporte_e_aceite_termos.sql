-- ════════════════════════════════════════════════════════════════════
-- Chamados de suporte (por PROPRIEDADE, não por safra) + aceite de termos
--
-- Regras combinadas com o Marco (09/11/2026):
--  • Todos os membros ativos da propriedade (e o dono) veem e acompanham todos
--    os chamados dela. O admin do sistema vê todos de todas as propriedades.
--  • Quem responde como suporte é só o admin (is_admin()). Os membros escrevem
--    na conversa do próprio chamado.
--  • Assunto, tipo (dúvida/erro/sugestão/outro), prioridade (baixa/normal/alta)
--    e status (pendente → em andamento → finalizado). Só o admin muda status,
--    tipo e prioridade depois de aberto.
--  • Histórico: toda mensagem fica gravada e não pode ser editada; mudanças de
--    status viram mensagens "de sistema" na mesma conversa.
--  • Membro escrevendo num chamado finalizado reabre (volta para pendente).
--    Primeira resposta do suporte num chamado pendente → em andamento.
--  • Avisos: sino + push (via notificacoes) para o outro lado; e-mail pela
--    edge function enviar-chamado-email (Resend).
-- ════════════════════════════════════════════════════════════════════

DO $$ BEGIN CREATE TYPE public.chamado_status AS ENUM ('pendente', 'em_andamento', 'finalizado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.chamado_tipo AS ENUM ('duvida', 'erro', 'sugestao', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.chamado_prioridade AS ENUM ('baixa', 'normal', 'alta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tabelas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chamados (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  propriedade_id      uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  criado_por          uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  assunto             text NOT NULL CHECK (char_length(btrim(assunto)) BETWEEN 3 AND 150),
  tipo                public.chamado_tipo NOT NULL DEFAULT 'duvida',
  prioridade          public.chamado_prioridade NOT NULL DEFAULT 'normal',
  status              public.chamado_status NOT NULL DEFAULT 'pendente',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  ultima_atividade_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em       timestamptz,
  finalizado_por      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_chamados_prop_status ON public.chamados (propriedade_id, status);
CREATE INDEX IF NOT EXISTS idx_chamados_atividade ON public.chamados (ultima_atividade_em DESC);

CREATE TABLE IF NOT EXISTS public.chamado_mensagens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id  uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  autor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  do_suporte  boolean NOT NULL DEFAULT false,
  sistema     boolean NOT NULL DEFAULT false,
  texto       text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 5000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chamado_mensagens_chamado ON public.chamado_mensagens (chamado_id, created_at);

CREATE TABLE IF NOT EXISTS public.chamado_anexos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id     uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  mensagem_id    uuid REFERENCES public.chamado_mensagens(id) ON DELETE SET NULL,
  propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  storage_path   text NOT NULL UNIQUE,
  nome_arquivo   text NOT NULL,
  mime_type      text,
  tamanho_bytes  bigint CHECK (tamanho_bytes IS NULL OR tamanho_bytes <= 10485760),
  enviado_por    uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chamado_anexos_chamado ON public.chamado_anexos (chamado_id);

-- Aceite dos Termos de Uso / Política de Privacidade (histórico, nunca editado)
CREATE TABLE IF NOT EXISTS public.termos_aceites (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  versao_termos       text NOT NULL,
  versao_privacidade  text NOT NULL,
  aceito_em           timestamptz NOT NULL DEFAULT now(),
  user_agent          text
);
CREATE INDEX IF NOT EXISTS idx_termos_aceites_usuario ON public.termos_aceites (usuario_id, versao_termos, versao_privacidade);

-- ── Visibilidade ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pode_ver_chamado(p_chamado_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = p_chamado_id AND c.propriedade_id = ANY (public.get_prop_ids_usuario())
  );
$$;

-- ── Triggers de chamados ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_chamados_antes_inserir()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.criado_por := auth.uid(); END IF;
  NEW.status := 'pendente';
  NEW.created_at := now(); NEW.updated_at := now(); NEW.ultima_atividade_em := now();
  NEW.finalizado_em := NULL; NEW.finalizado_por := NULL;
  NEW.assunto := btrim(NEW.assunto);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_chamados_antes_inserir ON public.chamados;
CREATE TRIGGER trg_chamados_antes_inserir BEFORE INSERT ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.fn_chamados_antes_inserir();

CREATE OR REPLACE FUNCTION public.fn_chamados_antes_atualizar()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  -- Dados de abertura não mudam
  NEW.id := OLD.id; NEW.numero := OLD.numero; NEW.propriedade_id := OLD.propriedade_id;
  NEW.criado_por := OLD.criado_por; NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'finalizado' THEN
      NEW.finalizado_em := now(); NEW.finalizado_por := auth.uid();
    ELSE
      NEW.finalizado_em := NULL; NEW.finalizado_por := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_chamados_antes_atualizar ON public.chamados;
CREATE TRIGGER trg_chamados_antes_atualizar BEFORE UPDATE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.fn_chamados_antes_atualizar();

CREATE OR REPLACE FUNCTION public.chamado_status_label(s public.chamado_status)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s WHEN 'pendente' THEN 'Pendente' WHEN 'em_andamento' THEN 'Em andamento' ELSE 'Finalizado' END;
$$;

-- Mudança de status vira mensagem de sistema na conversa (histórico)
CREATE OR REPLACE FUNCTION public.fn_chamados_status_mudou()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_texto text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_texto := CASE
      WHEN OLD.status = 'finalizado' AND NOT public.is_admin() THEN 'Chamado reaberto: ' || public.chamado_status_label(NEW.status)
      ELSE 'Status alterado: ' || public.chamado_status_label(OLD.status) || ' → ' || public.chamado_status_label(NEW.status)
    END;
    INSERT INTO public.chamado_mensagens (chamado_id, autor_id, do_suporte, sistema, texto)
    VALUES (NEW.id, auth.uid(), public.is_admin(), true, v_texto);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_chamados_status_mudou ON public.chamados;
CREATE TRIGGER trg_chamados_status_mudou AFTER UPDATE OF status ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.fn_chamados_status_mudou();

-- ── Triggers de mensagens ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_chamado_mensagens_antes_inserir()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  -- Inserção direta (pela tela/RPC): autor, papel e "sistema" nunca vêm do cliente.
  -- Mensagens de sistema só nascem dentro de outro trigger (pg_trigger_depth > 1).
  IF pg_trigger_depth() <= 1 THEN
    NEW.autor_id := auth.uid();
    NEW.do_suporte := public.is_admin();
    NEW.sistema := false;
  END IF;
  NEW.texto := btrim(NEW.texto);
  -- clock_timestamp: mensagens da mesma transação (resposta + status automático)
  -- ficam em ordem real; now() daria o mesmo horário para todas.
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_chamado_mensagens_antes_inserir ON public.chamado_mensagens;
CREATE TRIGGER trg_chamado_mensagens_antes_inserir BEFORE INSERT ON public.chamado_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.fn_chamado_mensagens_antes_inserir();

-- Depois de cada mensagem: atualiza o chamado, ajusta status, avisa o outro lado
CREATE OR REPLACE FUNCTION public.fn_chamado_mensagens_depois_inserir()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  c record;
  v_primeira boolean;
  v_titulo text;
  v_msg text;
  v_link text;
  v_dest uuid;
  v_secret text;
BEGIN
  SELECT * INTO c FROM public.chamados WHERE id = NEW.chamado_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Status sugerido pelo fluxo (silencioso: a própria mensagem já avisa)
  IF NOT NEW.sistema THEN
    UPDATE public.chamados SET ultima_atividade_em = now() WHERE id = c.id;
    IF NEW.do_suporte AND c.status = 'pendente' THEN
      PERFORM set_config('app.chamado_silencioso', '1', true);
      UPDATE public.chamados SET status = 'em_andamento' WHERE id = c.id;
      PERFORM set_config('app.chamado_silencioso', '', true);
    ELSIF NOT NEW.do_suporte AND c.status = 'finalizado' THEN
      PERFORM set_config('app.chamado_silencioso', '1', true);
      UPDATE public.chamados SET status = 'pendente' WHERE id = c.id;
      PERFORM set_config('app.chamado_silencioso', '', true);
    END IF;
  ELSIF COALESCE(current_setting('app.chamado_silencioso', true), '') = '1' THEN
    RETURN NEW; -- mudança automática de status: sem aviso extra
  END IF;

  v_link := '/chamados?id=' || c.id::text;
  v_primeira := NOT NEW.sistema AND NOT NEW.do_suporte AND NOT EXISTS (
    SELECT 1 FROM public.chamado_mensagens m WHERE m.chamado_id = c.id AND m.id <> NEW.id AND NOT m.sistema
  );
  v_titulo := CASE
    WHEN v_primeira THEN 'Novo chamado #' || c.numero
    WHEN NEW.sistema THEN 'Chamado #' || c.numero || ': ' || lower(public.chamado_status_label(c.status))
    WHEN NEW.do_suporte THEN 'Suporte respondeu o chamado #' || c.numero
    ELSE 'Nova mensagem no chamado #' || c.numero
  END;
  v_msg := c.assunto || ' — ' || left(NEW.texto, 140);

  IF NEW.do_suporte THEN
    -- Suporte → todos da propriedade (dono + membros ativos), menos o autor
    FOR v_dest IN
      SELECT user_id FROM public.propriedades WHERE id = c.propriedade_id AND user_id IS NOT NULL
      UNION
      SELECT usuario_id FROM public.propriedades_usuarios WHERE propriedade_id = c.propriedade_id AND status = 'ativo'
    LOOP
      CONTINUE WHEN v_dest = NEW.autor_id;
      INSERT INTO public.notificacoes (usuario_id, propriedade_id, tipo, titulo, mensagem, dados, link_acao, lida)
      VALUES (v_dest, c.propriedade_id, 'chamado', v_titulo, v_msg,
              jsonb_build_object('chamado_id', c.id, 'mensagem_id', NEW.id), v_link, false);
    END LOOP;
  ELSE
    -- Membro → admins do sistema, menos o autor
    FOR v_dest IN
      SELECT id FROM public.user_profiles WHERE perfil = 'admin' OR is_super_admin = true
    LOOP
      CONTINUE WHEN v_dest = NEW.autor_id;
      INSERT INTO public.notificacoes (usuario_id, propriedade_id, tipo, titulo, mensagem, dados, link_acao, lida)
      VALUES (v_dest, c.propriedade_id, 'chamado', v_titulo, v_msg,
              jsonb_build_object('chamado_id', c.id, 'mensagem_id', NEW.id), v_link, false);
    END LOOP;
  END IF;

  -- E-mail (edge function decide destinatários; mesmo segredo do push)
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET_INGESTAO_CLIMA';
    PERFORM net.http_post(
      url := 'https://kivnjwkomrkvdpvklakw.supabase.co/functions/v1/enviar-chamado-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := jsonb_build_object('mensagem_id', NEW.id, 'primeira', v_primeira),
      timeout_milliseconds := 8000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enviar-chamado-email não disparado: %', SQLERRM; -- e-mail nunca derruba a mensagem
  END;

  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_chamado_mensagens_depois_inserir ON public.chamado_mensagens;
CREATE TRIGGER trg_chamado_mensagens_depois_inserir AFTER INSERT ON public.chamado_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.fn_chamado_mensagens_depois_inserir();

-- ── Anexos ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_chamado_anexos_antes_inserir()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_prop uuid;
BEGIN
  SELECT propriedade_id INTO v_prop FROM public.chamados WHERE id = NEW.chamado_id;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Chamado não encontrado'; END IF;
  NEW.propriedade_id := v_prop;
  IF auth.uid() IS NOT NULL THEN NEW.enviado_por := auth.uid(); END IF;
  -- O arquivo precisa estar na pasta do chamado dentro da pasta da propriedade
  IF NEW.storage_path NOT LIKE v_prop::text || '/chamados/' || NEW.chamado_id::text || '/%' THEN
    RAISE EXCEPTION 'Caminho do anexo inválido';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_chamado_anexos_antes_inserir ON public.chamado_anexos;
CREATE TRIGGER trg_chamado_anexos_antes_inserir BEFORE INSERT ON public.chamado_anexos
  FOR EACH ROW EXECUTE FUNCTION public.fn_chamado_anexos_antes_inserir();

-- ── Abrir chamado (chamado + primeira mensagem numa transação só) ────
CREATE OR REPLACE FUNCTION public.abrir_chamado(
  p_propriedade_id uuid, p_assunto text, p_tipo public.chamado_tipo,
  p_prioridade public.chamado_prioridade, p_texto text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.chamados (propriedade_id, assunto, tipo, prioridade)
  VALUES (p_propriedade_id, p_assunto, COALESCE(p_tipo, 'duvida'), COALESCE(p_prioridade, 'normal'))
  RETURNING id INTO v_id;
  INSERT INTO public.chamado_mensagens (chamado_id, texto) VALUES (v_id, p_texto);
  RETURN v_id;
END $$;

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamado_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamado_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termos_aceites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chamados_select ON public.chamados;
CREATE POLICY chamados_select ON public.chamados FOR SELECT TO authenticated
  USING (public.is_admin() OR propriedade_id = ANY (public.get_prop_ids_usuario()));
DROP POLICY IF EXISTS chamados_insert ON public.chamados;
CREATE POLICY chamados_insert ON public.chamados FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR propriedade_id = ANY (public.get_prop_ids_usuario()));
DROP POLICY IF EXISTS chamados_update_admin ON public.chamados;
CREATE POLICY chamados_update_admin ON public.chamados FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS chamados_delete_admin ON public.chamados;
CREATE POLICY chamados_delete_admin ON public.chamados FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS chamado_mensagens_select ON public.chamado_mensagens;
CREATE POLICY chamado_mensagens_select ON public.chamado_mensagens FOR SELECT TO authenticated
  USING (public.pode_ver_chamado(chamado_id));
DROP POLICY IF EXISTS chamado_mensagens_insert ON public.chamado_mensagens;
CREATE POLICY chamado_mensagens_insert ON public.chamado_mensagens FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_chamado(chamado_id));
DROP POLICY IF EXISTS chamado_mensagens_delete_admin ON public.chamado_mensagens;
CREATE POLICY chamado_mensagens_delete_admin ON public.chamado_mensagens FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS chamado_anexos_select ON public.chamado_anexos;
CREATE POLICY chamado_anexos_select ON public.chamado_anexos FOR SELECT TO authenticated
  USING (public.pode_ver_chamado(chamado_id));
DROP POLICY IF EXISTS chamado_anexos_insert ON public.chamado_anexos;
CREATE POLICY chamado_anexos_insert ON public.chamado_anexos FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_chamado(chamado_id));
DROP POLICY IF EXISTS chamado_anexos_delete_admin ON public.chamado_anexos;
CREATE POLICY chamado_anexos_delete_admin ON public.chamado_anexos FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS termos_aceites_select ON public.termos_aceites;
CREATE POLICY termos_aceites_select ON public.termos_aceites FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS termos_aceites_insert ON public.termos_aceites;
CREATE POLICY termos_aceites_insert ON public.termos_aceites FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Sem acesso anônimo
REVOKE ALL ON public.chamados, public.chamado_mensagens, public.chamado_anexos, public.termos_aceites FROM anon;
REVOKE ALL ON FUNCTION public.abrir_chamado(uuid, text, public.chamado_tipo, public.chamado_prioridade, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_chamado(uuid, text, public.chamado_tipo, public.chamado_prioridade, text) TO authenticated;
REVOKE ALL ON FUNCTION public.pode_ver_chamado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_chamado(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Endurecimento (verificador de segurança do Supabase)
CREATE OR REPLACE FUNCTION public.chamado_status_label(s public.chamado_status)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE s WHEN 'pendente' THEN 'Pendente' WHEN 'em_andamento' THEN 'Em andamento' ELSE 'Finalizado' END;
$$;
-- Funções de trigger não precisam ser chamáveis pela API (o trigger continua funcionando)
REVOKE EXECUTE ON FUNCTION public.fn_chamado_mensagens_depois_inserir() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_chamados_status_mudou() FROM PUBLIC, anon, authenticated;
