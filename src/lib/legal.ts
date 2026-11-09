import termosMd from '@/legal/termos-de-uso.md?raw'
import privacidadeMd from '@/legal/politica-de-privacidade.md?raw'

/**
 * Termos de Uso e Política de Privacidade.
 *
 * LEGAL_PUBLICADO = false enquanto o texto tiver campos a preencher
 * ([RAZÃO SOCIAL], [CNPJ], ...). Desligado:
 *   • ninguém recebe a janela de aceite;
 *   • /termos e /privacidade mostram "em preparação" (o admin vê o rascunho).
 * Para publicar: preencher os .md em src/legal, conferir com advogado,
 * mudar para true. Para pedir novo aceite de todos: subir a versão abaixo.
 */
export const LEGAL_PUBLICADO = false

export const TERMOS_VERSAO = '1.0'
export const PRIVACIDADE_VERSAO = '1.0'

export const TEXTO_TERMOS = termosMd
export const TEXTO_PRIVACIDADE = privacidadeMd

/** Campos ainda não preenchidos no texto (ex.: "[CNPJ]"). */
export function camposPendentes(texto: string): string[] {
  return Array.from(new Set(texto.match(/\[[A-ZÀ-Ü0-9 /()ÇÃÊÍÓÚ:-]{2,}\]/g) || []))
}
