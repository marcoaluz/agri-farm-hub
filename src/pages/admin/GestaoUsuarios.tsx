import { useState, useEffect, useMemo } from 'react'

import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { toast as toastSonner } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Users, Search, MoreVertical, Crown, Shield,
  Edit, Trash2, UserCheck, UserX, UserPlus, Loader2, Clock, ChevronDown, MapPin,
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface UserProfile {
  id: string
  email: string | null
  nome: string | null
  perfil: string
  status?: string | null
  ultimo_acesso: string | null
  confirmado: boolean
  criado_em: string
  avatar_url: string | null
  is_super_admin?: boolean
  plano?: string | null
  plano_slug?: string | null
  assinatura_status?: string | null
  vencimento?: string | null
}

interface PropriedadeDetalhe {
  id: string
  nome: string
  area_total: number | null
  area_talhoes: number | null
}

interface EquipeDetalhe {
  usuario_id: string
  nome: string | null
  email: string
  papel: string
  propriedade_nome: string
}

interface DetalheProprietario {
  propriedades: PropriedadeDetalhe[]
  equipe: EquipeDetalhe[]
}

interface PropriedadeHierarquica {
  id: string
  nome: string
}

interface AcessoHierarquico {
  propriedade_id: string
  propriedade_nome: string
  papel: string
}

interface MembroHierarquico extends UserProfile {
  acessos: AcessoHierarquico[]
}

interface ProprietarioHierarquico extends UserProfile {
  propriedades: PropriedadeHierarquica[]
  equipe: MembroHierarquico[]
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
  const [proprietarios, setProprietarios] = useState<ProprietarioHierarquico[]>([])
  const [semPropriedade, setSemPropriedade] = useState<UserProfile[]>([])
  const [proprietariosExpandidos, setProprietariosExpandidos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('proprietario')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [usuarioEditando, setUsuarioEditando] = useState<UserProfile | null>(null)
  const [novoPerfilSelecionado, setNovoPerfilSelecionado] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Plan change dialog
  const [usuarioAlterandoPlano, setUsuarioAlterandoPlano] = useState<UserProfile | null>(null)
  const [novoPlanoSlug, setNovoPlanoSlug] = useState('essencial')
  const [novoCiclo, setNovoCiclo] = useState('mensal')
  const [alterandoPlano, setAlterandoPlano] = useState(false)

  // Approval dialog
  const [usuarioAprovando, setUsuarioAprovando] = useState<UserProfile | null>(null)
  const [papelAprovacao, setPapelAprovacao] = useState('consultor')
  const [aprovando, setAprovando] = useState(false)

  // Reject dialog
  const [usuarioRejeitando, setUsuarioRejeitando] = useState<UserProfile | null>(null)
  const [rejeitando, setRejeitando] = useState(false)

  // Proprietario detail dialog
  const [usuarioDetalhando, setUsuarioDetalhando] = useState<UserProfile | null>(null)
  const [detalhesProprietario, setDetalhesProprietario] = useState<DetalheProprietario | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false)

  // Edit name
  const [nomeEditando, setNomeEditando] = useState('')

  // Action confirmations
  const [usuarioPromovendo, setUsuarioPromovendo] = useState<UserProfile | null>(null)
  const [promovendo, setPromovendo] = useState(false)
  const [usuarioRebaixando, setUsuarioRebaixando] = useState<UserProfile | null>(null)
  const [rebaixando, setRebaixando] = useState(false)
  const [usuarioAlterandoStatus, setUsuarioAlterandoStatus] = useState<UserProfile | null>(null)
  const [alterandoStatus, setAlterandoStatus] = useState(false)
  const [usuarioDeletando, setUsuarioDeletando] = useState<UserProfile | null>(null)
  const [deletando, setDeletando] = useState(false)

  const [activeTab, setActiveTab] = useState('pendentes')


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
      const { data, error } = await supabase.rpc('admin_listar_usuarios_hierarquico' as any)
      if (error) throw error

      const resultado = (data || {}) as any
      const normalizarUsuario = (item: any, perfilPadrao?: string): UserProfile => ({
        id: item.id || item.usuario_id,
        email: item.email || item.usuario_email || null,
        nome: item.nome || item.usuario_nome || item.full_name || null,
        perfil: item.perfil || item.papel || perfilPadrao || 'consultor',
        status: item.status || null,
        ultimo_acesso: item.ultimo_acesso || null,
        confirmado: item.confirmado ?? item.status === 'ativo',
        criado_em: item.criado_em || item.created_at || '',
        avatar_url: item.avatar_url || null,
        is_super_admin: item.is_super_admin || false,
        plano: item.plano || item.plano_nome || null,
        plano_slug: item.plano_slug || null,
        assinatura_status: item.assinatura_status || null,
        vencimento: item.vencimento || item.data_fim || null,
      })

      const donos = ((resultado.proprietarios || []) as any[]).map((item) => {
        const dono = normalizarUsuario(item, 'proprietario')
        const propriedades = ((item.propriedades || []) as any[]).map((prop) => ({
          id: prop.id || prop.propriedade_id,
          nome: prop.nome || prop.propriedade_nome || 'Propriedade',
        }))
        const equipeAgrupada = new Map<string, MembroHierarquico>()
        for (const membroRaw of (item.equipe || []) as any[]) {
          const membro = normalizarUsuario(membroRaw, membroRaw.papel)
          if (!membro.id) continue
          const existente = equipeAgrupada.get(membro.id)
          const acessosRaw = Array.isArray(membroRaw.acessos)
            ? membroRaw.acessos
            : [{
                propriedade_id: membroRaw.propriedade_id,
                propriedade_nome: membroRaw.propriedade_nome,
                papel: membroRaw.papel || membro.perfil,
              }]
          const acessos = acessosRaw
            .filter((acesso: any) => acesso.propriedade_id || acesso.propriedade_nome)
            .map((acesso: any) => ({
              propriedade_id: acesso.propriedade_id || acesso.id || acesso.propriedade_nome,
              propriedade_nome: acesso.propriedade_nome || acesso.nome || 'Propriedade',
              papel: acesso.papel || membro.perfil,
            }))
          if (existente) {
            for (const acesso of acessos) {
              if (!existente.acessos.some((atual) => atual.propriedade_id === acesso.propriedade_id && atual.papel === acesso.papel)) {
                existente.acessos.push(acesso)
              }
            }
          } else {
            equipeAgrupada.set(membro.id, { ...membro, acessos })
          }
        }
        return { ...dono, propriedades, equipe: Array.from(equipeAgrupada.values()) }
      }) as ProprietarioHierarquico[]

      const avulsos = ((resultado.sem_propriedade || []) as any[]).map((item) => normalizarUsuario(item))
      const todos = new Map<string, UserProfile>()
      for (const dono of donos) {
        todos.set(dono.id, dono)
        for (const membro of dono.equipe) todos.set(membro.id, membro)
      }
      for (const avulso of avulsos) todos.set(avulso.id, avulso)

      setProprietarios(donos)
      setSemPropriedade(avulsos)
      setUsuarios(Array.from(todos.values()))
      setProprietariosExpandidos((atuais) => atuais.size > 0 ? atuais : new Set(donos.map((dono) => dono.id)))
    } catch (err) {
      toast({
        title: 'Erro ao carregar usuários',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsuarios()
  }, [])

  // Mark pending notifications as read when opening Pendentes tab
  useEffect(() => {
    if (activeTab === 'pendentes') {
      supabase
        .from('admin_notificacoes' as any)
        .update({ lida: true } as any)
        .eq('tipo', 'novo_cadastro')
        .eq('lida', false)
        .then(() => {})
    }
  }, [activeTab])

  // Pending users
  const usuariosPendentes = useMemo(() => {
    return usuarios.filter(u => u.status === 'pendente')
  }, [usuarios])

  // Filtered hierarchical list (all users tab)
  const correspondeFiltros = (u: UserProfile) => {
    const termo = busca.trim().toLowerCase()
    const matchBusca = !termo || u.nome?.toLowerCase().includes(termo) || u.email?.toLowerCase().includes(termo)
    const matchPerfil = filtroPerfil === 'todos' || u.perfil === filtroPerfil
    const matchStatus = filtroStatus === 'todos' ||
      (filtroStatus === 'ativo' && (u.status === 'ativo' || u.confirmado)) ||
      (filtroStatus === 'pendente' && u.status === 'pendente')
    return Boolean(matchBusca && matchPerfil && matchStatus)
  }

  const proprietariosFiltrados = useMemo(() => {
    return proprietarios
      .map((dono) => {
        const donoCorresponde = correspondeFiltros(dono)
        const equipeFiltrada = filtroPerfil === 'proprietario' && !busca.trim() && filtroStatus === 'todos'
          ? dono.equipe
          : dono.equipe.filter(correspondeFiltros)
        return { ...dono, equipe: donoCorresponde ? dono.equipe : equipeFiltrada }
      })
      .filter((dono) => correspondeFiltros(dono) || dono.equipe.length > 0)
  }, [proprietarios, busca, filtroPerfil, filtroStatus])

  const semPropriedadeFiltrados = useMemo(
    () => semPropriedade.filter(correspondeFiltros),
    [semPropriedade, busca, filtroPerfil, filtroStatus],
  )

  const totalFiltrado = proprietariosFiltrados.length + semPropriedadeFiltrados.length

  function alternarProprietario(id: string) {
    setProprietariosExpandidos((atuais) => {
      const proximo = new Set(atuais)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  // Save profile (nome + perfil)
  async function salvarPerfil() {
    if (!usuarioEditando) return
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('user_profiles' as any)
        .update({
          full_name: nomeEditando.trim(),
          perfil: novoPerfilSelecionado,
          updated_at: new Date().toISOString(),
        } as any)
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

  // Approve user
  async function aprovarUsuario() {
    if (!usuarioAprovando) return
    setAprovando(true)
    try {
      const { data: resultado, error } = await supabase.rpc('admin_aprovar_usuario' as any, {
        p_user_id: usuarioAprovando.id,
        p_perfil: papelAprovacao,
      })
      if (error) throw error
      const vinculadas = (resultado as any)?.propriedades_vinculadas || 0
      toast({
        title: '✅ Usuário aprovado com sucesso!',
        description: vinculadas > 0
          ? `${vinculadas} propriedade(s) vinculada(s) automaticamente.`
          : undefined,
      })
      setUsuarioAprovando(null)
      setPapelAprovacao(usuarioAprovando.perfil || 'consultor')
      fetchUsuarios()
    } catch {
      toast({ title: 'Erro ao aprovar usuário', variant: 'destructive' })
    } finally {
      setAprovando(false)
    }
  }

  // Reject user
  async function rejeitarUsuario() {
    if (!usuarioRejeitando) return
    setRejeitando(true)
    try {
      const { error } = await supabase
        .from('user_profiles' as any)
        .update({ status: 'inativo', updated_at: new Date().toISOString() } as any)
        .eq('id', usuarioRejeitando.id)
      if (error) throw error
      toast({ title: 'Usuário rejeitado.' })
      setUsuarioRejeitando(null)
      fetchUsuarios()
    } catch {
      toast({ title: 'Erro ao rejeitar usuário', variant: 'destructive' })
    } finally {
      setRejeitando(false)
    }
  }

  // Promote / demote with confirmation
  async function confirmarPromocao() {
    if (!usuarioPromovendo) return
    setPromovendo(true)
    try {
      const { error } = await supabase.rpc('promote_to_admin' as any, { p_user_id: usuarioPromovendo.id })
      if (error) throw error
      toast({ title: '✅ Promovido a Admin!' })
      setUsuarioPromovendo(null)
      fetchUsuarios()
    } catch {
      toast({ title: 'Erro ao promover', variant: 'destructive' })
    } finally {
      setPromovendo(false)
    }
  }

  async function confirmarRebaixamento() {
    if (!usuarioRebaixando) return
    setRebaixando(true)
    try {
      const { error } = await supabase.rpc('demote_from_admin' as any, {
        p_user_id: usuarioRebaixando.id,
        p_new_perfil: 'proprietario',
      })
      if (error) throw error
      toast({ title: '✅ Admin rebaixado para Proprietário!' })
      setUsuarioRebaixando(null)
      fetchUsuarios()
    } catch {
      toast({ title: 'Erro ao rebaixar', variant: 'destructive' })
    } finally {
      setRebaixando(false)
    }
  }

  // Suspend / reactivate
  async function confirmarAlteracaoStatus() {
    if (!usuarioAlterandoStatus) return
    const novoStatus = usuarioAlterandoStatus.status === 'inativo' ? 'ativo' : 'inativo'
    setAlterandoStatus(true)
    try {
      const { error } = await supabase
        .from('user_profiles' as any)
        .update({ status: novoStatus, updated_at: new Date().toISOString() } as any)
        .eq('id', usuarioAlterandoStatus.id)
      if (error) throw error
      toast({ title: novoStatus === 'ativo' ? '✅ Conta reativada!' : 'Conta suspensa.' })
      setUsuarioAlterandoStatus(null)
      fetchUsuarios()
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    } finally {
      setAlterandoStatus(false)
    }
  }

  // Delete user via edge function
  async function handleDeletarUsuario() {
    if (!usuarioDeletando) return
    console.log('Iniciando exclusão do usuário', usuarioDeletando.id)
    setDeletando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deletar-usuario-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ usuario_id: usuarioDeletando.id }),
      })
      const resultado = await resp.json()
      console.log('Resposta da função:', resultado)
      if (!resp.ok) {
        toast({ title: resultado.error || 'Erro ao excluir usuário', variant: 'destructive' })
      } else {
        toast({ title: 'Usuário excluído' })
        setUsuarioDeletando(null)
        fetchUsuarios()
      }
    } catch (err) {
      console.error('Erro capturado na exclusão:', err)
      toastSonner.error('Erro ao excluir: ' + (err as Error).message)
    } finally {
      setDeletando(false)
    }
  }

  // Change plan
  async function alterarPlano() {
    if (!usuarioAlterandoPlano) return
    setAlterandoPlano(true)
    try {
      const { data, error } = await supabase.rpc('admin_alterar_plano_usuario' as any, {
        p_usuario_id: usuarioAlterandoPlano.id,
        p_plano_slug: novoPlanoSlug,
        p_ciclo: novoCiclo,
      })
      if (error) throw error
      toast({ title: `✅ Plano alterado para ${(data as any)?.plano}!` })
      setUsuarioAlterandoPlano(null)
      fetchUsuarios()
    } catch (err: any) {
      toast({ title: 'Erro ao alterar plano: ' + err.message, variant: 'destructive' })
    } finally {
      setAlterandoPlano(false)
    }
  }

  function openEditModal(u: UserProfile) {
    setUsuarioEditando(u)
    setNovoPerfilSelecionado(u.perfil)
    setNomeEditando(u.nome || '')
  }

  async function abrirDetalhes(u: UserProfile) {
    setUsuarioDetalhando(u)
    setDetalhesProprietario(null)
    if (u.perfil !== 'proprietario') return
    setCarregandoDetalhes(true)
    try {
      const { data, error } = await supabase.rpc('admin_get_detalhe_proprietario' as any, {
        p_usuario_id: u.id,
      })
      if (error) throw error
      setDetalhesProprietario(data as DetalheProprietario)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar detalhes', description: err.message, variant: 'destructive' })
    } finally {
      setCarregandoDetalhes(false)
    }
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


  function renderStatusBadge(u: UserProfile) {
    if (u.status === 'pendente') {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">Pendente</Badge>
    }
    if (u.status === 'inativo') {
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Inativo</Badge>
    }
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">Ativo</Badge>
  }

  function renderMenuAcoes(u: UserProfile) {
    if (u.id === user?.id) return <span className="text-xs text-muted-foreground px-2">Você</span>
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(event) => event.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem onClick={() => abrirDetalhes(u)}>
            <Users className="mr-2 h-4 w-4" /> Ver detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEditModal(u)}>
            <Edit className="mr-2 h-4 w-4" /> Editar perfil
          </DropdownMenuItem>
          {u.perfil === 'proprietario' && (
            <DropdownMenuItem onClick={() => { setUsuarioAlterandoPlano(u); setNovoPlanoSlug(u.plano_slug || 'essencial'); setNovoCiclo('mensal') }}>
              <Shield className="mr-2 h-4 w-4" /> Alterar Plano
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {u.status === 'pendente' && (
            <>
              <DropdownMenuItem onClick={() => { setUsuarioAprovando(u); setPapelAprovacao(u.perfil || 'consultor') }}>
                <UserCheck className="mr-2 h-4 w-4" /> Aprovar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUsuarioRejeitando(u)} className="text-destructive focus:text-destructive">
                <UserX className="mr-2 h-4 w-4" /> Rejeitar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {u.perfil !== 'admin' && (
            <DropdownMenuItem onClick={() => setUsuarioPromovendo(u)}>
              <Shield className="mr-2 h-4 w-4" /> Promover a admin
            </DropdownMenuItem>
          )}
          {u.perfil === 'admin' && !u.is_super_admin && (
            <DropdownMenuItem onClick={() => setUsuarioRebaixando(u)}>
              <Shield className="mr-2 h-4 w-4" /> Rebaixar admin
            </DropdownMenuItem>
          )}
          {!u.is_super_admin && u.status !== 'pendente' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={u.status === 'inativo' ? '' : 'text-destructive focus:text-destructive'}
                onClick={() => setUsuarioAlterandoStatus(u)}
              >
                {u.status === 'inativo'
                  ? <><UserCheck className="mr-2 h-4 w-4" /> Reativar conta</>
                  : <><UserX className="mr-2 h-4 w-4" /> Suspender conta</>}
              </DropdownMenuItem>
            </>
          )}
          {!u.is_super_admin && (
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setUsuarioDeletando(u)}>
              <Trash2 className="mr-2 h-4 w-4" /> Deletar usuário
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pendentes" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes
            {usuariosPendentes.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center">
                {usuariosPendentes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="todos">Todos os Usuários</TabsTrigger>
        </TabsList>

        {/* === Pendentes Tab === */}
        <TabsContent value="pendentes" className="space-y-4 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : usuariosPendentes.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <UserCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-medium text-foreground">Nenhum usuário pendente</p>
                <p className="text-sm text-muted-foreground">Todos os cadastros foram analisados</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {usuariosPendentes.map(u => (
                <Card key={u.id} className="border-yellow-200 dark:border-yellow-800/50">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">
                          {getInitials(u.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{u.nome || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email || '—'}</p>
                      </div>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800 shrink-0">
                        Pendente
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Cadastro em {u.criado_em ? format(new Date(u.criado_em), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => { setUsuarioAprovando(u); setPapelAprovacao(u.perfil || 'consultor') }}
                      >
                        <UserCheck className="h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1.5"
                        onClick={() => setUsuarioRejeitando(u)}
                      >
                        <UserX className="h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* === Todos Tab === */}
        <TabsContent value="todos" className="space-y-4 mt-4">
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

          {/* Hierarchical user list */}
          <div className="space-y-3">
            {loading ? (
              <Card><CardContent className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>
            ) : totalFiltrado === 0 ? (
              <Card><CardContent className="text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum usuário encontrado</p>
                <p className="text-sm">Ajuste os filtros para ver resultados</p>
              </CardContent></Card>
            ) : (
              <>
                {proprietariosFiltrados.map((dono) => {
                  const expandido = proprietariosExpandidos.has(dono.id)
                  return (
                    <Card key={dono.id} className="overflow-hidden">
                      <div className="flex items-center gap-3 p-4">
                        <Button
                          variant="ghost"
                          className="h-auto min-w-0 flex-1 justify-start gap-3 p-0 text-left hover:bg-transparent"
                          onClick={() => alternarProprietario(dono.id)}
                          aria-expanded={expandido}
                        >
                          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandido ? '' : '-rotate-90'}`} />
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">{getInitials(dono.nome)}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground">{dono.nome || 'Sem nome'}</span>
                            <span className="block truncate text-xs font-normal text-muted-foreground">{dono.email || '—'}</span>
                          </span>
                        </Button>
                        <div className="hidden sm:block">{renderStatusBadge(dono)}</div>
                        <Badge variant="secondary" className="shrink-0">
                          {dono.propriedades.length} {dono.propriedades.length === 1 ? 'propriedade' : 'propriedades'}
                        </Badge>
                        {renderMenuAcoes(dono)}
                      </div>

                      {expandido && (
                        <div className="border-t bg-muted/20 px-4 py-4 sm:px-6">
                          <div className="mb-4 space-y-2">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Propriedades</p>
                            {dono.propriedades.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhuma propriedade cadastrada</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {dono.propriedades.map((propriedade) => (
                                  <Badge key={propriedade.id} variant="outline" className="gap-1.5 bg-background">
                                    <MapPin className="h-3 w-3" /> {propriedade.nome}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 border-l-2 border-primary/30 pl-3 sm:pl-5">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Equipe</p>
                            {dono.equipe.length === 0 ? (
                              <p className="py-2 text-sm text-muted-foreground">Nenhum membro de equipe ainda</p>
                            ) : dono.equipe.map((membro) => (
                              <div key={membro.id} className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <Avatar className="h-9 w-9 shrink-0">
                                    <AvatarFallback className="bg-muted text-sm font-medium">{getInitials(membro.nome)}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">{membro.nome || 'Sem nome'}</p>
                                    <p className="truncate text-xs text-muted-foreground">{membro.email || '—'}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {membro.acessos.map((acesso) => (
                                    <Badge key={`${acesso.propriedade_id}-${acesso.papel}`} variant="outline">
                                      {acesso.propriedade_nome} · {PERFIL_CONFIG[acesso.papel]?.label || acesso.papel}
                                    </Badge>
                                  ))}
                                </div>
                                <div className="flex items-center justify-between gap-2 sm:justify-end">
                                  {renderStatusBadge(membro)}
                                  {renderMenuAcoes(membro)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}

                {semPropriedadeFiltrados.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="px-1 text-xs font-semibold uppercase text-muted-foreground">Sem propriedade ou acesso</p>
                    {semPropriedadeFiltrados.map((u) => (
                      <Card key={u.id}>
                        <CardContent className="flex items-center gap-3 p-4">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-muted text-sm font-medium">{getInitials(u.nome)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{u.nome || 'Sem nome'}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email || '—'}</p>
                          </div>
                          <div className="hidden sm:block">{renderPerfilBadge(u.perfil, u.is_super_admin)}</div>
                          {renderStatusBadge(u)}
                          {renderMenuAcoes(u)}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={!!usuarioEditando} onOpenChange={open => !open && setUsuarioEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>

          {usuarioEditando && (
            <div className="space-y-4">
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nome</label>
                <Input
                  value={nomeEditando}
                  onChange={e => setNomeEditando(e.target.value)}
                  placeholder="Nome completo"
                  maxLength={100}
                />
              </div>

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
                      {Object.entries(PERFIL_CONFIG)
                        .filter(([key]) => key !== 'admin')
                        .map(([key, config]) => (
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
              disabled={
                salvando ||
                usuarioEditando?.is_super_admin ||
                !novoPerfilSelecionado ||
                (novoPerfilSelecionado === usuarioEditando?.perfil && nomeEditando.trim() === (usuarioEditando?.nome || ''))
              }
            >
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={!!usuarioAprovando} onOpenChange={open => !open && setUsuarioAprovando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovar Usuário</DialogTitle>
          </DialogHeader>

          {usuarioAprovando && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 font-medium">
                    {getInitials(usuarioAprovando.nome)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{usuarioAprovando.nome || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{usuarioAprovando.email || '—'}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Papel do usuário</label>
                <Select value={papelAprovacao} onValueChange={setPapelAprovacao}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERFIL_CONFIG)
                      .filter(([key]) => key !== 'admin')
                      .map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex flex-col">
                            <span>{config.label}</span>
                            <span className="text-xs text-muted-foreground">{PERFIL_DESCRICAO[key]}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUsuarioAprovando(null)}>
              Cancelar
            </Button>
            <Button
              onClick={aprovarUsuario}
              disabled={aprovando}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {aprovando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject AlertDialog */}
      <AlertDialog open={!!usuarioRejeitando} onOpenChange={open => !open && setUsuarioRejeitando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja rejeitar o cadastro de <strong>{usuarioRejeitando?.nome || usuarioRejeitando?.email}</strong>? O usuário será marcado como inativo e não terá acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejeitando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={rejeitarUsuario}
              disabled={rejeitando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejeitando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sim, rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plan Change Dialog */}
      <Dialog open={!!usuarioAlterandoPlano} onOpenChange={open => !open && setUsuarioAlterandoPlano(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
          </DialogHeader>

          {usuarioAlterandoPlano && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(usuarioAlterandoPlano.nome)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{usuarioAlterandoPlano.nome}</p>
                  <p className="text-xs text-muted-foreground">{usuarioAlterandoPlano.email}</p>
                  {usuarioAlterandoPlano.plano && (
                    <p className="text-xs text-primary font-medium">Plano atual: {usuarioAlterandoPlano.plano}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Novo plano</label>
                <Select value={novoPlanoSlug} onValueChange={setNovoPlanoSlug}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essencial">Essencial — R$ 49,90/mês</SelectItem>
                    <SelectItem value="profissional">Profissional — R$ 119,90/mês</SelectItem>
                    <SelectItem value="avancado">Avançado — R$ 249,90/mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ciclo de cobrança</label>
                <Select value={novoCiclo} onValueChange={setNovoCiclo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual (15% de desconto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                ⚠️ Confirme que o pagamento foi recebido antes de alterar o plano. O sistema sincronizará os módulos automaticamente.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUsuarioAlterandoPlano(null)}>Cancelar</Button>
            <Button onClick={alterarPlano} disabled={alterandoPlano}>
              {alterandoPlano ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User detail dialog */}
      <Dialog open={!!usuarioDetalhando} onOpenChange={open => !open && setUsuarioDetalhando(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>

          {usuarioDetalhando && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(usuarioDetalhando.nome)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{usuarioDetalhando.nome || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{usuarioDetalhando.email || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Perfil</p>
                  {renderPerfilBadge(usuarioDetalhando.perfil, usuarioDetalhando.is_super_admin)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{usuarioDetalhando.status || (usuarioDetalhando.confirmado ? 'ativo' : '—')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Último acesso</p>
                  <p className="font-medium">
                    {usuarioDetalhando.ultimo_acesso
                      ? format(new Date(usuarioDetalhando.ultimo_acesso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'Nunca acessou'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data de cadastro</p>
                  <p className="font-medium">
                    {usuarioDetalhando.criado_em
                      ? format(new Date(usuarioDetalhando.criado_em), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'}
                  </p>
                </div>
              </div>

              {usuarioDetalhando.perfil === 'proprietario' && (
                carregandoDetalhes ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : detalhesProprietario ? (
                <>
                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Propriedades</h3>
                      <p className="text-sm font-medium text-primary">
                        Área total em operação:{' '}
                        {detalhesProprietario.propriedades
                          .reduce((sum, p) => sum + Number(p.area_talhoes || 0), 0)
                          .toLocaleString('pt-BR')} ha
                      </p>
                    </div>
                    {detalhesProprietario.propriedades.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma propriedade cadastrada</p>
                    ) : (
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-left">Nome</TableHead>
                              <TableHead className="text-right">Área cadastrada</TableHead>
                              <TableHead className="text-right">Área em talhões</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detalhesProprietario.propriedades.map(p => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.nome}</TableCell>
                                <TableCell className="text-right">
                                  {Number(p.area_total || 0).toLocaleString('pt-BR')} ha
                                </TableCell>
                                <TableCell className="text-right">
                                  {Number(p.area_talhoes || 0).toLocaleString('pt-BR')} ha
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Equipe</h3>
                    {detalhesProprietario.equipe.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum membro de equipe ainda</p>
                    ) : (
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-left">Nome / E-mail</TableHead>
                              <TableHead className="text-left">Papel</TableHead>
                              <TableHead className="text-left">Propriedade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detalhesProprietario.equipe.map((m, idx) => (
                              <TableRow key={`${m.usuario_id}-${idx}`}>
                                <TableCell>
                                  <p className="font-medium text-foreground">{m.nome || 'Sem nome'}</p>
                                  <p className="text-xs text-muted-foreground">{m.email}</p>
                                </TableCell>
                                <TableCell>{renderPerfilBadge(m.papel)}</TableCell>
                                <TableCell className="text-sm">{m.propriedade_nome}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </>
              ) : null)}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Promote AlertDialog */}
      <AlertDialog open={!!usuarioPromovendo} onOpenChange={open => !open && setUsuarioPromovendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promover a administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Promover <strong>{usuarioPromovendo?.nome || usuarioPromovendo?.email}</strong> a administrador da plataforma? Ele terá acesso total ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promovendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarPromocao} disabled={promovendo}>
              {promovendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sim, promover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demote AlertDialog */}
      <AlertDialog open={!!usuarioRebaixando} onOpenChange={open => !open && setUsuarioRebaixando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebaixar administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{usuarioRebaixando?.nome || usuarioRebaixando?.email}</strong> deixará de ser admin e passará a ter o perfil de Proprietário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rebaixando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRebaixamento} disabled={rebaixando}>
              {rebaixando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sim, rebaixar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend/Reactivate AlertDialog */}
      <AlertDialog open={!!usuarioAlterandoStatus} onOpenChange={open => !open && setUsuarioAlterandoStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {usuarioAlterandoStatus?.status === 'inativo' ? 'Reativar conta?' : 'Suspender conta?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {usuarioAlterandoStatus?.status === 'inativo'
                ? <>A conta de <strong>{usuarioAlterandoStatus?.nome || usuarioAlterandoStatus?.email}</strong> voltará a ter acesso ao sistema.</>
                : <>A conta de <strong>{usuarioAlterandoStatus?.nome || usuarioAlterandoStatus?.email}</strong> ficará sem acesso ao sistema até ser reativada.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={alterandoStatus}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarAlteracaoStatus}
              disabled={alterandoStatus}
              className={usuarioAlterandoStatus?.status === 'inativo' ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
            >
              {alterandoStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {usuarioAlterandoStatus?.status === 'inativo' ? 'Sim, reativar' : 'Sim, suspender'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete user AlertDialog */}
      <AlertDialog open={!!usuarioDeletando} onOpenChange={open => !open && setUsuarioDeletando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação <strong>não pode ser desfeita</strong>. O usuário <strong>{usuarioDeletando?.nome || usuarioDeletando?.email}</strong> será removido definitivamente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletarUsuario}
              disabled={deletando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sim, excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

