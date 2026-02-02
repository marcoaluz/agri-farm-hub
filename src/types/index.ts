// Re-export local types for external Supabase project
export type {
  Propriedade,
  Safra,
  Talhao,
  Item,
  Lote,
  Servico,
  ServicoItem,
  Lancamento,
  LancamentoItem,
  Maquina,
  PreviewCustoResponse,
  PreviewConsumoLote,
} from './supabase-local'

// Alias types for compatibility
export type Produto = {
  id: string
  propriedade_id?: string
  nome: string
  categoria?: string
  unidade_medida: string
  quantidade_minima?: number
  ativo: boolean
  created_at: string
  updated_at: string
}

// Tipos para inserção (simplified)
export type PropriedadeInsert = Partial<Propriedade> & { nome: string; user_id: string }
export type SafraInsert = Partial<Safra> & { propriedade_id: string; nome: string }
export type TalhaoInsert = Partial<Talhao> & { propriedade_id: string; nome: string; area_ha: number }
export type ItemInsert = Partial<Item> & { nome: string; tipo: string; unidade_medida: string }
export type ProdutoInsert = Partial<Produto> & { nome: string; unidade_medida: string }
export type LoteInsert = Partial<Lote> & { propriedade_id: string; produto_id: string; quantidade_original: number; quantidade_disponivel: number; custo_unitario: number; data_entrada: string }
export type ServicoInsert = Partial<Servico> & { propriedade_id: string; nome: string }
export type ServicoItemInsert = Partial<ServicoItem> & { servico_id: string; item_id: string }
export type LancamentoInsert = Partial<Lancamento> & { propriedade_id: string; safra_id: string; servico_id: string }
export type LancamentoItemInsert = Partial<LancamentoItem> & { lancamento_id: string; item_id: string; quantidade: number }
export type MaquinaInsert = Partial<Maquina> & { propriedade_id: string; nome: string }

// Tipos para atualização
export type PropriedadeUpdate = Partial<Propriedade>
export type SafraUpdate = Partial<Safra>
export type TalhaoUpdate = Partial<Talhao>
export type ItemUpdate = Partial<Item>
export type ProdutoUpdate = Partial<Produto>
export type LoteUpdate = Partial<Lote>
export type ServicoUpdate = Partial<Servico>
export type ServicoItemUpdate = Partial<ServicoItem>
export type LancamentoUpdate = Partial<Lancamento>
export type LancamentoItemUpdate = Partial<LancamentoItem>
export type MaquinaUpdate = Partial<Maquina>

import type { Propriedade, Safra, Talhao, Item, Lote, Servico, ServicoItem, Lancamento, LancamentoItem, Maquina } from './supabase-local'

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
  localizacao: string
  responsavel: string
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
