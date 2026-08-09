import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { traduzirErroAuth } from '@/lib/authErrors'
import { toast } from 'sonner'
import { Leaf, Lock, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function DefinirSenha() {
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessaoOk, setSessaoOk] = useState<boolean | null>(null)

  const senhasIguais = senha.length > 0 && senha === confirmar
  const formValido = senha.length >= 6 && senhasIguais

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessaoOk(!!data.session)
    })
  }, [])

  const handleDefinirSenha = async () => {
    if (senha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (senha !== confirmar) {
      toast.error('As senhas não coincidem')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      toast.success('Senha criada com sucesso! Bem-vindo ao Agro GFI!')
      navigate('/', { replace: true })
    } catch (err: any) {
      toast.error(traduzirErroAuth(err, 'Erro ao definir senha.'))
    } finally {
      setLoading(false)
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
            <h1 className="font-display text-3xl font-bold">Agro GFI</h1>
            <p className="text-primary-foreground/70 text-sm">Gestão de Fazenda Inteligente</p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold">Bem-vindo!</h2>
          <p className="text-primary-foreground/70 text-lg">
            Crie sua senha para começar a usar o sistema.
          </p>
        </div>

        <p className="text-primary-foreground/60 text-sm">
          © 2025 Agro GFI — Gestão de Fazenda Inteligente
        </p>
      </div>

      {/* Lado Direito */}
      <div className="w-full lg:w-3/5 bg-background flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-md w-full">
          <div className="lg:hidden flex flex-col items-center gap-2 mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary p-3 rounded-xl">
                <Leaf className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground">Agro GFI</h1>
                <p className="text-muted-foreground text-sm">Gestão de Fazenda Inteligente</p>
              </div>
            </div>
          </div>

          <Card className="border-border shadow-lg">
            {sessaoOk === null ? (
              <CardContent className="py-8 px-4 sm:px-6 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">Validando seu convite...</p>
              </CardContent>
            ) : sessaoOk === false ? (
              <>
                <CardHeader className="space-y-1 pb-3 pt-4 px-4 sm:px-6 sm:pt-6 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                      <AlertTriangle className="h-8 w-8 text-destructive" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold">Link expirado ou inválido</CardTitle>
                  <CardDescription>
                    O link do convite expirou ou já foi utilizado. Peça um novo convite.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <Button onClick={() => navigate('/login')} className="w-full">
                    Ir para o login
                  </Button>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="space-y-1 pb-3 pt-4 px-4 sm:px-6 sm:pt-6">
                  <CardTitle className="text-2xl font-bold">Criar sua senha</CardTitle>
                  <CardDescription>Defina uma senha para acessar o sistema</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="space-y-1">
                    <Label htmlFor="senha">Nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="senha"
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDefinirSenha()}
                        className="pl-10 pr-10"
                        placeholder="Mínimo 6 caracteres"
                        disabled={loading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                        onClick={() => setMostrarSenha(!mostrarSenha)}
                        tabIndex={-1}
                      >
                        {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="confirmar">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmar"
                        type={mostrarSenha ? 'text' : 'password'}
                        value={confirmar}
                        onChange={(e) => setConfirmar(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDefinirSenha()}
                        className="pl-10"
                        placeholder="Repita a senha"
                        disabled={loading}
                      />
                    </div>
                    {confirmar && !senhasIguais && (
                      <p className="text-xs text-destructive">As senhas não coincidem.</p>
                    )}
                    {senhasIguais && <p className="text-xs text-green-500">Senhas coincidem</p>}
                  </div>

                  <Button onClick={handleDefinirSenha} disabled={!formValido || loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Criar senha e acessar'
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
