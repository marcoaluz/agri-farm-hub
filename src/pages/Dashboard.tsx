import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  PawPrint,
  Layers,
  AlertTriangle,
  TrendingUp,
  Milk,
  Weight,
  Activity,
  Calendar,
} from 'lucide-react'
import { StatCard } from '@/components/common/StatCard'
import { ChartCard } from '@/components/common/ChartCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Mock data - será substituído por dados reais do Supabase
const productionData = [
  { month: 'Jan', value: 4500 },
  { month: 'Fev', value: 4800 },
  { month: 'Mar', value: 5200 },
  { month: 'Abr', value: 4900 },
  { month: 'Mai', value: 5600 },
  { month: 'Jun', value: 5400 },
]

const speciesData = [
  { name: 'Bovinos', value: 450, color: 'hsl(142, 45%, 28%)' },
  { name: 'Suínos', value: 180, color: 'hsl(42, 85%, 55%)' },
  { name: 'Aves', value: 1200, color: 'hsl(199, 89%, 48%)' },
  { name: 'Equinos', value: 35, color: 'hsl(30, 35%, 45%)' },
]

const recentAlerts = [
  { id: 1, type: 'vaccination', message: 'Vacinação pendente - Lote B12', urgency: 'high' },
  { id: 2, type: 'health', message: 'Exame veterinário agendado', urgency: 'medium' },
  { id: 3, type: 'production', message: 'Produção abaixo da média - Lote A3', urgency: 'low' },
]

const recentActivities = [
  { id: 1, action: 'Novo animal registrado', detail: 'Bovino #B-0234', time: '2 min atrás' },
  { id: 2, action: 'Vacinação aplicada', detail: 'Lote B12 - 45 animais', time: '1 hora atrás' },
  { id: 3, action: 'Pesagem realizada', detail: 'Média: 320kg', time: '3 horas atrás' },
  { id: 4, action: 'Transferência de lote', detail: 'A3 → A5', time: '5 horas atrás' },
]

export default function Dashboard() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do sistema de gestão agropecuária
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Últimos 30 dias</span>
            <span className="sm:hidden">30 dias</span>
          </Button>
          <Button size="sm" className="gap-2 text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar Relatório</span>
            <span className="sm:hidden">Exportar</span>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de Animais"
          value="1.865"
          description="Ativos no sistema"
          icon={PawPrint}
          trend={{ value: 12, isPositive: true }}
          variant="primary"
        />
        <StatCard
          title="Lotes Ativos"
          value="24"
          description="Em 6 propriedades"
          icon={Layers}
          variant="default"
        />
        <StatCard
          title="Produção Mensal"
          value="5.400L"
          description="Leite produzido"
          icon={Milk}
          trend={{ value: 8, isPositive: true }}
          variant="success"
        />
        <StatCard
          title="Alertas Pendentes"
          value="3"
          description="Requerem atenção"
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Production Chart */}
        <ChartCard
          title="Tendência de Produção"
          description="Produção de leite nos últimos 6 meses"
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm">
              Ver detalhes
            </Button>
          }
        >
          <div className="h-[200px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productionData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 45%, 28%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 45%, 28%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 88%)" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(30, 15%, 45%)"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(30, 15%, 45%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(0, 0%, 100%)',
                    border: '1px solid hsl(40, 20%, 88%)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()}L`, 'Produção']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(142, 45%, 28%)"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Species Distribution */}
        <ChartCard title="Distribuição por Espécie" description="Animais ativos por categoria">
          <div className="h-[200px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={speciesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {speciesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(0, 0%, 100%)',
                    border: '1px solid hsl(40, 20%, 88%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [value, 'Animais']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {speciesData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {item.name}: {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Recent Alerts */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-card-foreground">Alertas Recentes</h3>
            <Button variant="ghost" size="sm">
              Ver todos
            </Button>
          </div>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-4 transition-colors hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      alert.urgency === 'high'
                        ? 'bg-destructive animate-pulse'
                        : alert.urgency === 'medium'
                        ? 'bg-warning'
                        : 'bg-success'
                    }`}
                  />
                  <span className="text-sm font-medium text-foreground">{alert.message}</span>
                </div>
                <Badge
                  variant={
                    alert.urgency === 'high'
                      ? 'destructive'
                      : alert.urgency === 'medium'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {alert.urgency === 'high' ? 'Urgente' : alert.urgency === 'medium' ? 'Médio' : 'Baixo'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-card-foreground">Atividade Recente</h3>
            <Button variant="ghost" size="sm">
              Ver histórico
            </Button>
          </div>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Weight className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Peso Médio (Bovinos)</p>
            <p className="text-xl font-semibold text-foreground">342 kg</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="rounded-lg bg-success/10 p-3">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Taxa de Crescimento</p>
            <p className="text-xl font-semibold text-foreground">+15.2%</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="rounded-lg bg-accent/20 p-3">
            <Calendar className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Próxima Vacinação</p>
            <p className="text-xl font-semibold text-foreground">3 dias</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="rounded-lg bg-info/10 p-3">
            <Milk className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Média Diária Leite</p>
            <p className="text-xl font-semibold text-foreground">180L</p>
          </div>
        </div>
      </div>
    </div>
  )
}
