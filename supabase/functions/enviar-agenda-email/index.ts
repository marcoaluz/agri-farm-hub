import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { renderEmail, blocoDetalhes, escapeHtml, escapeHtmlMultilinha } from '../_shared/emailLayout.ts';
import {
  json, corsHeaders, enviarEmail, descreverQuando, gerarIcs, base64Utf8, cronSecretValido, modoEnvio, URL_AGENDA,
} from '../_shared/agendaEmail.ts';

// Edge Function: enviar-agenda-email (verify_jwt = true)
// Notifica os convidados de um compromisso da Agenda pessoal.
//  - Chamada pelo app (token do usuário): body { evento_id, convidado_ids? }.
//    Só o DONO do evento pode chamar. Sem convidado_ids = todos os pendentes.
//    Convidado interno: notificação no sininho + e-mail com botão.
//    Convidado externo: e-mail com .ics anexado.
//  - Amostra de layout: header x-cron-secret + body { amostra: true }. Só envia
//    em modo teste (AGENDA_EMAIL_TESTE), com dados fictícios.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Limites contra abuso (envio de e-mail em massa pela conta do Agro GFI).
const MAX_CONVIDADOS_POR_EVENTO = 10;
const MAX_EXTERNOS_24H_POR_USUARIO = 20;

interface Evento {
  id: string; usuario_id: string; titulo: string; descricao: string | null; local: string | null;
  inicio: string; fim: string | null; dia_inteiro: boolean;
}

function montarConvite(ev: Evento, organizadorNome: string, interno: boolean) {
  const quando = descreverQuando(ev.inicio, ev.fim, ev.dia_inteiro);
  const blocos = blocoDetalhes(
    [
      { rotulo: 'Quando', valorHtml: escapeHtml(quando) },
      { rotulo: 'Local', valorHtml: ev.local ? escapeHtml(ev.local) : '' },
      { rotulo: 'Descrição', valorHtml: ev.descricao ? escapeHtmlMultilinha(ev.descricao) : '' },
      { rotulo: 'Convidado por', valorHtml: escapeHtml(organizadorNome) },
    ],
    escapeHtml(ev.titulo),
  );
  const html = renderEmail({
    titulo: 'Você foi convidado para um compromisso 📅',
    saudacao: `${organizadorNome} convidou você para o compromisso abaixo.`,
    blocosHtml: blocos,
    botaoTexto: interno ? 'Ver na minha agenda' : undefined,
    botaoUrl: interno ? URL_AGENDA : undefined,
    notaRodape: interno
      ? 'Abra a sua agenda no Agro GFI para aceitar ou recusar o convite.'
      : 'O convite está anexado (arquivo .ics) — abra-o para adicionar ao seu calendário (Outlook, Gmail, Apple).',
  });
  const text = [
    'Você foi convidado para um compromisso',
    '',
    `${organizadorNome} convidou você para:`,
    ev.titulo,
    `Quando: ${quando}`,
    ...(ev.local ? [`Local: ${ev.local}`] : []),
    ...(ev.descricao ? [`Descrição: ${ev.descricao}`] : []),
    '',
    interno ? `Ver na minha agenda: ${URL_AGENDA}` : 'O convite está anexado (arquivo .ics) para adicionar ao seu calendário.',
    '',
    'Agro GFI — Gestão de Fazenda Inteligente',
    'app.agrogfi.com.br',
  ].join('\n');
  return { html, text, quando };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // ---------------- Amostra de layout (só modo teste) ----------------
    if (body?.amostra === true) {
      if (!cronSecretValido(req)) return json({ error: 'não autorizado' }, 401);
      const modo = modoEnvio();
      if (modo.modo !== 'teste') return json({ error: 'amostra só é enviada com AGENDA_EMAIL_TESTE definida', modo: modo.modo }, 400);

      const inicio = new Date(Date.now() + 24 * 3600 * 1000);
      inicio.setUTCMinutes(0, 0, 0);
      const ev: Evento = {
        id: '00000000-0000-4000-8000-000000000001', usuario_id: '', titulo: 'Reunião com o agrônomo <amostra>',
        descricao: 'Revisar a adubação do talhão 3.\nLevar as análises de solo.', local: 'Sede da Fazenda Bonança',
        inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 3600 * 1000).toISOString(), dia_inteiro: false,
      };
      const r1 = montarConvite(ev, 'Marco (amostra)', true);
      const env1 = await enviarEmail({ to: 'convidado-interno@exemplo.com', subject: `Convite: ${ev.titulo}`, html: r1.html, text: r1.text });
      const r2 = montarConvite(ev, 'Marco (amostra)', false);
      const ics = gerarIcs({ ...ev, organizadorNome: 'Marco (amostra)', organizadorEmail: 'noreply@agrogfi.com.br', convidadoEmail: 'convidado-externo@exemplo.com' });
      const env2 = await enviarEmail({
        to: 'convidado-externo@exemplo.com', subject: `Convite: ${ev.titulo}`, html: r2.html, text: r2.text,
        attachments: [{ filename: 'convite.ics', content: base64Utf8(ics) }],
      });
      return json({ ok: true, amostra: true, interno: env1, externo: env2, ics });
    }

    // ---------------- Chamada do app: valida o dono ----------------
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'não autorizado' }, 401);
    const { data: userData, error: userError } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !userData?.user) return json({ error: 'token inválido' }, 401);
    const chamador = userData.user;

    const eventoId: string | undefined = body?.evento_id;
    if (!eventoId) return json({ error: 'evento_id é obrigatório' }, 400);

    const { data: ev, error: evErr } = await sb
      .from('agenda_eventos')
      .select('id, usuario_id, titulo, descricao, local, inicio, fim, dia_inteiro')
      .eq('id', eventoId)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!ev) return json({ error: 'compromisso não encontrado' }, 404);
    if (ev.usuario_id !== chamador.id) return json({ error: 'apenas o dono do compromisso pode enviar convites' }, 403);

    // Limite 1: convidados por compromisso.
    const { count: totalNoEvento, error: cntErr } = await sb
      .from('agenda_convidados')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', eventoId);
    if (cntErr) throw cntErr;
    if ((totalNoEvento ?? 0) > MAX_CONVIDADOS_POR_EVENTO) {
      return json({
        error: `Limite de ${MAX_CONVIDADOS_POR_EVENTO} convidados por compromisso atingido (este tem ${totalNoEvento}). Remova alguns convidados e salve de novo.`,
      }, 429);
    }

    // Limite 2: convites externos (sem conta no sistema) do usuário nas últimas 24h.
    const { data: meusEventos, error: meErr } = await sb
      .from('agenda_eventos')
      .select('id')
      .eq('usuario_id', chamador.id);
    if (meErr) throw meErr;
    const idsMeusEventos = (meusEventos ?? []).map((e: { id: string }) => e.id);
    if (idsMeusEventos.length) {
      const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: externos24h, error: extErr } = await sb
        .from('agenda_convidados')
        .select('id', { count: 'exact', head: true })
        .in('evento_id', idsMeusEventos)
        .is('usuario_id', null)
        .gte('created_at', desde);
      if (extErr) throw extErr;
      if ((externos24h ?? 0) > MAX_EXTERNOS_24H_POR_USUARIO) {
        return json({
          error: `Limite de ${MAX_EXTERNOS_24H_POR_USUARIO} convites por e-mail para pessoas de fora do sistema em 24 horas atingido. Tente novamente mais tarde.`,
        }, 429);
      }
    }

    let q = sb.from('agenda_convidados').select('id, usuario_id, email, status').eq('evento_id', eventoId);
    const ids: string[] | undefined = Array.isArray(body?.convidado_ids) ? body.convidado_ids : undefined;
    q = ids ? q.in('id', ids) : q.eq('status', 'pendente');
    const { data: convidados, error: cErr } = await q;
    if (cErr) throw cErr;

    const { data: perfil } = await sb.from('user_profiles').select('full_name').eq('id', chamador.id).maybeSingle();
    const organizadorNome = (perfil?.full_name || chamador.email || 'Um usuário do Agro GFI') as string;

    const resultados: unknown[] = [];
    for (const c of convidados ?? []) {
      const interno = !!c.usuario_id;
      const { html, text, quando } = montarConvite(ev as Evento, organizadorNome, interno);

      let notificacao: string | null = null;
      if (interno) {
        const { error: nErr } = await sb.from('notificacoes').insert({
          usuario_id: c.usuario_id,
          tipo: 'agenda_convite',
          titulo: `Convite: ${ev.titulo}`,
          mensagem: `${organizadorNome} convidou você — ${quando}`,
          link_acao: '/agenda?aba=minha',
          dados: { evento_id: ev.id, convidado_id: c.id },
        });
        notificacao = nErr ? `erro: ${nErr.message}` : 'criada';
      }

      const envio = await enviarEmail({
        to: c.email,
        subject: `Convite: ${ev.titulo}`,
        html,
        text,
        attachments: interno ? undefined : [{
          filename: 'convite.ics',
          content: base64Utf8(gerarIcs({
            ...(ev as Evento),
            organizadorNome,
            organizadorEmail: chamador.email ?? 'noreply@agrogfi.com.br',
            convidadoEmail: c.email,
          })),
        }],
      });
      resultados.push({ convidado_id: c.id, interno, notificacao, email: envio });
    }

    return json({ ok: true, total: resultados.length, resultados });
  } catch (err: any) {
    console.error('enviar-agenda-email error:', err);
    return json({ error: err?.message || 'Erro interno' }, 500);
  }
});
