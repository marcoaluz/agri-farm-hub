import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Shield,
  Leaf,
  UserCog,
  Briefcase,
  Wrench,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Schema
const cadastroSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo'),
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Deve conter pelo menos uma maiúscula')
    .regex(/[a-z]/, 'Deve conter pelo menos uma minúscula')
    .regex(/[0-9]/, 'Deve conter pelo menos um número'),
  confirmPassword: z.string().min(1, 'Confirmação obrigatória'),
  perfil: z.enum(['admin', 'proprietario', 'gerente', 'operador', 'consultor']),
  acceptTerms: z.boolean().refine(val => val === true, 'Você deve aceitar os termos'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type CadastroFormValues = z.infer<typeof cadastroSchema>

// Força da senha
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

const perfis = [
  {
    value: 'admin' as const,
    label: 'Admin',
    description: 'Acesso total ao sistema',
    icon: Shield,
    isAdmin: true,
  },
  {
    value: 'proprietario' as const,
    label: 'Proprietário',
    description: 'Acesso completo à propriedade',
    icon: UserCog,
    isAdmin: false,
  },
  {
    value: 'gerente' as const,
    label: 'Gerente',
    description: 'Gerenciamento de operações',
    icon: Briefcase,
    isAdmin: false,
  },
  {
    value: 'operador' as const,
    label: 'Operador',
    description: 'Lançamento de operações',
    icon: Wrench,
    isAdmin: false,
  },
  {
    value: 'consultor' as const,
    label: 'Consultor',
    description: 'Acesso somente leitura',
    icon: BookOpen,
    isAdmin: false,
  },
]

export function Cadastro() {
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
      perfil: 'operador',
      acceptTerms: false,
    },
  })

  const password = form.watch('password')
  const strength = password ? getPasswordStrength(password) : null
  const selectedPerfil = form.watch('perfil')

  async function onSubmit(data: CadastroFormValues) {
    try {
      setIsLoading(true)
      await signUp(data.email, data.password, data.fullName)
      setCadastroSucesso(true)
      toast({
        title: 'Conta criada!',
        description: 'Verifique seu email para confirmar.',
      })
      setTimeout(() => navigate('/login'), 3000)
    } catch {
      toast({
        title: 'Erro ao criar conta',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Tela de sucesso
  if (cadastroSucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md text-center border-border shadow-lg">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Cadastro realizado com sucesso!</h2>
            <p className="text-muted-foreground">
              Enviamos um email de confirmação para sua caixa de entrada.
            </p>
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
              <Leaf className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">SGA</h1>
          <p className="text-muted-foreground">Sistema de Gestão Agropecuária</p>
        </div>

        {/* Card */}
        <Card className="border-border shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold">Criar conta</CardTitle>
            <CardDescription>Preencha os dados abaixo para criar sua conta</CardDescription>
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
                      {/* Indicador de força */}
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

                {/* Perfil de Acesso */}
                <FormField
                  control={form.control}
                  name="perfil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Perfil de Acesso</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-1 md:grid-cols-2 gap-2"
                        >
                          {perfis.map(perfil => {
                            const isSelected = selectedPerfil === perfil.value
                            const Icon = perfil.icon

                            return (
                              <label
                                key={perfil.value}
                                className={cn(
                                  'relative flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all',
                                  perfil.isAdmin && 'md:col-span-2',
                                  perfil.isAdmin && isSelected
                                    ? 'border-destructive bg-destructive/5'
                                    : perfil.isAdmin
                                    ? 'border-destructive/30'
                                    : isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                )}
                              >
                                <RadioGroupItem value={perfil.value} className="sr-only" />
                                <div
                                  className={cn(
                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                                    perfil.isAdmin
                                      ? 'bg-destructive/10 text-destructive'
                                      : 'bg-primary/10 text-primary'
                                  )}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-foreground">{perfil.label}</span>
                                    {perfil.isAdmin && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                        SUPER ADMIN
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{perfil.description}</p>
                                </div>
                                {isSelected && (
                                  <CheckCircle2
                                    className={cn(
                                      'h-5 w-5 shrink-0',
                                      perfil.isAdmin ? 'text-destructive' : 'text-primary'
                                    )}
                                  />
                                )}
                              </label>
                            )
                          })}
                        </RadioGroup>
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
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          Eu li e aceito os{' '}
                          <Link to="/termos" className="text-primary hover:underline">
                            Termos de Uso
                          </Link>{' '}
                          e{' '}
                          <Link to="/privacidade" className="text-primary hover:underline">
                            Política de Privacidade
                          </Link>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {/* Botão criar conta */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    'Criar conta'
                  )}
                </Button>

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
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
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
              <Link to="/login" className="text-primary font-medium hover:underline">
                Faça login
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
