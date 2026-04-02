import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'

interface Modulos {
  lavoura: boolean
  pecuaria: boolean
  financeiro: boolean
  relatorios: boolean
  auditoria: boolean
}

const DEFAULTS: Modulos = {
  lavoura: true,
  pecuaria: true,
  financeiro: true,
  relatorios: true,
  auditoria: true,
}

export function useModulos() {
  const { propriedadeAtual } = useGlobal()
  const propId = propriedadeAtual?.id

  const { data, isLoading } = useQuery({
    queryKey: ['propriedade-modulos', propId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propriedade_modulos' as any)
        .select('*')
        .eq('propriedade_id', propId)
        .maybeSingle()
      if (error) throw error
      if (!data) return DEFAULTS
      return {
        lavoura: (data as any).lavoura ?? true,
        pecuaria: (data as any).pecuaria ?? true,
        financeiro: (data as any).financeiro ?? true,
        relatorios: (data as any).relatorios ?? true,
        auditoria: (data as any).auditoria ?? true,
      } as Modulos
    },
    enabled: !!propId,
  })

  return {
    modulos: data || DEFAULTS,
    loading: isLoading,
  }
}
