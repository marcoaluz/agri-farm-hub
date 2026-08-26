import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy } from 'lucide-react'
import { format, subDays } from 'date-fns'

interface RankingLeiteCardProps {
  propriedadeId: string
}

const PERIODOS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
]

export function RankingLeiteCard({ propriedadeId }: RankingLeiteCardProps) {
  const [periodo, setPeriodo] = useState('30')

  const { data: ranking, isLoading } = useQuery({
    queryKey: ['ranking-leite', propriedadeId, periodo],
    queryFn: async () => {
      const dataFim = format(new Date(), 'yyyy-MM-dd')
      const dataInicio = format(subDays(new Date(), Number(periodo)), 'yyyy-MM-dd')
      const { data, error } = await supabase.rpc('get_ranking_leite_vacas' as any, {
        p_propriedade_id: propriedadeId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propriedadeId,
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking de Produção por Vaca
          </CardTitle>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !ranking?.length ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Nenhum dado individual nesse período — só rebanhos com lote "Individual" aparecem aqui.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ranking.map((v: any, i: number) => (
              <div key={v.animal_id || i} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex flex-col items-center justify-center w-10">
                  <span className={`text-lg font-bold ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-700' : 'text-muted-foreground'}`}>
                    {i + 1}º
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{v.identificador}</p>
                  <p className="text-xs text-muted-foreground truncate">({v.rebanho_nome})</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-primary">
                    {Number(v.total_litros).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Number(v.media_litros_ordenha).toFixed(1)}L/ordenha · {v.num_ordenhas}x
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
