import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Users, UserPlus, Copy, Check, Trash2, Loader2,
  Clock, AlertTriangle, RefreshCw, Send, Link as LinkIcon,
  Shield, X, Plus,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const papelLabel: Record<string, string> = {
  gerente: 'Gerente', operador: 'Operador', visualizador: 'Visualizador', proprietario: 'Proprietário',
}
const papelVariant: Record<string, string> = {
  gerente: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  operador: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  visualizador: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  proprietario: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

interface Acesso { propriedade_id: string; propriedade_nome: string; papel: string }
interface PessoaEquipe { usuario_id: string; nome: string | null; email: string; avatar_url: string | null; acessos: Acesso[] }
interface PropriedadeGerenciavel { propriedade_id: string; propriedade_nome: string; meu_papel: string }
interface Convite { membro_id: string; tipo: string; email: string; nome: string | null; papel: string; status: string; adicionado_em: string; expira_em: string | null; expirado: boolean; token: string | null; propriedade_id?: string; propriedade_nome?: string }

export default function MinhaEquipe() {
  const { propriedadeAtual } = useGlobal()

  const [equipe, setEquipe] = useState<PessoaEquipe[]>([])
  const [propriedadesGerenciaveis, setPropriedadesGerenciaveis] = useState<PropriedadeGerenciavel[]>([])
  const [convitesPendentes, setConvitesPendentes] = useState<Convite[]>([])
  const [loading, setLoading] = useState(true)

  // Convidar pessoa nova (sem conta ainda)
  const [email, setEmail] = useState('')
  const [propriedadesConvite, setPropriedadesConvite] = useState<string[]>([])
  const [papel, setPapel] = useState('')
  const [horas, setHoras] = useState('72')
  const [gerando, setGerando] = useState(false)
  const [linkGerado, setLinkGerado] = useState('')
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // Dar acesso a mais uma propriedade (pessoa que já tem conta)
  const [emailAcesso, setEmailAcesso] = useState('')
  const [propriedadeAcesso, setPropriedadeAcesso] = useState('')
  const [papelAcesso, setPapelAcesso] = useState('')
  const [salvandoAcesso, setSalvandoAcesso] = useState(false)

  const [confirmarRemoverAcesso, setConfirmarRemoverAcesso] = useState<{ pessoa: PessoaEquipe; acesso: Acesso } | null>(null)
  const [confirmarRemoverConvite, setConfirmarRemoverConvite] = useState<Convite | null>(null)
  const [removendo, setRemovendo] = useState(false)

  const fetchTudo = useCallback(async () => {
    setLoading(true)
    const [{ data: props, error: e1 }, { data: eq, error: e2 }] = await Promise.all([
      supabase.rpc('get_minhas_propriedades_gerenciaveis' as any),
      supabase.rpc('get_equipe_universal' as any),
    ])
    if (e1) toast.error('Erro ao carregar propriedades: ' + e1.message)
    if (e2) toast.error('Erro ao carregar equipe: ' + e2.message)
    setPropriedadesGerenciaveis((props as any[]) || [])
    setEquipe((eq as any[]) || [])

    // Convites pendentes — busca em cada propriedade que eu gerencio e junta
    if (props && (props as any[]).length > 0) {
      const listas = await Promise.all(
        (props as any[]).map(async (p: any) => {
          const { data } = await supabase.rpc('listar_equipe_propriedade' as any, { p_propriedade_id: p.propriedade_id })
          return ((data as any[]) || [])
            .filter((m: any) => m.tipo === 'convite')
            .map((m: any) => ({ ...m, propriedade_id: p.propriedade_id, propriedade_nome: p.propriedade_nome }))
        })
      )
      setConvitesPendentes(listas.flat())
    } else {
      setConvitesPendentes([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  // Pré-seleciona a propriedade atual do topo, se ela estiver entre as gerenciáveis
  useEffect(() => {
    if (propriedadeAtual?.id && propriedadesGerenciaveis.some(p => p.propriedade_id === propriedadeAtual.id)) {
      setPropriedadesConvite(prev => prev.length === 0 ? [propriedadeAtual.id!] : prev)
      if (!propriedadeAcesso) setPropriedadeAcesso(propriedadeAtual.id)
    }
  }, [propriedadeAtual?.id, propriedadesGerenciaveis])

  const toggleUmaPropriedade = (id: string) => {
    setPropriedadesConvite(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const handleConvidar = async () => {
    if (!email.trim() || !papel || propriedadesConvite.length === 0) return
    setGerando(true)
    try {
      const { data, error } = await supabase.rpc('gerar_convite_equipe' as any, {
        p_email: email.trim().toLowerCase(),
        p_propriedade_ids: propriedadesConvite,
        p_papel: papel,
        p_horas_validade: parseInt(horas),
      })
      if (error) throw error
      const result = data as any
      const link = `${window.location.origin}/convite?token=${result.token}&tipo=existente`

      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData?.session
      let emailEnviado = false
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/convidar-usuario`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              email: email.trim().toLowerCase(), nome: '', role: papel,
              propriedade_id: propriedadesConvite[0], token: result.token, link,
            }),
          },
        )
        emailEnviado = response.ok
      } catch (e) {
        console.warn('Falha ao enviar e-mail de convite', e)
      }

      setLinkGerado(link)
      setCopiado(false)
      setEmail('')
      setPapel('')
      if (emailEnviado) toast.success(`Convite enviado por e-mail para ${email.trim()}!`)
      else { setShowLinkDialog(true); toast.warning('Convite criado, mas o e-mail não pôde ser enviado. Compartilhe o link manualmente.') }
      fetchTudo()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar convite')
    } finally {
      setGerando(false)
    }
  }

  const handleDefinirAcesso = async () => {
    if (!emailAcesso.trim() || !propriedadeAcesso || !papelAcesso) return
    setSalvandoAcesso(true)
    try {
      const { data, error } = await supabase.rpc('definir_acesso_usuario' as any, {
        p_email: emailAcesso.trim().toLowerCase(),
        p_propriedade_id: propriedadeAcesso,
        p_papel: papelAcesso,
      })
      if (error) throw error
      const result = data as any
      if (!result.sucesso) {
        toast.error(result.erro || 'Não foi possível dar acesso')
      } else {
        toast.success('Acesso concedido!')
        setEmailAcesso('')
        setPapelAcesso('')
        fetchTudo()
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao dar acesso')
    } finally {
      setSalvandoAcesso(false)
    }
  }

  const handleRemoverAcesso = async () => {
    if (!confirmarRemoverAcesso) return
    setRemovendo(true)
    const { error } = await supabase
      .from('propriedades_usuarios' as any)
      .delete()
      .eq('usuario_id', confirmarRemoverAcesso.pessoa.usuario_id)
      .eq('propriedade_id', confirmarRemoverAcesso.acesso.propriedade_id)
    setRemovendo(false)
    if (error) {
      toast.error('Erro ao remover acesso: ' + error.message)
    } else {
      toast.success('Acesso removido.')
      fetchTudo()
    }
    setConfirmarRemoverAcesso(null)
  }

  const handleRemoverConvite = async () => {
    if (!confirmarRemoverConvite) return
    setRemovendo(true)
    try {
      const { error } = await supabase.rpc('remover_membro_equipe' as any, { p_membro_id: confirmarRemoverConvite.membro_id })
      if (error) throw error
      toast.success('Convite revogado.')
      fetchTudo()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover')
    } finally {
      setRemovendo(false)
      setConfirmarRemoverConvite(null)
    }
  }

  const handleCopiar = async () => {
    await navigator.clipboard.writeText(linkGerado)
    setCopiado(true)
    toast.success('Link copiado!')
    setTimeout(() => setCopiado(false), 2000)
  }

  const copiarLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/convite?token=${token}&tipo=existente`)
    toast.success('Link copiado!')
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full overflow-x-hidden">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Todas as pessoas com acesso a qualquer uma das suas propriedades ({propriedadesGerenciaveis.length})
          </p>
        </div>
      </div>

      {!loading && propriedadesGerenciaveis.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">Você não é proprietário nem gerente de nenhuma propriedade</h3>
            <p className="text-sm text-muted-foreground">Só quem é Proprietário ou Gerente pode gerenciar a equipe.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs defaultValue="convidar" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="convidar">
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar pessoa nova
              </TabsTrigger>
              <TabsTrigger value="acesso">
                <Plus className="h-4 w-4 mr-2" />
                Dar acesso a mais uma propriedade
              </TabsTrigger>
            </TabsList>

            <TabsContent value="convidar" className="space-y-4">
              <Card className="max-w-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Convidar Membro
                  </CardTitle>
                  <CardDescription>Para quem ainda não tem conta no sistema — envia um convite por e-mail</CardDescription>
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

                  <div className="space-y-3">
                    <Label>Propriedades (marque uma ou mais — o convidado ganha acesso a todas de uma vez, com um clique só)</Label>
                    <div className="grid gap-2">
                      {propriedadesGerenciaveis.map(p => (
                        <label key={p.propriedade_id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={propriedadesConvite.includes(p.propriedade_id)}
                            onCheckedChange={() => toggleUmaPropriedade(p.propriedade_id)}
                            disabled={gerando}
                          />
                          {p.propriedade_nome}
                        </label>
                      ))}
                    </div>
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

                  <Button
                    className="w-full"
                    onClick={handleConvidar}
                    disabled={gerando || !email.trim() || !papel || propriedadesConvite.length === 0}
                  >
                    {gerando
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
                      : <><Send className="h-4 w-4 mr-2" /> Enviar Convite</>}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="acesso" className="space-y-4">
              <Card className="max-w-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Dar acesso a mais uma propriedade
                  </CardTitle>
                  <CardDescription>Para quem já tem conta — libera acesso imediato a outra propriedade sua, sem novo convite por e-mail</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>E-mail (conta já existente)</Label>
                    <Input
                      type="email"
                      placeholder="nome@email.com"
                      value={emailAcesso}
                      onChange={e => setEmailAcesso(e.target.value)}
                      disabled={salvandoAcesso}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Propriedade</Label>
                    <Select value={propriedadeAcesso} onValueChange={setPropriedadeAcesso} disabled={salvandoAcesso || loading}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {propriedadesGerenciaveis.map(p => (
                          <SelectItem key={p.propriedade_id} value={p.propriedade_id}>{p.propriedade_nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Função</Label>
                    <Select value={papelAcesso} onValueChange={setPapelAcesso} disabled={salvandoAcesso}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {PAPEIS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleDefinirAcesso}
                    disabled={salvandoAcesso || !emailAcesso.trim() || !papelAcesso || !propriedadeAcesso}
                  >
                    {salvandoAcesso ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : 'Conceder acesso'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Tabela universal — uma linha por pessoa, com todas as propriedades que ela acessa */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Equipe
                  </CardTitle>
                  <CardDescription>
                    {equipe.length} pessoa(s) com acesso a alguma das suas propriedades
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTudo} disabled={loading}>
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
              ) : equipe.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground" />
                  <h3 className="font-semibold">Nenhuma pessoa ainda</h3>
                  <p className="text-sm text-muted-foreground">Convide sua equipe usando o formulário acima.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pessoa</TableHead>
                        <TableHead>Propriedades e papéis</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipe.map(pessoa => (
                        <TableRow key={pessoa.usuario_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {getInitials(pessoa.nome, pessoa.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{pessoa.nome || pessoa.email}</p>
                                {pessoa.nome && <p className="text-xs text-muted-foreground truncate">{pessoa.email}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {pessoa.acessos.map(acesso => (
                                <Badge key={acesso.propriedade_id} variant="outline" className="gap-1 pr-1">
                                  {acesso.propriedade_nome} · {papelLabel[acesso.papel] || acesso.papel}
                                  {acesso.papel !== 'proprietario' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 ml-0.5 hover:text-destructive"
                                      title="Remover este acesso"
                                      onClick={() => setConfirmarRemoverAcesso({ pessoa, acesso })}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Convites pendentes (pessoas ainda sem conta) */}
          {convitesPendentes.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Convites Pendentes</CardTitle>
                </div>
                <CardDescription>
                  {convitesPendentes.filter(c => !c.expirado).length} aguardando aceite
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-2 px-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Propriedade</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {convitesPendentes.map(c => (
                        <TableRow key={c.membro_id}>
                          <TableCell>{c.email}</TableCell>
                          <TableCell>{c.propriedade_nome}</TableCell>
                          <TableCell>
                            <Badge className={papelVariant[c.papel] || ''} variant="outline">
                              {papelLabel[c.papel] || c.papel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {c.expirado ? (
                              <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Expirado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                <Clock className="h-3 w-3 mr-1" /> Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {c.token && !c.expirado && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copiarLink(c.token!)}
                                  title="Copiar link"
                                >
                                  <LinkIcon className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmarRemoverConvite(c)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
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

      {/* Confirmar remoção de acesso */}
      <AlertDialog open={!!confirmarRemoverAcesso} onOpenChange={(open) => !open && setConfirmarRemoverAcesso(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarRemoverAcesso?.pessoa.nome || confirmarRemoverAcesso?.pessoa.email} perde o acesso a{' '}
              {confirmarRemoverAcesso?.acesso.propriedade_nome}. Os outros acessos dela não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoverAcesso}
              disabled={removendo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removendo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar revogação de convite */}
      <AlertDialog open={!!confirmarRemoverConvite} onOpenChange={(open) => !open && setConfirmarRemoverConvite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O link enviado para {confirmarRemoverConvite?.email} será invalidado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoverConvite}
              disabled={removendo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removendo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
