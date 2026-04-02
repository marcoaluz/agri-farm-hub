export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ordenhas: {
        Row: {
          created_at: string
          data: string
          destino: string | null
          id: string
          litros: number
          observacoes: string | null
          preco_litro: number | null
          propriedade_id: string
          qualidade: string | null
          rebanho_id: string
          turno: string
          vacas_ordenhadas: number | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string
          data?: string
          destino?: string | null
          id?: string
          litros: number
          observacoes?: string | null
          preco_litro?: number | null
          propriedade_id: string
          qualidade?: string | null
          rebanho_id: string
          turno?: string
          vacas_ordenhadas?: number | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string
          data?: string
          destino?: string | null
          id?: string
          litros?: number
          observacoes?: string | null
          preco_litro?: number | null
          propriedade_id?: string
          qualidade?: string | null
          rebanho_id?: string
          turno?: string
          vacas_ordenhadas?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenhas_rebanho_id_fkey"
            columns: ["rebanho_id"]
            isOneToOne: false
            referencedRelation: "rebanhos"
            referencedColumns: ["id"]
          },
        ]
      }
      rebanho_movimentacoes: {
        Row: {
          created_at: string
          data_evento: string
          fornecedor_comprador: string | null
          id: string
          observacoes: string | null
          peso_medio_kg: number | null
          propriedade_id: string
          quantidade: number
          rebanho_id: string
          tipo: string
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          data_evento?: string
          fornecedor_comprador?: string | null
          id?: string
          observacoes?: string | null
          peso_medio_kg?: number | null
          propriedade_id: string
          quantidade?: number
          rebanho_id: string
          tipo: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          data_evento?: string
          fornecedor_comprador?: string | null
          id?: string
          observacoes?: string | null
          peso_medio_kg?: number | null
          propriedade_id?: string
          quantidade?: number
          rebanho_id?: string
          tipo?: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rebanho_movimentacoes_rebanho_id_fkey"
            columns: ["rebanho_id"]
            isOneToOne: false
            referencedRelation: "rebanhos"
            referencedColumns: ["id"]
          },
        ]
      }
      rebanhos: {
        Row: {
          ativo: boolean
          created_at: string
          data_formacao: string | null
          especie: string
          finalidade: string | null
          id: string
          localizacao: string | null
          nome: string
          observacoes: string | null
          propriedade_id: string
          quantidade_atual: number
          raca: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_formacao?: string | null
          especie?: string
          finalidade?: string | null
          id?: string
          localizacao?: string | null
          nome: string
          observacoes?: string | null
          propriedade_id: string
          quantidade_atual?: number
          raca?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_formacao?: string | null
          especie?: string
          finalidade?: string | null
          id?: string
          localizacao?: string | null
          nome?: string
          observacoes?: string | null
          propriedade_id?: string
          quantidade_atual?: number
          raca?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sanitario_eventos: {
        Row: {
          created_at: string
          custo: number | null
          data_aplicacao: string
          data_proxima: string | null
          descricao: string
          id: string
          lote_produto: string | null
          observacoes: string | null
          propriedade_id: string
          quantidade_dose: number | null
          rebanho_id: string | null
          responsavel: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          custo?: number | null
          data_aplicacao?: string
          data_proxima?: string | null
          descricao: string
          id?: string
          lote_produto?: string | null
          observacoes?: string | null
          propriedade_id: string
          quantidade_dose?: number | null
          rebanho_id?: string | null
          responsavel?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          custo?: number | null
          data_aplicacao?: string
          data_proxima?: string | null
          descricao?: string
          id?: string
          lote_produto?: string | null
          observacoes?: string | null
          propriedade_id?: string
          quantidade_dose?: number | null
          rebanho_id?: string | null
          responsavel?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanitario_eventos_rebanho_id_fkey"
            columns: ["rebanho_id"]
            isOneToOne: false
            referencedRelation: "rebanhos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_consolidado: {
        Args: { p_propriedade_id?: string; p_safra_id?: string }
        Returns: {
          area_operada_ha: number
          custo_total: number
          despesas_pagas: number
          propriedade_id: string
          propriedade_nome: string
          receitas_pagas: number
          saldo: number
          total_lancamentos: number
        }[]
      }
      get_estoque_producao: {
        Args: { p_propriedade_id?: string }
        Returns: {
          cultura_id: string
          cultura_nome: string
          icone: string
          propriedade_id: string
          propriedade_nome: string
          saldo_disponivel: number
          total_entradas: number
          total_saidas: number
          unidade_label: string
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
