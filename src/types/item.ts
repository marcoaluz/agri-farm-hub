// src/types/item.ts

export type ItemTipo = 'produto_estoque' | 'servico' | 'maquina_hora'

export type ItemUnidade = 
  | 'kg' | 'ton' | 'litro' | 'ml' | 'saca'
  | 'hora' | 'dia' | 'diaria'
  | 'ha' | 'unidade' | 'servico'

export interface Item {
  id: string
  propriedade_id: string
  nome: string
  tipo: ItemTipo
  categoria?: string | null
  unidade_medida: ItemUnidade
  
  // Vínculos opcionais
  produto_id?: string | null
  maquina_id?: string | null
  
  custo_padrao?: number | null
  ativo: boolean
  created_at?: string
}

export interface ItemComCusto extends Item {
  custo_unitario: number
  estoque_disponivel?: number
  valor_imobilizado?: number
}

export interface CreateItemDTO {
  propriedade_id: string
  nome: string
  tipo: ItemTipo
  categoria?: string | null
  unidade_medida: ItemUnidade
  produto_id?: string | null
  maquina_id?: string | null
  custo_padrao?: number | null
}

export interface UpdateItemDTO extends Partial<Omit<CreateItemDTO, 'unidade_medida'>> {
  unidade_medida?: string
  ativo?: boolean
}

// Helper type for form data where unidade_medida is string
export interface ItemFormPayload {
  propriedade_id: string
  nome: string
  tipo: ItemTipo
  categoria?: string | null
  unidade_medida: string
  produto_id?: string | null
  maquina_id?: string | null
  custo_padrao?: number | null
}
