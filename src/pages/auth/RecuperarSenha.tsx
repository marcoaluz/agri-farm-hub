import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Leaf, ArrowLeft, Mail, Lock, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const recuperarSenhaSchema = z.object({
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
})

type RecuperarSenhaFormValues = z.infer<typeof recuperarSenhaSchema>

export function RecuperarSenhaPage() {
  const { resetPassword } = useAuth()
  const { toast } = useToast()
  const [emailEnviado, setEmailEnviado] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<RecuperarSenhaFormValues>({
    resolver: zodResolver(recuperarSenhaSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(data: RecuperarSenhaFormValues) {
    try {
      setIsLoading(true)
      await resetPassword(data.email)
      setEmailEnviado(true)
      toast({
        title: 'Email enviado com sucesso!',
        description: 'Verifique sua caixa de entrada.',
      })
    } catch {
      // Error handled by AuthContext toast
    } finally {
      setIsLoading(false)
    }
  }

  const handleReenviar = () => {
    const email = form.getValues('email')
    onSubmit({ email })
  }

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/70 p-12 flex-col justify-between text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="bg-primary-foreground/10 backdrop-blur-sm p-3 rounded-xl">
            <Leaf className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">SGA</h1>
            <p className="text-primary-foreground/70 text-sm">Sistema de Gestão Agropecuária</p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-4xl font-bold mb-4">Recupere o acesso à sua conta</h2>
          <p className="text-primary-foreground/70 text-lg">
            Enviaremos um link seguro para redefinir sua senha
          </p>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 flex items-start gap-4">
              <div className="bg-primary-foreground/10 p-2 rounded-lg">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-lg">Link por email</p>
                <p className="text-primary-foreground/70 text-sm">Você receberá um link seguro e temporário</p>
              </div>
            </div>
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 flex items-start gap-4">
              <div className="bg-primary-foreground/10 p-2 rounded-lg">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-lg">Segurança garantida</p>
                <p className="text-primary-foreground/70 text-sm">O link expira em 1 hora</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-primary-foreground/60 text-sm">
          © 2024 SGA - Sistema de Gestão Agropecuária. Todos os direitos reservados.
        </p>
      </div>

      {/* Lado Direito */}
      <div className="w-full lg:w-1/2 bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6">
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

          {/* Card principal */}
          <Card className="border-border shadow-lg">
            {!emailEnviado ? (
              <>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-bold">Recuperar senha</CardTitle>
                  <CardDescription>Digite seu email para receber o link de recuperação</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="email"
                                  placeholder="seu@email.com"
                                  className="pl-10"
                                  autoFocus
                                  disabled={isLoading}
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full bg-success hover:bg-success/90 text-success-foreground"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          'Enviar link de recuperação'
                        )}
                      </Button>

                      <Link to="/login" className="block">
                        <Button type="button" variant="ghost" className="w-full text-muted-foreground">
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Voltar para login
                        </Button>
                      </Link>
                    </form>
                  </Form>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="space-y-1 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold">Email enviado!</CardTitle>
                  <CardDescription>
                    Enviamos um link de recuperação para{' '}
                    <strong className="text-foreground">{form.getValues('email')}</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Próximos passos */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4 space-y-3">
                    <p className="font-medium text-sm text-blue-900 dark:text-blue-200">Próximos passos:</p>
                    <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 text-xs font-bold text-blue-800 dark:text-blue-200">1</span>
                        Verifique sua caixa de entrada
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 text-xs font-bold text-blue-800 dark:text-blue-200">2</span>
                        Clique no link recebido
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 text-xs font-bold text-blue-800 dark:text-blue-200">3</span>
                        Defina sua nova senha
                      </li>
                    </ol>
                  </div>

                  <p className="text-sm text-muted-foreground text-center">
                    Não recebeu o email? Verifique a pasta de spam ou tente novamente.
                  </p>

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleReenviar}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Reenviando...
                        </>
                      ) : (
                        'Reenviar email'
                      )}
                    </Button>
                    <Link to="/login" className="block">
                      <Button type="button" variant="ghost" className="w-full text-muted-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para login
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </>
            )}
          </Card>

          {/* Dica de segurança */}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>Dica de segurança:</strong> Se você não solicitou a recuperação de senha, ignore este email. Sua conta permanecerá segura.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
