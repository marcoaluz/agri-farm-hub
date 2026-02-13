import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

/**
 * Hook para fechar uma safra
 */
export function useFecharSafra() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      safraId, 
      usuarioId 
    }: { 
      safraId: string
      usuarioId: string 
    }) => {
      const { data, error } = await supabase.rpc('fechar_safra', {
        p_safra_id: safraId,
        p_usuario_id: usuarioId
      })

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['safras'] })
      toast.success(`Safra "${data.safra_nome}" fechada com sucesso!`, {
        description: `${data.total_lancamentos} lançamentos e ${data.total_lotes} lotes protegidos.`
      })
    },
    onError: (error: any) => {
      console.error('Erro ao fechar safra:', error)
      toast.error(`Erro ao fechar safra: ${error.message}`)
    }
  })
}

/**
 * Hook para reabrir uma safra
 */
export function useReabrirSafra() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      safraId, 
      usuarioId 
    }: { 
      safraId: string
      usuarioId: string 
    }) => {
      const { data, error } = await supabase.rpc('reabrir_safra', {
        p_safra_id: safraId,
        p_usuario_id: usuarioId
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safras'] })
      toast.success('Safra reaberta com sucesso!')
    },
    onError: (error: any) => {
      console.error('Erro ao reabrir safra:', error)
      toast.error(`Erro ao reabrir safra: ${error.message}`)
    }
  })
}

/**
 * Hook para verificar se safra está fechada
 */
export function useSafraFechada(safraId?: string) {
  return useQuery({
    queryKey: ['safra-fechada', safraId],
    queryFn: async () => {
      if (!safraId) return false

      const { data, error } = await supabase
        .from('safras')
        .select('fechada')
        .eq('id', safraId)
        .single()

      if (error) throw error
      return data?.fechada || false
    },
    enabled: !!safraId
  })
}
