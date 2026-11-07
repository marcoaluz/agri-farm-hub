// Onde cada produto do estoque aparece nos lançamentos depende da CATEGORIA dele.
// Essas regras já existiam espalhadas pelo código (ItemLancamentoCard, LancamentoForm,
// AbastecimentoForm, ManutencaoDialog); agora ficam num lugar só, junto com o texto
// mostrado ao usuário, para que tela e regra nunca fiquem diferentes.
//
// A comparação é por "contém a palavra", sem diferenciar maiúscula/minúscula:
// "Manutenção", "MANUTENÇÃO" e "Manutenção Trator" contam como Manutenção.

export type UsoCategoriaEstoque = 'combustivel' | 'manutencao' | 'maquina'

const normalizar = (categoria?: string | null) => (categoria || '').toLowerCase()

export const ehCategoriaCombustivel = (categoria?: string | null) =>
  normalizar(categoria).includes('combust')

export const ehCategoriaManutencao = (categoria?: string | null) => {
  const c = normalizar(categoria)
  return c.includes('manutenç') || c.includes('manutenc')
}

export const ehCategoriaMaquina = (categoria?: string | null) => {
  const c = normalizar(categoria)
  return c.includes('máquina') || c.includes('maquina')
}

export const USO_CATEGORIA: Record<UsoCategoriaEstoque, {
  categoria: string
  ondeAparece: string
  combina: (categoria?: string | null) => boolean
}> = {
  combustivel: {
    categoria: 'Combustível',
    ondeAparece: 'Abastecimento (no lançamento e em Máquinas)',
    combina: ehCategoriaCombustivel,
  },
  manutencao: {
    categoria: 'Manutenção',
    ondeAparece: 'Manutenção de máquinas e implementos (no lançamento e em Máquinas)',
    combina: ehCategoriaManutencao,
  },
  maquina: {
    categoria: 'Máquina',
    ondeAparece: 'Troca/Reposição de peças no lançamento',
    combina: ehCategoriaMaquina,
  },
}

/** Para qual uso especial a categoria vai (ou null se for uma categoria comum). */
export function usoDaCategoria(categoria?: string | null): UsoCategoriaEstoque | null {
  if (ehCategoriaCombustivel(categoria)) return 'combustivel'
  if (ehCategoriaManutencao(categoria)) return 'manutencao'
  if (ehCategoriaMaquina(categoria)) return 'maquina'
  return null
}
