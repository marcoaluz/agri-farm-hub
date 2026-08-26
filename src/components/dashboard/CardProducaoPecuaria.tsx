import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Milk, ArrowRight } from 'lucide-react'

interface CardProducaoPecuariaProps {
  propriedadeId: string | null
}

export function CardProducaoPecuaria({ propriedadeId }: CardProducaoPecuariaProps) {
  const { data: producao, isLoading } = useQuery({
    queryKey: ['producao-pecuaria-mes', propriedadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_producao_pecuaria_mes' as any, {
        p_propriedade_id: propriedadeId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propriedadeId,
  })

  if (!propriedadeId) return null

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (!producao?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Milk className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum produto de origem animal em produção ainda (ex: registre uma ordenha vinculada a um produto &ldquo;Leite&rdquo; no Estoque).
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {producao.map((p: any) => (
        <Card key={p.produto_id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Milk className="h-4 w-4 text-primary" />
              </div>
              <p className="font-semibold text-foreground">{p.produto_nome}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Hoje</p>
                <p className="font-bold text-foreground">
                  {Number(p.produzido_hoje).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {p.unidade_medida}
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Produzido no mês</p>
                <p className="font-bold text-green-700">
                  {Number(p.produzido_mes).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {p.unidade_medida}
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Vendido no mês</p>
                <p className="font-bold text-blue-700">
                  {Number(p.vendido_mes).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {p.unidade_medida}
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Em estoque agora</p>
                <p className="font-bold text-amber-700">
                  {Number(p.estoque_atual).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {p.unidade_medida}
                </p>
              </div>
            </div>

            {p.receita_mes > 0 && (
              <div className="rounded-lg bg-emerald-500/10 p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Receita no mês</span>
                <span className="font-bold text-emerald-700">
                  R$ {Number(p.receita_mes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/estoque">
                Ver no Estoque <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
