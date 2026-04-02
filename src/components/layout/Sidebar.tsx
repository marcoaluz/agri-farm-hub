import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  LayoutDashboard, 
  MapPin, 
  Package, 
  ClipboardList,
  Tractor,
  DollarSign,
  BarChart3,
  Settings,
  Home,
  Wheat,
  X,
  Leaf,
  Calendar,
  ShieldCheck,
  Shield,
  Users,
  Beef,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useGlobal } from '@/contexts/GlobalContext'
import { useModulos } from '@/hooks/useModulos'
import { supabase } from '@/lib/supabase'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const routes = [
  { label: 'Dashboard',     icon: LayoutDashboard, href: '/',             sempre: true },
  { label: 'Propriedades',  icon: Home,            href: '/propriedades', sempre: true },
  { label: 'Safras',        icon: Calendar,        href: '/safras',       modulo: 'lavoura' as const },
  { label: 'Talhões',       icon: MapPin,          href: '/talhoes',      modulo: 'lavoura' as const },
  { label: 'Estoque',       icon: Package,         href: '/estoque',      sempre: true },
  { label: 'Serviços',      icon: Wheat,           href: '/servicos',     sempre: true },
  { label: 'Lançamentos',   icon: ClipboardList,   href: '/lancamentos',  sempre: true },
  { label: 'Máquinas',      icon: Tractor,         href: '/maquinas',     sempre: true },
  { label: 'Pecuária',      icon: Beef,            href: '/pecuaria',     modulo: 'pecuaria' as const },
  { label: 'Financeiro',    icon: DollarSign,      href: '/financeiro',   modulo: 'financeiro' as const },
  { label: 'Relatórios',    icon: BarChart3,       href: '/relatorios',   modulo: 'relatorios' as const },
  { label: 'Auditoria',     icon: ShieldCheck,     href: '/auditoria',    modulo: 'auditoria' as const },
  { label: 'Configurações', icon: Settings,        href: '/configuracoes',sempre: true },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuth()
  const { propriedadeAtual } = useGlobal()
  const { modulos } = useModulos()
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendentesCount, setPendentesCount] = useState(0)

  const routesFiltradas = routes.filter(route => {
    if (route.sempre) return true
    if (!propriedadeAtual) return false
    if (route.modulo) return modulos[route.modulo]
    return true
  })

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return
      const { data, error } = await supabase
        .from('user_profiles' as any)
        .select('perfil, is_super_admin')
        .eq('id', user.id)
        .maybeSingle()
      
      if (error) {
        console.error('Erro ao verificar admin:', error)
        return
      }
      
      const perfil = (data as any)?.perfil
      const isSuperAdmin = (data as any)?.is_super_admin
      setIsAdmin(perfil === 'admin' || isSuperAdmin === true)
    }
    checkAdmin()
  }, [user])

  // Fetch pending users count
  useEffect(() => {
    if (!isAdmin) return

    async function fetchPendentes() {
      const { count, error } = await supabase
        .from('user_profiles' as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
      if (!error && count !== null) {
        setPendentesCount(count)
      }
    }

    fetchPendentes()
    const interval = setInterval(fetchPendentes, 60000)
    return () => clearInterval(interval)
  }, [isAdmin])

  return (
    <>
      {/* Overlay para mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-64 border-r border-border bg-sidebar transition-transform duration-300 md:relative md:z-30 md:h-full md:translate-x-0 md:flex-shrink-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header Mobile */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <Leaf className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">SGA</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navegação */}
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="space-y-1 p-3">
            {routes.map((route) => {
              const isActive = location.pathname === route.href
              
              return (
                <Link
                  key={route.href}
                  to={route.href}
                  onClick={onClose}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-3 font-medium transition-all duration-200',
                      isActive 
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <route.icon className={cn(
                      'h-5 w-5',
                      isActive && 'text-sidebar-primary'
                    )} />
                    {route.label}
                  </Button>
                </Link>
              )
            })}

            {/* Links Admin */}
            {isAdmin && (
              <>
                <Link to="/admin" onClick={onClose}>
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-3 font-medium transition-all duration-200 mt-2',
                      location.pathname === '/admin'
                        ? 'bg-destructive/20 text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <Shield className="h-5 w-5 text-destructive" />
                    Painel Admin
                    <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                      ADMIN
                    </Badge>
                  </Button>
                </Link>
                <Link to="/admin/usuarios" onClick={onClose}>
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-3 font-medium transition-all duration-200',
                      location.pathname === '/admin/usuarios'
                        ? 'bg-destructive/20 text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <Users className="h-5 w-5 text-destructive" />
                    Gestão Usuários
                    {pendentesCount > 0 && (
                      <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center">
                        {pendentesCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Footer da Sidebar */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border p-4">
            <div className="text-xs text-sidebar-foreground/50 text-center">
              SGA v1.0.0
            </div>
          </div>
        </ScrollArea>
      </aside>
    </>
  )
}
