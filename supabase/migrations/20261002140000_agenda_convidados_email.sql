-- Agenda pessoal — Fase 2: convidados + e-mail do convite e do lembrete.
-- Aditiva: só cria objetos novos. A única função recriada é
-- processar_lembretes_agenda(), criada na Fase 1 desta mesma feature
-- (mesma assinatura, comportamento antigo preservado + disparo do e-mail).

-- ---------------------------------------------------------------------------
-- Convidados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_convidados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.agenda_eventos(id) ON DELETE CASCADE,
  usuario_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_convidados_evento ON public.agenda_convidados (evento_id);
CREATE INDEX IF NOT EXISTS idx_agenda_convidados_usuario ON public.agenda_convidados (usuario_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_agenda_convidados_evento_email ON public.agenda_convidados (evento_id, email);

-- Helpers SECURITY DEFINER: evitam recursão entre as policies de
-- agenda_eventos e agenda_convidados (uma consulta a outra).
CREATE OR REPLACE FUNCTION public.agenda_eh_dono_evento(p_evento_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM agenda_eventos WHERE id = p_evento_id AND usuario_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.agenda_eh_convidado_evento(p_evento_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM agenda_convidados WHERE evento_id = p_evento_id AND usuario_id = auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.agenda_eh_dono_evento(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agenda_eh_convidado_evento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_eh_dono_evento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_eh_convidado_evento(uuid) TO authenticated;

-- Normaliza o e-mail, resolve usuario_id SEMPRE pelo e-mail (ignora o valor
-- enviado pelo cliente, senão o dono poderia vincular o evento a qualquer
-- usuário) e limita o convidado a mudar só o status.
CREATE OR REPLACE FUNCTION public.fn_agenda_convidados_validar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono uuid;
BEGIN
  SELECT usuario_id INTO v_dono FROM agenda_eventos WHERE id = NEW.evento_id;

  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_dono THEN
    -- Convidado respondendo: só o status pode mudar.
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.evento_id IS DISTINCT FROM OLD.evento_id
       OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'O convidado só pode alterar o status do convite.';
    END IF;
    RETURN NEW;
  END IF;

  NEW.email := lower(btrim(NEW.email));

  IF TG_OP = 'INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
    SELECT u.id INTO NEW.usuario_id FROM auth.users u WHERE lower(u.email) = NEW.email LIMIT 1;
    IF TG_OP = 'UPDATE' THEN
      NEW.status := 'pendente';
    END IF;
  ELSE
    NEW.usuario_id := OLD.usuario_id;
  END IF;

  IF NEW.usuario_id IS NOT NULL AND NEW.usuario_id = v_dono THEN
    RAISE EXCEPTION 'Você não pode convidar a si mesmo.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_agenda_convidados_validar ON public.agenda_convidados;
CREATE TRIGGER trg_agenda_convidados_validar
  BEFORE INSERT OR UPDATE ON public.agenda_convidados
  FOR EACH ROW EXECUTE FUNCTION public.fn_agenda_convidados_validar();

ALTER TABLE public.agenda_convidados ENABLE ROW LEVEL SECURITY;

-- Dono do evento gerencia tudo.
CREATE POLICY agenda_convidados_dono_all ON public.agenda_convidados
  FOR ALL TO authenticated
  USING (public.agenda_eh_dono_evento(evento_id))
  WITH CHECK (public.agenda_eh_dono_evento(evento_id));

-- Convidado interno vê e responde a própria linha (o trigger limita ao status).
CREATE POLICY agenda_convidados_convidado_select ON public.agenda_convidados
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY agenda_convidados_convidado_update ON public.agenda_convidados
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Convidado interno lê o evento (policy adicional; as do dono continuam iguais).
CREATE POLICY agenda_eventos_select_convidado ON public.agenda_eventos
  FOR SELECT TO authenticated
  USING (public.agenda_eh_convidado_evento(id));

-- ---------------------------------------------------------------------------
-- Preferências (usada aqui pelo e-mail do lembrete; toggle na tela na Fase 3)
-- Sem linha = tudo ligado (defaults true).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_preferencias (
  usuario_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  resumo_diario_email boolean NOT NULL DEFAULT true,
  lembrete_email boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY agenda_preferencias_select_own ON public.agenda_preferencias
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY agenda_preferencias_insert_own ON public.agenda_preferencias
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY agenda_preferencias_update_own ON public.agenda_preferencias
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Controle do e-mail de lembrete (evita duplicidade).
-- A chave inclui o início do evento: se o horário mudar, o lembrete volta a
-- valer (igual ao lembrete_enviado_em do sininho); mesmo horário = 1 e-mail só.
-- Sem policies: só o banco (cron) e a edge function (service role) acessam.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_lembretes_email (
  evento_id uuid NOT NULL REFERENCES public.agenda_eventos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inicio_evento timestamptz NOT NULL,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz NULL,
  erro text NULL,
  PRIMARY KEY (evento_id, usuario_id, inicio_evento)
);

ALTER TABLE public.agenda_lembretes_email ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- processar_lembretes_agenda(): mesmo comportamento da Fase 1 (sininho) +
-- dispara o e-mail do lembrete via pg_net, no padrão de
-- fn_disparar_push_notificacao (header x-cron-secret do vault).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.processar_lembretes_agenda()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_total integer := 0;
  v_quando text;
  v_cron_secret text;
BEGIN
  FOR r IN
    SELECT e.id, e.usuario_id, e.titulo, e.local, e.inicio, e.dia_inteiro
    FROM agenda_eventos e
    WHERE e.lembrete_minutos IS NOT NULL
      AND e.lembrete_enviado_em IS NULL
      AND now() >= e.inicio - make_interval(mins => e.lembrete_minutos)
      AND now() < e.inicio
    FOR UPDATE SKIP LOCKED
  LOOP
    IF r.dia_inteiro THEN
      v_quando := to_char(r.inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || ' (dia inteiro)';
    ELSE
      v_quando := to_char(r.inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
    END IF;

    INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link_acao, dados)
    VALUES (
      r.usuario_id,
      'agenda_lembrete',
      'Lembrete: ' || r.titulo,
      v_quando || COALESCE(' — ' || NULLIF(btrim(r.local), ''), ''),
      '/agenda',
      jsonb_build_object('evento_id', r.id)
    );

    UPDATE agenda_eventos SET lembrete_enviado_em = now() WHERE id = r.id;
    v_total := v_total + 1;

    -- E-mail do lembrete: respeita a preferência (sem linha = ligado) e só
    -- dispara uma vez por evento/horário. Bloco isolado: qualquer falha aqui
    -- (vault, pg_net, tabela de controle) vira WARNING e NUNCA aborta o loop
    -- nem desfaz a notificação do sininho acima.
    BEGIN
      IF COALESCE((SELECT p.lembrete_email FROM agenda_preferencias p WHERE p.usuario_id = r.usuario_id), true) THEN
        INSERT INTO agenda_lembretes_email (evento_id, usuario_id, inicio_evento)
        VALUES (r.id, r.usuario_id, r.inicio)
        ON CONFLICT DO NOTHING;

        IF FOUND THEN
          IF v_cron_secret IS NULL THEN
            SELECT decrypted_secret INTO v_cron_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET_INGESTAO_CLIMA';
          END IF;

          PERFORM net.http_post(
            url := 'https://kivnjwkomrkvdpvklakw.supabase.co/functions/v1/enviar-lembrete-agenda-email',
            headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_cron_secret),
            body := jsonb_build_object(
              'evento_id', r.id,
              'usuario_id', r.usuario_id,
              'inicio_evento', r.inicio
            ),
            timeout_milliseconds := 8000
          );
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'processar_lembretes_agenda: falha ao disparar e-mail do lembrete do evento % (%): %',
        r.id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.processar_lembretes_agenda() FROM PUBLIC, anon, authenticated;
