import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  LayoutDashboard, 
  MapPin, 
  Package, 
  Briefcase, 
  ClipboardList,
  Tractor,
  DollarSign,
  BarChart3,
  Settings,
  Home,
  Wheat,
  X,
  Leaf
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const routes = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    label: 'Propriedades',
    icon: Home,
    href: '/propriedades',
  },
  {
    label: 'Talhões',
    icon: MapPin,
    href: '/talhoes',
  },
  {
    label: 'Estoque',
    icon: Package,
    href: '/estoque',
  },
  {
    label: 'Itens',
    icon: Briefcase,
    href: '/itens',
  },
  {
    label: 'Serviços',
    icon: Wheat,
    href: '/servicos',
  },
  {
    label: 'Lançamentos',
    icon: ClipboardList,
    href: '/lancamentos',
  },
  {
    label: 'Máquinas',
    icon: Tractor,
    href: '/maquinas',
  },
  {
    label: 'Financeiro',
    icon: DollarSign,
    href: '/financeiro',
  },
  {
    label: 'Relatórios',
    icon: BarChart3,
    href: '/relatorios',
  },
  {
    label: 'Configurações',
    icon: Settings,
    href: '/configuracoes',
  },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()

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
          'fixed left-0 top-0 z-50 h-screen w-64 border-r border-border bg-sidebar transition-transform duration-300 md:sticky md:top-16 md:z-30 md:h-[calc(100vh-4rem)] md:translate-x-0',
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
