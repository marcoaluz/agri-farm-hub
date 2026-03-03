import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface FiltrosRelatorio {
  data_inicio?: string
  data_fim?: string
  talhao_id?: string
  servico_id?: string
  categoria?: string
  tipo?: string
  status?: string
  safra_id?: string
}

function extrairId(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v.id) return v.id
  return ''
}

function fromView(viewName: string) {
  return (supabase as any).from(viewName)
}

export function useRelatorioOperacional(
  propriedadeId: string,
  safraId: string,
  filtros: FiltrosRelatorio
) {
  const idProp = extrairId(propriedadeId)
  const idSafra = extrairId(safraId)

  const lancamentos = useQuery({
    queryKey: ['rel-lancamentos', idProp, idSafra, filtros],
    queryFn: async () => {
      let q = fromView('vw_relatorio_lancamentos')
        .select('*')
        .eq('propriedade_id', idProp)
        .eq('safra_id', idSafra)
      if (filtros.data_inicio) q = q.gte('data_execucao', filtros.data_inicio)
      if (filtros.data_fim) q = q.lte('data_execucao', filtros.data_fim)
      if (filtros.talhao_id) q = q.eq('talhao_id', filtros.talhao_id)
      if (filtros.categoria) q = q.eq('servico_categoria', filtros.categoria)
      const { data, error } = await q.order('data_execucao', { ascending: false })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!idProp && !!idSafra,
  })

  const porTalhao = useQuery({
    queryKey: ['rel-talhao', idProp, idSafra],
    queryFn: async () => {
      const { data, error } = await fromView('vw_relatorio_por_talhao')
        .select('*')
        .eq('propriedade_id', idProp)
        .eq('safra_id', idSafra)
        .order('custo_total', { ascending: false })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!idProp && !!idSafra,
  })

  const porCategoria = useQuery({
    queryKey: ['rel-categoria', idProp, idSafra],
    queryFn: async () => {
      const { data, error } = await fromView('vw_relatorio_por_categoria')
        .select('*')
        .eq('propriedade_id', idProp)
        .eq('safra_id', idSafra)
        .order('custo_total', { ascending: false })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!idProp && !!idSafra,
  })

  const porMes = useQuery({
    queryKey: ['rel-mes', idProp, idSafra],
    queryFn: async () => {
      const { data, error } = await fromView('vw_custos_por_mes')
        .select('*')
        .eq('propriedade_id', idProp)
        .eq('safra_id', idSafra)
        .order('mes', { ascending: true })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!idProp && !!idSafra,
  })

  return { lancamentos, porTalhao, porCategoria, porMes }
}

export function useRelatorioFinanceiro(
  propriedadeId: string,
  safraId: string,
  filtros: FiltrosRelatorio
) {
  const idProp = extrairId(propriedadeId)
  const idSafra = extrairId(safraId)

  const transacoes = useQuery({
    queryKey: ['rel-financeiro', idProp, idSafra, filtros],
    queryFn: async () => {
      let q = fromView('transacoes')
        .select('*')
        .eq('propriedade_id', idProp)
        .eq('safra_id', idSafra)
      if (filtros.tipo) q = q.eq('tipo', filtros.tipo)
      if (filtros.status && filtros.status !== 'vencido') q = q.eq('status', filtros.status)
      if (filtros.categoria) q = q.eq('categoria', filtros.categoria)
      if (filtros.data_inicio) q = q.gte('data_vencimento', filtros.data_inicio)
      if (filtros.data_fim) q = q.lte('data_vencimento', filtros.data_fim)
      const { data, error } = await q.order('data_vencimento', { ascending: false })
      if (error) throw error
      let result = (data || []) as any[]
      if (filtros.status === 'vencido') {
        const hoje = new Date().toISOString().split('T')[0]
        result = result.filter((t: any) => t.status === 'pendente' && t.data_vencimento < hoje)
      }
      return result
    },
    enabled: !!idProp && !!idSafra,
  })

  const fluxoMensal = useQuery({
    queryKey: ['rel-fluxo-mensal', idProp, idSafra],
    queryFn: async () => {
      const { data, error } = await fromView('vw_fluxo_caixa_mensal')
        .select('*')
        .eq('propriedade_id', idProp)
        .eq('safra_id', idSafra)
        .order('mes', { ascending: true })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!idProp && !!idSafra,
  })

  return { transacoes, fluxoMensal }
}

export function useRelatorioComparativo(
  propriedadeId: string,
  safraIds: string[]
) {
  const idProp = extrairId(propriedadeId)

  const porSafra = useQuery({
    queryKey: ['rel-comparativo', idProp, safraIds],
    queryFn: async () => {
      if (!safraIds.length) return []
      const results = await Promise.all(
        safraIds.map(async (sid) => {
          const id = extrairId(sid)
          const [talhaoRes, mesRes] = await Promise.all([
            fromView('vw_relatorio_por_talhao').select('*').eq('propriedade_id', idProp).eq('safra_id', id),
            fromView('vw_custos_por_mes').select('*').eq('propriedade_id', idProp).eq('safra_id', id).order('mes', { ascending: true }),
          ])
          const talhoes = (talhaoRes.data || []) as any[]
          const meses = (mesRes.data || []) as any[]
          const custoTotal = talhoes.reduce((s: number, t: any) => s + Number(t.custo_total || 0), 0)
          const areaTotal = talhoes.reduce((s: number, t: any) => s + Number(t.area_ha || 0), 0)
          const totalLanc = talhoes.reduce((s: number, t: any) => s + Number(t.total_lancamentos || 0), 0)
          return { safra_id: id, custoTotal, areaTotal, totalLancamentos: totalLanc, custoHa: areaTotal > 0 ? custoTotal / areaTotal : 0, meses, talhoes }
        })
      )
      return results
    },
    enabled: !!idProp && safraIds.length > 0,
  })

  return { porSafra }
}

export function statusEfetivoTransacao(t: any): string {
  if (t.status === 'pendente' && t.data_vencimento < new Date().toISOString().split('T')[0]) {
    return 'vencido'
  }
  return t.status
}
