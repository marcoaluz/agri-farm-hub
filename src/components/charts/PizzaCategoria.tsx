import { useEffect, useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { prepararDadosPizza, fmtMoedaBR, type DadoPizza } from '@/lib/formatters'

export const CORES_PIZZA = [
  '#1F3A2E', '#E8B14F', '#4A6B8A', '#A83428',
  '#4A7C3E', '#C97A2B', '#6B6558', '#8B7355',
]

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

interface Props {
  dados: any[]
  nameKey?: string
  valueKey?: string
  donut?: boolean
  cores?: string[]
  /** Formatador do valor no tooltip (default: moeda BRL) */
  formatarValor?: (v: number) => string
  emptyLabel?: string
}

export function PizzaCategoria({
  dados,
  nameKey = 'name',
  valueKey = 'value',
  donut = false,
  cores = CORES_PIZZA,
  formatarValor = fmtMoedaBR,
  emptyLabel = 'Sem dados',
}: Props) {
  const isMobile = useIsMobile()
  const dadosFinal: DadoPizza[] = useMemo(
    () => prepararDadosPizza(dados || [], { nameKey, valueKey }),
    [dados, nameKey, valueKey],
  )

  const outerRadius = isMobile ? 70 : 90
  const innerRadius = donut ? (isMobile ? 40 : 52) : 0

  const renderLabel = ({ cx, cy, midAngle, outerRadius: oR, percent, name }: any) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = oR + (isMobile ? 16 : 25)
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text
        x={x}
        y={y}
        fill="hsl(var(--foreground))"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={isMobile ? 10 : 12}
        fontWeight={500}
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  if (dadosFinal.length === 0) {
    return (
      <div className="h-[350px] md:h-[400px] flex items-center justify-center text-muted-foreground text-sm">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="h-[350px] md:h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={dadosFinal}
            cx="50%"
            cy="45%"
            labelLine={false}
            label={renderLabel}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            paddingAngle={donut ? 3 : 0}
            dataKey="value"
            nameKey="name"
          >
            {dadosFinal.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isOutros ? '#9CA3AF' : cores[index % cores.length]}
              />
            ))}
          </Pie>
          <Tooltip
            trigger={isMobile ? 'click' : 'hover'}
            formatter={(value: number, name: any) => [formatarValor(Number(value)), name]}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
