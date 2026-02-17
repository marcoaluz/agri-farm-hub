import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  Leaf,
  CheckCircle2,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { cn } from '@/lib/utils'

const cadastroSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Deve conter pelo menos uma maiúscula')
    .regex(/[a-z]/, 'Deve conter pelo menos uma minúscula')
    .regex(/[0-9]/, 'Deve conter pelo menos um número'),
  confirmPassword: z.string().min(1, 'Confirmação obrigatória'),
  
  acceptTerms: z.boolean().refine(val => val === true, 'Você deve aceitar os termos'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type CadastroFormValues = z.infer<typeof cadastroSchema>

function getPasswordStrength(password: string) {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { strength: 1 as const, label: 'Fraca', color: 'bg-destructive' }
  if (score <= 4) return { strength: 2 as const, label: 'Média', color: 'bg-warning' }
  return { strength: 3 as const, label: 'Forte', color: 'bg-success' }
}


const sideFeatures = [
  { title: 'Controle total de custos', description: 'Sistema FIFO para gestão precisa' },
  { title: 'Acompanhamento em tempo real', description: 'Dashboards e relatórios atualizados' },
  { title: 'Multiplataforma', description: 'Acesse de qualquer dispositivo' },
]

export function CadastroPage() {
  const { signUp } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [cadastroSucesso, setCadastroSucesso] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CadastroFormValues>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      
      acceptTerms: false,
    },
  })

  const password = form.watch('password')
  const strength = password ? getPasswordStrength(password) : null
  async function onSubmit(data: CadastroFormValues) {
    try {
      setIsLoading(true)
      await signUp(data.email, data.password, data.fullName)
      setCadastroSucesso(true)
      toast({ title: 'Conta criada!', description: 'Verifique seu email para confirmar.' })
      setTimeout(() => navigate('/login'), 3000)
    } catch {
      toast({ title: 'Erro ao criar conta', description: 'Tente novamente.', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // Tela de sucesso
  if (cadastroSucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center border-border shadow-lg">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Cadastro realizado com sucesso!</h2>
            <p className="text-muted-foreground">Enviamos um email de confirmação para sua caixa de entrada.</p>
            <p className="text-sm text-muted-foreground">Redirecionando em alguns segundos...</p>
            <Link to="/login" className="text-primary font-medium hover:underline text-sm">
              Ir para login agora
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-primary to-primary/70 p-12 flex-col justify-between text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="bg-primary-foreground/10 backdrop-blur-sm p-3 rounded-xl">
            <Leaf className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">SGA</h1>
            <p className="text-primary-foreground/70 text-sm">Sistema de Gestão Agropecuária</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold mb-3">Comece sua jornada hoje</h2>
            <p className="text-primary-foreground/70 text-lg">
              Junte-se a centenas de produtores que já otimizaram a gestão de suas fazendas.
            </p>
          </div>
          <div className="space-y-4">
            {sideFeatures.map(f => (
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
              <CardDescription>Preencha os dados abaixo para começar a usar o SGA</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Nome */}
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome completo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Seu nome" className="pl-10" disabled={isLoading} {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input type="email" placeholder="seu@email.com" className="pl-10" disabled={isLoading} {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Senha */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              className="pl-10 pr-10"
                              disabled={isLoading}
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowPassword(!showPassword)}
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        {password && strength && (
                          <div className="space-y-1 mt-2">
                            <div className="flex gap-1">
                              {[1, 2, 3].map(level => (
                                <div
                                  key={level}
                                  className={cn(
                                    'h-1.5 flex-1 rounded-full transition-colors',
                                    level <= strength.strength ? strength.color : 'bg-muted'
                                  )}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Força da senha: <span className="font-medium">{strength.label}</span>
                            </p>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Confirmar Senha */}
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              className="pl-10 pr-10"
                              disabled={isLoading}
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              tabIndex={-1}
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Termos */}
                  <FormField
                    control={form.control}
                    name="acceptTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isLoading} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Eu li e aceito os{' '}
                            <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link>{' '}
                            e{' '}
                            <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Botão */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-success hover:bg-success/90 text-success-foreground"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</>
                    ) : (
                      'Criar conta'
                    )}
                  </Button>

                  {/* Nota informativa */}
                  <div className="text-center text-sm text-muted-foreground bg-muted rounded-lg p-3 border border-border">
                    <span>
                      Após o cadastro, o administrador irá definir
                      suas permissões de acesso ao sistema.
                    </span>
                  </div>

                  {/* Separador */}
                  <div className="relative my-4">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                      ou cadastre-se com
                    </span>
                  </div>

                  {/* Google */}
                  <Button type="button" variant="outline" className="w-full" disabled={isLoading}>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Cadastrar com Google
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex-col gap-2 pt-0">
              <Separator />
              <p className="text-sm text-muted-foreground">
                Já tem conta?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">Faça login</Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
