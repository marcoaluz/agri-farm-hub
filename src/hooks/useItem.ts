import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Item {
  id: string
  nome: string
  descricao?: string
  tipo: 'produto_estoque' | 'servico' | 'maquina_hora'
  unidade_medida: string
  custo_unitario?: number
  quantidade_estoque?: number
  ativo: boolean
}

export function useItem(itemId: string | undefined) {
  return useQuery({
    queryKey: ['item', itemId],
    queryFn: async () => {
      if (!itemId) return null

      const { data, error } = await supabase
        .from('itens')
        .select('*')
        .eq('id', itemId)
        .maybeSingle()

      if (error) throw error
      return data as Item | null
    },
    enabled: !!itemId
  })
}
