import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useGlobal } from '@/contexts/GlobalContext'

export type Papel = 'proprietario' | 'gerente' | 'operador' | 'visualizador' | null

/** Papel do usuário logado na propriedade atualmente selecionada. */
export function usePapelUsuario() {
  const { user } = useAuth()
  const { propriedadeAtual } = useGlobal()

  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin-papel', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles' as any).select('perfil, is_super_admin').eq('id', user!.id).maybeSingle()
      return (data as any)?.perfil === 'admin' || (data as any)?.is_super_admin === true
    },
    enabled: !!user,
  })

  const { data: papel, isLoading } = useQuery({
    queryKey: ['meu-papel', user?.id, propriedadeAtual?.id],
    queryFn: async () => {
      if (!propriedadeAtual?.id) return null
      const { data } = await supabase
        .from('propriedades_usuarios' as any)
        .select('papel')
        .eq('usuario_id', user!.id)
        .eq('propriedade_id', propriedadeAtual.id)
        .eq('status', 'ativo')
        .maybeSingle()
      return ((data as any)?.papel as Papel) || null
    },
    enabled: !!user && !!propriedadeAtual?.id,
  })

  const efetivo: Papel = isAdmin ? 'proprietario' : (papel ?? null)

  return {
    papel: efetivo,
    isAdmin: !!isAdmin,
    isLoading,
    ehProprietarioOuGerente: efetivo === 'proprietario' || efetivo === 'gerente',
    ehOperador: efetivo === 'operador',
    ehVisualizador: efetivo === 'visualizador',
    podeVerFinanceiro: efetivo === 'proprietario' || efetivo === 'gerente',
    podeVerAuditoria: efetivo === 'proprietario' || efetivo === 'gerente',
    podeVerEquipe: efetivo === 'proprietario' || efetivo === 'gerente',
  }
}
