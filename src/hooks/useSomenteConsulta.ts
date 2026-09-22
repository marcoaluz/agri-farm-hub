import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function useSomenteConsulta() {
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['somente-consulta', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('somente_consulta')
        .eq('id', user!.id)
        .single()
      return (data as any)?.somente_consulta === true
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })
  return data === true
}
