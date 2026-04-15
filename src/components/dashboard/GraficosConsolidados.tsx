import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/common/ChartCard'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

interface ConsolidadoRow {
  propriedade_nome: string
  custo_safra: number
  receita_paga: number
  resultado: number
  custo_por_ha: number
}

interface Props {
  data: ConsolidadoRow[]
  isLoading: boolean
}

function interpolateColor(value: number, max: number) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  const r = Math.round(255)
  const g = Math.round(220 - ratio * 150)
  const b = Math.round(50)
  return `rgb(${r}, ${g}, ${b})`
}

export function GraficosConsolidados({ data, isLoading }: Props) {
  const chartData = useMemo(() => {
    return (data || []).map((row) => ({
      nome: row.propriedade_nome,
      custo: Number(row.custo_safra || 0),
      receita: Number(row.receita_paga || 0),
      resultado: Number(row.resultado || 0),
      custo_ha: Number(row.custo_por_ha || 0),
    }))
  }, [data])

  const maxCustoHa = useMemo(() => Math.max(...chartData.map((d) => d.custo_ha), 1), [chartData])

  if (isLoading) {
    return (
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[310px] rounded-xl" />
        ))}
      </div>
    )
  }

  if (!chartData.length) return null

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
      {/* Custo vs Receita */}
      <ChartCard title="Custo vs Receita" description="Por propriedade">
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [fmt(value)]} contentStyle={tooltipStyle} />
              <Bar dataKey="custo" name="Custo" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="receita" name="Receita" fill="hsl(142, 45%, 40%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Resultado */}
      <ChartCard title="Resultado" description="Lucro ou prejuízo por propriedade">
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [fmt(value), 'Resultado']} contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.resultado >= 0 ? 'hsl(142, 45%, 40%)' : 'hsl(0, 72%, 51%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Custo por Hectare */}
      <ChartCard title="Custo por Hectare" description="R$/ha por propriedade">
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `R$${v.toLocaleString('pt-BR')}`} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
              <Tooltip formatter={(value: number) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/ha`]} contentStyle={tooltipStyle} />
              <Bar dataKey="custo_ha" name="Custo/ha" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={interpolateColor(entry.custo_ha, maxCustoHa)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  )
}
