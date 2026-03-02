import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface Servico {
  id: string
  propriedade_id: string
  nome: string
  descricao?: string
  categoria?: string
  tipo_servico: 'simples' | 'composto'
  custo_padrao?: number
  unidade_medida?: string
  requer_talhao: boolean
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

export function useServicosSimples(propriedadeId?: string) {
  return useQuery({
    queryKey: ['servicos-simples', propriedadeId],
    queryFn: async () => {
      if (!propriedadeId) return []

      const { data, error } = await supabase
        .from('servicos')
        .select('id, nome, custo_padrao, unidade_medida')
        .eq('propriedade_id', propriedadeId)
        .eq('tipo_servico', 'simples')
        .eq('ativo', true)
        .order('nome')

      if (error) throw error
      return data
    },
    enabled: !!propriedadeId,
  })
}

export function useServicosComItens(servicoId?: string) {
  return useQuery({
    queryKey: ['servicos-itens', servicoId],
    queryFn: async () => {
      if (!servicoId) return []

      const { data, error } = await supabase
        .from('servicos_itens')
        .select(`
          id, tipo_ref, obrigatorio, quantidade_sugerida, ordem,
          produto:produtos(id, nome, unidade, saldo_atual),
          maquina:maquinas(id, nome, custo_hora, horimetro_atual)
        `)
        .eq('servico_id', servicoId)
        .order('ordem')

      if (error) throw error
      return data
    },
    enabled: !!servicoId,
  })
}
