import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface Servico {
  id: string
  propriedade_id: string
  nome: string
  descricao?: string
  categoria?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export function useServicos(propriedadeId?: string) {
  return useQuery({
    queryKey: ['servicos', propriedadeId],
    queryFn: async () => {
      if (!propriedadeId) return []

      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('propriedade_id', propriedadeId)
        .eq('ativo', true)
        .order('nome')

      if (error) throw error
      return data as Servico[]
    },
    enabled: !!propriedadeId,
  })
}
