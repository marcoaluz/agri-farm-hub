import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MapPinOff, Wind, Droplets, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

const METEO_BASE = 'https://api.open-meteo.com/v1/forecast'

function weatherEmoji(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'Céu limpo' }
  if (code >= 1 && code <= 3) return { emoji: '⛅', label: 'Parcialmente nublado' }
  if (code === 45 || code === 48) return { emoji: '🌫️', label: 'Neblina' }
  if ([51, 53, 55, 61, 63, 65].includes(code)) return { emoji: '🌧️', label: 'Chuva' }
  if ([71, 73, 75].includes(code)) return { emoji: '❄️', label: 'Neve' }
  if ([80, 81, 82].includes(code)) return { emoji: '🌦️', label: 'Pancadas de chuva' }
  if ([95, 96, 99].includes(code)) return { emoji: '⛈️', label: 'Tempestade' }
  return { emoji: '🌤️', label: 'Variável' }
}

interface Prop {
  id: string
  nome: string
  latitude?: number | null
  longitude?: number | null
}

export function ClimaConsolidado({ propriedades }: { propriedades?: Prop[] }) {
  // Se não vier prop, busca diretamente do banco (RLS garante segurança)
  const { data: fetched } = useQuery({
    queryKey: ['clima-propriedades-todas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propriedades')
        .select('id, nome, latitude, longitude')
        .eq('ativo', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
      if (error) throw error
      return (data || []) as Prop[]
    },
    enabled: !propriedades || propriedades.length === 0,
    staleTime: 5 * 60 * 1000,
  })

  const fonte = (propriedades && propriedades.length > 0) ? propriedades : (fetched || [])

  const comCoords = useMemo(
    () => fonte.filter((p) => p.latitude != null && p.longitude != null),
    [fonte],
  )

  const queries = useQueries({
    queries: comCoords.map((prop) => ({
      queryKey: ['clima-consolidado', prop.latitude, prop.longitude],
      queryFn: async () => {
        const lat = Number(prop.latitude)
        const lng = Number(prop.longitude)
        const url = `${METEO_BASE}?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=America/Sao_Paulo`
        const res = await fetch(url)
        const data = await res.json()
        return { ...data, prop }
      },
      staleTime: 10 * 60 * 1000,
    })),
  })

  if (comCoords.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <MapPinOff className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-1">
            Configure as coordenadas das suas propriedades para ver o clima.
          </p>
          <Button asChild variant="outline" size="sm" className="gap-1.5 mt-3">
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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {queries.map((query, idx) => {
        const prop = comCoords[idx]
        const cur = query.data?.current

        if (query.isLoading || !cur) {
          return (
            <Card key={prop.id}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-20" />
                <div className="flex gap-4">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardContent>
            </Card>
          )
        }

        const { emoji, label } = weatherEmoji(cur.weather_code)

        return (
          <Card key={prop.id}>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-3">{prop.nome}</p>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{emoji}</span>
                <div>
                  <p className="text-2xl font-bold text-foreground">{Math.round(cur.temperature_2m)}°C</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5 text-sky-400" />
                  {cur.relative_humidity_2m}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="h-3.5 w-3.5" />
                  {cur.wind_speed_10m} km/h
                </span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
