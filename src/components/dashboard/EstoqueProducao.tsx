import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Coffee, Wheat, Apple, Sprout, Leaf, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function getIconComp(icone: string) {
  switch (icone) {
    case 'coffee': return Coffee
    case 'wheat': return Wheat
    case 'apple': return Apple
    case 'sprout': return Sprout
    default: return Leaf
  }
}

interface EstoqueProducaoProps {
  propriedadeId: string | null
  isConsolidado: boolean
}

interface EstoqueItem {
  propriedade_id: string
  propriedade_nome: string
  cultura_id: string
  cultura_nome: string
  unidade_label: string
  icone: string
  total_entradas: number
  total_saidas: number
  saldo_disponivel: number
}

export function EstoqueProducao({ propriedadeId, isConsolidado }: EstoqueProducaoProps) {
  const { data: estoqueData, isLoading } = useQuery({
    queryKey: ['dash-estoque-producao', propriedadeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_estoque_producao', {
        p_propriedade_id: propriedadeId || null,
      })
      if (error) throw error
      return (data || []) as EstoqueItem[]
    },
  })

  // Group by cultura when consolidated
  const agrupado = (() => {
    if (!estoqueData?.length) return []
    if (!isConsolidado) return estoqueData

    const map = new Map<string, EstoqueItem & { subPropriedades?: { nome: string; entradas: number; saidas: number; saldo: number }[] }>()
    estoqueData.forEach((item) => {
      const key = item.cultura_nome
      const existing = map.get(key)
      if (existing) {
        existing.total_entradas += Number(item.total_entradas)
        existing.total_saidas += Number(item.total_saidas)
        existing.saldo_disponivel += Number(item.saldo_disponivel)
        existing.subPropriedades?.push({
          nome: item.propriedade_nome,
          entradas: Number(item.total_entradas),
          saidas: Number(item.total_saidas),
          saldo: Number(item.saldo_disponivel),
        })
      } else {
        map.set(key, {
          ...item,
          total_entradas: Number(item.total_entradas),
          total_saidas: Number(item.total_saidas),
          saldo_disponivel: Number(item.saldo_disponivel),
          subPropriedades: [{
            nome: item.propriedade_nome,
            entradas: Number(item.total_entradas),
            saidas: Number(item.total_saidas),
            saldo: Number(item.saldo_disponivel),
          }],
        })
      }
    })
    return Array.from(map.values())
  })()

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Estoque de Produção</h2>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : agrupado.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Sprout className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Nenhuma colheita registrada ainda</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/talhoes">Registrar Colheita</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {agrupado.map((item: any) => {
            const IconComp = getIconComp(item.icone)
            return (
              <Card key={item.cultura_nome + item.propriedade_id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <IconComp className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-foreground">{item.cultura_nome}</span>
                    <span className="text-xs text-muted-foreground">({item.unidade_label})</span>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Entradas: <span className="font-medium text-foreground">{Number(item.total_entradas).toLocaleString('pt-BR')} {item.unidade_label}</span></p>
                    <p>Saídas: <span className="font-medium text-foreground">{Number(item.total_saidas).toLocaleString('pt-BR')} {item.unidade_label}</span></p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20 text-sm px-3 py-1">
                    Saldo: {Number(item.saldo_disponivel).toLocaleString('pt-BR')} {item.unidade_label}
                  </Badge>

                  {isConsolidado && item.subPropriedades?.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-border space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Por propriedade:</p>
                      {item.subPropriedades.map((sub: any) => (
                        <div key={sub.nome} className="flex justify-between text-xs text-muted-foreground">
                          <span>{sub.nome}</span>
                          <span className="font-medium text-foreground">{sub.saldo.toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
