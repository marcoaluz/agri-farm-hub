import { Package, Plus, Search, AlertTriangle } from 'lucide-react'
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

export function Estoque() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Estoque</h1>
          <p className="text-muted-foreground">
            Controle de produtos e insumos
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Entrada de Estoque
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor em Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 125.430</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Itens Abaixo do Mínimo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">3</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lotes a Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">2</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produtos..." className="pl-9" />
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Custo Médio</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Ureia</TableCell>
              <TableCell>Fertilizante</TableCell>
              <TableCell>500 kg</TableCell>
              <TableCell>R$ 2,50</TableCell>
              <TableCell>R$ 1.250,00</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-warning border-warning">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Baixo
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Glifosato</TableCell>
              <TableCell>Defensivo</TableCell>
              <TableCell>200 L</TableCell>
              <TableCell>R$ 35,00</TableCell>
              <TableCell>R$ 7.000,00</TableCell>
              <TableCell>
                <Badge variant="secondary">Normal</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Semente Soja</TableCell>
              <TableCell>Semente</TableCell>
              <TableCell>1.000 kg</TableCell>
              <TableCell>R$ 15,00</TableCell>
              <TableCell>R$ 15.000,00</TableCell>
              <TableCell>
                <Badge variant="secondary">Normal</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
