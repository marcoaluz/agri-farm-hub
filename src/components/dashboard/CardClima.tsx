import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import {
  Sun, CloudSun, Wind, CloudDrizzle, CloudRain, CloudLightning, Cloud, MapPinOff,
  Droplets, Thermometer, Settings,
} from 'lucide-react'
import { useGlobal } from '@/contexts/GlobalContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

const weatherIcon = (code: number, size = 24) => {
  const props = { size, className: 'text-foreground' }
  if (code === 0) return <Sun {...props} className="text-amber-500" />
  if (code <= 3) return <CloudSun {...props} className="text-amber-400" />
  if (code === 45 || code === 48) return <Wind {...props} className="text-muted-foreground" />
  if (code >= 51 && code <= 57) return <CloudDrizzle {...props} className="text-sky-400" />
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain {...props} className="text-sky-500" />
  if (code === 95 || code === 96 || code === 99) return <CloudLightning {...props} className="text-violet-500" />
  if (code >= 71 && code <= 77) return <Cloud {...props} className="text-muted-foreground" />
  return <Cloud {...props} className="text-muted-foreground" />
}

const METEO_BASE = 'https://api.open-meteo.com/v1/forecast'
const METEO_PARAMS = '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=America%2FSao_Paulo&forecast_days=4'

function buildForecast(daily: any) {
  return daily?.time?.slice(1, 4).map((d: string, i: number) => ({
    dia: format(new Date(d + 'T12:00:00'), 'EEE', { locale: ptBR }),
    max: daily.temperature_2m_max[i + 1],
    min: daily.temperature_2m_min[i + 1],
    code: daily.weather_code[i + 1],
  })) || []
}

interface CardClimaProps {
  propriedades?: any[]
}

export function CardClima({ propriedades }: CardClimaProps = {}) {
  const { propriedadeAtual } = useGlobal()

  // ── MODO CONSOLIDADO ──
  if (!propriedadeAtual && propriedades) {
    return <CardClimaConsolidado propriedades={propriedades} />
  }

  // ── MODO SELECIONADA ──
  return <CardClimaSingle />
}

/* ══════════════════════════════════════
   MODO SELECIONADA (comportamento original)
   ══════════════════════════════════════ */
function CardClimaSingle() {
  const { propriedadeAtual } = useGlobal()
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError] = useState(false)

  const propLat = (propriedadeAtual as any)?.latitude
  const propLng = (propriedadeAtual as any)?.longitude

  useEffect(() => {
    if (propLat && propLng) return
    if (!navigator.geolocation) { setGeoError(true); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError(true),
      { timeout: 8000 },
    )
  }, [propLat, propLng])

  const lat = propLat || geoCoords?.lat
  const lng = propLng || geoCoords?.lng

  const { data: clima, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['clima', lat, lng],
    queryFn: async () => {
      const url = `${METEO_BASE}?latitude=${lat}&longitude=${lng}${METEO_PARAMS}`
      const res = await fetch(url)
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!lat && !!lng,
  })

  const atualizadoHa = useMemo(() => {
    if (!dataUpdatedAt) return ''
    const min = Math.round((Date.now() - dataUpdatedAt) / 60000)
    return min < 1 ? 'agora' : `há ${min} min`
  }, [dataUpdatedAt, clima])

  if (!lat && !lng && (geoError || (!propLat && !propLng))) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <MapPinOff className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Configure as coordenadas da propriedade para ver o clima.</p>
        </CardContent>
      </Card>
    )
  }

  const cur = clima?.current
  const daily = clima?.daily
  const forecast = buildForecast(daily)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Clima — {propriedadeAtual?.nome || 'Propriedade'}</CardTitle>
          {dataUpdatedAt && <span className="text-xs text-muted-foreground">Atualizado {atualizadoHa}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !cur ? (
          <ClimaSkeletonContent />
        ) : (
          <>
            <ClimaCurrentBlock cur={cur} />
            <Separator />
            <ForecastRow forecast={forecast} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ══════════════════════════════════════
   MODO CONSOLIDADO (todas as propriedades)
   ══════════════════════════════════════ */
function CardClimaConsolidado({ propriedades }: { propriedades: any[] }) {
  const propriedadesComCoords = useMemo(
    () => (propriedades || []).filter((p: any) => p.latitude && p.longitude),
    [propriedades],
  )

  const climaQueries = useQueries({
    queries: propriedadesComCoords.map((prop: any) => ({
      queryKey: ['clima', prop.latitude, prop.longitude],
      queryFn: async () => {
        const url = `${METEO_BASE}?latitude=${prop.latitude}&longitude=${prop.longitude}${METEO_PARAMS}`
        const res = await fetch(url)
        const data = await res.json()
        return { ...data, propriedade: prop }
      },
      staleTime: 10 * 60 * 1000,
    })),
  })

  if (propriedadesComCoords.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <MapPinOff className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-1">
            Configure as coordenadas das suas propriedades para ver o clima.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Vá em Propriedades → Editar → Coordenadas GPS.
          </p>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/propriedades">
              <Settings className="h-3.5 w-3.5" />
              Configurar agora
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {climaQueries.map((query, idx) => {
        const prop = propriedadesComCoords[idx]
        const cur = query.data?.current
        const daily = query.data?.daily
        const forecast = buildForecast(daily)

        return (
          <Card key={prop.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {cur && weatherIcon(cur.weather_code, 20)}
                  Clima — {prop.nome}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.isLoading || !cur ? (
                <ClimaSkeletonContent />
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    {weatherIcon(cur.weather_code, 36)}
                    <p className="text-3xl font-bold text-foreground">{Math.round(cur.temperature_2m)}°C</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground ml-auto">
                      <span className="flex items-center gap-1">
                        <CloudRain className="h-3.5 w-3.5 text-sky-500" />
                        {cur.precipitation} mm
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets className="h-3.5 w-3.5 text-sky-400" />
                        {cur.relative_humidity_2m}%
                      </span>
                    </div>
                  </div>
                  <Separator />
                  <ForecastRow forecast={forecast} />
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════
   BLOCOS REUTILIZÁVEIS
   ══════════════════════════════════════ */
function ClimaCurrentBlock({ cur }: { cur: any }) {
  return (
    <>
      <div className="flex items-center gap-4">
        {weatherIcon(cur.weather_code, 48)}
        <div>
          <p className="text-4xl font-bold text-foreground">{Math.round(cur.temperature_2m)}°C</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Thermometer className="h-3 w-3" /> Sensação {Math.round(cur.apparent_temperature)}°C
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Droplets className="h-4 w-4 text-sky-400" />
          Umidade {cur.relative_humidity_2m}%
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CloudRain className="h-4 w-4 text-sky-500" />
          Chuva {cur.precipitation} mm
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
          <Wind className="h-4 w-4 text-muted-foreground" />
          Vento {cur.wind_speed_10m} km/h
        </div>
      </div>
    </>
  )
}

function ForecastRow({ forecast }: { forecast: any[] }) {
  return (
    <div className="flex gap-2">
      {forecast.map((f: any, i: number) => (
        <div key={i} className="flex-1 rounded-lg bg-muted/50 p-2 text-center">
          <p className="text-xs font-medium text-muted-foreground capitalize">{f.dia}</p>
          <div className="my-1 flex justify-center">{weatherIcon(f.code, 20)}</div>
          <p className="text-xs text-foreground font-semibold">{Math.round(f.max)}°</p>
          <p className="text-xs text-muted-foreground">{Math.round(f.min)}°</p>
        </div>
      ))}
    </div>
  )
}

function ClimaSkeletonContent() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 flex-1 rounded-lg" />)}
      </div>
    </div>
  )
}
