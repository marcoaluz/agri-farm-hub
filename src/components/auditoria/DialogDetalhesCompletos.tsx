import { useState } from 'react'
import { HistoricoAuditoria } from '@/hooks/useHistorico'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Eye } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatarMoeda } from '@/hooks/useHistorico'

interface DialogDetalhesCompletosProps {
  item: HistoricoAuditoria
}

export function DialogDetalhesCompletos({ item }: DialogDetalhesCompletosProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 px-2"
      >
        <Eye className="h-3.5 w-3.5 mr-1" />
        Ver Mais
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes Completos da Alteração</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 pr-4">
              {/* Cabeçalho */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={item.tipo_alteracao === 'DELETE' ? 'destructive' : 'secondary'}>
                    {item.tipo_alteracao}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(item.alterado_em), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {item.usuario_nome || item.usuario_email || 'Sistema'}
                  </p>
                  {item.usuario_email && item.usuario_nome && (
                    <p className="text-xs text-muted-foreground">{item.usuario_email}</p>
                  )}
                </div>
              </div>

              {/* Dados do Lançamento Excluído */}
              {item.tipo_alteracao === 'DELETE' && item.dados_anteriores && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-destructive">Lançamento Excluído:</h4>
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {item.dados_anteriores.data_execucao && (
                        <div>
                          <span className="text-muted-foreground">Data:</span>
                          <p className="font-medium">
                            {format(new Date(item.dados_anteriores.data_execucao), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      )}
                      {item.dados_anteriores.custo_total != null && (
                        <div>
                          <span className="text-muted-foreground">Custo:</span>
                          <p className="font-medium">{formatarMoeda(item.dados_anteriores.custo_total)}</p>
                        </div>
                      )}
                    </div>
                    {item.dados_anteriores.observacoes && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Observações:</span>
                        <p className="font-medium">{item.dados_anteriores.observacoes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Campos Alterados */}
              {item.tipo_alteracao === 'UPDATE' && item.dados_anteriores && item.dados_novos && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Campos Alterados:</h4>
                  <div className="space-y-3">
                    {Object.keys(item.dados_novos)
                      .filter(key =>
                        JSON.stringify(item.dados_anteriores[key]) !==
                        JSON.stringify(item.dados_novos[key])
                      )
                      .map(campo => (
                        <div key={campo} className="rounded-md border p-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">{campo}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Antes:</p>
                              <pre className="text-destructive line-through whitespace-pre-wrap text-xs mt-0.5">
                                {JSON.stringify(item.dados_anteriores[campo], null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Depois:</p>
                              <pre className="text-primary font-medium whitespace-pre-wrap text-xs mt-0.5">
                                {JSON.stringify(item.dados_novos[campo], null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Motivo */}
              {item.motivo && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Motivo:</h4>
                  <p className="text-sm text-muted-foreground italic">"{item.motivo}"</p>
                </div>
              )}

              {/* JSON Completo */}
              <details>
                <summary className="text-xs text-muted-foreground cursor-pointer hover:underline">
                  Ver JSON completo (avançado)
                </summary>
                <div className="mt-2 space-y-2">
                  {item.dados_anteriores && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">dados_anteriores:</p>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(item.dados_anteriores, null, 2)}
                      </pre>
                    </div>
                  )}
                  {item.dados_novos && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">dados_novos:</p>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(item.dados_novos, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
