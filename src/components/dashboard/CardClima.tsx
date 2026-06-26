import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { CloudRain, Thermometer, Droplets, MapPinOff } from 'lucide-react'
import { useGlobal } from '@/contexts/GlobalContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export function CardClima() {
  const { propriedadeAtual } = useGlobal()
  const propId = propriedadeAtual?.id
  const lat = (propriedadeAtual as any)?.latitude
  const lng = (propriedadeAtual as any)?.longitude
  const hasCoords = lat != null && lng != null

  const { data: resumo, isLoading: loadResumo } = useQuery({
    queryKey: ['clima-resumo', propId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_resumo_clima', {
        p_propriedade_id: propId,
        p_dias: 30,
      })
      if (error) throw error
      return Array.isArray(data) ? data[0] : data
    },
    enabled: !!propId && hasCoords,
    staleTime: 10 * 60 * 1000,
  })

  const { data: serie, isLoading: loadSerie } = useQuery({
    queryKey: ['clima-serie', propId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_serie_clima_diaria', {
        p_propriedade_id: propId,
        p_dias: 30,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propId && hasCoords,
    staleTime: 10 * 60 * 1000,
  })

  const serieFmt = useMemo(
    () =>
      (serie || []).map((d: any) => ({
        ...d,
        dataLabel: d.data ? format(new Date(d.data + 'T12:00:00'), 'dd/MM') : '',
        dataFull: d.data ? format(new Date(d.data + 'T12:00:00'), 'dd/MM/yyyy') : '',
        precipitacao_mm: Number(d.precipitacao_mm || 0),
      })),
    [serie],
  )

  const isLoading = loadResumo || loadSerie
  const precip = Number(resumo?.precipitacao_total || 0)
  const tMin = resumo?.temp_min_periodo
  const tMax = resumo?.temp_max_periodo
  const diasChuva = Number(resumo?.dias_com_chuva || 0)
  const semDados = !resumo || (precip === 0 && diasChuva === 0 && tMin == null && tMax == null)

  if (!hasCoords || (!isLoading && semDados)) {
    return (
      <Card className="lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clima — últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <MapPinOff className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Sem dados climáticos ainda. Desenhe os talhões no mapa para que o sistema capture
            a localização da propriedade automaticamente.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/mapa">Ir para o mapa</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Clima — últimos 30 dias {propriedadeAtual?.nome ? `· ${propriedadeAtual.nome}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-[120px] w-full" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-3">
                <CloudRain className="h-7 w-7 text-sky-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Chuva acumulada</p>
                  <p className="text-xl font-bold text-foreground">{precip.toFixed(1)} mm</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-3">
                <Thermometer className="h-7 w-7 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Temp. mín / máx</p>
                  <p className="text-xl font-bold text-foreground">
                    {tMin != null ? `${Math.round(Number(tMin))}°` : '—'} /{' '}
                    {tMax != null ? `${Math.round(Number(tMax))}°` : '—'}
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-3">
                <Droplets className="h-7 w-7 text-sky-400 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Dias com chuva</p>
                  <p className="text-xl font-bold text-foreground">{diasChuva}</p>
                </div>
              </div>
            </div>

            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serieFmt} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="dataLabel"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v: number) => `${v}`}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${Number(value).toFixed(1)} mm`, 'Chuva']}
                    labelFormatter={(_label, payload: any) => payload?.[0]?.payload?.dataFull || ''}
                  />
                  <Bar dataKey="precipitacao_mm" fill="hsl(199, 89%, 48%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
