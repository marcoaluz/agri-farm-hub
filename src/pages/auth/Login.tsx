import { Leaf, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const features = [
  { label: 'FIFO', description: 'Controle de estoque inteligente' },
  { label: 'Multi', description: 'Múltiplas propriedades' },
  { label: 'Real', description: 'Custos em tempo real' },
  { label: 'Cloud', description: 'Acesso de qualquer lugar' },
]

export function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/70 p-12 flex-col justify-between text-primary-foreground">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-primary-foreground/10 backdrop-blur-sm p-3 rounded-xl">
            <Leaf className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">SGA</h1>
            <p className="text-primary-foreground/70 text-sm">Sistema de Gestão Agropecuária</p>
          </div>
        </div>

        {/* Centro */}
        <div className="space-y-6">
          <h2 className="text-4xl font-bold mb-4">
            Gerencie sua fazenda com inteligência
          </h2>
          <p className="text-primary-foreground/70 text-lg">
            Controle completo de operações, estoque, custos e resultados em uma única plataforma.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {features.map(f => (
              <div
                key={f.label}
                className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4"
              >
                <p className="font-bold text-lg">{f.label}</p>
                <p className="text-primary-foreground/70 text-sm">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-primary-foreground/60 text-sm">
          © 2024 SGA - Sistema de Gestão Agropecuária. Todos os direitos reservados.
        </p>
      </div>

      {/* Lado Direito */}
      <div className="w-full lg:w-1/2 bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">
          {/* Logo mobile */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-primary p-3 rounded-xl">
                <Leaf className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">SGA</h1>
                <p className="text-muted-foreground text-sm">Sistema de Gestão Agropecuária</p>
              </div>
            </div>
          </div>

          {/* Card */}
          <Card className="border-border shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Entrar na sua conta</CardTitle>
              <CardDescription>
                Digite seu email e senha para acessar o sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Formulário será implementado na parte 2 */}
              <p className="text-muted-foreground text-center py-8">Formulário em breve</p>
            </CardContent>
            <CardFooter />
          </Card>
        </div>
      </div>
    </div>
  )
}
