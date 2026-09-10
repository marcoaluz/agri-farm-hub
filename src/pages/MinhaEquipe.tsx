import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Users, UserPlus, Copy, Check, Trash2, Loader2,
  Clock, AlertTriangle, RefreshCw, Send, Link as LinkIcon,
  Shield, X, Plus, ChevronsUpDown, Settings2,
} from 'lucide-react'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DialogFooter } from '@/components/ui/dialog'
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
interface Convite { id?: string; membro_id: string; tipo: string; email: string; email_convite?: string; nome: string | null; papel: string; status: string; adicionado_em: string; criado_em?: string; expira_em: string | null; token_expira_em?: string; expirado: boolean; token: string | null; token_primeiro_acesso?: string; propriedade_id?: string; propriedade_nome?: string }
interface GrupoConvite { token: string; email: string; papel: string; criado_em: string; expira_em: string; expirado: boolean; ids: string[]; propriedades: string[] }


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
  const [conviteEnviadoMsg, setConviteEnviadoMsg] = useState<string | null>(null)

  // Dar acesso a mais uma propriedade (pessoa que já tem conta)
  const [emailAcesso, setEmailAcesso] = useState('')
  const [nomeAcesso, setNomeAcesso] = useState('')
  const [pessoaPickerOpen, setPessoaPickerOpen] = useState(false)
  const [propriedadesAcesso, setPropriedadesAcesso] = useState<string[]>([])
  const [papelAcesso, setPapelAcesso] = useState('')
  const [salvandoAcesso, setSalvandoAcesso] = useState(false)

  // Gerenciar acessos de um membro já existente
  const [gerenciarMembro, setGerenciarMembro] = useState<PessoaEquipe | null>(null)
  const [linhasAcesso, setLinhasAcesso] = useState<Record<string, { rowId: string | null; marcado: boolean; papel: string; original: boolean; papelOriginal: string }>>({})
  const [salvandoGerenciar, setSalvandoGerenciar] = useState(false)

  const [confirmarRemoverAcesso, setConfirmarRemoverAcesso] = useState<{ pessoa: PessoaEquipe; acesso: Acesso } | null>(null)
  const [confirmarRemoverConvite, setConfirmarRemoverConvite] = useState<GrupoConvite | null>(null)

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
      setPropriedadesAcesso(prev => prev.length === 0 ? [propriedadeAtual.id!] : prev)
    }
  }, [propriedadeAtual?.id, propriedadesGerenciaveis])

  const toggleUmaPropriedade = (id: string) => {
    setPropriedadesConvite(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const togglePropriedadeAcesso = (id: string) => {
    setPropriedadesAcesso(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const gerarConvite = async (destEmail: string, propriedadeIds: string[], papelVal: string) => {
    const { data, error } = await supabase.rpc('gerar_convite_equipe' as any, {
      p_email: destEmail.trim().toLowerCase(),
      p_propriedade_ids: propriedadeIds,
      p_papel: papelVal,
      p_horas_validade: parseInt(horas),
    })
    if (error) throw error
    const result = data as any
    const link = `${window.location.origin}/convite?token=${result.token}&tipo=existente`

    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData?.session
    const nomesPropriedades = propriedadeIds
      .map(id => propriedadesGerenciaveis.find(p => p.propriedade_id === id)?.propriedade_nome)
      .filter(Boolean)
    let emailEnviado = false
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-convite-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email: destEmail.trim().toLowerCase(),
            link,
            papel: papelVal,
            propriedades_nomes: nomesPropriedades,
          }),
        },
      )
      emailEnviado = response.ok
    } catch (e) {
      console.warn('Falha ao enviar e-mail de convite', e)
    }

    if (emailEnviado) {
      setConviteEnviadoMsg(`Convite enviado por e-mail para ${destEmail.trim()}!`)
      setTimeout(() => setConviteEnviadoMsg(null), 6000)
    } else {
      setLinkGerado(link)
      setCopiado(false)
      setShowLinkDialog(true)
      toast.warning('Convite criado, mas o e-mail não pôde ser enviado. Compartilhe o link manualmente.')
    }
    fetchTudo()
  }

  const handleConvidar = async () => {
    if (!email.trim() || !papel || propriedadesConvite.length === 0) return
    setGerando(true)
    try {
      await gerarConvite(email, propriedadesConvite, papel)
      setEmail('')
      setPapel('')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar convite')
    } finally {
      setGerando(false)
    }
  }

  const limparFormAcesso = () => {
    setEmailAcesso('')
    setNomeAcesso('')
    setPropriedadesAcesso([])
    setPapelAcesso('')
  }

  const handleDefinirAcesso = async () => {
    if (!emailAcesso.trim() || propriedadesAcesso.length === 0 || !papelAcesso) return
    setSalvandoAcesso(true)
    try {
      const resultados = await Promise.all(
        propriedadesAcesso.map(propId =>
          supabase.rpc('dar_acesso_propriedade_existente' as any, {
            p_propriedade_id: propId,
            p_email: emailAcesso.trim().toLowerCase(),
            p_papel: papelAcesso,
          })
        )
      )
      const comErro = resultados.find(r => r.error)
      if (comErro?.error) {
        toast.error('Erro ao conceder acesso: ' + comErro.error.message)
        return
      }
      const dados = resultados.map(r => r.data as any)
      const encontrada = dados.some(d => d?.encontrado)
      if (encontrada) {
        const concedidas = dados.filter(d => d?.encontrado && !d?.ja_tinha_acesso).length
        const jaTinha = dados.filter(d => d?.ja_tinha_acesso).length
        if (concedidas > 0) {
          toast.success(
            `Acesso concedido a ${concedidas} propriedade(s).` +
            (jaTinha > 0 ? ` ${jaTinha} já tinha(m) acesso.` : '')
          )
        } else {
          toast.info('Essa pessoa já tinha acesso a todas as propriedades marcadas.')
        }
        limparFormAcesso()
        fetchTudo()
        return
      }
      // Pessoa ainda não tem conta: segue o fluxo normal de convite por e-mail
      await gerarConvite(emailAcesso, propriedadesAcesso, papelAcesso)
      limparFormAcesso()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao dar acesso')
    } finally {
      setSalvandoAcesso(false)
    }
  }

  const abrirGerenciar = async (pessoa: PessoaEquipe) => {
    setGerenciarMembro(pessoa)
    const { data } = await supabase
      .from('propriedades_usuarios' as any)
      .select('id, propriedade_id, papel')
      .eq('usuario_id', pessoa.usuario_id)
    const rows = (data as any[]) || []
    const mapa: Record<string, { rowId: string | null; marcado: boolean; papel: string; original: boolean; papelOriginal: string }> = {}
    for (const p of propriedadesGerenciaveis) {
      const row = rows.find(r => r.propriedade_id === p.propriedade_id)
      const acesso = pessoa.acessos.find(a => a.propriedade_id === p.propriedade_id)
      const papelAtual = row?.papel || acesso?.papel || 'operador'
      mapa[p.propriedade_id] = {
        rowId: row?.id ?? null,
        marcado: !!acesso || !!row,
        papel: papelAtual,
        original: !!acesso || !!row,
        papelOriginal: papelAtual,
      }
    }
    setLinhasAcesso(mapa)
  }

  const salvarGerenciar = async () => {
    if (!gerenciarMembro) return
    setSalvandoGerenciar(true)
    try {
      const acoes: Promise<any>[] = []
      for (const [propId, linha] of Object.entries(linhasAcesso)) {
        if (linha.marcado && !linha.original) {
          acoes.push(supabase.rpc('dar_acesso_propriedade_existente' as any, {
            p_propriedade_id: propId,
            p_email: gerenciarMembro.email.toLowerCase(),
            p_papel: linha.papel,
          }))
        } else if (!linha.marcado && linha.original && linha.rowId) {
          acoes.push(supabase.rpc('remover_membro_equipe' as any, { p_membro_id: linha.rowId }))
        } else if (linha.marcado && linha.original && linha.papel !== linha.papelOriginal && linha.rowId) {
          acoes.push(
            supabase.from('propriedades_usuarios' as any).update({ papel: linha.papel }).eq('id', linha.rowId)
          )
        }
      }
      if (acoes.length === 0) {
        setGerenciarMembro(null)
        return
      }
      const resultados = await Promise.all(acoes)
      const erro = resultados.find((r: any) => r?.error)
      if (erro) {
        toast.error('Erro ao salvar: ' + erro.error.message)
        return
      }
      toast.success('Acessos atualizados.')
      setGerenciarMembro(null)
      fetchTudo()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar acessos')
    } finally {
      setSalvandoGerenciar(false)
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
      await Promise.all(
        confirmarRemoverConvite.ids.map(id =>
          supabase.rpc('remover_membro_equipe' as any, { p_membro_id: id })
        )
      )
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

  const convitesAgrupados = useMemo(() => {
    const grupos = new Map<string, GrupoConvite>()
    for (const c of convitesPendentes || []) {
      const chave = c.token_primeiro_acesso || c.token || ''
      if (!chave) continue
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          token: chave,
          email: c.email_convite || c.email || '',
          papel: c.papel,
          criado_em: c.criado_em || c.adicionado_em || '',
          expira_em: c.token_expira_em || c.expira_em || '',
          expirado: c.expirado,
          ids: [],
          propriedades: [],
        })
      }
      const grupo = grupos.get(chave)!
      const id = c.id || c.membro_id
      if (id && !grupo.ids.includes(id)) grupo.ids.push(id)
      if (c.propriedade_nome && !grupo.propriedades.includes(c.propriedade_nome)) {
        grupo.propriedades.push(c.propriedade_nome)
      }
    }
    return Array.from(grupos.values())
  }, [convitesPendentes])


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

                  {conviteEnviadoMsg && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300">
                      {conviteEnviadoMsg}
                    </div>
                  )}
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
                    <Label>Pessoa</Label>
                    <Popover open={pessoaPickerOpen} onOpenChange={setPessoaPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal"
                          disabled={salvandoAcesso}
                        >
                          <span className={nomeAcesso || emailAcesso ? 'truncate' : 'truncate text-muted-foreground'}>
                            {nomeAcesso || emailAcesso || 'Selecione a pessoa'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar pessoa..." />
                          <CommandList>
                            <CommandEmpty>Nenhuma pessoa encontrada</CommandEmpty>
                            <CommandGroup>
                              {equipe.map(p => (
                                <CommandItem
                                  key={p.usuario_id}
                                  value={`${p.nome} ${p.email}`}
                                  onSelect={() => {
                                    setNomeAcesso(p.nome || p.email)
                                    setEmailAcesso(p.email)
                                    setPessoaPickerOpen(false)
                                  }}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm">{p.nome || p.email}</p>
                                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Propriedades</Label>
                    <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                      {propriedadesGerenciaveis.map(p => (
                        <label
                          key={p.propriedade_id}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={propriedadesAcesso.includes(p.propriedade_id)}
                            onCheckedChange={() => togglePropriedadeAcesso(p.propriedade_id)}
                            disabled={salvandoAcesso}
                          />
                          <span className="text-sm truncate">{p.propriedade_nome}</span>
                        </label>
                      ))}
                    </div>
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
                    disabled={salvandoAcesso || !emailAcesso.trim() || !papelAcesso || propriedadesAcesso.length === 0}
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
                        <TableHead className="w-24 text-right">Ações</TableHead>
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
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => abrirGerenciar(pessoa)}>
                              <Settings2 className="h-3.5 w-3.5 mr-1" /> Gerenciar
                            </Button>
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
          {convitesAgrupados.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Convites Pendentes</CardTitle>
                </div>
                <CardDescription>
                  {convitesAgrupados.filter(g => !g.expirado).length} aguardando aceite
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
                      {convitesAgrupados.map(grupo => (
                        <TableRow key={grupo.token}>
                          <TableCell>{grupo.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {grupo.propriedades.map(nome => (
                                <Badge key={nome} variant="outline" className="text-xs">
                                  {nome}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={papelVariant[grupo.papel] || ''} variant="outline">
                              {papelLabel[grupo.papel] || grupo.papel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {grupo.expirado ? (
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
                              {grupo.token && !grupo.expirado && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copiarLink(grupo.token)}
                                  title="Copiar link"
                                >
                                  <LinkIcon className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmarRemoverConvite(grupo)}
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
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Convite criado — e-mail não enviado
            </DialogTitle>
            <DialogDescription>
              Não conseguimos enviar o convite por e-mail automaticamente. Copie o link abaixo e envie manualmente para o membro da sua equipe.
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
            <p className="text-xs text-amber-600 dark:text-amber-400">
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
              O link enviado para {confirmarRemoverConvite?.email} será invalidado para{' '}
              {confirmarRemoverConvite?.propriedades.length === 1
                ? confirmarRemoverConvite.propriedades[0]
                : `${confirmarRemoverConvite?.propriedades.length || 0} propriedades`}.
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

      {/* Gerenciar acessos de um membro */}
      <Dialog open={!!gerenciarMembro} onOpenChange={(open) => !open && setGerenciarMembro(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Acessos de {gerenciarMembro?.nome || gerenciarMembro?.email}</DialogTitle>
            <DialogDescription>
              Marque as propriedades que essa pessoa pode acessar e escolha a função em cada uma.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {propriedadesGerenciaveis.map(p => {
              const linha = linhasAcesso[p.propriedade_id]
              if (!linha) return null
              return (
                <div key={p.propriedade_id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Checkbox
                    checked={linha.marcado}
                    disabled={salvandoGerenciar || linha.papelOriginal === 'proprietario'}
                    onCheckedChange={() => setLinhasAcesso(prev => ({
                      ...prev,
                      [p.propriedade_id]: { ...prev[p.propriedade_id], marcado: !prev[p.propriedade_id].marcado },
                    }))}
                  />
                  <span className="flex-1 truncate text-sm">{p.propriedade_nome}</span>
                  <Select
                    value={linha.papel}
                    disabled={!linha.marcado || salvandoGerenciar || linha.papelOriginal === 'proprietario'}
                    onValueChange={(v) => setLinhasAcesso(prev => ({
                      ...prev,
                      [p.propriedade_id]: { ...prev[p.propriedade_id], papel: v },
                    }))}
                  >
                    <SelectTrigger className="w-36"><SelectValue placeholder="Função" /></SelectTrigger>
                    <SelectContent>
                      {PAPEIS.map(pp => (
                        <SelectItem key={pp.value} value={pp.value}>{pp.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGerenciarMembro(null)} disabled={salvandoGerenciar}>Cancelar</Button>
            <Button onClick={salvarGerenciar} disabled={salvandoGerenciar}>
              {salvandoGerenciar ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
