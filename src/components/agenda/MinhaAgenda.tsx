import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, differenceInCalendarDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ChevronLeft, ChevronRight, Plus, Loader2, Trash2, MapPin, Bell, Pencil, Users, X, Check, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface AgendaConvidado {
  id: string
  evento_id: string
  usuario_id: string | null
  email: string
  status: 'pendente' | 'aceito' | 'recusado'
  created_at: string
}

export interface AgendaEvento {
  id: string
  usuario_id: string
  propriedade_id: string | null
  titulo: string
  descricao: string | null
  local: string | null
  inicio: string
  fim: string | null
  dia_inteiro: boolean
  lembrete_minutos: number | null
  lembrete_enviado_em: string | null
  created_at: string
  // RLS: o dono recebe todos os convidados; o convidado recebe só a própria linha.
  agenda_convidados?: AgendaConvidado[]
}

const STATUS_CONVITE: Record<AgendaConvidado['status'], { l: string; className: string }> = {
  pendente: { l: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  aceito: { l: 'Aceito', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  recusado: { l: 'Recusado', className: 'bg-rose-100 text-rose-800 border-rose-200' },
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
// Mesmo limite validado na edge function enviar-agenda-email.
const MAX_CONVIDADOS = 10

interface ResultadoConvite {
  convidado_id: string
  interno: boolean
  notificacao: string | null
  email: { enviado: boolean; erro?: string; destinatario_original: string }
}

/** Mensagem de erro de uma edge function (o corpo JSON vem em error.context). */
async function mensagemErroFuncao(error: any): Promise<string> {
  try {
    const corpo = await error?.context?.json?.()
    if (corpo?.error) return String(corpo.error)
  } catch { /* corpo não-JSON */ }
  return error?.message ?? 'erro desconhecido'
}

const LEMBRETES = [
  { v: 'none', l: 'Sem lembrete' },
  { v: '15', l: '15 minutos antes' },
  { v: '60', l: '1 hora antes' },
  { v: '1440', l: '1 dia antes' },
]

function rotuloLembrete(min: number | null) {
  if (min == null) return null
  return LEMBRETES.find(l => l.v === String(min))?.l ?? `${min} min antes`
}

function horarioEvento(ev: AgendaEvento) {
  if (ev.dia_inteiro) return 'Dia inteiro'
  const ini = format(parseISO(ev.inicio), 'HH:mm')
  return ev.fim ? `${ini} – ${format(parseISO(ev.fim), 'HH:mm')}` : ini
}

// Limite de dias em que um evento longo é "espalhado" no calendário do mês.
const MAX_DIAS_EVENTO = 62

export function MinhaAgenda() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<Date>(new Date())
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<AgendaEvento | null>(null)
  const [paraExcluir, setParaExcluir] = useState<AgendaEvento | null>(null)
  const [saving, setSaving] = useState(false)
  const [convidados, setConvidados] = useState<string[]>([])
  const [emailConvite, setEmailConvite] = useState('')
  const [respondendo, setRespondendo] = useState<string | null>(null)

  const souDono = (ev: AgendaEvento) => ev.usuario_id === user?.id
  const meuConvite = (ev: AgendaEvento) =>
    souDono(ev) ? undefined : ev.agenda_convidados?.find(c => c.usuario_id === user?.id)

  const formVazio = (dia: Date) => {
    const key = format(dia, 'yyyy-MM-dd')
    return {
      titulo: '',
      descricao: '',
      local: '',
      dia_inteiro: false,
      data_inicio: key,
      hora_inicio: '09:00',
      data_fim: key,
      hora_fim: '10:00',
      lembrete: '15',
    }
  }
  const [form, setForm] = useState(formVazio(new Date()))

  const inicioMes = useMemo(() => startOfMonth(mesAtual), [mesAtual])
  const fimMes = useMemo(() => endOfMonth(mesAtual), [mesAtual])

  const dias = useMemo(() => {
    const start = startOfWeek(inicioMes, { weekStartsOn: 0 })
    const end = endOfWeek(fimMes, { weekStartsOn: 0 })
    const arr: Date[] = []
    let d = start
    while (d <= end) {
      arr.push(d)
      d = addDays(d, 1)
    }
    return arr
  }, [inicioMes, fimMes])

  // Janela visível (inclui os dias de outros meses que aparecem na grade)
  const janelaInicio = dias[0]
  const janelaFim = addDays(dias[dias.length - 1], 1)

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['agenda-eventos', user?.id, format(janelaInicio, 'yyyy-MM-dd')],
    queryFn: async () => {
      const iniIso = janelaInicio.toISOString()
      const { data, error } = await supabase
        .from('agenda_eventos' as any)
        .select('*, agenda_convidados(id, evento_id, usuario_id, email, status, created_at)')
        .lt('inicio', janelaFim.toISOString())
        .or(`fim.gte."${iniIso}",inicio.gte."${iniIso}"`)
        .order('inicio')
      if (error) throw error
      return (data ?? []) as unknown as AgendaEvento[]
    },
    enabled: !!user?.id,
  })

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, AgendaEvento[]>()
    for (const ev of eventos) {
      const ini = startOfDay(parseISO(ev.inicio))
      const fim = ev.fim ? startOfDay(parseISO(ev.fim)) : ini
      const total = Math.min(Math.max(differenceInCalendarDays(fim, ini), 0), MAX_DIAS_EVENTO)
      for (let i = 0; i <= total; i++) {
        const key = format(addDays(ini, i), 'yyyy-MM-dd')
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(ev)
      }
    }
    return map
  }, [eventos])

  const eventosDoDia = eventosPorDia.get(format(diaSelecionado, 'yyyy-MM-dd')) ?? []

  function abrirNovo(dia: Date = diaSelecionado) {
    setEditando(null)
    setForm(formVazio(dia))
    setConvidados([])
    setEmailConvite('')
    setFormOpen(true)
  }

  function adicionarConvidado() {
    const email = emailConvite.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) {
      toast.error('E-mail inválido')
      return
    }
    if (email === (user?.email ?? '').toLowerCase()) {
      toast.error('Você não pode convidar a si mesmo')
      return
    }
    if (!convidados.includes(email)) setConvidados([...convidados, email])
    setEmailConvite('')
  }

  async function responderConvite(convite: AgendaConvidado, status: 'aceito' | 'recusado') {
    setRespondendo(convite.id)
    const { data, error } = await supabase
      .from('agenda_convidados' as any)
      .update({ status })
      .eq('id', convite.id)
      .select('id')
    setRespondendo(null)
    if (error) {
      toast.error('Erro ao responder o convite: ' + error.message)
      return
    }
    if (!data || (data as any[]).length === 0) {
      toast.error('Convite não encontrado.')
      return
    }
    toast.success(status === 'aceito' ? 'Convite aceito' : 'Convite recusado')
    invalidar()
  }

  function abrirEdicao(ev: AgendaEvento) {
    // Evento de outra pessoa (convite): só o dono edita.
    if (!souDono(ev)) return
    setConvidados((ev.agenda_convidados ?? []).map(c => c.email))
    setEmailConvite('')
    const ini = parseISO(ev.inicio)
    const fim = ev.fim ? parseISO(ev.fim) : ini
    setEditando(ev)
    setForm({
      titulo: ev.titulo,
      descricao: ev.descricao ?? '',
      local: ev.local ?? '',
      dia_inteiro: ev.dia_inteiro,
      data_inicio: format(ini, 'yyyy-MM-dd'),
      hora_inicio: format(ini, 'HH:mm'),
      data_fim: format(fim, 'yyyy-MM-dd'),
      hora_fim: format(fim, 'HH:mm'),
      lembrete: ev.lembrete_minutos == null ? 'none' : String(ev.lembrete_minutos),
    })
    setFormOpen(true)
  }

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['agenda-eventos'] })
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id) return
    if (!form.titulo.trim()) {
      toast.error('Informe o título')
      return
    }
    // Datas/horas digitadas são interpretadas no fuso local do navegador.
    const inicio = form.dia_inteiro
      ? new Date(`${form.data_inicio}T00:00:00`)
      : new Date(`${form.data_inicio}T${form.hora_inicio}:00`)
    const fim = form.dia_inteiro
      ? new Date(`${form.data_fim}T23:59:59`)
      : new Date(`${form.data_fim}T${form.hora_fim}:00`)
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      toast.error('Data ou hora inválida')
      return
    }
    if (fim < inicio) {
      toast.error('O fim deve ser depois do início')
      return
    }

    const payload: any = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      local: form.local.trim() || null,
      dia_inteiro: form.dia_inteiro,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      lembrete_minutos: form.lembrete === 'none' ? null : Number(form.lembrete),
    }

    // E-mail digitado e não adicionado com "+" também entra.
    const pendenteDigitado = emailConvite.trim().toLowerCase()
    const listaConvidados = [...convidados]
    if (pendenteDigitado) {
      if (!EMAIL_RE.test(pendenteDigitado)) {
        toast.error('E-mail de convidado inválido')
        return
      }
      if (!listaConvidados.includes(pendenteDigitado)) listaConvidados.push(pendenteDigitado)
    }
    if (listaConvidados.length > MAX_CONVIDADOS) {
      toast.error(`No máximo ${MAX_CONVIDADOS} convidados por compromisso.`)
      return
    }

    setSaving(true)
    let eventoId = editando?.id
    if (editando) {
      const { error } = await supabase.from('agenda_eventos' as any).update(payload).eq('id', editando.id)
      if (error) {
        setSaving(false)
        toast.error('Erro ao salvar compromisso: ' + error.message)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('agenda_eventos' as any)
        .insert({ ...payload, usuario_id: user.id })
        .select('id')
        .single()
      if (error || !data) {
        setSaving(false)
        toast.error('Erro ao salvar compromisso: ' + (error?.message ?? 'sem retorno'))
        return
      }
      eventoId = (data as any).id
    }

    // Sincroniza convidados: remove quem saiu da lista, adiciona os novos.
    const existentes = editando?.agenda_convidados ?? []
    const remover = existentes.filter(c => !listaConvidados.includes(c.email)).map(c => c.id)
    const adicionar = listaConvidados.filter(email => !existentes.some(c => c.email === email))
    let erroConvidados: string | null = null
    let novosIds: string[] = []

    if (remover.length) {
      const { error } = await supabase.from('agenda_convidados' as any).delete().in('id', remover)
      if (error) erroConvidados = error.message
    }
    if (adicionar.length && !erroConvidados) {
      const { data, error } = await supabase
        .from('agenda_convidados' as any)
        .insert(adicionar.map(email => ({ evento_id: eventoId, email })))
        .select('id')
      if (error) erroConvidados = error.message
      else novosIds = ((data as any[]) ?? []).map(r => r.id)
    }
    setSaving(false)

    if (erroConvidados) {
      toast.error('Compromisso salvo, mas houve erro nos convidados: ' + erroConvidados)
    } else {
      toast.success(editando ? 'Compromisso atualizado' : 'Compromisso criado')
    }

    // Só quem acabou de ser convidado recebe aviso (editar não reenvia convite).
    if (novosIds.length && eventoId) {
      const { data, error } = await supabase.functions.invoke('enviar-agenda-email', {
        body: { evento_id: eventoId, convidado_ids: novosIds },
      })
      if (error) {
        toast.error('Os convites não foram enviados: ' + (await mensagemErroFuncao(error)))
      } else {
        // Sucesso só para quem realmente recebeu o e-mail.
        const resultados = ((data as any)?.resultados ?? []) as ResultadoConvite[]
        const enviados = resultados.filter(r => r.email?.enviado)
        const falhos = resultados.filter(r => !r.email?.enviado)
        if (enviados.length) {
          toast.success(`Convite enviado por e-mail para ${enviados.length} pessoa(s)`)
        }
        for (const r of falhos) {
          const quem = r.email?.destinatario_original ?? 'convidado'
          const motivo = r.email?.erro ? ` (${r.email.erro})` : ''
          if (r.interno && r.notificacao === 'criada') {
            toast.warning(`${quem}: convidado avisado no sininho, mas o e-mail não foi enviado${motivo}`)
          } else {
            toast.error(`${quem}: o convite não foi enviado${motivo}`)
          }
        }
      }
    }

    setFormOpen(false)
    setEditando(null)
    setEmailConvite('')
    setDiaSelecionado(inicio)
    invalidar()
  }

  async function excluir() {
    if (!paraExcluir) return
    setSaving(true)
    const { data, error } = await supabase
      .from('agenda_eventos' as any)
      .delete()
      .eq('id', paraExcluir.id)
      .select('id')
    setSaving(false)
    if (error) {
      toast.error('Erro ao excluir compromisso: ' + error.message)
      return
    }
    if (!data || (data as any[]).length === 0) {
      toast.error('O compromisso não foi encontrado ou você não tem permissão para excluí-lo.')
      return
    }
    setParaExcluir(null)
    setFormOpen(false)
    setEditando(null)
    invalidar()
    toast.success('Compromisso excluído')
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Minha agenda</h1>
          <p className="text-sm text-muted-foreground">Seus compromissos e os convites que você recebeu</p>
        </div>
        <Button onClick={() => abrirNovo()}>
          <Plus className="h-4 w-4 mr-1" /> Novo compromisso
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="capitalize">
              {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setMesAtual(subMonths(mesAtual, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setMesAtual(new Date()); setDiaSelecionado(new Date()) }}
              >
                Hoje
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMesAtual(addMonths(mesAtual, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            )}
            <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-1">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="px-2 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {dias.map(dia => {
                const key = format(dia, 'yyyy-MM-dd')
                const lista = eventosPorDia.get(key) ?? []
                const outroMes = !isSameMonth(dia, mesAtual)
                const hoje = isSameDay(dia, new Date())
                const selecionado = isSameDay(dia, diaSelecionado)
                return (
                  <div
                    key={key}
                    onClick={() => setDiaSelecionado(dia)}
                    className={cn(
                      'min-h-[72px] md:min-h-[88px] border rounded-md p-1 text-left flex flex-col gap-1',
                      'cursor-pointer hover:bg-primary/5 transition-colors',
                      outroMes && 'bg-muted/30 text-muted-foreground',
                      hoje && 'border-primary',
                      selecionado && 'ring-2 ring-primary/60',
                    )}
                  >
                    <div className="text-xs font-medium">{format(dia, 'd')}</div>
                    <div className="flex flex-col gap-1 overflow-hidden">
                      {lista.slice(0, 3).map(ev => {
                        const convite = meuConvite(ev)
                        return (
                        <button
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); setDiaSelecionado(dia); abrirEdicao(ev) }}
                          className={cn(
                            'truncate text-[10px] leading-tight px-1.5 py-0.5 rounded text-left',
                            !convite && 'bg-primary text-primary-foreground',
                            convite?.status === 'pendente' && 'border border-dashed border-amber-500 bg-amber-50 text-amber-900',
                            convite?.status === 'aceito' && 'bg-emerald-600 text-white',
                            convite?.status === 'recusado' && 'bg-muted text-muted-foreground line-through',
                          )}
                          title={convite ? `Convite (${STATUS_CONVITE[convite.status].l.toLowerCase()}): ${ev.titulo}` : ev.titulo}
                        >
                          {!ev.dia_inteiro && isSameDay(parseISO(ev.inicio), dia) && (
                            <span className="opacity-80 mr-1">{format(parseISO(ev.inicio), 'HH:mm')}</span>
                          )}
                          {ev.titulo}
                        </button>
                        )
                      })}
                      {lista.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{lista.length - 3}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary" /> Meu compromisso</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-amber-500 bg-amber-50" /> Convite pendente</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600" /> Convite aceito</span>
              <span className="ml-auto">Clique em um dia para ver os compromissos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base capitalize">
              {format(diaSelecionado, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => abrirNovo(diaSelecionado)}>
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {eventosDoDia.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum compromisso neste dia</p>
            ) : (
              <div className="space-y-2">
                {eventosDoDia.map(ev => {
                  const convite = meuConvite(ev)
                  const dono = souDono(ev)
                  return (
                  <div key={ev.id} className={cn('border rounded-md p-2 text-sm', convite?.status === 'recusado' && 'opacity-60')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{horarioEvento(ev)}</p>
                        <p className={cn('font-medium break-words', convite?.status === 'recusado' && 'line-through')}>{ev.titulo}</p>
                      </div>
                      {dono ? (
                      <div className="flex shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEdicao(ev)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setParaExcluir(ev)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      ) : convite ? (
                        <Badge variant="outline" className={cn('shrink-0 text-[10px]', STATUS_CONVITE[convite.status].className)}>
                          <Mail className="h-3 w-3 mr-1" /> Convite · {STATUS_CONVITE[convite.status].l}
                        </Badge>
                      ) : null}
                    </div>
                    {convite && (
                      <div className="flex gap-2 mt-2">
                        {convite.status !== 'aceito' && (
                          <Button
                            size="sm"
                            className="h-7 bg-emerald-600 hover:bg-emerald-700"
                            disabled={respondendo === convite.id}
                            onClick={() => responderConvite(convite, 'aceito')}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Aceitar
                          </Button>
                        )}
                        {convite.status !== 'recusado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            disabled={respondendo === convite.id}
                            onClick={() => responderConvite(convite, 'recusado')}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Recusar
                          </Button>
                        )}
                      </div>
                    )}
                    {dono && (ev.agenda_convidados?.length ?? 0) > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> Convidados
                        </p>
                        {ev.agenda_convidados!.map(c => (
                          <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate" title={c.email}>
                              {c.email}{!c.usuario_id && <span className="text-muted-foreground"> (externo)</span>}
                            </span>
                            <Badge variant="outline" className={cn('shrink-0 text-[10px]', STATUS_CONVITE[c.status].className)}>
                              {c.usuario_id ? STATUS_CONVITE[c.status].l : 'E-mail'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    {ev.local && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {ev.local}
                      </p>
                    )}
                    {dono && ev.lembrete_minutos != null && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Bell className="h-3 w-3" /> {rotuloLembrete(ev.lembrete_minutos)}
                      </p>
                    )}
                    {ev.descricao && (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ev.descricao}</p>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Novo/Editar compromisso */}
      <Dialog open={formOpen} onOpenChange={o => { setFormOpen(o); if (!o) setEditando(null) }}>
        <DialogContent className="w-[95vw] sm:w-auto max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar compromisso' : 'Novo compromisso'}</DialogTitle>
            <DialogDescription>Visível só para você e para quem você convidar.</DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="dia-inteiro"
                checked={form.dia_inteiro}
                onCheckedChange={v => setForm({ ...form, dia_inteiro: v })}
              />
              <Label htmlFor="dia-inteiro">Dia inteiro</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início *</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={e => {
                    const v = e.target.value
                    setForm({ ...form, data_inicio: v, data_fim: form.data_fim < v ? v : form.data_fim })
                  }}
                  required
                />
              </div>
              {!form.dia_inteiro && (
                <div>
                  <Label>Hora início *</Label>
                  <Input type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} required />
                </div>
              )}
              <div>
                <Label>Fim *</Label>
                <Input type="date" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} required />
              </div>
              {!form.dia_inteiro && (
                <div>
                  <Label>Hora fim *</Label>
                  <Input type="time" value={form.hora_fim} onChange={e => setForm({ ...form, hora_fim: e.target.value })} required />
                </div>
              )}
            </div>
            <div>
              <Label>Local</Label>
              <Input value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div>
              <Label>Lembrete</Label>
              <Select value={form.lembrete} onValueChange={v => setForm({ ...form, lembrete: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEMBRETES.map(l => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Convidar pessoas</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={emailConvite}
                  onChange={e => setEmailConvite(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      adicionarConvidado()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={adicionarConvidado}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Usuários do Agro GFI recebem o convite na agenda e no sininho; os demais recebem por e-mail com o
                arquivo para adicionar ao calendário.
              </p>
              {convidados.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {convidados.map(email => {
                    const existente = editando?.agenda_convidados?.find(c => c.email === email)
                    return (
                      <Badge key={email} variant="secondary" className="gap-1 pr-1">
                        <span className="max-w-[200px] truncate">{email}</span>
                        {existente?.usuario_id && (
                          <span className={cn('rounded px-1 text-[10px]', STATUS_CONVITE[existente.status].className)}>
                            {STATUS_CONVITE[existente.status].l}
                          </span>
                        )}
                        <button
                          type="button"
                          className="rounded hover:bg-muted p-0.5"
                          onClick={() => setConvidados(convidados.filter(c => c !== email))}
                          aria-label={`Remover ${email}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
            <DialogFooter className="pt-2 gap-2 flex-wrap">
              {editando && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive sm:mr-auto"
                  onClick={() => setParaExcluir(editando)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!paraExcluir} onOpenChange={open => !open && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compromisso?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir} disabled={saving} className="bg-destructive text-destructive-foreground">
              {saving ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
