import { ClipboardList, Plus, Search, Filter, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useGlobal } from '@/contexts/GlobalContext'

export function Lancamentos() {
  const { safraAtual } = useGlobal()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Lançamentos</h1>
          <p className="text-muted-foreground">
            {safraAtual 
              ? `Lançamentos da ${safraAtual.nome}`
              : 'Selecione uma safra para ver os lançamentos'
            }
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 284.500</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo por Hectare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 1.850</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Este Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar lançamentos..." className="pl-9" />
        </div>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          Período
        </Button>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Talhão</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="text-right">Custo Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>15/12/2024</TableCell>
              <TableCell className="font-medium">Adubação de Cobertura</TableCell>
              <TableCell>
                <Badge variant="outline">Talhão A1</Badge>
              </TableCell>
              <TableCell>3 itens</TableCell>
              <TableCell className="text-right font-medium">R$ 4.500,00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>14/12/2024</TableCell>
              <TableCell className="font-medium">Aplicação de Herbicida</TableCell>
              <TableCell>
                <Badge variant="outline">Talhão B2</Badge>
              </TableCell>
              <TableCell>2 itens</TableCell>
              <TableCell className="text-right font-medium">R$ 2.800,00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>12/12/2024</TableCell>
              <TableCell className="font-medium">Plantio</TableCell>
              <TableCell>
                <Badge variant="outline">Talhão A2</Badge>
              </TableCell>
              <TableCell>5 itens</TableCell>
              <TableCell className="text-right font-medium">R$ 12.350,00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
