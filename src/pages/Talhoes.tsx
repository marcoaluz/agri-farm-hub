import { MapPin, Plus, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useGlobal } from '@/contexts/GlobalContext'

export function Talhoes() {
  const { propriedadeAtual } = useGlobal()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Talhões</h1>
          <p className="text-muted-foreground">
            {propriedadeAtual 
              ? `Talhões de ${propriedadeAtual.nome}`
              : 'Selecione uma propriedade para ver os talhões'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtrar
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Talhão
          </Button>
        </div>
      </div>

      {!propriedadeAtual ? (
        <Card className="p-12 text-center">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Nenhuma propriedade selecionada</h3>
          <p className="text-muted-foreground">Selecione uma propriedade no menu superior</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Placeholder talhão */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Talhão A1</CardTitle>
                <Badge variant="default" className="bg-success">Plantado</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Área</span>
                <span className="font-medium">45 ha</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cultura</span>
                <span className="font-medium">Soja</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed flex items-center justify-center min-h-[150px] cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="text-center">
              <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Adicionar Talhão</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
