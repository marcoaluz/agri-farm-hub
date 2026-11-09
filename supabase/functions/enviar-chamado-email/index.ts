import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Edge Function: enviar-chamado-email (verify_jwt = false)
// Chamada só pelo banco (trigger fn_chamado_mensagens_depois_inserir, via pg_net)
// com header x-cron-secret — mesmo padrão do enviar-push e dos e-mails da agenda.
// body { mensagem_id, primeira }:
//   • mensagem do SUPORTE (resposta ou mudança de status) → e-mail para quem abriu o chamado
//   • mensagem de MEMBRO (inclui abertura do chamado)    → e-mail para os admins do sistema
// Modo de envio (secrets da função):
//   CHAMADO_EMAIL_DESATIVADO = 'true'  → não envia nada
//   CHAMADO_EMAIL_TESTE = email         → tudo vai só para esse endereço, assunto com [TESTE]
//   (nenhum dos dois)                   → envio real

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REMETENTE = 'Agro GFI <noreply@agrogfi.com.br>';
const APP_URL = 'https://app.agrogfi.com.br';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const LABEL_STATUS: Record<string, string> = { pendente: 'Pendente', em_andamento: 'Em andamento', finalizado: 'Finalizado' };
const LABEL_TIPO: Record<string, string> = { duvida: 'Dúvida', erro: 'Erro', sugestao: 'Sugestão', outro: 'Outro' };
const LABEL_PRIORIDADE: Record<string, string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta' };

function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const escapeMulti = (v: unknown) => escapeHtml(v).replace(/\r?\n/g, '<br>');

function renderEmail(p: { titulo: string; saudacao: string; detalhes: Array<[string, string]>; mensagemHtml: string; rotuloMensagem: string; botaoUrl: string }): string {
  const linhas = p.detalhes
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 0;color:#555;font-size:14px;line-height:1.5;"><span style="color:#888;">${escapeHtml(k)}:</span> ${escapeHtml(v)}</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f0e8;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background-color:#2d3b2d;padding:28px 32px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">🌿 Agro GFI</h1>
<p style="margin:4px 0 0;color:#a8b5a0;font-size:12px;letter-spacing:1px;">GESTÃO DE FAZENDA INTELIGENTE</p></td></tr>
<tr><td style="padding:32px;">
<h2 style="margin:0 0 16px;color:#2d3b2d;font-size:20px;font-weight:600;">${escapeHtml(p.titulo)}</h2>
<p style="margin:0 0 8px;color:#555;font-size:15px;line-height:1.6;">${escapeHtml(p.saudacao)}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#f9f6f0;border:1px solid #e8e0d0;border-radius:8px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0">${linhas}</table></td></tr></table>
<p style="margin:16px 0 6px;color:#2d3b2d;font-size:14px;font-weight:600;">${escapeHtml(p.rotuloMensagem)}</p>
<div style="margin:0 0 24px;padding:14px 16px;border-left:3px solid #b8860b;background:#fffdf8;color:#333;font-size:14px;line-height:1.6;">${p.mensagemHtml}</div>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 16px;">
<a href="${escapeHtml(p.botaoUrl)}" style="display:inline-block;background-color:#b8860b;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;">Abrir chamado</a></td></tr></table>
<p style="margin:0;color:#888;font-size:13px;line-height:1.5;">Responda pelo sistema, dentro do chamado. Respostas a este e-mail não são lidas.</p>
</td></tr>
<tr><td style="background-color:#f9f6f0;padding:20px 32px;border-top:1px solid #e8e0d0;"><p style="margin:0;color:#999;font-size:12px;text-align:center;line-height:1.5;">Agro GFI — Gestão de Fazenda Inteligente<br><a href="${APP_URL}" style="color:#b8860b;text-decoration:none;">app.agrogfi.com.br</a></p></td></tr>
</table></td></tr></table></body></html>`;
}

async function enviar(to: string, subject: string, html: string, text: string) {
  if ((Deno.env.get('CHAMADO_EMAIL_DESATIVADO') ?? '').trim().toLowerCase() === 'true') {
    return { enviado: false, motivo: 'desativado' };
  }
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return { enviado: false, motivo: 'RESEND_API_KEY não configurada' };
  const teste = (Deno.env.get('CHAMADO_EMAIL_TESTE') ?? '').trim();
  const destino = teste || to;
  const assunto = teste ? `[TESTE] ${subject} (para: ${to})` : subject;
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMETENTE, to: [destino], subject: assunto, html, text }),
  });
  const corpo = await resp.text();
  if (!resp.ok) {
    console.error('Resend error:', resp.status, corpo);
    return { enviado: false, motivo: `Resend ${resp.status}` };
  }
  return { enviado: true, destino };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const segredo = Deno.env.get('CRON_SECRET') ?? '';
  if (!segredo || req.headers.get('x-cron-secret') !== segredo) return json({ error: 'não autorizado' }, 401);

  try {
    const { mensagem_id, primeira } = await req.json().catch(() => ({}));
    if (!mensagem_id) return json({ error: 'mensagem_id obrigatório' }, 400);
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: msg, error: mErr } = await sb.from('chamado_mensagens')
      .select('id, chamado_id, autor_id, do_suporte, sistema, texto').eq('id', mensagem_id).maybeSingle();
    if (mErr) throw mErr;
    if (!msg) return json({ error: 'mensagem não encontrada' }, 404);

    const { data: ch, error: cErr } = await sb.from('chamados')
      .select('id, numero, assunto, tipo, prioridade, status, criado_por, propriedade_id, propriedades(nome)')
      .eq('id', msg.chamado_id).maybeSingle();
    if (cErr) throw cErr;
    if (!ch) return json({ error: 'chamado não encontrado' }, 404);

    // Destinatários
    let destinatarios: string[] = [];
    if (msg.do_suporte) {
      if (ch.criado_por && ch.criado_por !== msg.autor_id) destinatarios = [ch.criado_por];
    } else {
      const { data: admins } = await sb.from('user_profiles').select('id').or('perfil.eq.admin,is_super_admin.eq.true');
      destinatarios = (admins ?? []).map((a: any) => a.id).filter((id: string) => id !== msg.autor_id);
    }
    if (!destinatarios.length) return json({ ok: true, ignorado: 'sem destinatário' });

    const propNome = (ch as any).propriedades?.nome ?? '';
    const numero = `#${ch.numero}`;
    const titulo = primeira
      ? `Novo chamado ${numero}: ${ch.assunto}`
      : msg.sistema
        ? `Chamado ${numero} — ${LABEL_STATUS[ch.status] ?? ch.status}`
        : msg.do_suporte
          ? `Resposta do suporte no chamado ${numero}`
          : `Nova mensagem no chamado ${numero}`;
    const saudacao = msg.do_suporte
      ? 'O suporte do Agro GFI atualizou o seu chamado.'
      : `Mensagem de ${propNome || 'uma propriedade'} no canal de suporte.`;
    const url = `${APP_URL}/chamados?id=${ch.id}`;
    const detalhes: Array<[string, string]> = [
      ['Assunto', ch.assunto],
      ['Propriedade', propNome],
      ['Tipo', LABEL_TIPO[ch.tipo] ?? ch.tipo],
      ['Prioridade', LABEL_PRIORIDADE[ch.prioridade] ?? ch.prioridade],
      ['Status', LABEL_STATUS[ch.status] ?? ch.status],
    ];
    const html = renderEmail({
      titulo, saudacao, detalhes, botaoUrl: url,
      rotuloMensagem: msg.sistema ? 'Atualização' : 'Mensagem',
      mensagemHtml: escapeMulti(msg.texto),
    });
    const text = [titulo, '', ...detalhes.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), '', msg.texto, '', `Abrir chamado: ${url}`, '', 'Agro GFI — Gestão de Fazenda Inteligente'].join('\n');

    const resultados = [];
    for (const uid of destinatarios) {
      const { data: u } = await sb.auth.admin.getUserById(uid);
      const email = u?.user?.email;
      if (!email) { resultados.push({ uid, enviado: false, motivo: 'sem e-mail' }); continue; }
      resultados.push({ uid, ...(await enviar(email, `[Agro GFI] ${titulo}`, html, text)) });
    }
    return json({ ok: true, resultados });
  } catch (err: any) {
    console.error('enviar-chamado-email error:', err);
    return json({ error: err?.message || 'Erro interno' }, 500);
  }
});
