import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Settings, User, Bell, Shield, Moon, Sun, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { OrdemMenuCard } from '@/components/configuracoes/OrdemMenuCard'

const perfilLabels: Record<string, string> = {
  admin: 'Administrador',
  proprietario: 'Proprietário',
  gerente: 'Gerente',
  operador: 'Operador',
  consultor: 'Consultor',
}

export function Configuracoes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [fullName, setFullName] = useState('')
  const [perfil, setPerfil] = useState('')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sga_tema') === 'dark')

  const [prefs, setPrefs] = useState({ financeiro: true, estoque: true, manutencao: true, sanidade: true, tarefas: true })
  const [savingPrefs, setSavingPrefs] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_profiles')
      .select('full_name, perfil, notification_preferences')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || '')
          setPerfil(data.perfil || '')
          if (data.notification_preferences) {
            setPrefs(p => ({ ...p, ...(data.notification_preferences as any) }))
          }
        }
      })
  }, [user])

  async function togglePref(chave: keyof typeof prefs, valor: boolean) {
    const novasPrefs = { ...prefs, [chave]: valor }
    setPrefs(novasPrefs)
    if (!user) return
    setSavingPrefs(true)
    const { error } = await supabase
      .from('user_profiles')
      .update({ notification_preferences: novasPrefs })
      .eq('id', user.id)
    setSavingPrefs(false)
    if (error) {
      toast({ title: 'Erro ao salvar preferência', description: error.message, variant: 'destructive' })
      setPrefs(prefs) // reverte
    }
  }

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('sga_tema', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('sga_tema', 'light')
    }
  }, [darkMode])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground">Gerencie sua conta e preferências do sistema</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Coluna esquerda */}
        <div className="space-y-4 sm:space-y-6">
          {/* Seção 1 — Minha Conta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Minha Conta
              </CardTitle>
              <CardDescription>Informações do seu perfil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Nome completo</Label>
                <p className="font-medium text-foreground">{fullName || '—'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">E-mail</Label>
                <p className="font-medium text-foreground">{user?.email || '—'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Perfil</Label>
                <div>
                  <Badge variant="secondary">{perfilLabels[perfil] || perfil || '—'}</Badge>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="gap-2" onClick={() => navigate('/perfil')}>
                  <User className="h-4 w-4" />
                  Editar Perfil
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => navigate('/perfil')}>
                  <Shield className="h-4 w-4" />
                  Alterar Senha
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Seção — Ordem do Menu */}

          <OrdemMenuCard />

          {/* Seção 2 — Aparência */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                Aparência
              </CardTitle>
              <CardDescription>Personalize a aparência do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="dark-mode" className="cursor-pointer">Modo Escuro</Label>
                </div>
                <Switch
                  id="dark-mode"
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4 sm:space-y-6">
          {/* Seção 3 — Notificações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5" />
                Notificações
              </CardTitle>
              <CardDescription>Escolha quais avisos você quer receber no sininho do app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-financeiro" className="cursor-pointer">Contas a pagar/receber (hoje, 3d, 7d)</Label>
                <Switch id="notif-financeiro" checked={prefs.financeiro} onCheckedChange={v => togglePref('financeiro', v)} disabled={savingPrefs} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-estoque" className="cursor-pointer">Estoque baixo ou zerado</Label>
                <Switch id="notif-estoque" checked={prefs.estoque} onCheckedChange={v => togglePref('estoque', v)} disabled={savingPrefs} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-manutencao" className="cursor-pointer">Manutenção de máquina vencida</Label>
                <Switch id="notif-manutencao" checked={prefs.manutencao} onCheckedChange={v => togglePref('manutencao', v)} disabled={savingPrefs} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-sanidade" className="cursor-pointer">Vacinação/sanidade (hoje, 3d, 7d)</Label>
                <Switch id="notif-sanidade" checked={prefs.sanidade} onCheckedChange={v => togglePref('sanidade', v)} disabled={savingPrefs} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-tarefas" className="cursor-pointer">Tarefas da Agenda (hoje, 3d, 7d)</Label>
                <Switch id="notif-tarefas" checked={prefs.tarefas} onCheckedChange={v => togglePref('tarefas', v)} disabled={savingPrefs} />
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Notificação por e-mail e no celular fora do app ainda não estão disponíveis — em breve.
              </p>
            </CardContent>
          </Card>

          {/* Seção 4 — Sobre */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5" />
                Sobre o Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Agro GFI — Gestão de Fazenda Inteligente</p>
                <p className="text-sm text-muted-foreground">Versão 1.0.0</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Plataforma de gestão para propriedades rurais.
              </p>
              <Separator />
              {perfil === 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  asChild
                >
                  <a
                    href="https://github.com/marcoaluz/agri-farm-hub"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Repositório no GitHub
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
