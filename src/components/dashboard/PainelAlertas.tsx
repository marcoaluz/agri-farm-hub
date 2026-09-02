import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface PainelAlertasProps {
  propriedadeId: string
  totalAlertas: number
  forceOpen?: boolean
}

const TIPO_LABELS: Record<string, string> = {
  conta_pagar_lembrete: 'Financeiro',
  conta_receber_lembrete: 'Financeiro',
  estoque_baixo: 'Estoque',
  sanitario_lembrete: 'Pecuária',
  manutencao_horimetro_atingido: 'Máquinas',
  tarefa_lembrete: 'Agenda',
}

export function PainelAlertas({ propriedadeId, totalAlertas, forceOpen }: PainelAlertasProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

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
    enabled: open && !!propriedadeId,
  })

  if (totalAlertas === 0) return null

  const grouped: Record<string, any[]> = {}
  ;(alertas || []).forEach((a: any) => {
    const key = a.tipo || 'outros'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(a)
  })

  async function handleClickAlerta(a: any) {
    await supabase.rpc('marcar_notificacao_lida' as any, { p_notificacao_id: a.id })
    queryClient.invalidateQueries({ queryKey: ['alertas-nao-lidos'] })
    queryClient.invalidateQueries({ queryKey: ['contar-notificacoes-dashboard'] })
    if (a.link_acao) navigate(a.link_acao)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-warning/30 bg-warning/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-warning/10 transition-colors rounded-t-lg pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <CardTitle className="text-base">
                  {totalAlertas} alerta{totalAlertas !== 1 ? 's' : ''} não lido{totalAlertas !== 1 ? 's' : ''}
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {open ? 'Recolher' : 'Expandir'}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : !alertas?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nada de novo por aqui.
              </p>
            ) : (
              Object.entries(grouped).map(([tipo, items]) => (
                <div key={tipo}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {TIPO_LABELS[tipo] || tipo}
                  </p>
                  <div className="space-y-2">
                    {items.map((alerta: any) => (
                      <button
                        key={alerta.id}
                        type="button"
                        onClick={() => handleClickAlerta(alerta)}
                        className="w-full flex items-start justify-between gap-3 rounded-lg bg-card border border-border p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          {alerta.severidade === 'critica' ? (
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{alerta.titulo}</p>
                            <p className="text-xs text-muted-foreground">{alerta.mensagem}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {alerta.created_at && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(alerta.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                          {alerta.link_acao && (
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
