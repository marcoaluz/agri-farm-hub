import { Briefcase, Plus, Search } from 'lucide-react'
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

export function Itens() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Itens</h1>
          <p className="text-muted-foreground">
            Cadastro unificado de produtos, serviços e horas de máquina
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Item
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produtos de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Horas de Máquina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar itens..." className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Ureia</TableCell>
              <TableCell>
                <Badge variant="secondary">Produto</Badge>
              </TableCell>
              <TableCell>Fertilizante</TableCell>
              <TableCell>kg</TableCell>
              <TableCell>R$ 2,50</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Aplicação de Defensivo</TableCell>
              <TableCell>
                <Badge variant="outline">Serviço</Badge>
              </TableCell>
              <TableCell>Aplicação</TableCell>
              <TableCell>ha</TableCell>
              <TableCell>R$ 45,00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Trator John Deere</TableCell>
              <TableCell>
                <Badge className="bg-accent text-accent-foreground">Máquina</Badge>
              </TableCell>
              <TableCell>Tração</TableCell>
              <TableCell>hora</TableCell>
              <TableCell>R$ 120,00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
