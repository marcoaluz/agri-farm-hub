import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Propriedade } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useGlobal } from '@/contexts/GlobalContext'
import { solicitarExclusaoEntidade } from '@/lib/solicitarExclusao'


interface PropriedadeFormData {
  nome: string
  area_total?: number | null
  localizacao?: string
  responsavel?: string
  latitude?: number | null
  longitude?: number | null
  dono_id?: string | null
}

export function usePropriedades() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { refetchPropriedades } = useGlobal()


  const { data: propriedades = [], isLoading } = useQuery({
    queryKey: ['propriedades', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propriedades')
        .select('*')
        .eq('ativo', true)
        .order('nome')

      if (error) throw error
      return data as Propriedade[]
    },
    enabled: !authLoading && !!user,
  })

  const createMutation = useMutation({
    mutationFn: async (propriedade: PropriedadeFormData) => {
      if (propriedade.dono_id) {
        const { data, error } = await supabase.rpc('criar_propriedade_para_dono' as any, {
          p_dono_id: propriedade.dono_id,
          p_nome: propriedade.nome,
          p_area_total: propriedade.area_total ?? null,
          p_localizacao: propriedade.localizacao || null,
          p_responsavel: propriedade.responsavel || null,
          p_latitude: propriedade.latitude ?? null,
          p_longitude: propriedade.longitude ?? null,
        })
        if (error) throw error
        return data
      }

      const { data, error } = await supabase
        .from('propriedades')
        .insert({
          nome: propriedade.nome,
          area_total: propriedade.area_total ?? null,
          localizacao: propriedade.localizacao || null,
          responsavel: propriedade.responsavel || null,
          latitude: propriedade.latitude ?? null,
          longitude: propriedade.longitude ?? null,
          user_id: user!.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
      queryClient.invalidateQueries({ queryKey: ['user-properties'] })
      queryClient.refetchQueries({ queryKey: ['propriedades'] })
      await refetchPropriedades()
      toast({
        title: 'Propriedade criada!',
        description: 'A propriedade foi cadastrada com sucesso.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar propriedade',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: PropriedadeFormData
    }) => {
      const { data, error } = await supabase
        .from('propriedades')
        .update({
          nome: updates.nome,
          area_total: updates.area_total ?? null,
          localizacao: updates.localizacao || null,
          responsavel: updates.responsavel || null,
          latitude: updates.latitude ?? null,
          longitude: updates.longitude ?? null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
      queryClient.invalidateQueries({ queryKey: ['user-properties'] })
      await refetchPropriedades()
      toast({
        title: 'Propriedade atualizada!',
        description: 'As alterações foram salvas com sucesso.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar propriedade',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await solicitarExclusaoEntidade('propriedade', id)
    },
    onSuccess: async (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-exclusao-pendentes'] })
      if (!resultado.executado) {
        toast({
          title: 'Pedido enviado!',
          description: resultado.mensagem || 'Aguardando aprovação do proprietário.',
        })
        return
      }
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
      queryClient.invalidateQueries({ queryKey: ['user-properties'] })
      await refetchPropriedades()
      toast({
        title: 'Propriedade removida!',
        description: 'A propriedade foi desativada.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover propriedade',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return {
    propriedades,
    isLoading,
    createPropriedade: createMutation.mutate,
    updatePropriedade: updateMutation.mutate,
    deletePropriedade: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
