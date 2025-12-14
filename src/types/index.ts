import { Database } from './database.types'

// Helper types for extracting table types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Tipos específicos das tabelas
export type Propriedade = Tables<'propriedades'>
export type Safra = Tables<'safras'>
export type Talhao = Tables<'talhoes'>
export type Item = Tables<'itens'>
export type Produto = Tables<'produtos'>
export type Lote = Tables<'lotes'>
export type Servico = Tables<'servicos'>
export type ServicoItem = Tables<'servicos_itens'>
export type Lancamento = Tables<'lancamentos'>
export type LancamentoItem = Tables<'lancamentos_itens'>
export type Maquina = Tables<'maquinas'>

// Tipos para inserção
export type PropriedadeInsert = Inserts<'propriedades'>
export type SafraInsert = Inserts<'safras'>
export type TalhaoInsert = Inserts<'talhoes'>
export type ItemInsert = Inserts<'itens'>
export type ProdutoInsert = Inserts<'produtos'>
export type LoteInsert = Inserts<'lotes'>
export type ServicoInsert = Inserts<'servicos'>
export type ServicoItemInsert = Inserts<'servicos_itens'>
export type LancamentoInsert = Inserts<'lancamentos'>
export type LancamentoItemInsert = Inserts<'lancamentos_itens'>
export type MaquinaInsert = Inserts<'maquinas'>

// Tipos para atualização
export type PropriedadeUpdate = Updates<'propriedades'>
export type SafraUpdate = Updates<'safras'>
export type TalhaoUpdate = Updates<'talhoes'>
export type ItemUpdate = Updates<'itens'>
export type ProdutoUpdate = Updates<'produtos'>
export type LoteUpdate = Updates<'lotes'>
export type ServicoUpdate = Updates<'servicos'>
export type ServicoItemUpdate = Updates<'servicos_itens'>
export type LancamentoUpdate = Updates<'lancamentos'>
export type LancamentoItemUpdate = Updates<'lancamentos_itens'>
export type MaquinaUpdate = Updates<'maquinas'>

// Tipos com relações
export interface ItemComCusto extends Item {
  custo_unitario: number
  estoque_disponivel?: number
  valor_imobilizado?: number
}

export interface LancamentoCompleto extends Lancamento {
  servico: Servico
  talhao?: Talhao
  safra: Safra
  itens: (LancamentoItem & { item: ItemComCusto })[]
}

export interface ProdutoComCusto extends Produto {
  custo_medio: number
  valor_imobilizado: number
  qtd_lotes: number
}

export interface ServicoCompleto extends Servico {
  itens: (ServicoItem & { item: Item })[]
}

export interface PropriedadeCompleta extends Propriedade {
  safras: Safra[]
  talhoes: Talhao[]
  maquinas: Maquina[]
}

export interface LoteFIFO {
  lote_id: string
  quantidade_disponivel: number
  quantidade_consumir: number
  custo_unitario: number
  subtotal: number
  nota_fiscal: string | null
  data_entrada: string
}

// Enums como const objects
export const ITEM_TIPOS = {
  PRODUTO_ESTOQUE: 'produto_estoque',
  SERVICO: 'servico',
  MAQUINA_HORA: 'maquina_hora',
} as const

export type ItemTipo = typeof ITEM_TIPOS[keyof typeof ITEM_TIPOS]

export const UNIDADES_MEDIDA = {
  KG: 'kg',
  TON: 'ton',
  LITRO: 'litro',
  ML: 'ml',
  SACA: 'saca',
  HORA: 'hora',
  DIA: 'dia',
  DIARIA: 'diaria',
  HA: 'ha',
  UNIDADE: 'unidade',
  SERVICO: 'servico',
} as const

export type UnidadeMedida = typeof UNIDADES_MEDIDA[keyof typeof UNIDADES_MEDIDA]

export const CATEGORIAS_PRODUTO = {
  FERTILIZANTE: 'Fertilizante',
  DEFENSIVO: 'Defensivo',
  SEMENTE: 'Semente',
  COMBUSTIVEL: 'Combustível',
  OUTRO: 'Outro',
} as const

export type CategoriaProduto = typeof CATEGORIAS_PRODUTO[keyof typeof CATEGORIAS_PRODUTO]

export const CATEGORIAS_SERVICO = {
  PREPARO_SOLO: 'Preparo de Solo',
  PLANTIO: 'Plantio',
  ADUBACAO: 'Adubação',
  APLICACAO: 'Aplicação',
  COLHEITA: 'Colheita',
  MANUTENCAO: 'Manutenção',
  OUTRO: 'Outro',
} as const

export type CategoriaServico = typeof CATEGORIAS_SERVICO[keyof typeof CATEGORIAS_SERVICO]

export const TIPOS_MAQUINA = {
  TRATOR: 'Trator',
  COLHEITADEIRA: 'Colheitadeira',
  PULVERIZADOR: 'Pulverizador',
  PLANTADEIRA: 'Plantadeira',
  CAMINHAO: 'Caminhão',
  OUTRO: 'Outro',
} as const

export type TipoMaquina = typeof TIPOS_MAQUINA[keyof typeof TIPOS_MAQUINA]

export const STATUS_TALHAO = {
  DISPONIVEL: 'disponivel',
  EM_PREPARO: 'em_preparo',
  PLANTADO: 'plantado',
  EM_COLHEITA: 'em_colheita',
  DESCANSO: 'descanso',
} as const

export type StatusTalhao = typeof STATUS_TALHAO[keyof typeof STATUS_TALHAO]

// Estados brasileiros
export const ESTADOS_BR = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
} as const

export type EstadoBR = keyof typeof ESTADOS_BR

// Tipos para formulários
export interface FormPropriedade {
  nome: string
  area_total: number | null
  endereco: string
  cidade: string
  estado: EstadoBR | ''
  coordenadas_gps: string
}

export interface FormSafra {
  nome: string
  ano_inicio: number
  ano_fim: number | null
  ativa: boolean
}

export interface FormTalhao {
  nome: string
  area_ha: number
  cultura_atual: string
  status: StatusTalhao
  coordenadas: string
}

export interface FormProduto {
  nome: string
  categoria: CategoriaProduto
  unidade: UnidadeMedida
  nivel_minimo: number | null
}

export interface FormLote {
  produto_id: string
  qtd_original: number
  custo_unitario: number
  data_entrada: string
  data_validade: string | null
  nota_fiscal: string
  fornecedor: string
}

export interface FormServico {
  nome: string
  categoria: CategoriaServico
  requer_talhao: boolean
}

export interface FormMaquina {
  nome: string
  tipo: TipoMaquina
  marca: string
  modelo: string
  ano: number | null
  horimetro_atual: number
  custo_hora: number | null
}

export interface FormLancamento {
  safra_id: string
  servico_id: string
  talhao_id: string | null
  data_execucao: string
  observacoes: string
  itens: FormLancamentoItem[]
}

export interface FormLancamentoItem {
  item_id: string
  quantidade: number
  custo_unitario: number
}

// Tipo para dashboard stats
export interface DashboardStats {
  totalPropriedades: number
  totalTalhoes: number
  areaTotal: number
  totalProdutos: number
  valorEstoque: number
  lancamentosRecentes: number
  alertasEstoque: number
  safrasAtivas: number
}

// Tipo para filtros
export interface FiltrosLancamento {
  safra_id?: string
  servico_id?: string
  talhao_id?: string
  data_inicio?: string
  data_fim?: string
}

// Re-export database types
export type { Database } from './database.types'
