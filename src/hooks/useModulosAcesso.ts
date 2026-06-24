import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'

export interface ModulosAcesso {
  lavoura: boolean
  pecuaria: boolean
  financeiro: boolean
  relatorios: boolean
  auditoria: boolean
  estoque: boolean
  lancamentos: boolean
  calendario: boolean
  maquinas: boolean
  safras: boolean
  talhoes: boolean
  servicos: boolean
  is_super_admin?: boolean
  assinatura_status?: string
}

export function useModulosAcesso() {
  const { propriedadeAtual } = useGlobal()
  const propriedadeId = propriedadeAtual?.id ?? null

  return useQuery<ModulosAcesso>({
    queryKey: ['modulos-acesso', propriedadeId],
    queryFn: async () => {
      if (!propriedadeId) {
        return {
          lavoura: true, pecuaria: true, financeiro: true, relatorios: true, auditoria: true,
          estoque: true, lancamentos: true, calendario: true, maquinas: true,
          safras: true, talhoes: true, servicos: true,
        }
      }
      const { data, error } = await supabase.rpc('get_modulos_propriedade' as any, {
        p_propriedade_id: propriedadeId,
      })
      if (error) throw error
      return data as ModulosAcesso
    },
    enabled: true,
    staleTime: 60_000,
  })
}
