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
  compartilhado?: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}

/** Busca serviços da propriedade + serviços globais (compartilhados) via RPC */
async function fetchServicosUsuario(propriedadeId: string) {
  const { data, error } = await supabase.rpc('listar_servicos_usuario', {
    p_propriedade_id: propriedadeId,
  })
  if (error) throw error
  return ((data as any[]) || [])
    .filter(s => s.ativo !== false)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
}

export function useServicos(propriedadeId?: string) {
  return useQuery({
    queryKey: ['servicos', propriedadeId],
    queryFn: async () => {
      if (!propriedadeId) return []
      return (await fetchServicosUsuario(propriedadeId)) as Servico[]
    },
    enabled: !!propriedadeId,
  })
}

export function useServicosSimples(propriedadeId?: string) {
  return useQuery({
    queryKey: ['servicos-simples', propriedadeId],
    queryFn: async () => {
      if (!propriedadeId) return []
      const lista = await fetchServicosUsuario(propriedadeId)
      return lista.filter(s => s.tipo_servico === 'simples')
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
          id, tipo_item, tipo_ref, obrigatorio, quantidade_sugerida, ordem,
          produto:produtos(id, nome, unidade_medida, saldo_atual),
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
