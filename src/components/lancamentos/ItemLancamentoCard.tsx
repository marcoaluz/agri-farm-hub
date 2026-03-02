import { useState, useEffect, useRef } from 'react'
import { X, Info, AlertCircle, Package, Wrench, Truck, Gauge, Pencil } from 'lucide-react'
import { usePreviewCustoDireto } from '@/hooks/usePreviewCusto'
import { PreviewConsumoFIFO } from './PreviewConsumoFIFO'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface ItemLancamento {
  // Novo: referências diretas
  tipo_ref?: 'produto' | 'maquina' | 'servico_simples'
  produto_id?: string | null
  maquina_id?: string | null
  servico_ref_id?: string | null
  nome?: string
  unidade?: string
  custo_unitario_ref?: number // custo_hora ou custo_padrao direto (nunca mudar)
  estoque_disponivel?: number | null

  // Override de custo por lançamento
  custo_unitario_override?: number // valor editado pelo usuário neste lançamento
  custo_personalizado?: boolean    // flag de que foi editado

  // Legado (mantido para compatibilidade com dados existentes)
  item_id?: string

  // Campos comuns
  quantidade: number
  custo_unitario?: number
  custo_total?: number
  detalhamento_lotes?: any
  obrigatorio?: boolean

  // Legado
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

function getTipoConfig(tipoRef?: string, itemTipo?: string) {
  if (tipoRef === 'produto') {
    return { label: 'Produto de Estoque', icon: Package, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' }
  }
  if (tipoRef === 'maquina') {
    return { label: 'Hora de Máquina', icon: Truck, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' }
  }
  if (tipoRef === 'servico_simples') {
    return { label: 'Serviço', icon: Wrench, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' }
  }
  const config = {
    'produto_estoque': { label: 'Produto de Estoque', icon: Package, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    'servico': { label: 'Serviço', icon: Wrench, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    'maquina_hora': { label: 'Hora de Máquina', icon: Truck, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' }
  }
  return config[itemTipo as keyof typeof config] || { label: itemTipo || 'Item', icon: Package, color: 'bg-gray-100 text-gray-800' }
}

export function ItemLancamentoCard({ itemForm, onUpdate, onRemove }: ItemLancamentoCardProps) {
  const [quantidade, setQuantidade] = useState(itemForm.quantidade)
  const [editandoCusto, setEditandoCusto] = useState(false)
  const [custoEditavel, setCustoEditavel] = useState('')
  const custoInputRef = useRef<HTMLInputElement>(null)

  const usaRefDireta = !!itemForm.tipo_ref
  const isProduto = itemForm.tipo_ref === 'produto' || itemForm.item?.tipo === 'produto_estoque'

  // Custo efetivo: override se personalizado, senão o padrão
  const custoEfetivo = itemForm.custo_personalizado && itemForm.custo_unitario_override != null
    ? itemForm.custo_unitario_override
    : itemForm.custo_unitario_ref

  // Preview de custo direto (novo sistema) — para produtos usa FIFO, ignora override
  const { data: previewDireto, isLoading: loadingPreviewDireto } = usePreviewCustoDireto(
    usaRefDireta ? itemForm.tipo_ref : undefined,
    itemForm.produto_id,
    itemForm.maquina_id,
    itemForm.servico_ref_id,
    quantidade,
    isProduto ? undefined : custoEfetivo // Para produtos, FIFO calcula o custo; para outros, usa custo efetivo
  )

  const preview = previewDireto
  const loadingPreview = loadingPreviewDireto

  // Atualizar form quando quantidade ou preview mudarem
  useEffect(() => {
    if (isProduto && preview) {
      // Produto usa FIFO — custo vem do preview, não do override
      onUpdate({
        ...itemForm,
        quantidade,
        custo_unitario: preview.custo_unitario,
        custo_total: preview.custo_total,
        detalhamento_lotes: preview.preview_consumo || null
      })
    } else if (preview) {
      // Máquina/Serviço — usa custo efetivo (pode ser override)
      const custoFinal = custoEfetivo ?? preview.custo_unitario
      onUpdate({
        ...itemForm,
        quantidade,
        custo_unitario: custoFinal,
        custo_total: custoFinal * quantidade,
        detalhamento_lotes: null
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
  }, [quantidade, preview, custoEfetivo])

  // Focar no input ao abrir edição
  useEffect(() => {
    if (editandoCusto && custoInputRef.current) {
      custoInputRef.current.focus()
      custoInputRef.current.select()
    }
  }, [editandoCusto])

  const handleIniciarEdicaoCusto = () => {
    const valorAtual = custoEfetivo ?? preview?.custo_unitario ?? 0
    setCustoEditavel(valorAtual.toFixed(2))
    setEditandoCusto(true)
  }

  const handleConfirmarCusto = () => {
    const novoValor = parseFloat(custoEditavel)
    if (isNaN(novoValor) || novoValor < 0) {
      setEditandoCusto(false)
      return
    }

    const custoOriginal = itemForm.custo_unitario_ref ?? 0
    const isPersonalizado = Math.abs(novoValor - custoOriginal) > 0.001

    onUpdate({
      ...itemForm,
      quantidade,
      custo_unitario_override: isPersonalizado ? novoValor : undefined,
      custo_personalizado: isPersonalizado,
      custo_unitario: novoValor,
      custo_total: novoValor * quantidade,
    })
    setEditandoCusto(false)
  }

  const handleRestaurarCusto = () => {
    const custoOriginal = itemForm.custo_unitario_ref ?? 0
    onUpdate({
      ...itemForm,
      quantidade,
      custo_unitario_override: undefined,
      custo_personalizado: false,
      custo_unitario: custoOriginal,
      custo_total: custoOriginal * quantidade,
    })
  }

  const handleCustoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirmarCusto()
    if (e.key === 'Escape') setEditandoCusto(false)
  }

  const itemNome = itemForm.nome || itemForm.item?.nome || 'Item'
  const itemUnidade = itemForm.unidade || itemForm.item?.unidade_medida || ''
  const tipoConfig = getTipoConfig(itemForm.tipo_ref, itemForm.item?.tipo)
  const TipoIcon = tipoConfig.icon
  const isMaquina = itemForm.tipo_ref === 'maquina' || itemForm.item?.tipo === 'maquina_hora'
  const estoqueInsuficiente = isProduto && preview && !preview.estoque_suficiente
  const custoExibido = itemForm.custo_personalizado && itemForm.custo_unitario_override != null
    ? itemForm.custo_unitario_override
    : (preview?.custo_unitario || itemForm.custo_unitario_ref || 0)
  const custoTotalExibido = itemForm.custo_personalizado && !isProduto
    ? (itemForm.custo_unitario_override ?? 0) * quantidade
    : (preview?.custo_total ?? 0)

  // Para produtos, override de custo não se aplica (FIFO calcula)
  const permiteOverrideCusto = !isProduto

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
              <h4 className="font-semibold text-lg truncate">{itemNome}</h4>
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
              {isProduto && preview && (
                <div className="flex justify-between">
                  <span>Estoque disponível:</span>
                  <strong className={cn(
                    estoqueInsuficiente ? "text-yellow-600" : "text-blue-600"
                  )}>
                    {(preview.estoque_disponivel ?? 0).toFixed(2)} {itemUnidade}
                  </strong>
                </div>
              )}

              {/* Custo unitário com edição inline */}
              <div className="flex justify-between items-center">
                <span>Custo unitário:</span>
                <div className="flex items-center gap-1.5">
                  {editandoCusto ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm">R$</span>
                      <Input
                        ref={custoInputRef}
                        type="number"
                        min="0"
                        step="0.01"
                        value={custoEditavel}
                        onChange={(e) => setCustoEditavel(e.target.value)}
                        onBlur={handleConfirmarCusto}
                        onKeyDown={handleCustoKeyDown}
                        className="w-24 h-7 text-sm font-mono border-amber-400 focus:border-amber-500 focus-visible:ring-amber-400"
                      />
                      <span className="text-sm text-muted-foreground">/ {itemUnidade}</span>
                    </div>
                  ) : (
                    <>
                      <strong className={cn(
                        "text-primary",
                        itemForm.custo_personalizado && "text-amber-600 dark:text-amber-400"
                      )}>
                        R$ {custoExibido.toFixed(2)} / {itemUnidade}
                      </strong>

                      {permiteOverrideCusto && !itemForm.custo_personalizado && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={handleIniciarEdicaoCusto}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Editar custo para este lançamento</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {itemForm.custo_personalizado && (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
                            <Pencil className="h-3 w-3 mr-1" />
                            Personalizado
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            onClick={handleRestaurarCusto}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                  onClick={handleIniciarEdicaoCusto}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar custo novamente</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Input de Quantidade */}
        <div className="space-y-2">
          <Label htmlFor={`quantidade-${itemForm.produto_id || itemForm.maquina_id || itemForm.servico_ref_id || itemForm.item_id}`}>
            Quantidade ({itemUnidade})
            {itemForm.obrigatorio && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={`quantidade-${itemForm.produto_id || itemForm.maquina_id || itemForm.servico_ref_id || itemForm.item_id}`}
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

          {estoqueInsuficiente && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Quantidade maior que o estoque disponível!
                Disponível: {(preview?.estoque_disponivel ?? 0).toFixed(2)} {itemUnidade}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Info Horímetro para máquina */}
        {isMaquina && (
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-800/50 dark:bg-orange-950/20 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-400">
              <Gauge className="h-4 w-4" />
              Horímetro será atualizado automaticamente
            </div>
          </div>
        )}

        {/* Preview FIFO (se produto) */}
        {isProduto && quantidade > 0 && (
          loadingPreview ? (
            <Skeleton className="h-24 w-full" />
          ) : preview?.preview_consumo && preview.preview_consumo.length > 0 && (
            <PreviewConsumoFIFO lotes={preview.preview_consumo} />
          )
        )}

        {/* Custo Total do Item */}
        {quantidade > 0 && (custoTotalExibido > 0 || (preview && preview.custo_total > 0)) && (
          <div className="flex justify-between items-center pt-4 border-t">
            <span className="font-semibold">Custo Total do Item:</span>
            <span className={cn(
              "text-2xl font-bold text-primary",
              itemForm.custo_personalizado && "text-amber-600 dark:text-amber-400"
            )}>
              R$ {(isProduto ? preview?.custo_total ?? 0 : custoTotalExibido).toFixed(2)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
