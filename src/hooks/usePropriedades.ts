import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Propriedade } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

interface PropriedadeFormData {
  nome: string
  area_total?: number | null
  endereco?: string
  cidade: string
  estado: string
  coordenadas_gps?: string
}

export function usePropriedades() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: propriedades = [], isLoading } = useQuery({
    queryKey: ['propriedades', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propriedades')
        .select('*')
        .eq('user_id', user!.id)
        .order('nome')

      if (error) throw error
      return data as Propriedade[]
    },
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: async (propriedade: PropriedadeFormData) => {
      const { data, error } = await supabase
        .from('propriedades')
        .insert({
          nome: propriedade.nome,
          area_total: propriedade.area_total ?? null,
          endereco: propriedade.endereco || null,
          cidade: propriedade.cidade,
          estado: propriedade.estado,
          coordenadas_gps: propriedade.coordenadas_gps || null,
          user_id: user!.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
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
          endereco: updates.endereco || null,
          cidade: updates.cidade,
          estado: updates.estado,
          coordenadas_gps: updates.coordenadas_gps || null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
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
      const { error } = await supabase
        .from('propriedades')
        .update({ ativo: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
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
