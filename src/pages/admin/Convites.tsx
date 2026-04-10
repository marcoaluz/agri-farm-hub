import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Mail, Send, Copy, Check, Loader2, Trash2, Clock, AlertTriangle,
  UserPlus, Link as LinkIcon, RefreshCw,
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
  propriedade_nome: string
  papel: string
  criado_em: string
  expira_em: string
  expirado: boolean
}

const PAPEL_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  proprietario: { label: 'Proprietário', variant: 'default' },
  gerente: { label: 'Gerente', variant: 'default' },
  operador: { label: 'Operador', variant: 'secondary' },
  visualizador: { label: 'Visualizador', variant: 'secondary' },
}

const VALIDADE_OPTIONS = [
  { value: '24', label: '24 horas' },
  { value: '48', label: '48 horas' },
  { value: '72', label: '72 horas' },
  { value: '168', label: '7 dias' },
]

export default function Convites() {
  const { user } = useAuth()

  // Form state
  const [email, setEmail] = useState('')
  const [propriedadeId, setPropriedadeId] = useState('')
  const [papel, setPapel] = useState('')
  const [horas, setHoras] = useState('72')
  const [gerando, setGerando] = useState(false)

  // Link gerado
  const [linkGerado, setLinkGerado] = useState('')
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // Lista
  const [propriedades, setPropriedades] = useState<Propriedade[]>([])
  const [convites, setConvites] = useState<ConvitePendente[]>([])
  const [loadingConvites, setLoadingConvites] = useState(true)
  const [revogando, setRevogando] = useState<string | null>(null)

  // Carregar propriedades
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

  // Carregar convites pendentes
  const fetchConvites = useCallback(async () => {
    setLoadingConvites(true)
    const { data, error } = await supabase.rpc('listar_convites_pendentes' as any)
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

  // Gerar convite
  const handleGerarConvite = async () => {
    if (!email.trim()) { toast.error('Informe o e-mail do convidado.'); return }
    if (!propriedadeId) { toast.error('Selecione uma propriedade.'); return }
    if (!papel) { toast.error('Selecione o papel.'); return }

    setGerando(true)
    try {
      const { data, error } = await supabase.rpc('gerar_convite' as any, {
        p_email: email.trim().toLowerCase(),
        p_propriedade_id: propriedadeId,
        p_papel: papel,
        p_horas_validade: parseInt(horas),
      })

      if (error) throw error

      const result = data as any
      const link = `${window.location.origin}/convite?token=${result.token}`
      setLinkGerado(link)
      setShowLinkDialog(true)
      setCopiado(false)

      // Limpar form
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

  // Copiar link
  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(linkGerado)
      setCopiado(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      toast.error('Erro ao copiar. Selecione e copie manualmente.')
    }
  }

  // Revogar convite
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
        {/* Formulário de novo convite */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5" />
              Novo Convite
            </CardTitle>
            <CardDescription>Gere um link de convite para um novo usuário</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  <SelectItem value="proprietario">Proprietário</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="visualizador">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

        {/* Lista de convites pendentes */}
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
                      <TableHead>Propriedade</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convites.map((c) => {
                      const papelInfo = PAPEL_LABELS[c.papel] || { label: c.papel, variant: 'secondary' as const }
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.email}</TableCell>
                          <TableCell>{c.propriedade_nome}</TableCell>
                          <TableCell>
                            <Badge variant={papelInfo.variant}>{papelInfo.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(c.criado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(c.expira_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {c.expirado ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Expirado
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevogar(c.id)}
                              disabled={revogando === c.id}
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
              <Button onClick={handleCopiar} variant="outline" className="shrink-0">
                {copiado ? (
                  <><Check className="h-4 w-4 mr-1" />Copiado</>
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
