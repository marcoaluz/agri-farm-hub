import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Package, Calendar, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LoteConsumo } from '@/hooks/usePreviewCusto'

interface PreviewConsumoFIFOProps {
  lotes: LoteConsumo[]
}

export function PreviewConsumoFIFO({ lotes }: PreviewConsumoFIFOProps) {
  if (!lotes || lotes.length === 0) return null

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Package className="h-4 w-4" />
        <span>Detalhamento FIFO - {lotes.length} lote(s)</span>
      </div>

      <div className="space-y-2">
        {lotes.map((lote, index) => (
          <div
            key={lote.lote_id}
            className={cn(
              "flex items-center justify-between rounded-md px-3 py-2 text-sm",
              index % 2 === 0 ? "bg-background" : "bg-muted/50"
            )}
          >
            <div className="flex items-center gap-4">
              <span className="font-mono font-medium text-primary">
                #{lote.lote_codigo}
              </span>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="text-xs">
                  {format(new Date(lote.data_entrada), "dd/MM/yy", { locale: ptBR })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                {lote.quantidade_consumida.toFixed(2)} un
              </span>
              <span className="text-muted-foreground">×</span>
              <span className="text-muted-foreground">
                R$ {lote.custo_unitario.toFixed(2)}
              </span>
              <span className="text-muted-foreground">=</span>
              <span className="font-semibold text-foreground">
                R$ {lote.custo_parcial.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
        <DollarSign className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Total FIFO:</span>
        <span className="text-lg font-bold text-primary">
          R$ {lotes.reduce((acc, l) => acc + l.custo_parcial, 0).toFixed(2)}
        </span>
      </div>
    </div>
  )
}
