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

  const [notifEmail, setNotifEmail] = useState(false)
  const [notifEstoque, setNotifEstoque] = useState(false)
  const [notifSafra, setNotifSafra] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_profiles')
      .select('full_name, perfil')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || '')
          setPerfil(data.perfil || '')
        }
      })
  }, [user])

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
              <CardDescription>Gerencie como você recebe alertas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-email" className="cursor-pointer">Notificações por e-mail</Label>
                <Switch id="notif-email" checked={notifEmail} onCheckedChange={setNotifEmail} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-estoque" className="cursor-pointer">Alertas de estoque baixo</Label>
                <Switch id="notif-estoque" checked={notifEstoque} onCheckedChange={setNotifEstoque} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-safra" className="cursor-pointer">Lembretes de safra</Label>
                <Switch id="notif-safra" checked={notifSafra} onCheckedChange={setNotifSafra} />
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Configurações de e-mail serão ativadas em breve.
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
                <p className="font-semibold text-foreground">SGA — Sistema de Gestão Agropecuária</p>
                <p className="text-sm text-muted-foreground">Versão 1.0.0</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Plataforma de gestão para propriedades rurais.
              </p>
              <Separator />
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
