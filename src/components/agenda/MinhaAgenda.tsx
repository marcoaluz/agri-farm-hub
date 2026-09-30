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
import { ChevronLeft, ChevronRight, Plus, Loader2, Trash2, MapPin, Bell, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

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
        .select('*')
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
    setFormOpen(true)
  }

  function abrirEdicao(ev: AgendaEvento) {
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

    setSaving(true)
    const { error } = editando
      ? await supabase.from('agenda_eventos' as any).update(payload).eq('id', editando.id)
      : await supabase.from('agenda_eventos' as any).insert({ ...payload, usuario_id: user.id })
    setSaving(false)
    if (error) {
      toast.error('Erro ao salvar compromisso: ' + error.message)
      return
    }
    toast.success(editando ? 'Compromisso atualizado' : 'Compromisso criado')
    setFormOpen(false)
    setEditando(null)
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
          <p className="text-sm text-muted-foreground">Seus compromissos pessoais — só você vê</p>
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
                      {lista.slice(0, 3).map(ev => (
                        <button
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); setDiaSelecionado(dia); abrirEdicao(ev) }}
                          className="truncate text-[10px] leading-tight px-1.5 py-0.5 rounded text-left bg-primary text-primary-foreground"
                          title={ev.titulo}
                        >
                          {!ev.dia_inteiro && isSameDay(parseISO(ev.inicio), dia) && (
                            <span className="opacity-80 mr-1">{format(parseISO(ev.inicio), 'HH:mm')}</span>
                          )}
                          {ev.titulo}
                        </button>
                      ))}
                      {lista.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{lista.length - 3}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-xs text-muted-foreground text-right">
              Clique em um dia para ver os compromissos
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
                {eventosDoDia.map(ev => (
                  <div key={ev.id} className="border rounded-md p-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{horarioEvento(ev)}</p>
                        <p className="font-medium break-words">{ev.titulo}</p>
                      </div>
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
                    </div>
                    {ev.local && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {ev.local}
                      </p>
                    )}
                    {ev.lembrete_minutos != null && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Bell className="h-3 w-3" /> {rotuloLembrete(ev.lembrete_minutos)}
                      </p>
                    )}
                    {ev.descricao && (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ev.descricao}</p>
                    )}
                  </div>
                ))}
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
            <DialogDescription>Compromisso pessoal, visível só para você.</DialogDescription>
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
