// Local type definitions for external Supabase project
// These types match the user's existing database schema

export interface Propriedade {
  id: string
  user_id: string
  nome: string
  area_total?: number
  localizacao?: string
  responsavel?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Safra {
  id: string
  propriedade_id: string
  nome: string
  ano_inicio: number
  ano_fim: number
  status?: string
  ativa?: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Talhao {
  id: string
  propriedade_id: string
  nome: string
  area_ha: number
  cultura_atual?: string
  status?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  propriedade_id?: string
  nome: string
  descricao?: string
  tipo: 'produto_estoque' | 'servico' | 'maquina_hora'
  unidade_medida: string
  custo_unitario?: number
  quantidade_estoque?: number
  produto_id?: string
  maquina_id?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Lote {
  id: string
  produto_id: string
  nota_fiscal?: string
  data_entrada: string
  quantidade_inicial: number
  quantidade_atual: number
  custo_unitario: number
  fornecedor?: string
  observacoes?: string
  created_at: string
}

export interface Servico {
  id: string
  propriedade_id: string
  nome: string
  descricao?: string
  categoria?: string
  requer_talhao?: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ServicoItem {
  id: string
  servico_id: string
  item_id: string
  quantidade_padrao?: number
  obrigatorio: boolean
  item?: Item
}

export interface Lancamento {
  id: string
  propriedade_id: string
  safra_id: string
  servico_id: string
  talhao_id?: string
  data_execucao: string
  observacoes?: string
  custo_total: number
  status: string
  created_at: string
  updated_at: string
  servico?: Servico
  talhao?: Talhao
  lancamentos_itens?: LancamentoItem[]
}

export interface LancamentoItem {
  id: string
  lancamento_id: string
  item_id: string
  quantidade: number
  custo_unitario: number
  custo_total: number
  detalhamento_lotes?: any
  item?: Item
}

export interface Maquina {
  id: string
  propriedade_id: string
  nome: string
  modelo?: string
  ano_fabricacao?: number
  horimetro_inicial: number
  horimetro_atual: number
  custo_hora?: number
  ativo: boolean
  created_at: string
}

export interface PreviewCustoResponse {
  item_tipo: string
  custo_total: number
  custo_unitario: number
  estoque_disponivel?: number
  estoque_suficiente?: boolean
  preview_consumo?: PreviewConsumoLote[]
}

export interface PreviewConsumoLote {
  lote_id: string
  nota_fiscal: string
  data_entrada: string
  quantidade: number
  custo_unitario: number
  subtotal: number
}
