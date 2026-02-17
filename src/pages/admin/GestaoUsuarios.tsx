import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Users, Search, MoreVertical, Crown, Shield,
  Edit, Trash2, UserCheck, UserX, UserPlus, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

interface UserProfile {
  id: string
  email: string | null
  nome: string | null
  perfil: string
  ultimo_acesso: string | null
  confirmado: boolean
  criado_em: string
  avatar_url: string | null
  is_super_admin?: boolean
}

const PERFIL_CONFIG: Record<string, { label: string; className: string; variant?: 'destructive' | 'secondary' | 'default' }> = {
  admin: { label: 'Admin', className: 'bg-destructive/10 text-destructive border-destructive/20', variant: 'destructive' },
  proprietario: { label: 'Proprietário', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  gerente: { label: 'Gerente', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  operador: { label: 'Operador', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  consultor: { label: 'Consultor', className: '', variant: 'secondary' },
}

const PERFIL_DESCRICAO: Record<string, string> = {
  admin: 'Acesso total ao sistema',
  proprietario: 'Acesso completo à propriedade',
  gerente: 'Gerenciamento de operações',
  operador: 'Lançamento de operações',
  consultor: 'Somente leitura',
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export default function GestaoUsuarios() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [usuarios, setUsuarios] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [usuarioEditando, setUsuarioEditando] = useState<UserProfile | null>(null)
  const [novoPerfilSelecionado, setNovoPerfilSelecionado] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Admin check
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return
      const { data } = await supabase
        .from('user_profiles' as any)
        .select('perfil')
        .eq('id', user.id)
        .single()
      if ((data as any)?.perfil !== 'admin') {
        navigate('/dashboard')
        toast({ title: 'Acesso negado', description: 'Área restrita a administradores.', variant: 'destructive' })
      }
    }
    if (user) checkAdmin()
  }, [user, navigate, toast])

  // Fetch users
  async function fetchUsuarios() {
    setLoading(true)
    try {
      // Try the admin view first
      const { data, error } = await supabase
        .from('vw_all_users_admin' as any)
        .select('*')
        .order('criado_em', { ascending: false })

      if (error) {
        // Fallback to user_profiles
        const { data: fallback, error: err2 } = await supabase
          .from('user_profiles' as any)
          .select('*')
          .order('created_at', { ascending: false })
        if (err2) throw err2
        setUsuarios((fallback || []) as any)
      } else {
        setUsuarios((data || []) as any)
      }
    } catch {
      toast({ title: 'Erro ao carregar usuários', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsuarios()
  }, [])

  // Filtered list
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const matchBusca = !busca || 
        (u.nome?.toLowerCase().includes(busca.toLowerCase())) ||
        (u.email?.toLowerCase().includes(busca.toLowerCase()))
      const matchPerfil = filtroPerfil === 'todos' || u.perfil === filtroPerfil
      const matchStatus = filtroStatus === 'todos' || 
        (filtroStatus === 'ativo' && u.confirmado) ||
        (filtroStatus === 'pendente' && !u.confirmado)
      return matchBusca && matchPerfil && matchStatus
    })
  }, [usuarios, busca, filtroPerfil, filtroStatus])

  // Save profile
  async function salvarPerfil() {
    if (!usuarioEditando || !novoPerfilSelecionado) return
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('user_profiles' as any)
        .update({ perfil: novoPerfilSelecionado, updated_at: new Date().toISOString() } as any)
        .eq('id', usuarioEditando.id)
      if (error) throw error
      toast({ title: '✅ Perfil atualizado com sucesso!' })
      setUsuarioEditando(null)
      fetchUsuarios()
    } catch {
      toast({ title: 'Erro ao atualizar perfil', variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  // Promote / demote
  async function toggleAdmin(userId: string, tornarAdmin: boolean) {
    try {
      const rpc = tornarAdmin ? 'promote_to_admin' : 'demote_from_admin'
      const params = tornarAdmin
        ? { p_user_id: userId }
        : { p_user_id: userId, p_new_perfil: 'consultor' }
      const { error } = await supabase.rpc(rpc as any, params as any)
      if (error) throw error
      toast({ title: tornarAdmin ? '✅ Promovido a Admin!' : '✅ Admin removido!' })
      fetchUsuarios()
    } catch {
      toast({ title: 'Erro na operação', variant: 'destructive' })
    }
  }

  function openEditModal(u: UserProfile) {
    setUsuarioEditando(u)
    setNovoPerfilSelecionado(u.perfil)
  }

  function renderPerfilBadge(perfil: string, isSuperAdmin?: boolean) {
    const config = PERFIL_CONFIG[perfil] || PERFIL_CONFIG.consultor
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant={config.variant || 'outline'} className={config.className}>
          {config.label}
        </Badge>
        {isSuperAdmin && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                Gestão de Usuários
                <Badge variant="secondary" className="text-xs">{usuarios.length}</Badge>
              </h1>
              <p className="text-sm text-muted-foreground">Gerencie permissões de acesso ao sistema</p>
            </div>
          </div>
        </div>
        <Button disabled className="gap-2">
          <UserPlus className="h-4 w-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="proprietario">Proprietário</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="operador">Operador</SelectItem>
                <SelectItem value="consultor">Consultor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum usuário encontrado</p>
              <p className="text-sm">Ajuste os filtros para ver resultados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuariosFiltrados.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {getInitials(u.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{u.nome || 'Sem nome'}</p>
                          <p className="text-xs text-muted-foreground">{u.email || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{renderPerfilBadge(u.perfil, u.is_super_admin)}</TableCell>
                    <TableCell>
                      {u.confirmado ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.criado_em
                        ? format(new Date(u.criado_em), "dd MMM yyyy", { locale: ptBR })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(u)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar Perfil
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.perfil !== 'admin' && (
                            <DropdownMenuItem onClick={() => toggleAdmin(u.id, true)}>
                              <Shield className="mr-2 h-4 w-4" />
                              Tornar Admin
                            </DropdownMenuItem>
                          )}
                          {u.perfil === 'admin' && !u.is_super_admin && (
                            <DropdownMenuItem onClick={() => toggleAdmin(u.id, false)}>
                              <Shield className="mr-2 h-4 w-4" />
                              Remover Admin
                            </DropdownMenuItem>
                          )}
                          {(u.perfil !== 'admin' || !u.is_super_admin) && (
                            <>
                              <DropdownMenuSeparator />
                              {!u.is_super_admin && (
                                <DropdownMenuItem className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir Usuário
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!usuarioEditando} onOpenChange={open => !open && setUsuarioEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>

          {usuarioEditando && (
            <div className="space-y-4">
              {/* User info */}
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(usuarioEditando.nome)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{usuarioEditando.nome || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{usuarioEditando.email || '—'}</p>
                </div>
              </div>

              <Separator />

              {/* Profile select */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Perfil de Acesso</label>
                {usuarioEditando.is_super_admin ? (
                  <div className="space-y-2">
                    <Select value={novoPerfilSelecionado} disabled>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </Select>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Crown className="h-3 w-3 text-yellow-500" />
                      Este é o administrador principal do sistema
                    </p>
                  </div>
                ) : (
                  <Select value={novoPerfilSelecionado} onValueChange={setNovoPerfilSelecionado}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PERFIL_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex flex-col">
                            <span>{config.label}</span>
                            <span className="text-xs text-muted-foreground">{PERFIL_DESCRICAO[key]}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUsuarioEditando(null)}>
              Cancelar
            </Button>
            <Button
              onClick={salvarPerfil}
              disabled={salvando || usuarioEditando?.is_super_admin || novoPerfilSelecionado === usuarioEditando?.perfil}
            >
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
