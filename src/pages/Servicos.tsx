import { Wheat, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function Servicos() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Serviços</h1>
          <p className="text-muted-foreground">
            Configure os serviços agrícolas e seus itens
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Serviço
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar serviços..." className="pl-9" />
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Adubação de Cobertura</CardTitle>
              <Badge variant="secondary">Adubação</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Requer Talhão</span>
              <span className="font-medium text-success">Sim</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Itens vinculados</span>
              <span className="font-medium">5</span>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Aplicação de Herbicida</CardTitle>
              <Badge variant="secondary">Aplicação</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Requer Talhão</span>
              <span className="font-medium text-success">Sim</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Itens vinculados</span>
              <span className="font-medium">3</span>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Plantio</CardTitle>
              <Badge variant="secondary">Plantio</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Requer Talhão</span>
              <span className="font-medium text-success">Sim</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Itens vinculados</span>
              <span className="font-medium">4</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed flex items-center justify-center min-h-[180px] cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="text-center">
            <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Adicionar Serviço</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
