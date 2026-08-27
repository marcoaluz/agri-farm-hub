import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RankingPesoCardProps {
  propriedadeId: string
}

type Criterio = 'peso' | 'gmd'

export function RankingPesoCard({ propriedadeId }: RankingPesoCardProps) {
  const [criterio, setCriterio] = useState<Criterio>('peso')

  const { data: ranking, isLoading } = useQuery({
    queryKey: ['ranking-peso', propriedadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ranking_peso_animais' as any, {
        p_propriedade_id: propriedadeId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propriedadeId,
  })

  const ordenado = useMemo(() => {
    if (!ranking) return []
    const comGmd = ranking.filter(r => criterio === 'peso' || r.gmd_kg != null)
    return [...comGmd].sort((a, b) =>
      criterio === 'peso' ? Number(b.peso_atual) - Number(a.peso_atual) : Number(b.gmd_kg) - Number(a.gmd_kg)
    )
  }, [ranking, criterio])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-500" />
            Ranking de Peso por Animal
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={criterio === 'peso' ? 'default' : 'outline'}
              onClick={() => setCriterio('peso')}
            >
              Mais pesado
            </Button>
            <Button
              size="sm"
              variant={criterio === 'gmd' ? 'default' : 'outline'}
              onClick={() => setCriterio('gmd')}
            >
              Maior GMD
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !ordenado.length ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">
              {criterio === 'gmd'
                ? 'Nenhum animal com GMD calculado ainda (precisa de pelo menos 2 pesagens).'
                : 'Nenhuma pesagem registrada ainda.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {ordenado.map((a: any, i: number) => (
              <div key={a.animal_id || i} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex flex-col items-center justify-center w-10">
                  <span className={cn(
                    'text-lg font-bold',
                    i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-700' : 'text-muted-foreground'
                  )}>
                    {i + 1}º
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.identificador}</p>
                  <p className="text-xs text-muted-foreground truncate">({a.rebanho_nome})</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-primary">
                    {Number(a.peso_atual).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.gmd_kg != null ? `GMD +${Number(a.gmd_kg).toFixed(3)}kg/dia` : 'sem GMD ainda'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
