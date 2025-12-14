import { BarChart3, Download, FileText, Calendar } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const relatorios = [
  {
    title: 'Custo por Talhão',
    description: 'Análise detalhada de custos por área',
    icon: BarChart3,
    category: 'Financeiro',
  },
  {
    title: 'Consumo de Insumos',
    description: 'Relatório de consumo de produtos',
    icon: FileText,
    category: 'Estoque',
  },
  {
    title: 'Lançamentos por Período',
    description: 'Histórico de operações realizadas',
    icon: Calendar,
    category: 'Operacional',
  },
  {
    title: 'Custo por Serviço',
    description: 'Análise de custos por tipo de serviço',
    icon: BarChart3,
    category: 'Financeiro',
  },
  {
    title: 'Horas de Máquina',
    description: 'Relatório de utilização de máquinas',
    icon: FileText,
    category: 'Operacional',
  },
  {
    title: 'Comparativo de Safras',
    description: 'Compare custos entre safras',
    icon: BarChart3,
    category: 'Financeiro',
  },
]

export function Relatorios() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">
            Gere relatórios personalizados
          </p>
        </div>
      </div>

      {/* Grid de Relatórios */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {relatorios.map((relatorio, index) => (
          <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <relatorio.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {relatorio.category}
                </span>
              </div>
              <CardTitle className="text-lg mt-3">{relatorio.title}</CardTitle>
              <CardDescription>{relatorio.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full gap-2">
                <Download className="h-4 w-4" />
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
