-- Agenda pessoal (Fase 1): compromissos do próprio usuário + lembrete no sininho.
-- Migration 100% aditiva: só cria objetos novos, não altera nada existente.
-- A agenda de TAREFAS da propriedade (tabela tarefas) continua intocada.

CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  propriedade_id uuid NULL REFERENCES public.propriedades(id) ON DELETE SET NULL,
  titulo text NOT NULL CHECK (length(btrim(titulo)) > 0),
  descricao text NULL,
  local text NULL,
  inicio timestamptz NOT NULL,
  fim timestamptz NULL,
  dia_inteiro boolean NOT NULL DEFAULT false,
  lembrete_minutos integer NULL CHECK (lembrete_minutos IS NULL OR lembrete_minutos BETWEEN 0 AND 43200),
  lembrete_enviado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_eventos_fim_apos_inicio CHECK (fim IS NULL OR fim >= inicio)
);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_usuario_inicio
  ON public.agenda_eventos (usuario_id, inicio);

-- Índice parcial para o job de lembretes varrer só o que ainda está pendente.
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_lembrete_pendente
  ON public.agenda_eventos (inicio)
  WHERE lembrete_minutos IS NOT NULL AND lembrete_enviado_em IS NULL;

ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;

-- Cada usuário só enxerga/gerencia os próprios compromissos.
-- propriedade_id (opcional) precisa ser uma propriedade a que ele tem acesso.
CREATE POLICY agenda_eventos_select_dono ON public.agenda_eventos
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY agenda_eventos_insert_dono ON public.agenda_eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND (propriedade_id IS NULL OR propriedade_id = ANY (get_prop_ids_usuario()))
  );

CREATE POLICY agenda_eventos_update_dono ON public.agenda_eventos
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (
    usuario_id = auth.uid()
    AND (propriedade_id IS NULL OR propriedade_id = ANY (get_prop_ids_usuario()))
  );

CREATE POLICY agenda_eventos_delete_dono ON public.agenda_eventos
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

-- Se o horário ou o lembrete mudar, o lembrete volta a ficar pendente.
CREATE OR REPLACE FUNCTION public.fn_agenda_eventos_reset_lembrete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.inicio IS DISTINCT FROM OLD.inicio
     OR NEW.lembrete_minutos IS DISTINCT FROM OLD.lembrete_minutos THEN
    NEW.lembrete_enviado_em := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_agenda_eventos_reset_lembrete
  BEFORE UPDATE ON public.agenda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.fn_agenda_eventos_reset_lembrete();

-- Gera a notificação (sininho + push via trigger existente) dos compromissos
-- cujo momento de lembrete já chegou. Só avisa antes do início do evento:
-- lembrete que "perdeu a hora" (ex.: cron parado) é descartado em silêncio.
-- A notificação vai com propriedade_id NULL para aparecer em qualquer filtro
-- de propriedade do sininho (é compromisso pessoal).
-- Chamada pelo cron (ver supabase/cron_agenda_pendente.sql — ainda NÃO agendado).
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
  END LOOP;

  RETURN v_total;
END;
$function$;

-- Só o cron (postgres) chama. Usuário comum não deve disparar lembretes.
REVOKE ALL ON FUNCTION public.processar_lembretes_agenda() FROM PUBLIC, anon, authenticated;
