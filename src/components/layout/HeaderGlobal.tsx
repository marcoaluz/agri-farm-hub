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
} from 'lucide-react'

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
  const [notificacoesCount] = useState(0)

  // Buscar perfil do usuário
  useEffect(() => {
    if (!user) return

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('perfil, full_name, avatar_url, is_super_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Erro ao buscar perfil do usuário:', error)
        return
      }
      if (data) setProfile(data as UserProfile)
    }

    fetchProfile()
  }, [user])

  // Auto-selecionar se só tiver 1 propriedade
  useEffect(() => {
    if (propriedades.length === 1 && !propriedadeSelecionada) {
      setPropriedadeSelecionada(propriedades[0])
    }
  }, [propriedades, propriedadeSelecionada, setPropriedadeSelecionada])

  const isAdmin = profile?.perfil === 'admin'

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

  const renderPropriedadeSelect = (className?: string) => (
    <Select
      value={propriedadeSelecionada?.id ?? undefined}
      onValueChange={(value) => {
        const prop = propriedades.find((p) => p.id === value)
        if (prop) setPropriedadeSelecionada(prop)
      }}
      disabled={propriedades.length <= 1}
    >
      <SelectTrigger className={className ?? 'min-w-[180px] max-w-[260px] bg-card'}>
        <div className="flex items-center gap-2 truncate">
          <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Selecionar propriedade" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border z-[60]">
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
              !propriedadeSelecionada ? 'Selecione propriedade' : 'Selecionar safra'
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
                {safra.ativa && (
                  <Badge
                    variant="default"
                    className="ml-1 text-[10px] px-1.5 py-0 bg-success text-success-foreground"
                  >
                    ATIVA
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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
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
        <Drawer>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="sm:hidden flex-1 max-w-[200px] justify-between text-xs h-9 px-2"
            >
              <div className="flex flex-col items-start truncate">
                <span className="font-medium truncate max-w-[140px]">
                  {propriedadeSelecionada?.nome || 'Selecionar'}
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
              {propriedadeSelecionada && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Contexto atual:</p>
                  <p className="font-medium text-foreground">{propriedadeSelecionada.nome}</p>
                  {safraSelecionada && (
                    <p className="text-sm text-muted-foreground">{safraSelecionada.nome}</p>
                  )}
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        <div className="flex-1" />

        {/* ---- Desktop selectors ---- */}
        <div className="hidden sm:flex items-center gap-2">
          {renderPropriedadeSelect()}
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          {renderSafraSelect()}
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
