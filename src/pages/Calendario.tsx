import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useSafraContext } from '@/contexts/SafraContext'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface CalEvent {
  tipo: 'lancamento' | 'sanitario' | 'manutencao' | 'transacao'
  data: string
  titulo: string
  detalhe?: string
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Calendario() {
  const { propriedadeAtual } = useGlobal()
  const { safraSelecionada } = useSafraContext()
  const propId = propriedadeAtual?.id
  const safraId = safraSelecionada?.id

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const rangeStart = format(startOfWeek(monthStart), 'yyyy-MM-dd')
  const rangeEnd = format(endOfWeek(monthEnd), 'yyyy-MM-dd')

  // Fetch all event sources in parallel
  const { data: lancamentos } = useQuery({
    queryKey: ['cal-lancamentos', propId, safraId, rangeStart, rangeEnd],
    queryFn: async () => {
      let q = (supabase as any).from('lancamentos')
        .select('data_execucao, servico:servicos(nome), talhao:talhoes(nome), custo_total')
        .eq('propriedade_id', propId)
        .gte('data_execucao', rangeStart)
        .lte('data_execucao', rangeEnd)
      if (safraId) q = q.eq('safra_id', safraId)
      const { data } = await q
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  const { data: sanitarios } = useQuery({
    queryKey: ['cal-sanitarios', propId, rangeStart, rangeEnd],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sanitario_eventos')
        .select('data_proxima, tipo, descricao, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .not('data_proxima', 'is', null)
        .gte('data_proxima', rangeStart)
        .lte('data_proxima', rangeEnd)
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  const { data: manutencoes } = useQuery({
    queryKey: ['cal-manutencoes', propId, rangeStart, rangeEnd],
    queryFn: async () => {
      const { data } = await (supabase as any).from('maquina_manutencoes')
        .select('data_prevista, tipo, descricao, maquina:maquinas(nome), status')
        .eq('propriedade_id', propId)
        .not('data_prevista', 'is', null)
        .gte('data_prevista', rangeStart)
        .lte('data_prevista', rangeEnd)
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  const { data: transacoes } = useQuery({
    queryKey: ['cal-transacoes', propId, rangeStart, rangeEnd],
    queryFn: async () => {
      const { data } = await (supabase as any).from('transacoes')
        .select('data_vencimento, descricao, valor, tipo, status, categoria')
        .eq('propriedade_id', propId)
        .eq('status', 'pendente')
        .not('data_vencimento', 'is', null)
        .gte('data_vencimento', rangeStart)
        .lte('data_vencimento', rangeEnd)
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  // Build event map by date string
  const eventMap = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    const push = (dateStr: string, ev: CalEvent) => {
      if (!dateStr) return
      const key = dateStr.substring(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }

    lancamentos?.forEach((l: any) => push(l.data_execucao, {
      tipo: 'lancamento',
      data: l.data_execucao,
      titulo: l.servico?.nome || 'Lançamento',
      detalhe: `${l.talhao?.nome ? l.talhao.nome + ' — ' : ''}R$ ${Number(l.custo_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    }))

    sanitarios?.forEach((s: any) => push(s.data_proxima, {
      tipo: 'sanitario',
      data: s.data_proxima,
      titulo: `💉 ${s.descricao}`,
      detalhe: `${s.tipo} — ${s.rebanho?.nome || ''}`,
    }))

    manutencoes?.forEach((m: any) => push(m.data_prevista, {
      tipo: 'manutencao',
      data: m.data_prevista,
      titulo: `🔧 ${m.descricao}`,
      detalhe: `${m.maquina?.nome || ''} — ${m.status}`,
    }))

    transacoes?.forEach((t: any) => push(t.data_vencimento, {
      tipo: 'transacao',
      data: t.data_vencimento,
      titulo: `💰 ${t.descricao}`,
      detalhe: `${t.tipo === 'receita' ? 'Receita' : 'Despesa'} — R$ ${Number(t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    }))

    return map
  }, [lancamentos, sanitarios, manutencoes, transacoes])

  // Build calendar grid days
  const calendarDays = useMemo(() => {
    const days: Date[] = []
    let day = startOfWeek(monthStart)
    const end = endOfWeek(monthEnd)
    while (day <= end) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  const selectedEvents = selectedDate ? eventMap.get(format(selectedDate, 'yyyy-MM-dd')) || [] : []

  const dotColor: Record<string, string> = {
    lancamento: 'bg-green-500',
    sanitario: 'bg-yellow-500',
    manutencao: 'bg-blue-500',
    transacao: 'bg-red-500',
  }

  const badgeColor: Record<string, string> = {
    lancamento: 'bg-green-100 text-green-700 border-green-300',
    sanitario: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    manutencao: 'bg-blue-100 text-blue-700 border-blue-300',
    transacao: 'bg-red-100 text-red-700 border-red-300',
  }

  const tipoLabel: Record<string, string> = {
    lancamento: 'Lançamento',
    sanitario: 'Sanitário',
    manutencao: 'Manutenção',
    transacao: 'Transação',
  }

  if (!propId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Selecione uma propriedade</h3>
            <p className="text-muted-foreground text-center">
              Para visualizar o calendário, selecione uma propriedade no menu superior.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Calendário Agrícola
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão unificada de lançamentos, sanidade, manutenções e transações
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {[
          { color: 'bg-green-500', label: 'Lançamentos' },
          { color: 'bg-yellow-500', label: 'Sanitário 💉' },
          { color: 'bg-blue-500', label: 'Manutenção 🔧' },
          { color: 'bg-red-500', label: 'Transações 💰' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className={cn('h-3 w-3 rounded-full', l.color)} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Calendar Card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px">
            {calendarDays.map((day, idx) => {
              const key = format(day, 'yyyy-MM-dd')
              const events = eventMap.get(key) || []
              const inMonth = isSameMonth(day, currentMonth)
              const today = isToday(day)
              const selected = selectedDate && isSameDay(day, selectedDate)

              // Get unique event types for dots
              const types = Array.from(new Set(events.map(e => e.tipo)))

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (events.length > 0) {
                      setSelectedDate(day)
                      setSheetOpen(true)
                    }
                  }}
                  className={cn(
                    'relative flex flex-col items-center justify-start p-1 sm:p-2 min-h-[3rem] sm:min-h-[4.5rem] rounded-lg transition-colors text-sm',
                    inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                    today && 'ring-2 ring-primary ring-inset',
                    selected && 'bg-primary/10',
                    events.length > 0 && inMonth && 'hover:bg-accent cursor-pointer',
                    events.length === 0 && 'cursor-default',
                  )}
                >
                  <span className={cn('font-medium text-xs sm:text-sm', today && 'text-primary font-bold')}>
                    {format(day, 'd')}
                  </span>

                  {types.length > 0 && inMonth && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {types.map(t => (
                        <span key={t} className={cn('h-2 w-2 rounded-full', dotColor[t])} />
                      ))}
                    </div>
                  )}

                  {events.length > 1 && inMonth && (
                    <span className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                      {events.length} eventos
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento neste dia.</p>
            ) : (
              selectedEvents.map((ev, i) => (
                <Card key={i} className="border">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', dotColor[ev.tipo])} />
                      <Badge variant="outline" className={cn('text-xs', badgeColor[ev.tipo])}>
                        {tipoLabel[ev.tipo]}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm text-foreground">{ev.titulo}</p>
                    {ev.detalhe && (
                      <p className="text-xs text-muted-foreground">{ev.detalhe}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
