import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { renderEmail, blocoDetalhes, escapeHtml } from '../_shared/emailLayout.ts';
import { json, corsHeaders, enviarEmail, descreverQuando, cronSecretValido, modoEnvio, URL_AGENDA } from '../_shared/agendaEmail.ts';

// Edge Function: enviar-lembrete-agenda-email (verify_jwt = false)
// Chamada só pelo banco (processar_lembretes_agenda, via pg_net) com header
// x-cron-secret — mesmo padrão do enviar-push.
// body { evento_id, usuario_id, inicio_evento }: só envia se existir a linha
// correspondente em agenda_lembretes_email ainda não enviada (evita duplicidade
// e impede uso para mandar e-mail arbitrário).
// body { amostra: true }: envia um lembrete fictício (só em modo teste).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function montarLembrete(ev: { titulo: string; local: string | null; inicio: string; fim: string | null; dia_inteiro: boolean }) {
  const quando = descreverQuando(ev.inicio, ev.fim, ev.dia_inteiro);
  const html = renderEmail({
    titulo: `Lembrete: ${ev.titulo} ⏰`,
    saudacao: 'Este é o lembrete do seu compromisso.',
    blocosHtml: blocoDetalhes([
      { rotulo: 'Quando', valorHtml: escapeHtml(quando) },
      { rotulo: 'Local', valorHtml: ev.local ? escapeHtml(ev.local) : '' },
    ], escapeHtml(ev.titulo)),
    botaoTexto: 'Abrir agenda',
    botaoUrl: URL_AGENDA,
    notaRodape: 'Você pode desligar os lembretes por e-mail na tela Minha agenda.',
  });
  const text = [
    `Lembrete: ${ev.titulo}`,
    '',
    `Quando: ${quando}`,
    ...(ev.local ? [`Local: ${ev.local}`] : []),
    '',
    `Abrir agenda: ${URL_AGENDA}`,
    '',
    'Agro GFI — Gestão de Fazenda Inteligente',
    'app.agrogfi.com.br',
  ].join('\n');
  return { html, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!cronSecretValido(req)) return json({ error: 'não autorizado' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    if (body?.amostra === true) {
      const modo = modoEnvio();
      if (modo.modo !== 'teste') return json({ error: 'amostra só é enviada com AGENDA_EMAIL_TESTE definida', modo: modo.modo }, 400);
      const inicio = new Date(Date.now() + 3600 * 1000);
      inicio.setUTCMinutes(0, 0, 0);
      const r = montarLembrete({
        titulo: 'Vacinação do lote de bezerros <amostra>', local: 'Curral 2',
        inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 2 * 3600 * 1000).toISOString(), dia_inteiro: false,
      });
      const envio = await enviarEmail({ to: 'usuario@exemplo.com', subject: 'Lembrete: Vacinação do lote de bezerros <amostra>', html: r.html, text: r.text });
      return json({ ok: true, amostra: true, email: envio });
    }

    const { evento_id, usuario_id, inicio_evento } = body ?? {};
    if (!evento_id || !usuario_id || !inicio_evento) return json({ error: 'evento_id, usuario_id e inicio_evento são obrigatórios' }, 400);

    const { data: controle, error: ctrlErr } = await sb
      .from('agenda_lembretes_email')
      .select('evento_id, enviado_em')
      .eq('evento_id', evento_id)
      .eq('usuario_id', usuario_id)
      .eq('inicio_evento', inicio_evento)
      .maybeSingle();
    if (ctrlErr) throw ctrlErr;
    if (!controle) return json({ error: 'lembrete não solicitado pelo banco' }, 404);
    if (controle.enviado_em) return json({ ok: true, ignorado: 'já enviado' });

    const marcar = (patch: Record<string, unknown>) => sb
      .from('agenda_lembretes_email')
      .update(patch)
      .eq('evento_id', evento_id)
      .eq('usuario_id', usuario_id)
      .eq('inicio_evento', inicio_evento);

    const { data: ev, error: evErr } = await sb
      .from('agenda_eventos')
      .select('id, usuario_id, titulo, local, inicio, fim, dia_inteiro')
      .eq('id', evento_id)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!ev || ev.usuario_id !== usuario_id) {
      await marcar({ erro: 'compromisso não encontrado' });
      return json({ error: 'compromisso não encontrado' }, 404);
    }

    const { data: pref } = await sb.from('agenda_preferencias').select('lembrete_email').eq('usuario_id', usuario_id).maybeSingle();
    if (pref && pref.lembrete_email === false) {
      await marcar({ erro: 'desligado pelo usuário' });
      return json({ ok: true, ignorado: 'preferência desligada' });
    }

    const { data: u, error: uErr } = await sb.auth.admin.getUserById(usuario_id);
    if (uErr || !u?.user?.email) {
      await marcar({ erro: 'usuário sem e-mail' });
      return json({ error: 'usuário sem e-mail' }, 404);
    }

    const { html, text } = montarLembrete(ev);
    const envio = await enviarEmail({ to: u.user.email, subject: `Lembrete: ${ev.titulo}`, html, text });
    await marcar(envio.enviado ? { enviado_em: new Date().toISOString(), erro: envio.modo === 'teste' ? `teste → ${envio.destinatario_efetivo}` : null } : { erro: envio.erro ?? 'falha no envio' });

    return json({ ok: envio.enviado, email: envio });
  } catch (err: any) {
    console.error('enviar-lembrete-agenda-email error:', err);
    return json({ error: err?.message || 'Erro interno' }, 500);
  }
});
