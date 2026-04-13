import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Landmark, BarChart3 } from 'lucide-react'
import { StatCard } from '@/components/common/StatCard'
import { Skeleton } from '@/components/ui/skeleton'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

interface KPIData {
  custo_safra_ativa: number
  custo_por_ha: number
  receita_paga: number
  resultado_parcial: number
  alertas: {
    produtos_baixo_estoque: number
    manutencoes_vencidas: number
    vacinas_proximas: number
    financeiro_vencido: number
    total_alertas: number
  }
}

interface Props {
  data: KPIData | null
  isLoading: boolean
  onAlertClick?: () => void
}

export function DashboardKPIsV2({ data, isLoading, onAlertClick }: Props) {
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    )
  }

  const alertas = data.alertas ?? { total_alertas: 0, produtos_baixo_estoque: 0, manutencoes_vencidas: 0, vacinas_proximas: 0, financeiro_vencido: 0 }
  const totalAlertas = alertas.total_alertas ?? 0

  const alertBreakdown: string[] = []
  if (alertas.produtos_baixo_estoque > 0) alertBreakdown.push(`${alertas.produtos_baixo_estoque} estoque`)
  if (alertas.financeiro_vencido > 0) alertBreakdown.push(`${alertas.financeiro_vencido} financeiro`)
  if (alertas.manutencoes_vencidas > 0) alertBreakdown.push(`${alertas.manutencoes_vencidas} máquinas`)
  if (alertas.vacinas_proximas > 0) alertBreakdown.push(`${alertas.vacinas_proximas} pecuária`)

  const resultado = data.resultado_parcial ?? 0
  const isPositivo = resultado >= 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Custo da Safra"
        value={fmt(data.custo_safra_ativa ?? 0)}
        description={`R$ ${((data.custo_por_ha ?? 0)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}/ha`}
        icon={DollarSign}
        variant="primary"
      />
      <StatCard
        title="Receita Recebida"
        value={fmt(data.receita_paga ?? 0)}
        description="receitas pagas"
        icon={Landmark}
        variant={(data.receita_paga ?? 0) > 0 ? 'success' : 'default'}
      />
      <StatCard
        title={isPositivo ? 'Lucro Parcial' : 'Prejuízo Parcial'}
        value={fmt(resultado)}
        description={`Margem: ${resultado !== 0 && (data.receita_paga ?? 0) > 0
          ? ((resultado / (data.receita_paga ?? 1)) * 100).toFixed(1)
          : '0.0'}%`}
        icon={isPositivo ? TrendingUp : TrendingDown}
        variant={isPositivo ? 'success' : 'warning'}
      />
      <div onClick={onAlertClick} className={onAlertClick ? 'cursor-pointer' : ''}>
        <StatCard
          title="Alertas"
          value={totalAlertas}
          description={alertBreakdown.length > 0 ? alertBreakdown.join(' · ') : 'Tudo certo!'}
          icon={totalAlertas > 0 ? AlertTriangle : BarChart3}
          variant={totalAlertas > 0 ? 'warning' : 'success'}
        />
      </div>
    </div>
  )
}
