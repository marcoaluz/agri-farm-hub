import { Package, Wrench, Tractor, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ItemComCusto, ItemTipo } from '@/types/item'

interface ItemCardProps {
  item: ItemComCusto
  onEdit: (item: ItemComCusto) => void
  onDelete: (item: ItemComCusto) => void
}

const tipoConfig: Record<ItemTipo, { 
  label: string
  icon: typeof Package
  bgColor: string
  borderColor: string
  textColor: string
  badgeVariant: 'default' | 'secondary' | 'outline'
}> = {
  produto_estoque: {
    label: 'Produto',
    icon: Package,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-600 dark:text-blue-400',
    badgeVariant: 'secondary'
  },
  servico: {
    label: 'Serviço',
    icon: Wrench,
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-600 dark:text-purple-400',
    badgeVariant: 'outline'
  },
  maquina_hora: {
    label: 'Máquina',
    icon: Tractor,
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-600 dark:text-orange-400',
    badgeVariant: 'default'
  }
}

export function ItemCard({ item, onEdit, onDelete }: ItemCardProps) {
  const config = tipoConfig[item.tipo]
  const Icon = config.icon

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return 'N/D'
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <Card 
      className={`overflow-hidden transition-all hover:shadow-md ${config.bgColor} ${config.borderColor} border`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Ícone do tipo */}
          <div className={`p-2.5 rounded-lg bg-white dark:bg-background shadow-sm shrink-0`}>
            <Icon className={`h-6 w-6 ${config.textColor}`} />
          </div>

          {/* Informações principais */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">
              {item.nome}
            </h3>
            
            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Badge variant={config.badgeVariant} className="text-xs">
                {config.label}
              </Badge>
              {item.categoria && (
                <Badge variant="outline" className="text-xs">
                  {item.categoria}
                </Badge>
              )}
            </div>

            {/* Custo e estoque */}
            <div className="mt-3 space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-foreground">
                  {formatCurrency(item.custo_unitario)}
                </span>
                <span className="text-xs text-muted-foreground">
                  /{item.unidade_medida}
                </span>
              </div>

              {/* Mostrar estoque apenas para produtos */}
              {item.tipo === 'produto_estoque' && item.estoque_disponivel !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Estoque:</span>
                  <span className={`text-sm font-medium ${
                    item.estoque_disponivel <= 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : item.estoque_disponivel < 10 
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-green-600 dark:text-green-400'
                  }`}>
                    {item.estoque_disponivel.toLocaleString('pt-BR')} {item.unidade_medida}
                  </span>
                </div>
              )}

              {/* Valor imobilizado para produtos */}
              {item.tipo === 'produto_estoque' && item.valor_imobilizado !== undefined && item.valor_imobilizado > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Imobilizado:</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(item.valor_imobilizado)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-border/50">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs"
            onClick={() => onEdit(item)}
          >
            <Edit className="h-3.5 w-3.5 mr-1" />
            Editar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(item)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
