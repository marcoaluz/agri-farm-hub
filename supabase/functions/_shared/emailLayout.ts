// Layout único dos e-mails da Agenda (mesma identidade visual dos e-mails de
// convite/redefinição de senha do Agro GFI). Tabelas + estilos inline para
// funcionar no Gmail/Outlook. Todo texto vindo do usuário deve passar por
// escapeHtml antes de entrar aqui.

export function escapeHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Quebra de linha do usuário (descrição) vira <br> depois de escapar. */
export function escapeHtmlMultilinha(valor: unknown): string {
  return escapeHtml(valor).replace(/\r?\n/g, '<br>');
}

export interface RenderEmailParams {
  /** Texto puro (será escapado). */
  titulo: string;
  /** Texto puro (será escapado). */
  saudacao?: string;
  /** HTML já montado com os helpers abaixo (conteúdo do usuário já escapado). */
  blocosHtml?: string;
  botaoTexto?: string;
  botaoUrl?: string;
  /** Texto puro (será escapado). */
  notaRodape?: string;
}

export function renderEmail({ titulo, saudacao, blocosHtml, botaoTexto, botaoUrl, notaRodape }: RenderEmailParams): string {
  const botao = botaoTexto && botaoUrl
    ? `
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 24px;">
                <a href="${escapeHtml(botaoUrl)}" style="display:inline-block;background-color:#b8860b;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">${escapeHtml(botaoTexto)}</a>
              </td></tr>
            </table>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f0e8;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#2d3b2d;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">🌿 Agro GFI</h1>
            <p style="margin:4px 0 0;color:#a8b5a0;font-size:12px;letter-spacing:1px;">GESTÃO DE FAZENDA INTELIGENTE</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#2d3b2d;font-size:20px;font-weight:600;">${escapeHtml(titulo)}</h2>
            ${saudacao ? `<p style="margin:0 0 8px;color:#555;font-size:15px;line-height:1.6;">${escapeHtml(saudacao)}</p>` : ''}
            ${blocosHtml ?? ''}
            ${botao}
            ${notaRodape ? `<p style="margin:0;color:#888;font-size:13px;line-height:1.5;">${escapeHtml(notaRodape)}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9f6f0;padding:20px 32px;border-top:1px solid #e8e0d0;">
            <p style="margin:0;color:#999;font-size:12px;text-align:center;line-height:1.5;">
              Agro GFI — Gestão de Fazenda Inteligente<br>
              <a href="https://app.agrogfi.com.br" style="color:#b8860b;text-decoration:none;">app.agrogfi.com.br</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Bloco de detalhes (rótulo: valor) com fundo claro.
 * `valorHtml` precisa vir já escapado (use escapeHtml / escapeHtmlMultilinha).
 */
export function blocoDetalhes(linhas: Array<{ rotulo: string; valorHtml: string }>, destaqueHtml?: string): string {
  const itens = linhas
    .filter((l) => l.valorHtml && l.valorHtml.trim() !== '')
    .map((l) => `
                <tr><td style="padding:4px 0;color:#555;font-size:14px;line-height:1.5;">
                  <span style="color:#888;">${escapeHtml(l.rotulo)}:</span> ${l.valorHtml}
                </td></tr>`)
    .join('');
  return `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px;background-color:#f9f6f0;border:1px solid #e8e0d0;border-radius:8px;">
              <tr><td style="padding:16px 20px;">
                ${destaqueHtml ? `<p style="margin:0 0 8px;color:#2d3b2d;font-size:16px;font-weight:600;line-height:1.4;">${destaqueHtml}</p>` : ''}
                <table width="100%" cellpadding="0" cellspacing="0">${itens}</table>
              </td></tr>
            </table>`;
}

/**
 * Lista simples com título de seção. Cada item: horário (opcional) + texto.
 * Retorna '' se não houver itens (nada de seção vazia).
 */
export function blocoLista(tituloSecao: string, itens: Array<{ horario?: string; textoHtml: string }>): string {
  if (!itens.length) return '';
  const linhas = itens
    .map((i) => `
                <tr>
                  <td valign="top" style="padding:6px 12px 6px 0;color:#b8860b;font-size:14px;font-weight:600;white-space:nowrap;width:1%;">${escapeHtml(i.horario ?? '')}</td>
                  <td valign="top" style="padding:6px 0;color:#555;font-size:14px;line-height:1.5;">${i.textoHtml}</td>
                </tr>`)
    .join('');
  return `
            <p style="margin:20px 0 4px;color:#2d3b2d;font-size:15px;font-weight:600;">${escapeHtml(tituloSecao)}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-top:1px solid #e8e0d0;">${linhas}</table>`;
}
