export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      propriedades: {
        Row: {
          id: string
          user_id: string
          nome: string
          area_total: number | null
          endereco: string | null
          cidade: string | null
          estado: string | null
          coordenadas_gps: string | null
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          area_total?: number | null
          endereco?: string | null
          cidade?: string | null
          estado?: string | null
          coordenadas_gps?: string | null
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          area_total?: number | null
          endereco?: string | null
          cidade?: string | null
          estado?: string | null
          coordenadas_gps?: string | null
          ativo?: boolean
          created_at?: string
        }
      }
      safras: {
        Row: {
          id: string
          propriedade_id: string
          nome: string
          ano_inicio: number
          ano_fim: number | null
          ativa: boolean
          created_at: string
        }
        Insert: {
          id?: string
          propriedade_id: string
          nome: string
          ano_inicio: number
          ano_fim?: number | null
          ativa?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          propriedade_id?: string
          nome?: string
          ano_inicio?: number
          ano_fim?: number | null
          ativa?: boolean
          created_at?: string
        }
      }
      talhoes: {
        Row: {
          id: string
          propriedade_id: string
          nome: string
          area_ha: number
          cultura_atual: string | null
          status: string | null
          coordenadas: string | null
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          propriedade_id: string
          nome: string
          area_ha: number
          cultura_atual?: string | null
          status?: string | null
          coordenadas?: string | null
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          propriedade_id?: string
          nome?: string
          area_ha?: number
          cultura_atual?: string | null
          status?: string | null
          coordenadas?: string | null
          ativo?: boolean
          created_at?: string
        }
      }
      itens: {
        Row: {
          id: string
          propriedade_id: string
          nome: string
          tipo: 'produto_estoque' | 'servico' | 'maquina_hora'
          categoria: string
          unidade_medida: string
          produto_id: string | null
          maquina_id: string | null
          custo_padrao: number | null
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          propriedade_id: string
          nome: string
          tipo: 'produto_estoque' | 'servico' | 'maquina_hora'
          categoria: string
          unidade_medida: string
          produto_id?: string | null
          maquina_id?: string | null
          custo_padrao?: number | null
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          propriedade_id?: string
          nome?: string
          tipo?: 'produto_estoque' | 'servico' | 'maquina_hora'
          categoria?: string
          unidade_medida?: string
          produto_id?: string | null
          maquina_id?: string | null
          custo_padrao?: number | null
          ativo?: boolean
          created_at?: string
        }
      }
      produtos: {
        Row: {
          id: string
          propriedade_id: string
          nome: string
          categoria: string
          unidade: string
          saldo_atual: number
          nivel_minimo: number | null
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          propriedade_id: string
          nome: string
          categoria: string
          unidade: string
          saldo_atual?: number
          nivel_minimo?: number | null
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          propriedade_id?: string
          nome?: string
          categoria?: string
          unidade?: string
          saldo_atual?: number
          nivel_minimo?: number | null
          ativo?: boolean
          created_at?: string
        }
      }
      lotes: {
        Row: {
          id: string
          produto_id: string
          qtd_original: number
          qtd_disponivel: number
          custo_unitario: number
          data_entrada: string
          data_validade: string | null
          nota_fiscal: string | null
          fornecedor: string | null
          created_at: string
        }
        Insert: {
          id?: string
          produto_id: string
          qtd_original: number
          qtd_disponivel: number
          custo_unitario: number
          data_entrada: string
          data_validade?: string | null
          nota_fiscal?: string | null
          fornecedor?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          produto_id?: string
          qtd_original?: number
          qtd_disponivel?: number
          custo_unitario?: number
          data_entrada?: string
          data_validade?: string | null
          nota_fiscal?: string | null
          fornecedor?: string | null
          created_at?: string
        }
      }
      servicos: {
        Row: {
          id: string
          propriedade_id: string
          nome: string
          categoria: string
          requer_talhao: boolean
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          propriedade_id: string
          nome: string
          categoria: string
          requer_talhao?: boolean
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          propriedade_id?: string
          nome?: string
          categoria?: string
          requer_talhao?: boolean
          ativo?: boolean
          created_at?: string
        }
      }
      servicos_itens: {
        Row: {
          id: string
          servico_id: string
          item_id: string
          tipo_item: 'categoria_inteira' | 'produto_especifico'
          categoria: string | null
          obrigatorio: boolean
          quantidade_sugerida: number | null
          ordem: number
        }
        Insert: {
          id?: string
          servico_id: string
          item_id: string
          tipo_item?: 'categoria_inteira' | 'produto_especifico'
          categoria?: string | null
          obrigatorio?: boolean
          quantidade_sugerida?: number | null
          ordem?: number
        }
        Update: {
          id?: string
          servico_id?: string
          item_id?: string
          tipo_item?: 'categoria_inteira' | 'produto_especifico'
          categoria?: string | null
          obrigatorio?: boolean
          quantidade_sugerida?: number | null
          ordem?: number
        }
      }
      lancamentos: {
        Row: {
          id: string
          propriedade_id: string
          safra_id: string
          servico_id: string
          talhao_id: string | null
          data_execucao: string
          custo_total: number
          observacoes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          propriedade_id: string
          safra_id: string
          servico_id: string
          talhao_id?: string | null
          data_execucao: string
          custo_total?: number
          observacoes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          propriedade_id?: string
          safra_id?: string
          servico_id?: string
          talhao_id?: string | null
          data_execucao?: string
          custo_total?: number
          observacoes?: string | null
          created_by?: string
          created_at?: string
        }
      }
      lancamentos_itens: {
        Row: {
          id: string
          lancamento_id: string
          item_id: string
          quantidade: number
          custo_unitario: number
          custo_total: number
          detalhamento_lotes: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          lancamento_id: string
          item_id: string
          quantidade: number
          custo_unitario: number
          custo_total: number
          detalhamento_lotes?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          lancamento_id?: string
          item_id?: string
          quantidade?: number
          custo_unitario?: number
          custo_total?: number
          detalhamento_lotes?: Json | null
          created_at?: string
        }
      }
      maquinas: {
        Row: {
          id: string
          propriedade_id: string
          nome: string
          tipo: string
          marca: string | null
          modelo: string | null
          ano: number | null
          horimetro_atual: number
          custo_hora: number | null
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          propriedade_id: string
          nome: string
          tipo: string
          marca?: string | null
          modelo?: string | null
          ano?: number | null
          horimetro_atual?: number
          custo_hora?: number | null
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          propriedade_id?: string
          nome?: string
          tipo?: string
          marca?: string | null
          modelo?: string | null
          ano?: number | null
          horimetro_atual?: number
          custo_hora?: number | null
          ativo?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      vw_produtos_custos: {
        Row: {
          id: string
          nome: string
          saldo_atual: number
          custo_medio: number | null
          valor_imobilizado: number | null
        }
      }
      vw_itens_custos: {
        Row: {
          id: string
          nome: string
          tipo: string
          custo_unitario: number | null
        }
      }
    }
    Functions: {
      obter_lotes_fifo: {
        Args: {
          p_produto_id: string
          p_quantidade: number
        }
        Returns: {
          lote_id: string
          quantidade_disponivel: number
          quantidade_consumir: number
          custo_unitario: number
          subtotal: number
          nota_fiscal: string
          data_entrada: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
