import { Bell, BellOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// TODO: alertas de estoque baixo, safra vencendo, manutenção pendente

export default function Notificacoes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Centro de Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BellOff className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhuma notificação no momento.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Alertas de estoque, safra e manutenção aparecerão aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
