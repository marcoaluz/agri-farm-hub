import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { CloudSun, History } from 'lucide-react'
import { useGlobal } from '@/contexts/GlobalContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

function weatherDescription(code: number) {
  if (code === 0) return { texto: 'Céu limpo', icone: '☀️' }
  if (code <= 3) return { texto: 'Parcialmente nublado', icone: '⛅' }
  if (code <= 48) return { texto: 'Nublado', icone: '☁️' }
  if (code <= 57) return { texto: 'Chuvisco', icone: '🌦️' }
  if (code <= 67) return { texto: 'Chuva', icone: '🌧️' }
  if (code <= 77) return { texto: 'Neve', icone: '❄️' }
  if (code <= 82) return { texto: 'Pancadas', icone: '⛈️' }
  if (code <= 99) return { texto: 'Tempestade', icone: '🌩️' }
  return { texto: 'Desconhecido', icone: '❓' }
}

export function CardClima() {
  const { propriedadeAtual } = useGlobal()
  const propId = propriedadeAtual?.id
  const lat = (propriedadeAtual as any)?.latitude
  const lng = (propriedadeAtual as any)?.longitude
  const [histOpen, setHistOpen] = useState(false)

  const { data: climaHoje, isLoading } = useQuery({
    queryKey: ['clima-hoje', lat, lng],
    queryFn: async () => {
      if (lat == null || lng == null) return null
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=America/Sao_Paulo&forecast_days=7`,
      )
      return res.json()
    },
    enabled: lat != null && lng != null,
    staleTime: 1000 * 60 * 30,
  })

  const { data: historicoClima, isLoading: loadHist } = useQuery({
    queryKey: ['clima-historico', propId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_serie_clima_diaria', {
        p_propriedade_id: propId,
        p_dias: 90,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propId && histOpen,
    staleTime: 10 * 60 * 1000,
  })

  const serieFmt = useMemo(
    () =>
      (historicoClima || []).map((d: any) => ({
        ...d,
        dataLabel: d.data ? format(new Date(d.data + 'T12:00:00'), 'dd/MM') : '',
        dataFull: d.data ? format(new Date(d.data + 'T12:00:00'), 'dd/MM/yyyy') : '',
        precipitacao_mm: Number(d.precipitacao_mm || 0),
      })),
    [historicoClima],
  )

  return (
    <>
      <Card className="lg:col-span-3">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudSun className="h-5 w-5" />
            Clima {propriedadeAtual?.nome ? `· ${propriedadeAtual.nome}` : ''}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setHistOpen(true)} disabled={!propId}>
            <History className="h-4 w-4 mr-1" /> Ver histórico
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : climaHoje?.current ? (
            <>
              {/* Agora */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold">{climaHoje.current.temperature_2m}°C</p>
                  <p className="text-sm text-muted-foreground">
                    {weatherDescription(climaHoje.current.weather_code).texto}
                  </p>
                </div>
                <div className="text-4xl">{weatherDescription(climaHoje.current.weather_code).icone}</div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-center mb-4">
                <div>
                  <p className="text-muted-foreground">Umidade</p>
                  <p className="font-medium">{climaHoje.current.relative_humidity_2m}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Chuva</p>
                  <p className="font-medium">{climaHoje.current.precipitation}mm</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vento</p>
                  <p className="font-medium">{climaHoje.current.wind_speed_10m}km/h</p>
                </div>
              </div>

              {/* Próximos dias */}
              <div className="border-t pt-3">
                <p className="text-xs font-medium mb-2">Próximos dias</p>
                <div className="space-y-1">
                  {climaHoje.daily?.time?.slice(1, 6).map((dia: string, i: number) => (
                    <div key={dia} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground w-16">
                        {new Date(dia + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                      </span>
                      <span>{weatherDescription(climaHoje.daily.weather_code[i + 1]).icone}</span>
                      <span>
                        {climaHoje.daily.temperature_2m_min[i + 1]}° / {climaHoje.daily.temperature_2m_max[i + 1]}°
                      </span>
                      <span className="text-sky-600">
                        {climaHoje.daily.precipitation_sum[i + 1] > 0
                          ? `${climaHoje.daily.precipitation_sum[i + 1]}mm`
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Defina a localização da propriedade para ver o clima
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de chuva</DialogTitle>
            <DialogDescription>Precipitação diária dos últimos 90 dias</DialogDescription>
          </DialogHeader>
          {loadHist ? (
            <Skeleton className="h-[260px] w-full" />
          ) : serieFmt.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum registro climático disponível para esta propriedade.
            </p>
          ) : (
            <div className="h-[260px]">
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
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
