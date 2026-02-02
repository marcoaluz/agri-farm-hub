import { useState, useEffect } from 'react'
import { X, Info, AlertCircle, Package, Wrench, Truck } from 'lucide-react'
import { useItem } from '@/hooks/useItem'
import { usePreviewCusto } from '@/hooks/usePreviewCusto'
import { PreviewConsumoFIFO } from './PreviewConsumoFIFO'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface ItemLancamento {
  item_id: string
  quantidade: number
  custo_unitario?: number
  custo_total?: number
  detalhamento_lotes?: any
  obrigatorio?: boolean
  item?: {
    id: string
    nome: string
    tipo: string
    unidade_medida: string
    produto_id?: string
    maquina_id?: string
  }
}

interface ItemLancamentoCardProps {
  itemForm: ItemLancamento
  onUpdate: (updated: ItemLancamento) => void
  onRemove: () => void
}

function getTipoLabel(tipo: string) {
  const config = {
    'produto_estoque': { label: 'Produto de Estoque', icon: Package, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    'servico': { label: 'Serviço', icon: Wrench, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    'maquina_hora': { label: 'Hora de Máquina', icon: Truck, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' }
  }
  return config[tipo as keyof typeof config] || { label: tipo, icon: Package, color: 'bg-gray-100 text-gray-800' }
}

export function ItemLancamentoCard({ itemForm, onUpdate, onRemove }: ItemLancamentoCardProps) {
  const [quantidade, setQuantidade] = useState(itemForm.quantidade)

  // Buscar dados do item
  const { data: item, isLoading: loadingItem } = useItem(itemForm.item_id)

  // Preview de custo FIFO
  const { data: preview, isLoading: loadingPreview } = usePreviewCusto(
    itemForm.item_id,
    quantidade
  )

  // Atualizar form quando quantidade ou preview mudarem
  useEffect(() => {
    if (preview) {
      onUpdate({
        ...itemForm,
        quantidade,
        custo_unitario: preview.custo_unitario,
        custo_total: preview.custo_total,
        detalhamento_lotes: preview.preview_consumo
      })
    } else if (quantidade === 0) {
      onUpdate({
        ...itemForm,
        quantidade: 0,
        custo_unitario: 0,
        custo_total: 0,
        detalhamento_lotes: []
      })
    }
  }, [quantidade, preview])

  // Usar dados do item do form ou do hook
  const itemData = item || itemForm.item

  if (loadingItem || !itemData) {
    return <Skeleton className="h-40 w-full" />
  }

  const tipoConfig = getTipoLabel(itemData.tipo)
  const TipoIcon = tipoConfig.icon
  const isProdutoEstoque = itemData.tipo === 'produto_estoque'
  const estoqueInsuficiente = isProdutoEstoque && preview && !preview.estoque_suficiente

  return (
    <Card className={cn(
      "relative transition-all",
      itemForm.obrigatorio && "ring-2 ring-destructive/20 bg-destructive/5",
      estoqueInsuficiente && "ring-2 ring-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10"
    )}>
      <CardContent className="pt-6 space-y-4">
        {/* Cabeçalho do Item */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-lg truncate">{itemData.nome}</h4>
              {itemForm.obrigatorio && (
                <Badge variant="destructive" className="text-xs shrink-0">
                  OBRIGATÓRIO
                </Badge>
              )}
              <Badge className={cn("text-xs shrink-0", tipoConfig.color)}>
                <TipoIcon className="h-3 w-3 mr-1" />
                {tipoConfig.label}
              </Badge>
            </div>
            {item?.categoria && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                Categoria: {item.categoria}
              </p>
            )}
          </div>

          {!itemForm.obrigatorio && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Info do Item */}
        <Alert className="bg-muted/50">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="grid gap-1 text-sm">
              {isProdutoEstoque && preview && (
                <div className="flex justify-between">
                  <span>Estoque disponível:</span>
                  <strong className={cn(
                    estoqueInsuficiente ? "text-yellow-600" : "text-blue-600"
                  )}>
                    {preview.estoque_disponivel.toFixed(2)} {itemData.unidade_medida}
                  </strong>
                </div>
              )}
              <div className="flex justify-between">
                <span>Custo unitário:</span>
                <strong className="text-primary">
                  R$ {(preview?.custo_unitario || item?.custo_padrao || 0).toFixed(2)} / {itemData.unidade_medida}
                </strong>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Input de Quantidade */}
        <div className="space-y-2">
          <Label htmlFor={`quantidade-${itemForm.item_id}`}>
            Quantidade ({itemData.unidade_medida})
            {itemForm.obrigatorio && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={`quantidade-${itemForm.item_id}`}
            type="number"
            min="0"
            step="0.01"
            value={quantidade || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0
              setQuantidade(val)
            }}
            placeholder="0.00"
            className={cn(
              "font-mono",
              quantidade > 0 && !estoqueInsuficiente && "border-primary/50 focus:border-primary"
            )}
          />

          {/* Validação de Estoque */}
          {estoqueInsuficiente && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Quantidade maior que o estoque disponível!
                Disponível: {preview?.estoque_disponivel.toFixed(2)} {itemData.unidade_medida}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Preview FIFO (se produto de estoque) */}
        {isProdutoEstoque && quantidade > 0 && (
          loadingPreview ? (
            <Skeleton className="h-24 w-full" />
          ) : preview?.preview_consumo && preview.preview_consumo.length > 0 && (
            <PreviewConsumoFIFO lotes={preview.preview_consumo} />
          )
        )}

        {/* Custo Total do Item */}
        {quantidade > 0 && preview && (
          <div className="flex justify-between items-center pt-4 border-t">
            <span className="font-semibold">Custo Total do Item:</span>
            <span className="text-2xl font-bold text-primary">
              R$ {preview.custo_total.toFixed(2)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
