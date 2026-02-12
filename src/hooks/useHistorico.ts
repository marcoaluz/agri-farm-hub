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

export function useHistoricoGeral(propriedadeId?: string) {
  return useQuery({
    queryKey: ['historico-geral', propriedadeId],
    queryFn: async () => {
      let query = supabase
        .from('lancamentos_historico')
        .select('*')
        .in('tipo_alteracao', ['UPDATE', 'DELETE'])
        .order('alterado_em', { ascending: false })
        .limit(100)

      if (propriedadeId) {
        query = query.eq('propriedade_id', propriedadeId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as HistoricoAuditoria[]
    }
  })
}

export function useEstatisticasAuditoria(propriedadeId?: string) {
  return useQuery({
    queryKey: ['estatisticas-auditoria', propriedadeId],
    queryFn: async () => {
      let query = supabase
        .from('lancamentos_historico')
        .select('tipo_alteracao, alterado_em')

      if (propriedadeId) {
        query = query.eq('propriedade_id', propriedadeId)
      }

      const { data, error } = await query
      if (error) throw error

      const total = data?.length || 0
      const edicoes = data?.filter(d => d.tipo_alteracao === 'UPDATE').length || 0
      const exclusoes = data?.filter(d => d.tipo_alteracao === 'DELETE').length || 0

      const ontem = new Date()
      ontem.setDate(ontem.getDate() - 1)
      const ultimas24h = data?.filter(d =>
        new Date(d.alterado_em) > ontem
      ).length || 0

      return { total, edicoes, exclusoes, ultimas24h }
    }
  })
}

/**
 * Extrai informações resumidas do lançamento a partir do JSON
 */
export function extrairInfoLancamento(dados: any) {
  if (!dados) return null
  
  return {
    servico_id: dados.servico_id,
    talhao_id: dados.talhao_id,
    data_execucao: dados.data_execucao,
    custo_total: dados.custo_total,
    observacoes: dados.observacoes,
    propriedade_id: dados.propriedade_id
  }
}

/**
 * Formata valor monetário
 */
export function formatarMoeda(valor: number | string | null): string {
  if (valor === null || valor === undefined) return 'R$ 0,00'
  const numero = typeof valor === 'string' ? parseFloat(valor) : valor
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numero)
}

/**
 * Compara dois objetos e retorna campos alterados
 */
export function obterCamposAlterados(anterior: any, novo: any): string[] {
  if (!anterior || !novo) return []
  
  const camposIgnorados = ['updated_at', 'editado_em', 'editado_por']
  
  return Object.keys(novo).filter(key => {
    if (camposIgnorados.includes(key)) return false
    return JSON.stringify(anterior[key]) !== JSON.stringify(novo[key])
  })
}
