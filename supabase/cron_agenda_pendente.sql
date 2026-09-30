-- Cron jobs da Agenda pessoal — NÃO aplicados automaticamente.
-- Este arquivo fica fora de supabase/migrations de propósito: rodar manualmente
-- no SQL Editor quando for ativar.
--
-- Para desativar depois:
--   SELECT cron.unschedule('processar_lembretes_agenda');

-- Lembretes de compromissos (sininho + push), a cada 5 minutos.
SELECT cron.schedule(
  'processar_lembretes_agenda',
  '*/5 * * * *',
  $$SELECT public.processar_lembretes_agenda();$$
);

-- (Fase 3) O resumo diário das 7h (10:00 UTC) será adicionado aqui.
