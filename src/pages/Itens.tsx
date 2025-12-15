import { Briefcase, Plus, Search, Package, Wrench, Tractor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function Itens() {
  // Dados mockados
  const itens = [
    { id: 1, nome: 'Ureia', tipo: 'produto', categoria: 'Fertilizante', unidade: 'kg', custo: 2.50 },
    { id: 2, nome: 'Aplicação de Defensivo', tipo: 'servico', categoria: 'Aplicação', unidade: 'ha', custo: 45.00 },
    { id: 3, nome: 'Trator John Deere', tipo: 'maquina', categoria: 'Tração', unidade: 'hora', custo: 120.00 },
  ]

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'produto':
        return <Badge variant="secondary" className="text-xs"><Package className="h-3 w-3 mr-1" />Produto</Badge>
      case 'servico':
        return <Badge variant="outline" className="text-xs"><Wrench className="h-3 w-3 mr-1" />Serviço</Badge>
      case 'maquina':
        return <Badge className="bg-accent text-accent-foreground text-xs"><Tractor className="h-3 w-3 mr-1" />Máquina</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{tipo}</Badge>
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Itens</h1>
          <p className="text-sm text-muted-foreground">
            Produtos, serviços e horas de máquina
          </p>
        </div>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Novo Item
        </Button>
      </div>

      {/* Stats - Grid responsivo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col items-center sm:items-start">
              <Package className="h-5 w-5 text-primary mb-1 sm:hidden" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">Produtos</p>
              <p className="text-xl sm:text-2xl font-bold">24</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col items-center sm:items-start">
              <Wrench className="h-5 w-5 text-primary mb-1 sm:hidden" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">Serviços</p>
              <p className="text-xl sm:text-2xl font-bold">8</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col items-center sm:items-start">
              <Tractor className="h-5 w-5 text-primary mb-1 sm:hidden" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">Máquinas</p>
              <p className="text-xl sm:text-2xl font-bold">5</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar itens..." className="pl-9" />
      </div>

      {/* Lista de Cards para Mobile (em vez de tabela) */}
      <div className="space-y-3">
        {itens.map(item => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{item.nome}</h3>
                  <p className="text-sm text-muted-foreground">{item.categoria} • {item.unidade}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-foreground">
                    R$ {item.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="mt-1">
                    {getTipoBadge(item.tipo)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
