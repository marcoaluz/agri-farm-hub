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

// Rótulo exibido quando um lançamento não está vinculado a um talhão específico
export const talhaoLabel = (nome?: string | null) =>
  nome && String(nome).trim() ? String(nome) : 'Propriedade'

/** Formata CPF (até 11 dígitos) ou CNPJ (12+) automaticamente, conforme
 * a pessoa digita — detecta sozinho qual dos dois é pela quantidade de
 * números. */
export function formatarCpfCnpj(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** Formata telefone como (00) 0000-0000 (fixo, 10 dígitos) ou
 * (00) 00000-0000 (celular, 11 dígitos) automaticamente. */
export function formatarTelefone(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}
