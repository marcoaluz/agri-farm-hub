/**
 * Helpers de formatação e preparo de dados para gráficos.
 */

export function formatarCategoria(nome: string): string {
  if (!nome || nome === '' || nome === 'null' || nome === 'undefined') {
    return 'Sem categoria'
  }

  const traducoes: Record<string, string> = {
    servicos_terceiros: 'Serviços Terceiros',
    compra_animais: 'Compra de Animais',
    compra_animal: 'Compra de Animais',
    alimentacao_racao: 'Alimentação / Ração',
    combustivel: 'Combustível',
    adubacao: 'Adubação',
    defensivos: 'Defensivos',
    sementes: 'Sementes',
    mao_de_obra: 'Mão de Obra',
    manutencao: 'Manutenção',
    energia: 'Energia',
    impostos: 'Impostos',
    aluguel: 'Aluguel',
    transporte: 'Transporte',
  }

  const chave = String(nome).toLowerCase()
  if (traducoes[chave]) return traducoes[chave]

  return String(nome)
    .split('_')
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

export type DadoPizza = { name: string; value: number; isOutros?: boolean; [k: string]: any }

/**
 * Formata nomes, remove zerados, agrupa fatias < 1% em "Outros" e ordena desc.
 */
export function prepararDadosPizza<T extends Record<string, any>>(
  dados: T[],
  opts: { nameKey?: string; valueKey?: string } = {},
): DadoPizza[] {
  const nameKey = opts.nameKey || 'name'
  const valueKey = opts.valueKey || 'value'

  const dadosFormatados: DadoPizza[] = (dados || []).map(item => ({
    ...item,
    name: formatarCategoria(item[nameKey] ?? item.categoria ?? item.name),
    value: Number(item[valueKey] ?? 0),
  }))

  const total = dadosFormatados.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return []

  const dadosSignificativos = dadosFormatados.filter(item => {
    const percentual = (item.value / total) * 100
    return item.value > 0 && percentual >= 1
  })

  const pequenos = dadosFormatados.filter(item => {
    const percentual = (item.value / total) * 100
    return item.value > 0 && percentual < 1
  })

  if (pequenos.length > 0) {
    dadosSignificativos.push({
      name: 'Outros',
      value: pequenos.reduce((sum, item) => sum + item.value, 0),
      isOutros: true,
    })
  }

  return dadosSignificativos.sort((a, b) => b.value - a.value)
}

export const fmtMoedaBR = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
