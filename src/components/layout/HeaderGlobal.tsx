import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useSafraContext } from '@/contexts/SafraContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Leaf,
  Home,
  Wheat,
  ChevronRight,
  ChevronDown,
  Bell,
  User,
  Settings,
  LogOut,
  Shield,
  Menu,
  LayoutDashboard,
  Puzzle,
} from 'lucide-react'
import { AdminPropertyPicker } from '@/components/layout/AdminPropertyPicker'

interface HeaderGlobalProps {
  onMenuClick?: () => void
}

type UserProfile = {
  perfil: string
  full_name: string | null
  avatar_url: string | null
  is_super_admin: boolean | null
}


const PERFIL_BADGE_VARIANT: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  admin: 'destructive',
  proprietario: 'default',
  gerente: 'secondary',
  operador: 'outline',
  consultor: 'outline',
}

export function HeaderGlobal({ onMenuClick }: HeaderGlobalProps) {
  const {
    propriedades,
    safras,
    propriedadeSelecionada,
    safraSelecionada,
    setPropriedadeSelecionada,
    setSafraSelecionada,
  } = useSafraContext()

  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [notificacoesCount, setNotificacoesCount] = useState(0)

  // Buscar perfil do usuário
  useEffect(() => {
    if (!user) return

    const fetchProfile = async () => {
      // DEBUG: verificar sessão e perfil
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      console.log('[SGA DEBUG] SESSION:', currentSession?.user?.id, currentSession?.user?.email)
      console.log('[SGA DEBUG] SUPABASE URL:', (supabase as any).supabaseUrl || 'não acessível')

      const { data, error } = await supabase
        .from('user_profiles')
        .select('perfil, full_name, avatar_url, is_super_admin')
        .eq('id', user.id)
        .single()

      console.log('[SGA DEBUG] PERFIL QUERY result:', { data, error: error?.message })
      console.log('[SGA DEBUG] IS_ADMIN:', data?.perfil === 'admin' || (data as any)?.is_super_admin === true)

      if (error) {
        console.error('Erro ao buscar perfil do usuário:', error)
        return
      }
      if (data) setProfile(data as UserProfile)
    }

    fetchProfile()
  }, [user])

  const isAdmin = profile?.perfil === 'admin' || profile?.is_super_admin === true

  // Admin property selection handler (with safra pre-selection)
  const handleAdminSelectPropriedade = (prop: {
    id: string
    nome: string
    area_total: number | null
    safra_ativa_id: string | null
    safra_ativa_nome: string | null
    dono_nome: string
  } | null) => {
    if (!prop) {
      setPropriedadeSelecionada(null)
      return
    }

    void (async () => {
      const { data, error } = await supabase
        .from('propriedades')
        .select('id, nome, area_total, localizacao, ativo, latitude, longitude')
        .eq('id', prop.id)
        .maybeSingle()

      if (error) {
        console.error('Erro ao carregar coordenadas da propriedade selecionada:', error)
      }

      setPropriedadeSelecionada({
        id: data?.id ?? prop.id,
        nome: data?.nome ?? prop.nome,
        area_total: data?.area_total ?? prop.area_total,
        localizacao: data?.localizacao ?? null,
        ativo: data?.ativo ?? true,
        latitude: data?.latitude ?? null,
        longitude: data?.longitude ?? null,
      })
    })()
  }

  // Buscar total de alertas (admin + estoque + sanitário)
  useEffect(() => {
    if (!user) return

    const fetchAlertas = async () => {
      let total = 0

      // Admin: notificações não lidas
      if (isAdmin) {
        const { count } = await supabase
          .from('admin_notificacoes')
          .select('id', { count: 'exact', head: true })
          .eq('lida', false)
        total += count || 0
      }

      // Estoque abaixo do mínimo
      const { data: prods } = await supabase
        .from('produtos')
        .select('saldo_atual, nivel_minimo')
        .eq('ativo', true)
        .not('nivel_minimo', 'is', null)
      const baixo = (prods || []).filter(
        (p: any) => p.nivel_minimo !== null && p.saldo_atual <= p.nivel_minimo
      ).length
      total += baixo

      // Eventos sanitários próximos (30 dias)
      const hoje = new Date().toISOString().split('T')[0]
      const limite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
      const { count: vacCount } = await supabase
        .from('sanitario_eventos')
        .select('id', { count: 'exact', head: true })
        .gte('data_proxima', hoje)
        .lte('data_proxima', limite)
      total += vacCount || 0

      setNotificacoesCount(total)
    }

    fetchAlertas()
    const interval = setInterval(fetchAlertas, 300000)  // 5 minutos
    return () => clearInterval(interval)
  }, [isAdmin, user])

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuário'

  const truncatedName =
    displayName.length > 15 ? displayName.slice(0, 15) + '…' : displayName

  const getUserInitials = () => {
    if (profile?.full_name) {
      const parts = profile.full_name.split(' ')
      return (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
    }
    if (user?.email) return user.email.substring(0, 2).toUpperCase()
    return 'U'
  }

  const perfilLabel = profile?.perfil
    ? profile.perfil.charAt(0).toUpperCase() + profile.perfil.slice(1)
    : ''

  /* ---------------------------------------------------------------- */
  /*  Render helpers                                                    */
  /* ---------------------------------------------------------------- */

  const handlePropriedadeChange = (value: string) => {
    if (value === '__todas__') {
      setPropriedadeSelecionada(null)
      return
    }
    const prop = propriedades.find((p) => p.id === value)
    if (prop) {
      setPropriedadeSelecionada(prop)
    }
  }

  const renderPropriedadeSelect = (className?: string) => (
    <Select
      value={propriedadeSelecionada?.id ?? '__todas__'}
      onValueChange={handlePropriedadeChange}
    >
      <SelectTrigger className={className ?? 'min-w-[180px] max-w-[300px] bg-card'}>
        <div className="flex items-center gap-2 truncate">
          {propriedadeSelecionada ? (
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{propriedadeSelecionada.nome}</span>
            </div>
          ) : (
            <>
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="font-medium text-success">Visão Geral</span>
            </>
          )}
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border z-[60] max-h-[400px]">
        <SelectItem value="__todas__">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-3.5 w-3.5 text-success" />
            <span className="font-medium">Visão Geral</span>
            <span className="text-xs text-muted-foreground ml-1">todas as propriedades</span>
          </div>
        </SelectItem>
        {propriedades.length === 0 ? (
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-primary"
              onClick={() => navigate('/propriedades')}
            >
              + Nova Propriedade
            </Button>
          </div>
        ) : (
          propriedades.map((prop) => (
            <SelectItem key={prop.id} value={prop.id}>
              {prop.nome}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )

  const renderSafraSelect = (className?: string) => (
    <Select
      value={safraSelecionada?.id ?? undefined}
      onValueChange={(value) => {
        const safra = safras.find((s) => s.id === value)
        if (safra) setSafraSelecionada(safra)
      }}
      disabled={!propriedadeSelecionada}
    >
      <SelectTrigger className={className ?? 'min-w-[140px] max-w-[200px] bg-card'}>
        <div className="flex items-center gap-2 truncate">
          <Wheat className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue
            placeholder={
              !propriedadeSelecionada ? 'Todas as safras' : 'Selecionar safra'
            }
          />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border z-[60]">
        {safras.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground text-center">
            Sem safras
          </div>
        ) : (
          safras.map((safra) => (
            <SelectItem key={safra.id} value={safra.id}>
              <div className="flex items-center gap-2">
                {safra.nome}
                {safra.ativa && !((safra as any).fechada) && (
                  <Badge
                    variant="default"
                    className="ml-1 text-[10px] px-1.5 py-0 bg-success text-success-foreground"
                  >
                    ATIVA
                  </Badge>
                )}
                {(safra as any).fechada && (
                  <Badge
                    variant="destructive"
                    className="ml-1 text-[10px] px-1.5 py-0"
                  >
                    🔒 Fechada
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )

  /* ---------------------------------------------------------------- */
  /*  JSX                                                              */
  /* ---------------------------------------------------------------- */

  return (
    <header className="w-full border-b border-border bg-card shadow-sm flex-shrink-0">
      <div className="flex h-14 sm:h-16 items-center px-2 sm:px-4 gap-2 sm:gap-4">
        {/* Menu Mobile */}
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 h-9 w-9"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-primary">
            <Leaf className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
          <span className="hidden sm:inline-block font-bold text-lg text-primary">
            SGA
          </span>
        </Link>

        {/* ---- Mobile: compact drawer trigger ---- */}
        {isAdmin ? (
          <div className="sm:hidden flex-1 max-w-[200px]">
            <AdminPropertyPicker
              propriedadeSelecionada={propriedadeSelecionada}
              onSelectPropriedade={handleAdminSelectPropriedade}
              className="w-full h-9 text-xs"
            />
          </div>
        ) : (
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden flex-1 max-w-[200px] justify-between text-xs h-9 px-2"
              >
                <div className="flex flex-col items-start truncate">
                  <span className="font-medium truncate max-w-[140px]">
                    {propriedadeSelecionada?.nome || 'Visão Geral'}
                  </span>
                  {safraSelecionada && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {safraSelecionada.nome}
                    </span>
                  )}
                </div>
                <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="bg-background">
              <DrawerHeader className="pb-2">
                <DrawerTitle>Selecionar Contexto</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 space-y-4 pb-8">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Home className="h-4 w-4 text-primary" />
                    Propriedade
                  </label>
                  {renderPropriedadeSelect('w-full bg-card')}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Wheat className="h-4 w-4 text-accent-foreground" />
                    Safra
                  </label>
                  {renderSafraSelect('w-full bg-card')}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        )}

        <div className="flex-1" />

        {/* ---- Desktop selectors ---- */}
        <div className="hidden sm:flex items-center gap-2">
          {isAdmin ? (
            <AdminPropertyPicker
              propriedadeSelecionada={propriedadeSelecionada}
              onSelectPropriedade={handleAdminSelectPropriedade}
            />
          ) : (
          renderPropriedadeSelect()
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          {renderSafraSelect()}
          {(safraSelecionada as any)?.fechada && (
            <Badge variant="destructive" className="text-[10px] gap-1 hidden md:flex">
              🔒 Fechada
            </Badge>
          )}
        </div>

        <div className="flex-1" />

        {/* ---- Right section ---- */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Admin Badge */}
          {isAdmin && (
            <Badge variant="destructive" className="hidden sm:flex items-center gap-1 text-xs">
              <Shield className="h-3 w-3" />
              ADMIN
            </Badge>
          )}

          {/* Notificações */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            onClick={() => navigate('/notificacoes')}
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            {notificacoesCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full p-0 flex items-center justify-center text-[10px] sm:text-xs"
              >
                {notificacoesCount}
              </Badge>
            )}
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative flex items-center gap-2 h-9 px-2">
                <Avatar className="h-8 w-8 border-2 border-primary/20">
                  <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline-block text-sm font-medium text-foreground max-w-[120px] truncate">
                  {truncatedName}
                </span>
                <ChevronDown className="hidden sm:block h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60 bg-popover border border-border z-50">
              {/* Header do menu */}
              <DropdownMenuLabel className="pb-3">
                <div className="flex flex-col space-y-1.5">
                  <p className="text-sm font-semibold leading-none text-foreground">
                    {displayName}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  {perfilLabel && (
                    <Badge
                      variant={PERFIL_BADGE_VARIANT[profile?.perfil || ''] || 'outline'}
                      className="w-fit text-[10px] mt-1"
                    >
                      {perfilLabel}
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/configuracoes')} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>

              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Administração
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => navigate('/admin')}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Painel Admin
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate('/admin/usuarios')}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Gestão de Usuários
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate('/admin/modulos')}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Puzzle className="mr-2 h-4 w-4" />
                    Módulos das Propriedades
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={signOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
