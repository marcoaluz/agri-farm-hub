import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Transacao {
  id: string
  propriedade_id: string
  safra_id: string
  talhao_id: string | null
  tipo: 'receita' | 'despesa'
  categoria: string
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento: string | null
  status: 'pendente' | 'pago' | 'cancelado' | 'vencido'
  fornecedor_cliente: string | null
  numero_nf: string | null
  forma_pagamento: string | null
  observacoes: string | null
  parcela_numero: number | null
  parcela_total: number | null
  parcela_grupo_id: string | null
  lancamento_id: string | null
  origem: 'manual' | 'lancamento' | 'abastecimento'
  criado_por: string | null
  cultura_id?: string | null
  quantidade_produzida?: number | null
  created_at: string
  updated_at: string
  talhao?: { nome: string } | null
}

export interface TransacaoPayload {
  propriedade_id: string
  safra_id: string
  talhao_id?: string | null
  tipo: 'receita' | 'despesa'
  categoria: string
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string | null
  status: 'pendente' | 'pago' | 'cancelado'
  fornecedor_cliente?: string | null
  numero_nf?: string | null
  forma_pagamento?: string | null
  observacoes?: string | null
  origem?: string
  parcelas?: number
}

export interface FiltrosTransacao {
  tipo?: string
  status?: string
  categoria?: string
  data_inicio?: string
  data_fim?: string
  busca?: string
}

export const statusEfetivo = (t: Transacao): string => {
  if (t.status === 'pendente' && t.data_vencimento < new Date().toISOString().split('T')[0]) {
    return 'vencido'
  }
  return t.status
}

export function useTransacoes(propriedadeId?: string | null, safraId?: string | null, filtros?: FiltrosTransacao) {
  const idProp = typeof propriedadeId === 'object' ? (propriedadeId as any)?.id : propriedadeId
  const idSafra = typeof safraId === 'object' ? (safraId as any)?.id : safraId

  return useQuery({
    queryKey: ['transacoes', idProp, idSafra, filtros],
    queryFn: async () => {
      let query = supabase
        .from('transacoes')
        .select('*, talhao:talhoes(nome)')
        .eq('propriedade_id', idProp)
        .eq('safra_id', idSafra)

      if (filtros?.tipo) query = query.eq('tipo', filtros.tipo)
      if (filtros?.status) {
        if (filtros.status === 'vencido') {
          query = query.eq('status', 'pendente').lt('data_vencimento', new Date().toISOString().split('T')[0])
        } else {
          query = query.eq('status', filtros.status)
        }
      }
      if (filtros?.categoria) query = query.eq('categoria', filtros.categoria)
      if (filtros?.data_inicio) query = query.gte('data_vencimento', filtros.data_inicio)
      if (filtros?.data_fim) query = query.lte('data_vencimento', filtros.data_fim)
      if (filtros?.busca) query = query.ilike('descricao', `%${filtros.busca}%`)

      const { data, error } = await query.order('data_vencimento', { ascending: true })
      if (error) throw error
      return (data || []) as Transacao[]
    },
    enabled: !!idProp && !!idSafra,
  })
}

export function useResumoFinanceiroView(propriedadeId?: string | null, safraId?: string | null) {
  const idProp = typeof propriedadeId === 'object' ? (propriedadeId as any)?.id : propriedadeId
  const idSafra = typeof safraId === 'object' ? (safraId as any)?.id : safraId

  return useQuery({
    queryKey: ['resumo-financeiro', idProp, idSafra],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_resumo_financeiro')
        .select('*')
        .eq('propriedade_id', idProp)
        .eq('safra_id', idSafra)
      if (error) throw error
      return data || []
    },
    enabled: !!idProp && !!idSafra,
  })
}

export function useFluxoCaixaMensal(propriedadeId?: string | null, safraId?: string | null) {
  const idProp = typeof propriedadeId === 'object' ? (propriedadeId as any)?.id : propriedadeId
  const idSafra = typeof safraId === 'object' ? (safraId as any)?.id : safraId

  return useQuery({
    queryKey: ['fluxo-caixa', idProp, idSafra],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_fluxo_caixa_mensal')
        .select('*')
        .eq('propriedade_id', idProp)
        .eq('safra_id', idSafra)
        .order('mes', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!idProp && !!idSafra,
  })
}

export function useCreateTransacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TransacaoPayload) => {
      const { parcelas, ...dados } = payload
      if (parcelas && parcelas > 1) {
        const grupo_id = crypto.randomUUID()
        const valorParcela = Math.round((dados.valor / parcelas) * 100) / 100
        const inserts = Array.from({ length: parcelas }, (_, i) => {
          const dt = new Date(dados.data_vencimento)
          dt.setMonth(dt.getMonth() + i)
          return {
            ...dados,
            valor: valorParcela,
            data_vencimento: dt.toISOString().split('T')[0],
            parcela_numero: i + 1,
            parcela_total: parcelas,
            parcela_grupo_id: grupo_id,
            descricao: `${dados.descricao} (${i + 1}/${parcelas})`,
            origem: dados.origem || 'manual',
          }
        })
        const { error } = await supabase.from('transacoes').insert(inserts)
        if (error) throw error
      } else {
        const { error } = await supabase.from('transacoes').insert({ ...dados, origem: dados.origem || 'manual' })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      queryClient.invalidateQueries({ queryKey: ['resumo-financeiro'] })
      queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] })
    },
  })
}

export function useUpdateTransacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dados }: Partial<TransacaoPayload> & { id: string }) => {
      const { error } = await supabase.from('transacoes').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      queryClient.invalidateQueries({ queryKey: ['resumo-financeiro'] })
      queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] })
    },
  })
}

export function useDeleteTransacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transacoes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      queryClient.invalidateQueries({ queryKey: ['resumo-financeiro'] })
      queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] })
    },
  })
}

export function useMarcarPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transacoes')
        .update({ status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      queryClient.invalidateQueries({ queryKey: ['resumo-financeiro'] })
      queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] })
    },
  })
}
