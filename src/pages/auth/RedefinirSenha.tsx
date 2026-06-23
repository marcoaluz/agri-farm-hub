import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Leaf, Lock, Eye, EyeOff, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function getPasswordStrength(pw: string) {
  if (!pw) return { level: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 2) return { level: 33, label: 'Fraca', color: 'bg-red-500' }
  if (score <= 3) return { level: 66, label: 'Razoável', color: 'bg-yellow-500' }
  return { level: 100, label: 'Forte', color: 'bg-green-500' }
}

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [linkInvalido, setLinkInvalido] = useState(false)
  const [sessaoOk, setSessaoOk] = useState(false)

  const strength = getPasswordStrength(senha)
  const senhasIguais = senha === confirmar && confirmar.length > 0
  const formValido = senha.length >= 8 && senhasIguais

  useEffect(() => {
    const error = searchParams.get('error')
    const errorCode = searchParams.get('error_code')
    if (error === 'access_denied' || errorCode === 'otp_expired') {
      setLinkInvalido(true)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessaoOk(true)
      } else {
        setLinkInvalido(true)
      }
    })
  }, [searchParams])

  const handleSubmit = async () => {
    if (!formValido) return

    setSalvando(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      setSucesso(true)
      toast.success('Senha redefinida com sucesso!')
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao redefinir senha.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="h-screen flex overflow-hidden">
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
          <h2 className="text-3xl font-bold">Redefinir senha</h2>
          <p className="text-primary-foreground/70 text-lg">
            Escolha uma senha forte para proteger sua conta.
          </p>
        </div>

        <p className="text-primary-foreground/60 text-sm">
          © 2025 SGA - Sistema de Gestão Agropecuária
        </p>
      </div>

      {/* Lado Direito */}
      <div className="w-full lg:w-3/5 bg-background flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
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

          <Card className="border-border shadow-lg">
            {linkInvalido ? (
              <>
                <CardHeader className="space-y-1 pb-3 pt-4 px-4 sm:px-6 sm:pt-6 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                      <AlertTriangle className="h-8 w-8 text-destructive" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold">Link expirado ou inválido</CardTitle>
                  <CardDescription>
                    O link de redefinição de senha expirou ou já foi utilizado. Solicite um novo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <Button onClick={() => navigate('/esqueci-senha')} className="w-full">
                    Solicitar novo link
                  </Button>
                </CardContent>
              </>
            ) : sucesso ? (
              <>
                <CardHeader className="space-y-1 pb-3 pt-4 px-4 sm:px-6 sm:pt-6 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold">Senha redefinida!</CardTitle>
                  <CardDescription>Redirecionando para o login...</CardDescription>
                </CardHeader>
              </>
            ) : !sessaoOk ? (
              <CardContent className="py-8 px-4 sm:px-6 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">Verificando link de recuperação...</p>
              </CardContent>
            ) : (
              <>
                <CardHeader className="space-y-1 pb-3 pt-4 px-4 sm:px-6 sm:pt-6">
                  <CardTitle className="text-2xl font-bold">Nova senha</CardTitle>
                  <CardDescription>Escolha uma senha com pelo menos 8 caracteres</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="space-y-1">
                    <Label htmlFor="senha">Nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="senha"
                        type={showSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        className="pl-10 pr-10"
                        placeholder="Mínimo 8 caracteres"
                        disabled={salvando}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                        onClick={() => setShowSenha(!showSenha)}
                        tabIndex={-1}
                      >
                        {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {senha && (
                      <div className="pt-1 space-y-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${strength.color}`} style={{ width: `${strength.level}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">{strength.label}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="confirmar">Confirmar nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmar"
                        type={showConfirmar ? 'text' : 'password'}
                        value={confirmar}
                        onChange={(e) => setConfirmar(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        className="pl-10 pr-10"
                        placeholder="Repita a senha"
                        disabled={salvando}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                        onClick={() => setShowConfirmar(!showConfirmar)}
                        tabIndex={-1}
                      >
                        {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {confirmar && !senhasIguais && (
                      <p className="text-xs text-destructive">As senhas não coincidem.</p>
                    )}
                    {senhasIguais && (
                      <p className="text-xs text-green-500">Senhas coincidem</p>
                    )}
                  </div>

                  <Button onClick={handleSubmit} disabled={!formValido || salvando} className="w-full">
                    {salvando ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Redefinir senha'
                    )}
                  </Button>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
