// Utilitários comuns das edge functions de e-mail da Agenda:
// envio pelo Resend com modo de teste/trava, datas em America/Sao_Paulo,
// geração de .ics e checagem do x-cron-secret.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export const FUSO = 'America/Sao_Paulo';
export const URL_AGENDA = 'https://app.agrogfi.com.br/agenda?aba=minha';
const REMETENTE = 'Agro GFI <noreply@agrogfi.com.br>';

/** x-cron-secret igual ao CRON_SECRET (mesmo padrão do enviar-push). */
export function cronSecretValido(req: Request): boolean {
  const esperado = Deno.env.get('CRON_SECRET') ?? '';
  const recebido = req.headers.get('x-cron-secret') ?? '';
  return esperado !== '' && recebido === esperado;
}

export type ModoEnvio =
  | { modo: 'teste'; destino: string }
  | { modo: 'producao' }
  | { modo: 'desativado' };

/**
 * AGENDA_EMAIL_TESTE definida  -> tudo vai só para esse endereço, assunto com [TESTE].
 * AGENDA_EMAIL_ATIVO = 'true'  -> envio real aos destinatários.
 * Nenhuma das duas             -> não envia nada (trava de segurança: o cron de
 *                                 lembretes já roda em produção).
 */
export function modoEnvio(): ModoEnvio {
  const teste = (Deno.env.get('AGENDA_EMAIL_TESTE') ?? '').trim();
  if (teste) return { modo: 'teste', destino: teste };
  if ((Deno.env.get('AGENDA_EMAIL_ATIVO') ?? '').trim().toLowerCase() === 'true') return { modo: 'producao' };
  return { modo: 'desativado' };
}

export interface ResultadoEnvio {
  enviado: boolean;
  modo: ModoEnvio['modo'];
  destinatario_original: string;
  destinatario_efetivo: string | null;
  resend_id?: string;
  erro?: string;
}

export async function enviarEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: string; content_type?: string }>;
}): Promise<ResultadoEnvio> {
  const modo = modoEnvio();
  const base = { modo: modo.modo, destinatario_original: params.to };

  if (modo.modo === 'desativado') {
    return { ...base, enviado: false, destinatario_efetivo: null, erro: 'envio desativado (defina AGENDA_EMAIL_TESTE ou AGENDA_EMAIL_ATIVO=true)' };
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return { ...base, enviado: false, destinatario_efetivo: null, erro: 'RESEND_API_KEY não configurada' };
  }

  const destino = modo.modo === 'teste' ? modo.destino : params.to;
  const subject = modo.modo === 'teste' ? `[TESTE] ${params.subject} (para: ${params.to})` : params.subject;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REMETENTE,
      to: [destino],
      subject,
      html: params.html,
      text: params.text,
      ...(params.attachments?.length ? { attachments: params.attachments } : {}),
    }),
  });

  const corpo = await resp.text();
  if (!resp.ok) {
    console.error('Resend error:', resp.status, corpo);
    return { ...base, enviado: false, destinatario_efetivo: destino, erro: `Resend ${resp.status}: ${corpo}` };
  }
  let id: string | undefined;
  try { id = JSON.parse(corpo)?.id; } catch { /* ignora */ }
  return { ...base, enviado: true, destinatario_efetivo: destino, resend_id: id };
}

// ---------------------------------------------------------------------------
// Datas (sempre no fuso de Brasília)
// ---------------------------------------------------------------------------
const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const fmtDataCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const fmtDiaChave = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

export function hora(iso: string): string {
  return fmtHora.format(new Date(iso));
}

/** yyyy-mm-dd do instante no fuso de Brasília. */
export function diaBrasilia(d: Date | string): string {
  return fmtDiaChave.format(typeof d === 'string' ? new Date(d) : d);
}

/** Ex.: "quinta-feira, 02 de outubro de 2026, das 14:00 às 15:00" */
export function descreverQuando(inicio: string, fim: string | null, diaInteiro: boolean): string {
  const ini = new Date(inicio);
  const fimD = fim ? new Date(fim) : null;
  const mesmoDia = !fimD || diaBrasilia(ini) === diaBrasilia(fimD);
  if (diaInteiro) {
    return mesmoDia
      ? `${fmtData.format(ini)} (dia inteiro)`
      : `de ${fmtDataCurta.format(ini)} a ${fmtDataCurta.format(fimD!)} (dia inteiro)`;
  }
  if (!fimD) return `${fmtData.format(ini)}, às ${fmtHora.format(ini)}`;
  return mesmoDia
    ? `${fmtData.format(ini)}, das ${fmtHora.format(ini)} às ${fmtHora.format(fimD)}`
    : `de ${fmtDataCurta.format(ini)} ${fmtHora.format(ini)} a ${fmtDataCurta.format(fimD)} ${fmtHora.format(fimD)}`;
}

// ---------------------------------------------------------------------------
// .ics (RFC 5545)
// ---------------------------------------------------------------------------
function icsTexto(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Dobra linhas em 75 octetos (UTF-8), como pede a RFC. */
function icsDobrar(linha: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linha).length <= 75) return linha;
  const partes: string[] = [];
  let atual = '';
  for (const ch of linha) {
    const limite = partes.length === 0 ? 75 : 74; // continuação começa com espaço
    if (enc.encode(atual + ch).length > limite) {
      partes.push(atual);
      atual = ch;
    } else {
      atual += ch;
    }
  }
  if (atual) partes.push(atual);
  return partes.map((p, i) => (i === 0 ? p : ' ' + p)).join('\r\n');
}

export function gerarIcs(ev: {
  id: string;
  titulo: string;
  descricao?: string | null;
  local?: string | null;
  inicio: string;
  fim?: string | null;
  dia_inteiro: boolean;
  organizadorNome: string;
  organizadorEmail: string;
  convidadoEmail: string;
}): string {
  const ini = new Date(ev.inicio);
  const fim = ev.fim ? new Date(ev.fim) : new Date(ini.getTime() + 60 * 60 * 1000);

  let dtStart: string;
  let dtEnd: string;
  if (ev.dia_inteiro) {
    // Evento de dia inteiro usa DATE (sem hora), senão o calendário mostra
    // 03:00–02:59 por causa do fuso. DTEND é exclusivo (dia seguinte).
    const d0 = diaBrasilia(ini).replace(/-/g, '');
    const ultimo = new Date(`${diaBrasilia(fim)}T12:00:00Z`);
    ultimo.setUTCDate(ultimo.getUTCDate() + 1);
    const d1 = ultimo.toISOString().slice(0, 10).replace(/-/g, '');
    dtStart = `DTSTART;VALUE=DATE:${d0}`;
    dtEnd = `DTEND;VALUE=DATE:${d1}`;
  } else {
    dtStart = `DTSTART:${icsUtc(ini)}`;
    dtEnd = `DTEND:${icsUtc(fim)}`;
  }

  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agro GFI//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${ev.id}@agrogfi.com.br`,
    `DTSTAMP:${icsUtc(new Date())}`,
    dtStart,
    dtEnd,
    `SUMMARY:${icsTexto(ev.titulo)}`,
    ...(ev.descricao ? [`DESCRIPTION:${icsTexto(ev.descricao)}`] : []),
    ...(ev.local ? [`LOCATION:${icsTexto(ev.local)}`] : []),
    `ORGANIZER;CN=${icsTexto(ev.organizadorNome)}:mailto:${ev.organizadorEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${ev.convidadoEmail}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return linhas.map(icsDobrar).join('\r\n') + '\r\n';
}

export function base64Utf8(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
