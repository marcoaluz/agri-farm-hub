import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface CardAlertasProps {
  propriedadeId: string | null
  totalAlertas: number
}

export function CardAlertas({ propriedadeId, totalAlertas }: CardAlertasProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expandido, setExpandido] = useState(false)

  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas-nao-lidos', propriedadeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('listar_minhas_notificacoes', {
        p_apenas_nao_lidas: true,
        p_limite: 30,
        p_propriedade_id: propriedadeId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: expandido && !!propriedadeId,
  })

  async function handleClickAlerta(a: any) {
    await supabase.rpc('marcar_notificacao_lida' as any, { p_notificacao_id: a.id })
    queryClient.invalidateQueries({ queryKey: ['alertas-nao-lidos'] })
    queryClient.invalidateQueries({ queryKey: ['contar-notificacoes-dashboard'] })
    if (a.link_acao) navigate(a.link_acao)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-card-foreground">Alertas do Sistema</h3>
      </div>

      {totalAlertas === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CheckCircle className="h-10 w-10 text-success mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum alerta não lido</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="h-10 w-10 text-warning mb-3" />
            <p className="text-2xl font-bold text-foreground mb-1">{totalAlertas}</p>
            <p className="text-sm text-muted-foreground">alerta{totalAlertas !== 1 ? 's' : ''} não lido{totalAlertas !== 1 ? 's' : ''}</p>
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
              ) : !alertas?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nada de novo por aqui.
                </p>
              ) : (
                alertas.map((alerta: any) => (
                  <button
                    key={alerta.id}
                    type="button"
                    onClick={() => handleClickAlerta(alerta)}
                    className="w-full p-3 rounded-md border border-border text-left hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{alerta.titulo}</p>
                        <p className="text-sm text-muted-foreground mt-1">{alerta.mensagem}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
