import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface CardAlertasProps {
  propriedadeId: string | null
  totalAlertas: number
}

export function CardAlertas({ propriedadeId, totalAlertas }: CardAlertasProps) {
  const navigate = useNavigate()
  const [expandido, setExpandido] = useState(false)

  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas-detalhados', propriedadeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_alertas_detalhados', {
        p_propriedade_id: propriedadeId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: expandido && !!propriedadeId,
  })

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-card-foreground">Alertas do Sistema</h3>
      </div>

      {totalAlertas === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CheckCircle className="h-10 w-10 text-success mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum alerta no momento</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="h-10 w-10 text-warning mb-3" />
            <p className="text-2xl font-bold text-foreground mb-1">{totalAlertas}</p>
            <p className="text-sm text-muted-foreground">alertas ativos</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setExpandido((v) => !v)}
            >
              {expandido ? 'Ocultar detalhes' : 'Ver detalhes'}
            </Button>
          </div>

          {expandido && (
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)
              ) : (alertas || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum detalhe disponível.
                </p>
              ) : (
                (alertas || []).map((alerta: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => alerta.link_acao && navigate(alerta.link_acao)}
                    className="p-3 rounded-md border border-border cursor-pointer hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={
                              alerta.severidade === 'critico' || alerta.severidade === 'critica'
                                ? 'destructive'
                                : 'default'
                            }
                          >
                            {alerta.severidade}
                          </Badge>
                          <span className="font-medium text-sm text-foreground">{alerta.titulo}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alerta.descricao}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
