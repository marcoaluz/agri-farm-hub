import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import type { Item, ItemComCusto, ItemFormPayload, ItemTipo } from '@/types/item'

// Hook para listar itens com custos
export function useItens(propriedadeId: string | undefined, tipo?: ItemTipo) {
  return useQuery({
    queryKey: ['itens', propriedadeId, tipo],
    queryFn: async () => {
      let query = supabase
        .from('vw_itens_custos')
        .select('*')
        .eq('propriedade_id', propriedadeId)
        .eq('ativo', true)
        .order('nome')

      if (tipo) {
        query = query.eq('tipo', tipo)
      }

      const { data, error } = await query

      if (error) throw error
      return data as ItemComCusto[]
    },
    enabled: !!propriedadeId
  })
}

// Hook para buscar um item específico
export function useItemById(itemId: string | undefined) {
  return useQuery({
    queryKey: ['item', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_itens_custos')
        .select('*')
        .eq('id', itemId)
        .maybeSingle()

      if (error) throw error
      return data as ItemComCusto | null
    },
    enabled: !!itemId
  })
}

// Hook para criar item
export function useCreateItem() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: ItemFormPayload) => {
      const { data: item, error } = await supabase
        .from('itens')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return item
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['itens', variables.propriedade_id] })
      toast({
        title: 'Item criado com sucesso!',
        description: 'O item foi adicionado ao sistema.'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar item',
        description: error.message,
        variant: 'destructive'
      })
    }
  })
}

// Hook para atualizar item
export function useUpdateItem() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ItemFormPayload> & { id: string }) => {
      const { data: item, error } = await supabase
        .from('itens')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return item
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['itens', data.propriedade_id] })
      queryClient.invalidateQueries({ queryKey: ['item', data.id] })
      toast({
        title: 'Item atualizado!',
        description: 'As alterações foram salvas.'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar item',
        description: error.message,
        variant: 'destructive'
      })
    }
  })
}

// Hook para desativar item (soft delete)
export function useDeleteItem() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('itens')
        .update({ ativo: false })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['itens', data.propriedade_id] })
      toast({
        title: 'Item desativado',
        description: 'O item foi removido da lista ativa.'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao desativar item',
        description: error.message,
        variant: 'destructive'
      })
    }
  })
}

// Hook auxiliar para buscar produtos para vincular
export function useProdutosParaVincular(propriedadeId: string | undefined) {
  return useQuery({
    queryKey: ['produtos-vincular', propriedadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome')
        .eq('propriedade_id', propriedadeId)
        .eq('ativo', true)
        .order('nome')

      if (error) throw error
      return data as { id: string; nome: string }[]
    },
    enabled: !!propriedadeId
  })
}

// Hook auxiliar para buscar máquinas para vincular
export function useMaquinasParaVincular(propriedadeId: string | undefined) {
  return useQuery({
    queryKey: ['maquinas-vincular', propriedadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maquinas')
        .select('id, nome, custo_hora')
        .eq('propriedade_id', propriedadeId)
        .eq('ativo', true)
        .order('nome')

      if (error) throw error
      return data as { id: string; nome: string; custo_hora: number | null }[]
    },
    enabled: !!propriedadeId
  })
}
