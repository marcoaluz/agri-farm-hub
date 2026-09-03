import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface HistoricoAuditoria {
  id: string
  tabela?: string
  modulo: string
  registro_id?: string
  lancamento_id?: string
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
  propriedade_id?: string
  safra_id?: string
  resumo?: string
}

export const MODULOS_AUDITORIA = [
  'Lançamentos', 'Pecuária', 'Máquinas', 'Estoque', 'Talhões',
  'Safras', 'Contatos', 'Serviços', 'Agenda', 'Financeiro', 'Equipe', 'Propriedade',
] as const

export function useHistoricoLancamento(lancamentoId: string | null) {
  return useQuery({
    queryKey: ['historico-lancamento', lancamentoId],
    queryFn: async () => {
      if (!lancamentoId) return []
      const { data, error } = await supabase
        .from('vw_lancamentos_historico_completo')
        .select('*')
        .eq('lancamento_id', lancamentoId)
        .order('alterado_em', { ascending: false })
      if (error) throw error
      return (data as any[]).map(d => ({ ...d, modulo: 'Lançamentos' })) as HistoricoAuditoria[]
    },
    enabled: !!lancamentoId
  })
}

export function useHistoricoGeral(propriedadeId?: string, safraId?: string) {
  return useQuery({
    queryKey: ['historico-geral', propriedadeId, safraId],
    queryFn: async () => {
      // Fonte 1: histórico específico de Lançamentos (já existia, mais detalhado)
      let queryLanc = supabase
        .from('vw_lancamentos_historico_completo')
        .select('*')
        .order('alterado_em', { ascending: false })
        .limit(100)
      if (propriedadeId) queryLanc = queryLanc.eq('propriedade_id', propriedadeId)
      if (safraId) queryLanc = queryLanc.eq('safra_id', safraId)

      // Fonte 2: histórico geral (todas as outras telas de cadastro)
      let queryGeral = supabase
        .from('vw_auditoria_geral_completa')
        .select('*')
        .order('alterado_em', { ascending: false })
        .limit(150)
      if (propriedadeId) queryGeral = queryGeral.eq('propriedade_id', propriedadeId)

      const [{ data: lanc, error: errLanc }, { data: geral, error: errGeral }] = await Promise.all([queryLanc, queryGeral])
      if (errLanc) throw errLanc
      if (errGeral) throw errGeral

      const lancComModulo = (lanc || []).map((d: any) => ({ ...d, modulo: 'Lançamentos' }))
      const todos = [...lancComModulo, ...(geral || [])]
      todos.sort((a, b) => new Date(b.alterado_em).getTime() - new Date(a.alterado_em).getTime())
      return todos.slice(0, 150) as HistoricoAuditoria[]
    }
  })
}

export function useEstatisticasAuditoria(propriedadeId?: string, safraId?: string) {
  return useQuery({
    queryKey: ['estatisticas-auditoria', propriedadeId, safraId],
    queryFn: async () => {
      let queryLanc = supabase.from('vw_lancamentos_historico_completo').select('tipo_alteracao, alterado_em, propriedade_id, safra_id')
      if (propriedadeId) queryLanc = queryLanc.eq('propriedade_id', propriedadeId)
      if (safraId) queryLanc = queryLanc.eq('safra_id', safraId)

      let queryGeral = supabase.from('vw_auditoria_geral_completa').select('tipo_alteracao, alterado_em, propriedade_id')
      if (propriedadeId) queryGeral = queryGeral.eq('propriedade_id', propriedadeId)

      const [{ data: lanc, error: e1 }, { data: geral, error: e2 }] = await Promise.all([queryLanc, queryGeral])
      if (e1) throw e1
      if (e2) throw e2

      const data = [...(lanc || []), ...(geral || [])]
      const total = data.length
      const insercoes = data.filter(d => d.tipo_alteracao === 'INSERT').length
      const edicoes = data.filter(d => d.tipo_alteracao === 'UPDATE').length
      const exclusoes = data.filter(d => d.tipo_alteracao === 'DELETE').length

      const ontem = new Date()
      ontem.setDate(ontem.getDate() - 1)
      const ultimas24h = data.filter(d => new Date(d.alterado_em) > ontem).length

      return { total, insercoes, edicoes, exclusoes, ultimas24h }
    }
  })
}

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

export function formatarMoeda(valor: number | string | null): string {
  if (valor === null || valor === undefined) return 'R$ 0,00'
  const numero = typeof valor === 'string' ? parseFloat(valor) : valor
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero)
}

export function obterCamposAlterados(anterior: any, novo: any): string[] {
  if (!anterior || !novo) return []
  const camposIgnorados = ['updated_at', 'editado_em', 'editado_por']
  return Object.keys(novo).filter(key => {
    if (camposIgnorados.includes(key)) return false
    return JSON.stringify(anterior[key]) !== JSON.stringify(novo[key])
  })
}
