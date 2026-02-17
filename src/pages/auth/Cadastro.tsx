import { Leaf, CheckCircle2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const features = [
  {
    title: 'Controle total de custos',
    description: 'Sistema FIFO para gestão precisa',
  },
  {
    title: 'Acompanhamento em tempo real',
    description: 'Dashboards e relatórios atualizados',
  },
  {
    title: 'Multiplataforma',
    description: 'Acesse de qualquer dispositivo',
  },
]

export function CadastroPage() {
  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-primary to-primary/70 p-12 flex-col justify-between text-primary-foreground">
        {/* Logo */}
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
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold mb-3">Comece sua jornada hoje</h2>
            <p className="text-primary-foreground/70 text-lg">
              Junte-se a centenas de produtores que já otimizaram a gestão de suas fazendas.
            </p>
          </div>

          <div className="space-y-4">
            {features.map(f => (
              <div key={f.title} className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 mt-0.5 text-primary-foreground/80" />
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-primary-foreground/60 text-sm">{f.description}</p>
                </div>
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
      <div className="w-full lg:w-3/5 bg-background flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
        <div className="max-w-2xl w-full space-y-8">
          {/* Logo mobile */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-4">
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
              <CardTitle className="text-2xl font-bold">Criar nova conta</CardTitle>
              <CardDescription>
                Preencha os dados abaixo para começar a usar o SGA
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
