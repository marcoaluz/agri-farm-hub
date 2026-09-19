import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface BalanceteMes {
  mes: number
  credito: number
  debito: number
  saldo: number
  contabilizado: boolean
  contabilizado_por_nome: string | null
  contabilizado_em: string | null
  fechamento_id: string | null
  qtd_anexos: number
}

export function useBalanceteMensal(propriedadeId?: string | null, ano?: number) {
  return useQuery({
    queryKey: ['balancete-mensal', propriedadeId, ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_balancete_mensal' as any, {
        p_propriedade_id: propriedadeId,
        p_ano: ano,
      })
      if (error) throw error
      return ((data || []) as unknown as BalanceteMes[]).map(m => ({
        ...m,
        credito: Number(m.credito || 0),
        debito: Number(m.debito || 0),
        saldo: Number(m.saldo || 0),
      }))
    },
    enabled: !!propriedadeId && !!ano,
  })
}

/** Marca/desmarca um mês como contabilizado (upsert em fechamentos_contabeis). */
export function useToggleFechamento(propriedadeId?: string | null, ano?: number) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ mes, contabilizado }: { mes: number; contabilizado: boolean }) => {
      if (!propriedadeId || !ano) throw new Error('Propriedade ou ano não definidos')
      const { error } = await supabase
        .from('fechamentos_contabeis' as any)
        .upsert(
          {
            propriedade_id: propriedadeId,
            ano,
            mes,
            contabilizado,
            contabilizado_por: contabilizado ? user?.id ?? null : null,
            contabilizado_em: contabilizado ? new Date().toISOString() : null,
          },
          { onConflict: 'propriedade_id,ano,mes' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balancete-mensal'] })
    },
  })
}

/**
 * Garante que exista uma linha em fechamentos_contabeis pro mês (necessária pra anexar
 * arquivos), sem sobrescrever um fechamento que já exista — usa upsert com
 * ignoreDuplicates pra não correr o risco de desfazer uma contabilização feita
 * por outra pessoa entre o carregamento da tela e o clique.
 */
export function useGarantirFechamento(propriedadeId?: string | null, ano?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (mes: number) => {
      if (!propriedadeId || !ano) throw new Error('Propriedade ou ano não definidos')
      const { error: upsertError } = await supabase
        .from('fechamentos_contabeis' as any)
        .upsert(
          { propriedade_id: propriedadeId, ano, mes, contabilizado: false },
          { onConflict: 'propriedade_id,ano,mes', ignoreDuplicates: true }
        )
      if (upsertError) throw upsertError

      const { data, error } = await supabase
        .from('fechamentos_contabeis' as any)
        .select('id')
        .eq('propriedade_id', propriedadeId)
        .eq('ano', ano)
        .eq('mes', mes)
        .single()
      if (error) throw error
      return (data as any).id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balancete-mensal'] })
    },
  })
}
