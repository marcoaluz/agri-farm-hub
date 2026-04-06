import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useAuth } from '@/contexts/AuthContext'
import { useModulos } from '@/hooks/useModulos'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Bell,
  Package,
  Syringe,
  Users,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigate } from 'react-router-dom'

export default function Notificacoes() {
  const { propriedadeAtual } = useGlobal()
  const { user } = useAuth()
  const { modulos } = useModulos()
  const navigate = useNavigate()

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('perfil')
        .eq('id', user!.id)
        .single()
      return data
    },
    enabled: !!user?.id,
  })

  const { data: estoqueBaixo, isLoading: loadEstoque } = useQuery({
    queryKey: ['notif-estoque', propriedadeAtual?.id],
    queryFn: async () => {
      const { data: prods } = await supabase
        .from('produtos')
        .select('id, nome, saldo_atual, nivel_minimo, unidade_medida')
        .eq('ativo', true)
        .not('nivel_minimo', 'is', null)
        .eq('propriedade_id', propriedadeAtual!.id)
      return (prods || []).filter(
        (p: any) => p.nivel_minimo !== null && p.saldo_atual <= p.nivel_minimo
      )
    },
    enabled: !!propriedadeAtual?.id,
  })

  const { data: vacinasProximas, isLoading: loadVacinas } = useQuery({
    queryKey: ['notif-vacinas', propriedadeAtual?.id],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0]
      const limite = addDays(new Date(), 30).toISOString().split('T')[0]
      const { data } = await supabase
        .from('sanitario_eventos')
        .select('id, descricao, tipo, data_proxima, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propriedadeAtual!.id)
        .gte('data_proxima', hoje)
        .lte('data_proxima', limite)
        .order('data_proxima', { ascending: true })
      return data || []
    },
    enabled: !!propriedadeAtual?.id && modulos.pecuaria,
  })

  const { data: notifsAdmin, isLoading: loadAdmin } = useQuery({
    queryKey: ['notif-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_notificacoes')
        .select('id, titulo, mensagem, created_at, lida')
        .eq('lida', false)
        .order('created_at', { ascending: false })
        .limit(10)
      return data || []
    },
    enabled: userProfile?.perfil === 'admin',
  })

  const isLoading = loadEstoque || loadVacinas || loadAdmin
  const totalAlertas =
    (estoqueBaixo?.length || 0) +
    (vacinasProximas?.length || 0) +
    (notifsAdmin?.length || 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
        {totalAlertas > 0 && (
          <Badge variant="destructive">
            {totalAlertas} ativo{totalAlertas !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {!propriedadeAtual && (
        <p className="text-sm text-muted-foreground">
          Selecione uma propriedade para ver alertas específicos
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && totalAlertas === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="h-12 w-12 text-success mb-4" />
            <p className="text-lg font-medium text-foreground">Tudo em ordem!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nenhum alerta ativo no momento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Estoque Crítico */}
      {(estoqueBaixo?.length || 0) > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Estoque Abaixo do Mínimo
              <Badge variant="destructive">{estoqueBaixo!.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {estoqueBaixo!.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-foreground">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Saldo: {p.saldo_atual} {p.unidade_medida} · Mínimo:{' '}
                      {p.nivel_minimo} {p.unidade_medida}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/estoque')}
                >
                  Ver Estoque
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Eventos Sanitários */}
      {(vacinasProximas?.length || 0) > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Syringe className="h-5 w-5 text-yellow-600" />
              Eventos Sanitários nos Próximos 30 Dias
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                {vacinasProximas!.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vacinasProximas!.map((v: any) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 rounded-lg bg-yellow-50/50 border border-yellow-200/50"
              >
                <div className="flex items-center gap-3">
                  <Syringe className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-foreground">{v.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.rebanho?.nome} · Previsto:{' '}
                      {format(
                        new Date(v.data_proxima + 'T12:00:00'),
                        "dd 'de' MMMM",
                        { locale: ptBR }
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/pecuaria')}
                >
                  Ver Pecuária
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Admin */}
      {(notifsAdmin?.length || 0) > 0 && (
        <Card className="border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-blue-600" />
              Pendências Administrativas
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {notifsAdmin!.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifsAdmin!.map((n: any) => (
              <div
                key={n.id}
                className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 border border-blue-200/50"
              >
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-foreground">{n.titulo}</p>
                    <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin/usuarios')}
                >
                  Gerenciar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
