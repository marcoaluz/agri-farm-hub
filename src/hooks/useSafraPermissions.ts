import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Verifica se o usuário pode fechar/reabrir uma safra:
 * - perfil = 'admin'
 * - is_super_admin = true
 * - papel = 'proprietario' na propriedade da safra (via propriedades_usuarios)
 */
export function useSafraPermissions(propriedadeId?: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['safra-permissions', user?.id, propriedadeId],
    queryFn: async () => {
      if (!user?.id) return { canClose: false, canReopen: false, isAdmin: false }

      // 1. Buscar perfil
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('perfil, is_super_admin')
        .eq('id', user.id)
        .maybeSingle()

      const isAdmin =
        (profile as any)?.perfil === 'admin' ||
        (profile as any)?.is_super_admin === true

      // 2. Verificar se é proprietário da propriedade
      let isProprietario = false
      if (propriedadeId) {
        // Dono direto
        const { data: prop } = await supabase
          .from('propriedades')
          .select('user_id')
          .eq('id', propriedadeId)
          .maybeSingle()
        if ((prop as any)?.user_id === user.id) {
          isProprietario = true
        }

        // Vínculo em propriedades_usuarios com papel='proprietario'
        if (!isProprietario) {
          const { data: vinculo } = await supabase
            .from('propriedades_usuarios')
            .select('papel, status')
            .eq('usuario_id', user.id)
            .eq('propriedade_id', propriedadeId)
            .eq('status', 'ativo')
            .maybeSingle()
          if ((vinculo as any)?.papel === 'proprietario') {
            isProprietario = true
          }
        }
      }

      const canClose = isAdmin || isProprietario
      const canReopen = isAdmin || isProprietario

      return { canClose, canReopen, isAdmin, isProprietario }
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  })
}
