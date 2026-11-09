import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { TextoLegal } from '@/components/legal/TextoLegal'
import { LEGAL_PUBLICADO, TEXTO_TERMOS, TEXTO_PRIVACIDADE, camposPendentes } from '@/lib/legal'

/** Página pública: /termos e /privacidade. */
export default function DocumentoLegal({ tipo }: { tipo: 'termos' | 'privacidade' }) {
  const { user } = useAuth()
  const { data: ehAdmin } = useQuery({
    queryKey: ['is-admin-papel', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from('user_profiles').select('perfil, is_super_admin').eq('id', user!.id).maybeSingle()
      return data?.perfil === 'admin' || data?.is_super_admin === true
    },
    enabled: !!user,
  })

  const texto = tipo === 'termos' ? TEXTO_TERMOS : TEXTO_PRIVACIDADE
  const titulo = tipo === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'
  const outro = tipo === 'termos'
    ? { href: '/privacidade', label: 'Política de Privacidade' }
    : { href: '/termos', label: 'Termos de Uso' }
  const mostrarRascunho = LEGAL_PUBLICADO || !!ehAdmin
  const pendentes = camposPendentes(texto)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to={user ? '/' : '/login'} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {user ? 'Voltar ao sistema' : 'Voltar ao login'}
        </Link>
        <Card>
          <CardContent className="p-6 sm:p-8">
            {!mostrarRascunho ? (
              <div className="space-y-2 py-8 text-center">
                <h1 className="text-2xl font-bold">{titulo}</h1>
                <p className="text-muted-foreground">Documento em preparação. Em caso de dúvida, abra um chamado no sistema.</p>
              </div>
            ) : (
              <>
                {!LEGAL_PUBLICADO && (
                  <div className="mb-6 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Rascunho — só o admin vê esta página. Ainda não está em vigor.</p>
                      {pendentes.length > 0 && <p className="mt-1">Falta preencher: {pendentes.join(', ')}</p>}
                    </div>
                  </div>
                )}
                <TextoLegal markdown={texto} />
                <p className="mt-8 border-t pt-4 text-sm text-muted-foreground">
                  Veja também a <Link to={outro.href} className="text-primary hover:underline">{outro.label}</Link>.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
