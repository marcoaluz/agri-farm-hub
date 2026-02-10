import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface HistoricoAuditoria {
  id: string
  lancamento_id: string
  tipo_alteracao: 'INSERT' | 'UPDATE' | 'DELETE'
  dados_anteriores: any
  dados_novos: any
  alterado_por: string
  alterado_em: string
  motivo?: string
  usuario_email?: string
  usuario_nome?: string
  servico_nome?: string
  talhao_nome?: string
  propriedade_nome?: string
}

export function useHistoricoLancamento(lancamentoId: string | null) {
  return useQuery({
    queryKey: ['historico-lancamento', lancamentoId],
    queryFn: async () => {
      if (!lancamentoId) return []

      const { data, error } = await supabase
        .from('lancamentos_historico')
        .select('*')
        .eq('lancamento_id', lancamentoId)
        .in('tipo_alteracao', ['UPDATE', 'DELETE'])
        .order('alterado_em', { ascending: false })

      if (error) throw error
      return data as HistoricoAuditoria[]
    },
    enabled: !!lancamentoId
  })
}
