import { Settings, User, Bell, Shield, Database } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export function Configuracoes() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Perfil */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Perfil</CardTitle>
            </div>
            <CardDescription>
              Informações pessoais e conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Nome</p>
                <p className="text-sm text-muted-foreground">Administrador</p>
              </div>
              <Button variant="outline" size="sm">Editar</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground">admin@fazenda.com</p>
              </div>
              <Button variant="outline" size="sm">Alterar</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Senha</p>
                <p className="text-sm text-muted-foreground">••••••••</p>
              </div>
              <Button variant="outline" size="sm">Alterar</Button>
            </div>
          </CardContent>
        </Card>

        {/* Notificações */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notificações</CardTitle>
            </div>
            <CardDescription>
              Configure suas preferências de notificação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="estoque-baixo" className="flex-1">
                <p className="font-medium">Estoque baixo</p>
                <p className="text-sm text-muted-foreground">
                  Alertar quando produto estiver abaixo do mínimo
                </p>
              </Label>
              <Switch id="estoque-baixo" defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="vencimento" className="flex-1">
                <p className="font-medium">Vencimento de lotes</p>
                <p className="text-sm text-muted-foreground">
                  Alertar sobre lotes próximos ao vencimento
                </p>
              </Label>
              <Switch id="vencimento" defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="manutencao" className="flex-1">
                <p className="font-medium">Manutenção de máquinas</p>
                <p className="text-sm text-muted-foreground">
                  Alertar sobre manutenções pendentes
                </p>
              </Label>
              <Switch id="manutencao" defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Segurança</CardTitle>
            </div>
            <CardDescription>
              Configurações de segurança da conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="2fa" className="flex-1">
                <p className="font-medium">Autenticação em duas etapas</p>
                <p className="text-sm text-muted-foreground">
                  Adicione uma camada extra de segurança
                </p>
              </Label>
              <Switch id="2fa" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sessões ativas</p>
                <p className="text-sm text-muted-foreground">
                  1 dispositivo conectado
                </p>
              </div>
              <Button variant="outline" size="sm">Gerenciar</Button>
            </div>
          </CardContent>
        </Card>

        {/* Dados */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle>Dados</CardTitle>
            </div>
            <CardDescription>
              Exportação e backup de dados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Exportar dados</p>
                <p className="text-sm text-muted-foreground">
                  Baixe todos os seus dados em formato CSV
                </p>
              </div>
              <Button variant="outline" size="sm">Exportar</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Último backup</p>
                <p className="text-sm text-muted-foreground">
                  14/12/2024 às 03:00
                </p>
              </div>
              <Button variant="outline" size="sm">Backup agora</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
