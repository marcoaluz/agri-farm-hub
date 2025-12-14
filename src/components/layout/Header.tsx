import { useState } from 'react'
import { useGlobal } from '@/contexts/GlobalContext'
import { useAuth } from '@/contexts/AuthContext'
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
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Bell, User, Settings, LogOut, Menu, Leaf } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { 
    propriedadeAtual, 
    safraAtual, 
    propriedades, 
    safras,
    setPropriedadeAtual,
    setSafraAtual 
  } = useGlobal()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [notificacoesCount] = useState(3)

  const getUserInitials = () => {
    if (!user?.email) return 'U'
    return user.email.substring(0, 2).toUpperCase()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 gap-4">
        {/* Menu Mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="hidden font-bold text-lg md:inline-block text-foreground">
            SGA
          </span>
          <span className="font-bold text-lg md:hidden text-foreground">SGA</span>
        </div>

        <div className="flex-1" />

        {/* Seletor de Propriedade */}
        <div className="hidden sm:flex items-center gap-2">
          <Select
            value={propriedadeAtual?.id || ''}
            onValueChange={(value) => {
              const prop = propriedades.find(p => p.id === value)
              if (prop) setPropriedadeAtual(prop)
            }}
          >
            <SelectTrigger className="w-[180px] bg-card">
              <SelectValue placeholder="Selecione propriedade" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-50">
              {propriedades.length === 0 ? (
                <SelectItem value="none" disabled>Nenhuma propriedade</SelectItem>
              ) : (
                propriedades.map((prop) => (
                  <SelectItem key={prop.id} value={prop.id}>
                    {prop.nome}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Seletor de Safra */}
        <div className="hidden sm:flex items-center gap-2">
          <Select
            value={safraAtual?.id || ''}
            onValueChange={(value) => {
              const safra = safras.find(s => s.id === value)
              if (safra) setSafraAtual(safra)
            }}
            disabled={!propriedadeAtual}
          >
            <SelectTrigger className="w-[150px] bg-card">
              <SelectValue placeholder="Selecione safra" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-50">
              {safras.length === 0 ? (
                <SelectItem value="none" disabled>Nenhuma safra</SelectItem>
              ) : (
                safras.map((safra) => (
                  <SelectItem key={safra.id} value={safra.id}>
                    <div className="flex items-center gap-2">
                      {safra.nome}
                      {safra.ativa && (
                        <Badge variant="default" className="ml-1 text-xs">Ativa</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Notificações */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {notificacoesCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {notificacoesCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-popover border border-border z-50">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              <div className="p-3 hover:bg-accent cursor-pointer">
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-info mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Estoque Baixo</p>
                    <p className="text-xs text-muted-foreground">
                      Ureia está abaixo do nível mínimo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      há 2 horas
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 hover:bg-accent cursor-pointer">
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-warning mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Lote Próximo ao Vencimento</p>
                    <p className="text-xs text-muted-foreground">
                      Defensivo XYZ vence em 15 dias
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      há 5 horas
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 hover:bg-accent cursor-pointer">
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-success mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Lançamento Registrado</p>
                    <p className="text-xs text-muted-foreground">
                      Adubação no Talhão A1 concluída
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      há 1 dia
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="cursor-pointer justify-center text-primary"
              onClick={() => navigate('/notificacoes')}
            >
              Ver todas as notificações
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Menu do Usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9 border-2 border-primary/20">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border border-border z-50">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-foreground">
                  {user?.user_metadata?.name || 'Usuário'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
