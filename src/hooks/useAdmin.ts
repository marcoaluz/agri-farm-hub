import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

export interface AdminUser {
  id: string
  email: string
  nome: string | null
  perfil: string
  ultimo_acesso: string | null
  confirmado: boolean
  criado_em: string
  avatar_url: string | null
  status: string
}

export interface AdminStats {
  total_usuarios: number
  novos_7_dias: number
  total_propriedades: number
  total_lancamentos: number
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_all_users_admin' as any)
        .select('*')
        .order('criado_em', { ascending: false })

      if (error) throw error
      return (data || []) as AdminUser[]
    },
  })
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_system_stats' as any)

      if (error) throw error
      return (data as unknown as AdminStats) || {
        total_usuarios: 0,
        novos_7_dias: 0,
        total_propriedades: 0,
        total_lancamentos: 0,
      }
    },
  })
}

export function useCheckAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin-check', userId],
    queryFn: async () => {
      if (!userId) return false
      const { data, error } = await supabase
        .from('user_profiles' as any)
        .select('perfil')
        .eq('id', userId)
        .single()

      if (error) return false
      return (data as any)?.perfil === 'admin'
    },
    enabled: !!userId,
  })
}

export function usePromoteToAdmin() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('promote_to_admin' as any, { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: 'Usuário promovido a admin!' })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => {
      toast({ title: 'Erro ao promover', variant: 'destructive' })
    },
  })
}

export function useDemoteFromAdmin() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ userId, newPerfil }: { userId: string; newPerfil: string }) => {
      const { error } = await supabase.rpc('demote_from_admin' as any, {
        p_user_id: userId,
        p_new_perfil: newPerfil,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: 'Admin rebaixado!' })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => {
      toast({ title: 'Erro ao rebaixar', variant: 'destructive' })
    },
  })
}

export function useSuspendUser() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('user_profiles' as any).update({ status: 'inativo' } as any).eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: 'Conta suspensa.' })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => toast({ title: 'Erro ao suspender conta', variant: 'destructive' }),
  })
}

export function useReactivateUser() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('user_profiles' as any).update({ status: 'ativo' } as any).eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: 'Conta reativada.' })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => toast({ title: 'Erro ao reativar conta', variant: 'destructive' }),
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deletar-usuario-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ usuario_id: userId }),
      })
      const resultado = await resp.json()
      if (!resp.ok) throw new Error(resultado.error || 'Erro ao excluir usuário')
      return resultado
    },
    onSuccess: () => {
      toast({ title: 'Usuário excluído.' })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (err: any) => toast({ title: err.message || 'Erro ao excluir usuário', variant: 'destructive' }),
  })
}
