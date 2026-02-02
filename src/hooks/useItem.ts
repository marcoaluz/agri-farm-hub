import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Item {
  id: string
  propriedade_id: string
  nome: string
  tipo: 'produto_estoque' | 'servico' | 'maquina_hora'
  categoria?: string
  unidade_medida: string
  produto_id?: string
  maquina_id?: string
  custo_padrao?: number
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
