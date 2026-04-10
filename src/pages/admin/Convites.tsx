import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Mail, Send, Copy, Check, Loader2, Trash2, Clock, AlertTriangle,
  UserPlus, Link as LinkIcon, RefreshCw, Info, Building2, User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

interface Propriedade {
  id: string
  nome: string
}

interface ConvitePendente {
  id: string
  email: string
  propriedade_nome: string | null
  papel: string | null
  tipo: string
  criado_em: string
  expira_em: string
  expirado: boolean
  status?: string
}

type TipoConvite = 'novo_proprietario' | 'acesso_propriedade'

const PAPEL_OPTIONS: Record<string, { label: string; desc: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  proprietario: { label: 'Proprietário', desc: 'Acesso total, pode gerenciar usuários', variant: 'default' },
  gerente: { label: 'Gerente', desc: 'Pode criar e editar registros', variant: 'default' },
  operador: { label: 'Operador', desc: 'Pode registrar operações do dia a dia', variant: 'secondary' },
  visualizador: { label: 'Visualizador', desc: 'Somente leitura', variant: 'secondary' },
}

const VALIDADE_OPTIONS = [
  { value: '24', label: '24 horas' },
  { value: '48', label: '48 horas' },
  { value: '72', label: '72 horas' },
  { value: '168', label: '7 dias' },
]

export default function Convites() {
  const { user } = useAuth()

  const [tipoConvite, setTipoConvite] = useState<TipoConvite>('acesso_propriedade')
  const [email, setEmail] = useState('')
  const [propriedadeId, setPropriedadeId] = useState('')
  const [papel, setPapel] = useState('')
  const [horas, setHoras] = useState('72')
  const [gerando, setGerando] = useState(false)

  const [linkGerado, setLinkGerado] = useState('')
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const [propriedades, setPropriedades] = useState<Propriedade[]>([])
  const [convites, setConvites] = useState<ConvitePendente[]>([])
  const [loadingConvites, setLoadingConvites] = useState(true)
  const [revogando, setRevogando] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPropriedades() {
      const { data } = await supabase
        .from('propriedades' as any)
        .select('id, nome')
        .eq('ativo', true)
        .order('nome')
      if (data) setPropriedades(data as any)
    }
    fetchPropriedades()
  }, [])

  const fetchConvites = useCallback(async () => {
    setLoadingConvites(true)
    const { data, error } = await supabase.rpc('listar_todos_convites_pendentes' as any)
    if (error) {
      toast.error('Erro ao carregar convites: ' + error.message)
    } else {
      setConvites((data || []) as ConvitePendente[])
    }
    setLoadingConvites(false)
  }, [])

  useEffect(() => {
    fetchConvites()
  }, [fetchConvites])

  const handleTrocarTipo = (tipo: TipoConvite) => {
    setTipoConvite(tipo)
    setEmail('')
    setPropriedadeId('')
    setPapel('')
    setHoras('72')
  }

  const handleGerarConvite = async () => {
    if (!email.trim()) { toast.error('Informe o e-mail do convidado.'); return }

    if (tipoConvite === 'acesso_propriedade') {
      if (!propriedadeId) { toast.error('Selecione uma propriedade.'); return }
      if (!papel) { toast.error('Selecione o papel.'); return }
    }

    setGerando(true)
    try {
      let link = ''

      if (tipoConvite === 'novo_proprietario') {
        const { data, error } = await supabase.rpc('gerar_convite_novo_usuario' as any, {
          p_email: email.trim().toLowerCase(),
          p_horas_validade: parseInt(horas),
        })
        if (error) throw error
        const result = data as any
        link = `${window.location.origin}/convite?token=${result.token}&tipo=novo`
      } else {
        const { data, error } = await supabase.rpc('gerar_convite' as any, {
          p_email: email.trim().toLowerCase(),
          p_propriedade_id: propriedadeId,
          p_papel: papel,
          p_horas_validade: parseInt(horas),
        })
        if (error) throw error
        const result = data as any
        link = `${window.location.origin}/convite?token=${result.token}&tipo=existente`
      }

      setLinkGerado(link)
      setShowLinkDialog(true)
      setCopiado(false)

      setEmail('')
      setPapel('')
      setPropriedadeId('')
      setHoras('72')

      toast.success('Convite gerado com sucesso!')
      fetchConvites()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar convite')
    } finally {
      setGerando(false)
    }
  }

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(linkGerado)
      setCopiado(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('Erro ao copiar. Selecione e copie manualmente.')
    }
  }

  const handleRevogar = async (conviteId: string) => {
    setRevogando(conviteId)
    try {
      const { error } = await supabase.rpc('revogar_convite' as any, { p_convite_id: conviteId })
      if (error) throw error
      toast.success('Convite revogado.')
      fetchConvites()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao revogar convite')
    } finally {
      setRevogando(null)
    }
  }

  const papelSelecionado = papel ? PAPEL_OPTIONS[papel] : null

  const getStatusBadge = (c: ConvitePendente) => {
    if (c.status === 'ativo') {
      return (
        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-600">
          <Check className="h-3 w-3" />
          Aceito
        </Badge>
      )
    }
    if (c.expirado) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expirado
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400">
        <Clock className="h-3 w-3" />
        Pendente
      </Badge>
    )
  }

  const getTipoBadge = (c: ConvitePendente) => {
    if (c.tipo === 'novo_proprietario') {
      return (
        <Badge variant="outline" className="gap-1 border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400">
          <UserPlus className="h-3 w-3" />
          Novo proprietário
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400">
        <Building2 className="h-3 w-3" />
        Acesso: {c.propriedade_nome || '—'}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserPlus className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Convites</h1>
          <p className="text-sm text-muted-foreground">Convide novos usuários para acessar o sistema</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulário */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5" />
              Novo Convite
            </CardTitle>
            <CardDescription>Gere um link de convite para um novo usuário</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seletor de tipo */}
            <div className="space-y-2">
              <Label>Tipo de convite</Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleTrocarTipo('novo_proprietario')}
                  disabled={gerando}
                  className={`flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                    tipoConvite === 'novo_proprietario'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30'
                  } ${gerando ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    tipoConvite === 'novo_proprietario' ? 'border-primary' : 'border-muted-foreground/40'
                  }`}>
                    {tipoConvite === 'novo_proprietario' && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">Novo proprietário</p>
                    <p className="text-xs text-muted-foreground">Pessoa vai criar a própria fazenda após se cadastrar</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTrocarTipo('acesso_propriedade')}
                  disabled={gerando}
                  className={`flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                    tipoConvite === 'acesso_propriedade'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30'
                  } ${gerando ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    tipoConvite === 'acesso_propriedade' ? 'border-primary' : 'border-muted-foreground/40'
                  }`}>
                    {tipoConvite === 'acesso_propriedade' && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">Acesso a propriedade</p>
                    <p className="text-xs text-muted-foreground">Dar acesso a uma fazenda já cadastrada no sistema</p>
                  </div>
                </button>
              </div>
            </div>

            <Separator />

            {/* E-mail */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail do convidado</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={gerando}
                />
              </div>
            </div>

            {/* Campos exclusivos de Tipo B */}
            {tipoConvite === 'acesso_propriedade' && (
              <>
                <div className="space-y-2">
                  <Label>Propriedade</Label>
                  <Select value={propriedadeId} onValueChange={setPropriedadeId} disabled={gerando}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a propriedade" />
                    </SelectTrigger>
                    <SelectContent>
                      {propriedades.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={papel} onValueChange={setPapel} disabled={gerando}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAPEL_OPTIONS).map(([key, opt]) => (
                        <SelectItem key={key} value={key}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {papelSelecionado && (
                    <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{papelSelecionado.desc}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Validade */}
            <div className="space-y-2">
              <Label>Validade</Label>
              <Select value={horas} onValueChange={setHoras} disabled={gerando}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALIDADE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGerarConvite} disabled={gerando} className="w-full">
              {gerando ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Gerar Convite</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Convites Pendentes
                </CardTitle>
                <CardDescription>Convites aguardando aceite</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchConvites} disabled={loadingConvites}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingConvites ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingConvites ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : convites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Nenhum convite pendente</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convites.map((c) => {
                      const papelInfo = c.papel ? (PAPEL_OPTIONS[c.papel] || { label: c.papel, variant: 'secondary' as const }) : null
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.email}</TableCell>
                          <TableCell>{getTipoBadge(c)}</TableCell>
                          <TableCell>
                            {papelInfo ? (
                              <Badge variant={papelInfo.variant}>{papelInfo.label}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(c.criado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(c.expira_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>{getStatusBadge(c)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevogar(c.id)}
                              disabled={revogando === c.id || c.status === 'ativo'}
                              className="text-destructive hover:text-destructive"
                            >
                              {revogando === c.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog do link gerado */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Convite Gerado!
            </DialogTitle>
            <DialogDescription>
              Envie o link abaixo para o convidado. Ele poderá criar sua conta através dele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={linkGerado}
                readOnly
                className="font-mono text-sm"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button onClick={handleCopiar} variant="outline" className="shrink-0 min-w-[100px]">
                {copiado ? (
                  <><Check className="h-4 w-4 mr-1 text-green-600" />Copiado!</>
                ) : (
                  <><Copy className="h-4 w-4 mr-1" />Copiar</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ Este link é de uso único. Após o convite ser aceito, ele será automaticamente invalidado.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
