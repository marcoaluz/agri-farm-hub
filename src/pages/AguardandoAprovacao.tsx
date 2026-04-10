import { Clock, Mail, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function AguardandoAprovacao() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-[480px]">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-16 w-16 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">Conta Pendente</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sua conta foi criada mas ainda não foi ativada. Você precisa de um convite de um administrador para acessar o sistema.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <Separator />

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">E-mail cadastrado</p>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>

        <CardFooter>
          <p className="text-xs text-muted-foreground text-center w-full">
            Em caso de dúvidas, entre em contato com o administrador do sistema.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
