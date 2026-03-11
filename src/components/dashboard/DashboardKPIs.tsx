import { ClipboardList, DollarSign, MapPin, TrendingUp, TrendingDown } from 'lucide-react'
import { StatCard } from '@/components/common/StatCard'
import { Skeleton } from '@/components/ui/skeleton'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface KPIData {
  totalLanc: number
  custoTotal: number
  areaOperada: number
  saldo: number
}

interface DashboardKPIsProps {
  data: KPIData
  isLoading: boolean
}

export function DashboardKPIs({ data, isLoading }: DashboardKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total de Lançamentos"
        value={data.totalLanc}
        description="lançamentos na safra"
        icon={ClipboardList}
        variant="default"
      />
      <StatCard
        title="Custo Total da Safra"
        value={fmt(data.custoTotal)}
        description="investido na safra"
        icon={DollarSign}
        variant="primary"
      />
      <StatCard
        title="Área Operada"
        value={`${data.areaOperada.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha`}
        description="área com lançamentos"
        icon={MapPin}
        variant="success"
      />
      <StatCard
        title="Saldo Financeiro"
        value={fmt(data.saldo)}
        description={data.saldo >= 0 ? 'saldo positivo' : 'saldo negativo'}
        icon={data.saldo >= 0 ? TrendingUp : TrendingDown}
        variant={data.saldo >= 0 ? 'success' : 'warning'}
      />
    </div>
  )
}
