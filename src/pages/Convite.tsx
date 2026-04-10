import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Leaf, Lock, Eye, EyeOff, User, Loader2,
  AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface TokenValidation {
  valido: boolean
  motivo?: string
  papel: string
  propriedade_nome: string
  expira_em: string
  email?: string
}

export default function Convite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [validando, setValidando] = useState(true)
  const [tokenData, setTokenData] = useState<TokenValidation | null>(null)
  const [tokenValido, setTokenValido] = useState(false)

  // Form
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [criando, setCriando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const PAPEL_LABELS: Record<string, string> = {
    proprietario: 'Proprietário',
    gerente: 'Gerente',
    operador: 'Operador',
    visualizador: 'Visualizador',
  }

  // Validar token ao carregar
  useEffect(() => {
    async function validar() {
      if (!token) {
        setValidando(false)
        return
      }

      try {
        const { data, error } = await supabase.rpc('validar_token_convite' as any, { p_token: token })
        if (error) throw error

        const result = data as unknown as TokenValidation
        setTokenData(result)
        setTokenValido(result.valido)
      } catch (err: any) {
        setTokenData({ valido: false, motivo: err.message || 'Erro ao validar convite', papel: '', propriedade_nome: '', expira_em: '' })
        setTokenValido(false)
      } finally {
        setValidando(false)
      }
    }

    validar()
  }, [token])

  // Criar conta
  const handleCriarConta = async () => {
    if (!nome.trim() || nome.trim().length < 3) {
      toast.error('Nome deve ter no mínimo 3 caracteres.')
      return
    }
    if (senha.length < 8) {
      toast.error('Senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (senha !== confirmarSenha) {
      toast.error('As senhas não coincidem.')
      return
    }
    if (!tokenData?.email && !token) {
      toast.error('Token inválido.')
      return
    }

    setCriando(true)
    try {
      // Passo 1: criar conta no Auth
      const emailConvite = (tokenData as any)?.email
      if (!emailConvite) {
        toast.error('Não foi possível obter o e-mail do convite.')
        return
      }

      const { error: authError } = await supabase.auth.signUp({
        email: emailConvite,
        password: senha,
        options: {
          data: { name: nome.trim() },
        },
      })

      if (authError) throw authError

      // Passo 2: aceitar convite
      const { data: conviteData, error: conviteError } = await supabase.rpc('aceitar_convite' as any, {
        p_token: token,
        p_nome: nome.trim(),
      })

      if (conviteError) throw conviteError

      setSucesso(true)
      toast.success('Conta criada com sucesso! Bem-vindo ao SGA.')

      // Redirecionar após sucesso
      setTimeout(() => navigate('/'), 2000)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar conta.')
    } finally {
      setCriando(false)
    }
  }

  // Loading
  if (validando) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Validando convite...</p>
        </div>
      </div>
    )
  }

  // Token ausente
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Link inválido</h2>
            <p className="text-muted-foreground">Nenhum token de convite encontrado na URL.</p>
            <Button onClick={() => navigate('/login')} variant="outline">Ir para o login</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Token inválido/expirado
  if (!tokenValido) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Convite Inválido</h2>
            <p className="text-muted-foreground">
              {tokenData?.motivo || 'Este convite não é mais válido.'}
            </p>
            <p className="text-sm text-muted-foreground">Solicite um novo convite ao administrador.</p>
            <Button onClick={() => navigate('/login')} variant="outline">Ir para o login</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Sucesso
  if (sucesso) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Conta criada com sucesso!</h2>
            <p className="text-muted-foreground">Redirecionando para o sistema...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Formulário de cadastro por convite
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

        <div className="space-y-6">
          <h2 className="text-3xl font-bold">Você foi convidado!</h2>
          <p className="text-primary-foreground/70 text-lg">
            Crie sua conta para acessar o sistema e colaborar na gestão da propriedade.
          </p>
          <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-6 space-y-3">
            <p className="font-semibold text-lg">{tokenData?.propriedade_nome}</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground">
                {PAPEL_LABELS[tokenData?.papel || ''] || tokenData?.papel}
              </Badge>
            </div>
          </div>
        </div>

        <p className="text-primary-foreground/60 text-sm">
          © 2024 SGA - Sistema de Gestão Agropecuária
        </p>
      </div>

      {/* Lado Direito */}
      <div className="w-full lg:w-3/5 bg-background flex items-center justify-center p-6 sm:p-8">
        <div className="max-w-md w-full">
          {/* Logo mobile */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-6">
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

          {/* Banner convite mobile */}
          <div className="lg:hidden bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4 text-center">
            <p className="text-sm text-foreground">
              Você foi convidado para <strong>{tokenData?.propriedade_nome}</strong> como{' '}
              <Badge variant="secondary" className="ml-1">
                {PAPEL_LABELS[tokenData?.papel || ''] || tokenData?.papel}
              </Badge>
            </p>
          </div>

          <Card className="border-border shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Criar sua conta</CardTitle>
              <CardDescription>
                Preencha os dados abaixo para acessar o SGA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Banner no desktop */}
              <div className="hidden lg:block bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-sm text-foreground">
                  📩 Convite para <strong>{tokenData?.propriedade_nome}</strong> como{' '}
                  <Badge variant="secondary">
                    {PAPEL_LABELS[tokenData?.papel || ''] || tokenData?.papel}
                  </Badge>
                </p>
              </div>

              {/* E-mail (readonly) */}
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  value={(tokenData as any)?.email || ''}
                  disabled
                  className="opacity-70"
                />
                <p className="text-xs text-muted-foreground">O e-mail é definido pelo convite e não pode ser alterado.</p>
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    className="pl-10"
                    disabled={criando}
                    maxLength={100}
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="senha"
                    type={showPassword ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-10 pr-10"
                    disabled={criando}
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
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmar-senha"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a senha"
                    className="pl-10 pr-10"
                    disabled={criando}
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
              </div>

              <Button onClick={handleCriarConta} disabled={criando} className="w-full" size="lg">
                {criando ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</>
                ) : (
                  'Criar minha conta'
                )}
              </Button>

              {/* Validade */}
              {tokenData?.expira_em && (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Convite válido até {format(new Date(tokenData.expira_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
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
