import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Users, UserPlus, Copy, Check, Trash2, Loader2,
  Clock, AlertTriangle, RefreshCw, Send, Link as LinkIcon,
  Shield
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'

const PAPEIS = [
  { value: 'gerente', label: 'Gerente', desc: 'Pode criar e editar registros' },
  { value: 'operador', label: 'Operador', desc: 'Registra operações do dia a dia' },
  { value: 'visualizador', label: 'Visualizador', desc: 'Somente leitura' },
]

const VALIDADES = [
  { value: '24', label: '24 horas' },
  { value: '48', label: '48 horas' },
  { value: '72', label: '72 horas' },
  { value: '168', label: '7 dias' },
]

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

interface Membro {
  membro_id: string
  tipo: string
  email: string
  nome: string | null
  papel: string
  status: string
  adicionado_em: string
  expira_em: string | null
  expirado: boolean
  token: string | null
}

export default function MinhaEquipe() {
  const { propriedadeId } = useGlobal()
  const { user } = useAuth()

  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('')
  const [horas, setHoras] = useState('72')
  const [gerando, setGerando] = useState(false)
  const [linkGerado, setLinkGerado] = useState('')
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [removendoId, setRemovendoId] = useState<string | null>(null)
  const [confirmarRemover, setConfirmarRemover] = useState<Membro | null>(null)

  const fetchEquipe = useCallback(async () => {
    if (!propriedadeId) return
    setLoading(true)
    const { data, error } = await supabase.rpc('listar_equipe_propriedade' as any, {
      p_propriedade_id: propriedadeId,
    })
    if (error) toast.error('Erro ao carregar equipe: ' + error.message)
    else setMembros((data as any[]) || [])
    setLoading(false)
  }, [propriedadeId])

  useEffect(() => { fetchEquipe() }, [fetchEquipe])

  const handleConvidar = async () => {
    if (!email.trim() || !papel || !propriedadeId) return
    setGerando(true)
    try {
      const { data, error } = await supabase.rpc('gerar_convite_equipe' as any, {
        p_email: email.trim().toLowerCase(),
        p_propriedade_id: propriedadeId,
        p_papel: papel,
        p_horas_validade: parseInt(horas),
      })
      if (error) throw error
      const result = data as any
      const link = `${window.location.origin}/convite?token=${result.token}&tipo=existente`
      setLinkGerado(link)
      setShowLinkDialog(true)
      setCopiado(false)
      setEmail('')
      setPapel('')
      setHoras('72')
      toast.success('Convite gerado!')
      fetchEquipe()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar convite')
    } finally {
      setGerando(false)
    }
  }

  const handleCopiar = async () => {
    await navigator.clipboard.writeText(linkGerado)
    setCopiado(true)
    toast.success('Link copiado!')
    setTimeout(() => setCopiado(false), 2000)
  }

  const handleRemover = async (membro: Membro) => {
    setRemovendoId(membro.membro_id)
    try {
      const { error } = await supabase.rpc('remover_membro_equipe' as any, {
        p_membro_id: membro.membro_id,
      })
      if (error) throw error
      toast.success(membro.tipo === 'convite' ? 'Convite revogado.' : 'Membro removido.')
      fetchEquipe()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover')
    } finally {
      setRemovendoId(null)
      setConfirmarRemover(null)
    }
  }

  const copiarLink = (token: string) => {
    const link = `${window.location.origin}/convite?token=${token}&tipo=existente`
    navigator.clipboard.writeText(link)
    toast.success('Link copiado!')
  }

  const papelLabel: Record<string, string> = {
    gerente: 'Gerente', operador: 'Operador',
    visualizador: 'Visualizador', proprietario: 'Proprietário'
  }
  const papelVariant: Record<string, string> = {
    gerente: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    operador: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    visualizador: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    proprietario: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Minha Equipe</h1>
          <p className="text-sm text-muted-foreground">Convide e gerencie os membros da sua propriedade</p>
        </div>
      </div>

      {!propriedadeId ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">Selecione uma propriedade</h3>
            <p className="text-sm text-muted-foreground">Escolha a propriedade no seletor acima para gerenciar sua equipe.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Formulário de convite */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Convidar Membro
              </CardTitle>
              <CardDescription>Envie um convite por link para sua equipe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="nome@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={gerando}
                />
              </div>

              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={papel} onValueChange={setPapel} disabled={gerando}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PAPEIS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <div>
                          <div className="font-medium">{p.label}</div>
                          <div className="text-xs text-muted-foreground">{p.desc}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Validade do link</Label>
                <Select value={horas} onValueChange={setHoras} disabled={gerando}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VALIDADES.map(v => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Permissões disponíveis:</p>
                {PAPEIS.map(p => (
                  <p key={p.value} className="text-xs text-muted-foreground">
                    <strong>{p.label}:</strong> {p.desc}
                  </p>
                ))}
              </div>

              <Button
                className="w-full"
                onClick={handleConvidar}
                disabled={gerando || !email.trim() || !papel}
              >
                {gerando
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
                  : <><Send className="h-4 w-4 mr-2" /> Gerar Convite</>}
              </Button>
            </CardContent>
          </Card>

          {/* Lista de membros */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Equipe Atual
                  </CardTitle>
                  <CardDescription>
                    {membros.filter(m => m.tipo === 'membro').length} membro(s) ·{' '}
                    {membros.filter(m => m.tipo === 'convite' && !m.expirado).length} convite(s) pendente(s)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchEquipe} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : membros.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground" />
                  <h3 className="font-semibold">Nenhum membro ainda</h3>
                  <p className="text-sm text-muted-foreground">Convide sua equipe usando o formulário ao lado.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membro</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membros.map(m => (
                      <TableRow key={m.membro_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(m.nome, m.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{m.nome || m.email}</p>
                              {m.nome && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={papelVariant[m.papel] || ''} variant="outline">
                            {papelLabel[m.papel] || m.papel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {m.tipo === 'membro' ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              Ativo
                            </Badge>
                          ) : m.expirado ? (
                            <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Expirado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              <Clock className="h-3 w-3 mr-1" /> Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.adicionado_em
                            ? format(new Date(m.adicionado_em), 'dd/MM/yy', { locale: ptBR })
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {m.tipo === 'convite' && m.token && !m.expirado && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copiarLink(m.token!)}
                                title="Copiar link"
                              >
                                <LinkIcon className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmarRemover(m)}
                              disabled={removendoId === m.membro_id || m.papel === 'proprietario'}
                              className="text-destructive hover:text-destructive"
                            >
                              {removendoId === m.membro_id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog link gerado */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Convite Gerado!
            </DialogTitle>
            <DialogDescription>
              Copie o link abaixo e envie para o membro da sua equipe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={linkGerado}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button onClick={handleCopiar} variant={copiado ? 'outline' : 'default'}>
                {copiado
                  ? <><Check className="h-4 w-4 mr-2" /> Copiado!</>
                  : <><Copy className="h-4 w-4 mr-2" /> Copiar</>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ Link de uso único. Expira conforme o prazo selecionado.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar remoção */}
      <AlertDialog open={!!confirmarRemover} onOpenChange={(open) => !open && setConfirmarRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmarRemover?.tipo === 'convite' ? 'Revogar convite?' : 'Remover membro?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarRemover?.tipo === 'convite'
                ? `O link enviado para ${confirmarRemover?.email} será invalidado.`
                : `${confirmarRemover?.nome || confirmarRemover?.email} perderá o acesso à propriedade.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmarRemover && handleRemover(confirmarRemover)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
