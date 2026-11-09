import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  LifeBuoy, Plus, Search, ArrowLeft, Send, Paperclip, Loader2, FileText,
  Image as ImageIcon, X as XIcon, Headset, MessageSquare,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { usePapelUsuario } from '@/hooks/usePapelUsuario'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  type ChamadoResumo, type ChamadoMensagem, type ChamadoAnexo, type ChamadoStatus, type ChamadoTipo, type ChamadoPrioridade,
  STATUS_LABEL, STATUS_CLASSE, TIPO_LABEL, PRIORIDADE_LABEL, PRIORIDADE_CLASSE,
  ANEXO_ACEITOS, ANEXO_MAX_BYTES, enviarAnexoChamado, abrirAnexoChamado, formatarTamanho,
} from '@/lib/chamados'

const db = supabase as any
type FiltroStatus = 'abertos' | ChamadoStatus | 'todos'

const dataHora = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
const haQuanto = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })

function StatusBadge({ status }: { status: ChamadoStatus }) {
  return <Badge variant="outline" className={cn('font-medium', STATUS_CLASSE[status])}>{STATUS_LABEL[status]}</Badge>
}

/** Arquivos escolhidos, ainda não enviados. */
function ListaArquivos({ arquivos, onRemover }: { arquivos: File[]; onRemover: (i: number) => void }) {
  if (!arquivos.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {arquivos.map((f, i) => (
        <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs">
          {f.type.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          <span className="max-w-[160px] truncate">{f.name}</span>
          <span className="text-muted-foreground">{formatarTamanho(f.size)}</span>
          <button type="button" onClick={() => onRemover(i)} className="ml-0.5 text-muted-foreground hover:text-foreground" title="Remover">
            <XIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

function escolherArquivos(lista: FileList | null, atuais: File[]): File[] {
  const novos = Array.from(lista || [])
  const grandes = novos.filter((f) => f.size > ANEXO_MAX_BYTES)
  if (grandes.length) toast.error(`Arquivo acima de 10 MB não é aceito: ${grandes.map((f) => f.name).join(', ')}`)
  return [...atuais, ...novos.filter((f) => f.size <= ANEXO_MAX_BYTES)].slice(0, 5)
}

/* ════════════════════════════════════════════════
   PÁGINA
   ════════════════════════════════════════════════ */
export default function Chamados() {
  const { propriedadeAtual } = useGlobal()
  const { isAdmin } = usePapelUsuario()
  const [params, setParams] = useSearchParams()
  const selecionadoId = params.get('id')
  const [filtro, setFiltro] = useState<FiltroStatus>('abertos')
  const [busca, setBusca] = useState('')
  const [escopoTodas, setEscopoTodas] = useState(true) // admin: todas as propriedades
  const [novoAberto, setNovoAberto] = useState(false)

  const propFiltro = isAdmin && escopoTodas ? null : (propriedadeAtual?.id ?? null)
  const podeListar = isAdmin || !!propriedadeAtual?.id

  const listaQ = useQuery({
    queryKey: ['chamados', propFiltro],
    queryFn: async () => {
      const { data, error } = await db.rpc('listar_chamados', { p_propriedade_id: propFiltro })
      if (error) throw error
      return (data || []) as ChamadoResumo[]
    },
    enabled: podeListar,
    refetchInterval: 30_000,
  })
  const chamados = listaQ.data || []

  const contagem = useMemo(() => ({
    abertos: chamados.filter((c) => c.status !== 'finalizado').length,
    pendente: chamados.filter((c) => c.status === 'pendente').length,
    em_andamento: chamados.filter((c) => c.status === 'em_andamento').length,
    finalizado: chamados.filter((c) => c.status === 'finalizado').length,
    todos: chamados.length,
  }), [chamados])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return chamados.filter((c) => {
      if (filtro === 'abertos' && c.status === 'finalizado') return false
      if (filtro !== 'abertos' && filtro !== 'todos' && c.status !== filtro) return false
      if (!termo) return true
      return c.assunto.toLowerCase().includes(termo) || String(c.numero) === termo.replace('#', '')
        || c.propriedade_nome.toLowerCase().includes(termo)
    })
  }, [chamados, filtro, busca])

  const selecionado = chamados.find((c) => c.id === selecionadoId) || null
  const abrir = (id: string | null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('id', id); else p.delete('id')
    setParams(p, { replace: !id })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="h-7 w-7 text-primary" /> Chamados
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? 'Canal de suporte de todas as propriedades. Você responde como Suporte Agro GFI.'
              : `Fale com o suporte do Agro GFI${propriedadeAtual ? ` · ${propriedadeAtual.nome}` : ''}. Todos da propriedade acompanham os chamados.`}
          </p>
        </div>
        <Button onClick={() => setNovoAberto(true)} disabled={!propriedadeAtual?.id} title={!propriedadeAtual?.id ? 'Selecione uma propriedade no topo' : undefined}>
          <Plus className="h-4 w-4 mr-1" /> Novo chamado
        </Button>
      </div>

      {!podeListar ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione uma propriedade no topo para ver os chamados.</CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          {/* Lista */}
          <div className={cn('space-y-3', selecionado && 'hidden lg:block')}>
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroStatus)}>
              <TabsList className="w-full grid grid-cols-4 h-auto">
                <TabsTrigger value="abertos" className="text-xs px-1">Abertos ({contagem.abertos})</TabsTrigger>
                <TabsTrigger value="pendente" className="text-xs px-1">Pendente ({contagem.pendente})</TabsTrigger>
                <TabsTrigger value="em_andamento" className="text-xs px-1">Andamento ({contagem.em_andamento})</TabsTrigger>
                <TabsTrigger value="finalizado" className="text-xs px-1">Finalizados ({contagem.finalizado})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar assunto ou nº" className="pl-8" />
              </div>
              {isAdmin && (
                <Select value={escopoTodas ? 'todas' : 'atual'} onValueChange={(v) => setEscopoTodas(v === 'todas')}>
                  <SelectTrigger className="w-[130px] shrink-0" title="Quais propriedades mostrar"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="atual" disabled={!propriedadeAtual}>Só a atual</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {listaQ.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : visiveis.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                {chamados.length === 0 ? 'Nenhum chamado ainda. Use “Novo chamado” para falar com o suporte.' : 'Nenhum chamado neste filtro.'}
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {visiveis.map((c) => {
                  const aguardandoSuporte = c.status !== 'finalizado' && c.ultima_do_suporte === false
                  return (
                    <button
                      key={c.id}
                      onClick={() => abrir(c.id)}
                      className={cn(
                        'w-full text-left rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50',
                        c.id === selecionadoId && 'border-primary ring-1 ring-primary',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-muted-foreground">#{c.numero}{isAdmin && escopoTodas ? ` · ${c.propriedade_nome}` : ''}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="mt-1 font-medium leading-snug line-clamp-2">{c.assunto}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{TIPO_LABEL[c.tipo]}</span>
                        <span>·</span>
                        <span className={PRIORIDADE_CLASSE[c.prioridade]}>Prioridade {PRIORIDADE_LABEL[c.prioridade].toLowerCase()}</span>
                        <span>·</span>
                        <span>{haQuanto(c.ultima_atividade_em)}</span>
                      </div>
                      {isAdmin && aguardandoSuporte && (
                        <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">Aguardando resposta do suporte</p>
                      )}
                      {!isAdmin && c.status !== 'finalizado' && c.ultima_do_suporte === true && (
                        <p className="mt-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">Suporte respondeu</p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Conversa */}
          <div className={cn(!selecionado && 'hidden lg:block')}>
            {selecionado ? (
              <ConversaChamado key={selecionado.id} chamado={selecionado} ehAdmin={isAdmin} onVoltar={() => abrir(null)} />
            ) : (
              <Card className="h-full min-h-[320px]">
                <CardContent className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <MessageSquare className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Escolha um chamado na lista para ver a conversa.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {propriedadeAtual && (
        <NovoChamadoDialog
          open={novoAberto}
          onOpenChange={setNovoAberto}
          propriedadeId={propriedadeAtual.id}
          propriedadeNome={propriedadeAtual.nome}
          onCriado={(id) => { setFiltro('abertos'); abrir(id) }}
        />
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   CONVERSA
   ════════════════════════════════════════════════ */
function ConversaChamado({ chamado, ehAdmin, onVoltar }: { chamado: ChamadoResumo; ehAdmin: boolean; onVoltar: () => void }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [salvandoCampo, setSalvandoCampo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  const msgsQ = useQuery({
    queryKey: ['chamado-mensagens', chamado.id],
    queryFn: async () => {
      const { data, error } = await db.rpc('listar_mensagens_chamado', { p_chamado_id: chamado.id })
      if (error) throw error
      return (data || []) as ChamadoMensagem[]
    },
    refetchInterval: 15_000,
  })
  const anexosQ = useQuery({
    queryKey: ['chamado-anexos', chamado.id],
    queryFn: async () => {
      const { data, error } = await db.from('chamado_anexos').select('*').eq('chamado_id', chamado.id).order('created_at')
      if (error) throw error
      return (data || []) as ChamadoAnexo[]
    },
    refetchInterval: 15_000,
  })
  const mensagens = msgsQ.data || []
  const anexosPorMensagem = useMemo(() => {
    const m = new Map<string, ChamadoAnexo[]>()
    for (const a of anexosQ.data || []) {
      const k = a.mensagem_id || '_sem'
      m.set(k, [...(m.get(k) || []), a])
    }
    return m
  }, [anexosQ.data])

  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }) }, [mensagens.length])

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ['chamado-mensagens', chamado.id] })
    qc.invalidateQueries({ queryKey: ['chamado-anexos', chamado.id] })
    qc.invalidateQueries({ queryKey: ['chamados'] })
  }

  const enviar = async () => {
    const t = texto.trim()
    if (!t && arquivos.length === 0) return
    setEnviando(true)
    try {
      const { data: msg, error } = await db.from('chamado_mensagens')
        .insert({ chamado_id: chamado.id, texto: t || '(anexo)' })
        .select('id').single()
      if (error) throw error
      const falhas: string[] = []
      for (const file of arquivos) {
        const r = await enviarAnexoChamado({ file, chamadoId: chamado.id, propriedadeId: chamado.propriedade_id, mensagemId: msg.id })
        if (!r.ok && r.error) falhas.push(r.error)
      }
      if (falhas.length) toast.error(`Mensagem enviada, mas houve erro em anexo: ${falhas.join('; ')}`)
      setTexto(''); setArquivos([])
      recarregar()
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível enviar a mensagem')
    } finally {
      setEnviando(false)
    }
  }

  const atualizarCampo = async (campo: 'status' | 'tipo' | 'prioridade', valor: string) => {
    setSalvandoCampo(true)
    const { error } = await db.from('chamados').update({ [campo]: valor }).eq('id', chamado.id)
    setSalvandoCampo(false)
    if (error) { toast.error(error.message || 'Não foi possível atualizar'); return }
    toast.success(campo === 'status' ? `Status: ${STATUS_LABEL[valor as ChamadoStatus]}` : 'Chamado atualizado')
    recarregar()
  }

  const ChipsAnexos = ({ lista }: { lista?: ChamadoAnexo[] }) => !lista?.length ? null : (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {lista.map((a) => (
        <button
          key={a.id} type="button"
          onClick={() => abrirAnexoChamado(a.storage_path).catch((e) => toast.error(e?.message || 'Erro ao abrir anexo'))}
          className="inline-flex items-center gap-1 rounded-md border bg-background/80 px-2 py-1 text-xs hover:bg-muted"
          title="Abrir anexo"
        >
          {a.mime_type?.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          <span className="max-w-[180px] truncate">{a.nome_arquivo}</span>
          <span className="text-muted-foreground">{formatarTamanho(a.tamanho_bytes)}</span>
        </button>
      ))}
    </div>
  )

  return (
    <Card className="flex flex-col h-[calc(100vh-12rem)] min-h-[480px]">
      {/* Cabeçalho */}
      <div className="border-b p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" className="lg:hidden -ml-2 shrink-0" onClick={onVoltar} title="Voltar à lista">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Chamado #{chamado.numero} · {chamado.propriedade_nome}</p>
            <h2 className="text-lg font-semibold leading-snug break-words">{chamado.assunto}</h2>
            <p className="text-xs text-muted-foreground">Aberto por {chamado.criado_por_nome} em {dataHora(chamado.created_at)}</p>
          </div>
          {!ehAdmin && <StatusBadge status={chamado.status} />}
        </div>
        {ehAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={chamado.status} onValueChange={(v) => atualizarCampo('status', v)} disabled={salvandoCampo}>
              <SelectTrigger className={cn('h-8 w-[150px] border', STATUS_CLASSE[chamado.status])}><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as ChamadoStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={chamado.tipo} onValueChange={(v) => atualizarCampo('tipo', v)} disabled={salvandoCampo}>
              <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABEL) as ChamadoTipo[]).map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={chamado.prioridade} onValueChange={(v) => atualizarCampo('prioridade', v)} disabled={salvandoCampo}>
              <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORIDADE_LABEL) as ChamadoPrioridade[]).map((p) => <SelectItem key={p} value={p}>Prioridade {PRIORIDADE_LABEL[p].toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>Tipo: {TIPO_LABEL[chamado.tipo]}</span>
            <span className={PRIORIDADE_CLASSE[chamado.prioridade]}>Prioridade: {PRIORIDADE_LABEL[chamado.prioridade]}</span>
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {msgsQ.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        <ChipsAnexos lista={anexosPorMensagem.get('_sem')} />
        {mensagens.map((m) => m.sistema ? (
          <div key={m.id} className="flex justify-center">
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {m.texto} · {format(new Date(m.created_at), 'dd/MM HH:mm')}
            </span>
          </div>
        ) : (
          <div key={m.id} className={cn('flex', m.do_suporte ? 'justify-start' : 'justify-end')}>
            <div className={cn(
              'max-w-[85%] rounded-lg border px-3 py-2 shadow-sm',
              m.do_suporte ? 'bg-primary/10 border-primary/30' : 'bg-card',
            )}>
              <p className="flex items-center gap-1 text-xs font-semibold">
                {m.do_suporte && <Headset className="h-3.5 w-3.5 text-primary" />}
                {m.autor_nome}
                <span className="font-normal text-muted-foreground">· {dataHora(m.created_at)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.texto}</p>
              <ChipsAnexos lista={anexosPorMensagem.get(m.id)} />
            </div>
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      {/* Escrever */}
      <div className="border-t p-3 space-y-2">
        {chamado.status === 'finalizado' && !ehAdmin && (
          <p className="text-xs text-muted-foreground">Este chamado foi finalizado. Se você escrever, ele será reaberto.</p>
        )}
        <ListaArquivos arquivos={arquivos} onRemover={(i) => setArquivos((a) => a.filter((_, j) => j !== i))} />
        <div className="flex items-end gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void enviar() } }}
            placeholder={ehAdmin ? 'Responder como Suporte Agro GFI…' : 'Escreva sua mensagem…'}
            rows={2}
            maxLength={5000}
            className="min-h-[44px] resize-none"
          />
          <input
            ref={fileRef} type="file" multiple accept={ANEXO_ACEITOS} className="hidden"
            onChange={(e) => { setArquivos((a) => escolherArquivos(e.target.files, a)); if (fileRef.current) fileRef.current.value = '' }}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => fileRef.current?.click()} title="Anexar print ou foto (até 10 MB)" disabled={enviando}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button type="button" onClick={() => void enviar()} disabled={enviando || (!texto.trim() && arquivos.length === 0)}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Enviar</span>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Ctrl+Enter envia · imagens ou PDF até 10 MB</p>
      </div>
    </Card>
  )
}

/* ════════════════════════════════════════════════
   NOVO CHAMADO
   ════════════════════════════════════════════════ */
function NovoChamadoDialog({ open, onOpenChange, propriedadeId, propriedadeNome, onCriado }: {
  open: boolean; onOpenChange: (v: boolean) => void; propriedadeId: string; propriedadeNome: string; onCriado: (id: string) => void
}) {
  const qc = useQueryClient()
  const [assunto, setAssunto] = useState('')
  const [tipo, setTipo] = useState<ChamadoTipo>('duvida')
  const [prioridade, setPrioridade] = useState<ChamadoPrioridade>('normal')
  const [descricao, setDescricao] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { setAssunto(''); setTipo('duvida'); setPrioridade('normal'); setDescricao(''); setArquivos([]) }
  }, [open])

  const valido = assunto.trim().length >= 3 && descricao.trim().length >= 1

  const salvar = async () => {
    if (!valido) return
    setSalvando(true)
    try {
      const { data: id, error } = await db.rpc('abrir_chamado', {
        p_propriedade_id: propriedadeId, p_assunto: assunto.trim(), p_tipo: tipo, p_prioridade: prioridade, p_texto: descricao.trim(),
      })
      if (error) throw error
      if (arquivos.length) {
        const { data: primeira } = await db.from('chamado_mensagens').select('id').eq('chamado_id', id).eq('sistema', false)
          .order('created_at').limit(1).maybeSingle()
        const falhas: string[] = []
        for (const file of arquivos) {
          const r = await enviarAnexoChamado({ file, chamadoId: id, propriedadeId, mensagemId: primeira?.id ?? null })
          if (!r.ok && r.error) falhas.push(r.error)
        }
        if (falhas.length) toast.error(`Chamado aberto, mas houve erro em anexo: ${falhas.join('; ')}`)
      }
      toast.success('Chamado aberto. O suporte foi avisado.')
      qc.invalidateQueries({ queryKey: ['chamados'] })
      onOpenChange(false)
      onCriado(id)
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível abrir o chamado')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo chamado</DialogTitle>
          <DialogDescription>Propriedade: {propriedadeNome}. Todos da propriedade poderão acompanhar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="assunto">Assunto *</Label>
            <Input id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={150} placeholder="Ex.: Relatório de estoque não abre" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as ChamadoTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_LABEL) as ChamadoTipo[]).map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as ChamadoPrioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORIDADE_LABEL) as ChamadoPrioridade[]).map((p) => <SelectItem key={p} value={p}>{PRIORIDADE_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descreva o que aconteceu *</Label>
            <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={5} maxLength={5000}
              placeholder="O que você estava fazendo, o que esperava e o que apareceu na tela." />
          </div>
          <div className="space-y-1.5">
            <input ref={fileRef} type="file" multiple accept={ANEXO_ACEITOS} className="hidden"
              onChange={(e) => { setArquivos((a) => escolherArquivos(e.target.files, a)); if (fileRef.current) fileRef.current.value = '' }} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-1" /> Anexar print ou foto
            </Button>
            <ListaArquivos arquivos={arquivos} onRemover={(i) => setArquivos((a) => a.filter((_, j) => j !== i))} />
            <p className="text-xs text-muted-foreground">Imagens ou PDF, até 10 MB cada (máximo 5).</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={!valido || salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Abrir chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
