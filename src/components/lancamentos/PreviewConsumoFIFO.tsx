import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Info } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { PreviewConsumoLote } from '@/hooks/usePreviewCusto'

interface PreviewConsumoFIFOProps {
  lotes: PreviewConsumoLote[]
  unidadeMedida?: string
}

export function PreviewConsumoFIFO({ lotes, unidadeMedida = 'un' }: PreviewConsumoFIFOProps) {
  if (!lotes || lotes.length === 0) return null

  const total = lotes.reduce((sum, l) => sum + l.custo_parcial, 0)

  return (
    <Card className="border-blue-200 bg-blue-50/50 mt-3">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
          <Info className="h-4 w-4 text-blue-600" />
          <span>📊 Preview de Consumo FIFO</span>
        </div>
        <p className="text-xs text-blue-700 mt-1">
          Os lotes mais antigos serão consumidos primeiro
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        {lotes.map((lote, idx) => (
          <div
            key={lote.lote_id}
            className="border-l-4 border-blue-400 pl-3 py-2 bg-background rounded-r"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-foreground">
                Lote #{idx + 1} {lote.lote_codigo && `(${lote.lote_codigo})`}
              </span>
              {lote.nota_fiscal && (
                <span className="text-xs text-muted-foreground">
                  NF {lote.nota_fiscal}
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5">
              <div className="flex justify-between">
                <span>Data entrada:</span>
                <span className="font-medium">
                  {format(new Date(lote.data_entrada), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Consumirá:</span>
                <span className="font-medium text-blue-700">
                  {lote.quantidade_consumida.toFixed(2)} {unidadeMedida}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Preço unitário:</span>
                <span className="font-semibold text-green-700">
                  R$ {lote.custo_unitario.toFixed(2)}/{unidadeMedida}
                </span>
              </div>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-muted-foreground">Subtotal:</span>
              <span className="text-sm font-bold text-blue-900">
                R$ {lote.custo_parcial.toFixed(2)}
              </span>
            </div>
          </div>
        ))}

        <Separator className="my-3" />

        <div className="flex justify-between items-center pt-2 bg-blue-100 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
          <span className="font-semibold text-blue-900">💰 CUSTO TOTAL ITEM:</span>
          <span className="text-xl font-bold text-primary">
            R$ {total.toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
