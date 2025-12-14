import { DollarSign, TrendingUp, TrendingDown, PieChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function Financeiro() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">
            Visão geral de custos e despesas
          </p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="2024">
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border">
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">Exportar</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Custo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 584.320</div>
            <p className="text-xs text-muted-foreground mt-1">Safra atual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Insumos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 312.450</div>
            <p className="text-xs text-success mt-1">53.5% do total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-info" />
              Serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 156.870</div>
            <p className="text-xs text-info mt-1">26.8% do total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4 text-accent" />
              Máquinas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 115.000</div>
            <p className="text-xs text-muted-foreground mt-1">19.7% do total</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts placeholder */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Custos por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">Gráfico de Pizza</p>
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">Gráfico de Barras</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custo por Talhão */}
      <Card className="p-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Custo por Talhão</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Talhão A1</p>
                <p className="text-sm text-muted-foreground">45 ha</p>
              </div>
              <div className="text-right">
                <p className="font-bold">R$ 85.430</p>
                <p className="text-sm text-muted-foreground">R$ 1.898/ha</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Talhão A2</p>
                <p className="text-sm text-muted-foreground">52 ha</p>
              </div>
              <div className="text-right">
                <p className="font-bold">R$ 98.280</p>
                <p className="text-sm text-muted-foreground">R$ 1.890/ha</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Talhão B1</p>
                <p className="text-sm text-muted-foreground">38 ha</p>
              </div>
              <div className="text-right">
                <p className="font-bold">R$ 72.150</p>
                <p className="text-sm text-muted-foreground">R$ 1.899/ha</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
