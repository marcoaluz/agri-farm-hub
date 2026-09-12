/**
 * Cruzamento de filtros (facetas) a partir das combinações válidas retornadas
 * pelas RPCs `get_combinacoes_filtro_*`.
 *
 * Regra: interseção com fallback — quando uma faceta tem 2+ valores marcados,
 * as opções da faceta-alvo são a interseção das opções de cada valor marcado;
 * se essa interseção ficar vazia, a faceta não filtra nada (mostra todos).
 */

export type FacetaChave = 'categoria' | 'item' | 'talhao' | 'maquina'

export const TALHAO_PROPRIEDADE_UUID = '00000000-0000-0000-0000-000000000000'

export function chaveDaFaceta(combo: any, faceta: FacetaChave): string {
  switch (faceta) {
    case 'categoria': return String(combo.categoria ?? '')
    case 'item': return combo.item_id ? `${combo.item_tipo}:${combo.item_id}` : ''
    case 'talhao': return String(combo.talhao_id ?? '')
    case 'maquina': return String(combo.maquina_id ?? '')
  }
}

export function bateComValor(combo: any, faceta: FacetaChave, valor: string): boolean {
  return chaveDaFaceta(combo, faceta) === valor
}

function labelDaFaceta(combo: any, faceta: FacetaChave): string {
  switch (faceta) {
    case 'categoria': return String(combo.categoria ?? '')
    case 'item': {
      const sufixo = combo.item_tipo === 'maquina' ? ' (máquina)' : combo.item_tipo === 'servico' ? ' (serviço)' : ''
      return `${combo.item_nome ?? ''}${sufixo}`
    }
    case 'talhao':
      return combo.talhao_id === TALHAO_PROPRIEDADE_UUID ? 'Propriedade' : String(combo.talhao_nome || 'Talhão')
    case 'maquina': return String(combo.maquina_nome || 'Máquina')
  }
}

export function extrairOpcoesUnicas(combos: any[], faceta: FacetaChave) {
  const map = new Map<string, string>()
  combos.forEach((c) => {
    const chave = chaveDaFaceta(c, faceta)
    if (!chave) return
    if (!map.has(chave)) map.set(chave, labelDaFaceta(c, faceta))
  })
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => {
      if (faceta === 'talhao') {
        const pa = a.value === TALHAO_PROPRIEDADE_UUID ? 1 : 0
        const pb = b.value === TALHAO_PROPRIEDADE_UUID ? 1 : 0
        if (pa !== pb) return pa - pb
      }
      return a.label.localeCompare(b.label)
    })
}

export interface SelecaoFaceta {
  chave: FacetaChave
  valoresSelecionados: string[]
}

export function calcularOpcoesDisponiveis(
  combos: any[],
  facetAlvo: FacetaChave,
  selecoesOutrasFacetas: SelecaoFaceta[]
) {
  let combosFiltrados = combos

  for (const faceta of selecoesOutrasFacetas) {
    if (faceta.valoresSelecionados.length === 0) continue

    if (faceta.valoresSelecionados.length === 1) {
      combosFiltrados = combosFiltrados.filter((c) => bateComValor(c, faceta.chave, faceta.valoresSelecionados[0]))
      continue
    }

    const conjuntosPorValor = faceta.valoresSelecionados.map((valor) => {
      const combosDesseValor = combosFiltrados.filter((c) => bateComValor(c, faceta.chave, valor))
      return new Set(combosDesseValor.map((c) => chaveDaFaceta(c, facetAlvo)))
    })

    const intersecao = conjuntosPorValor.reduce((acc, set) => new Set([...acc].filter((x) => set.has(x))))

    if (intersecao.size > 0) {
      combosFiltrados = combosFiltrados.filter((c) => intersecao.has(chaveDaFaceta(c, facetAlvo)))
    }
    // interseção vazia: fallback — não filtra por essa faceta
  }

  return extrairOpcoesUnicas(combosFiltrados, facetAlvo)
}
