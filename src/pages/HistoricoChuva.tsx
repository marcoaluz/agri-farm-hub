import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useAuth } from '@/contexts/AuthContext'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CloudRain, ChevronLeft, ChevronRight, Droplets, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface RegistroChuva {
  data: string
  precipitacao_mm: number
}

export default function HistoricoChuva() {
  const { propriedadeAtual } = useGlobal()
  const { user } = useAuth()
  const propId = propriedadeAtual?.id
  const queryClient = useQueryClient()

  const [mesReferencia, setMesReferencia] = useState(() => startOfMonth(new Date()))
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mmInput, setMmInput] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const monthStart = startOfMonth(mesReferencia)
  const monthEnd = endOfMonth(mesReferencia)
  const rangeStart = format(monthStart, 'yyyy-MM-dd')
  const rangeEnd = format(monthEnd, 'yyyy-MM-dd')

  const { data: registros, isLoading } = useQuery({
    queryKey: ['clima-historico', propId, rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clima_historico' as any)
        .select('data, precipitacao_mm')
        .eq('propriedade_id', propId)
        .gte('data', rangeStart)
        .lte('data', rangeEnd)
      if (error) throw error
      return (data || []) as RegistroChuva[]
    },
    enabled: !!propId,
  })

  const chuvaMap = useMemo(() => {
    const map = new Map<string, number>()
    registros?.forEach((r) => map.set(r.data, Number(r.precipitacao_mm)))
    return map
  }, [registros])

  const totalMesMm = useMemo(
    () => Array.from(chuvaMap.values()).reduce((s, v) => s + v, 0),
    [chuvaMap]
  )

  // Grade do mês: dias reais + espaços vazios no início/fim pra fechar as semanas
  const celulas = useMemo(() => {
    const dias = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const paddingInicio = Array(getDay(monthStart)).fill(null)
    const paddingFim = Array(6 - getDay(monthEnd)).fill(null)
    return [...paddingInicio, ...dias, ...paddingFim] as (Date | null)[]
  }, [mesReferencia])

  const abrirDia = (dia: Date) => {
    const key = format(dia, 'yyyy-MM-dd')
    setDiaSelecionado(dia)
    setMmInput(chuvaMap.has(key) ? String(chuvaMap.get(key)) : '')
    setDialogOpen(true)
  }

  const salvar = async () => {
    if (!diaSelecionado || !propId || !user?.id) return
    const mm = Number(mmInput)
    if (mmInput.trim() === '' || isNaN(mm) || mm < 0) {
      toast.error('Informe um valor válido em mm')
      return
    }
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('clima_historico' as any)
        .upsert(
          {
            propriedade_id: propId,
            data: format(diaSelecionado, 'yyyy-MM-dd'),
            precipitacao_mm: mm,
            origem: 'manual',
            registrado_por: user.id,
          } as any,
          { onConflict: 'propriedade_id,data' }
        )
      if (error) throw error
      toast.success('Chuva registrada')
      queryClient.invalidateQueries({ queryKey: ['clima-historico'] })
      setDialogOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    if (!diaSelecionado || !propId) return
    setExcluindo(true)
    try {
      const { error } = await supabase
        .from('clima_historico' as any)
        .delete()
        .eq('propriedade_id', propId)
        .eq('data', format(diaSelecionado, 'yyyy-MM-dd'))
      if (error) throw error
      toast.success('Lançamento removido')
      queryClient.invalidateQueries({ queryKey: ['clima-historico'] })
      setDialogOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir')
    } finally {
      setExcluindo(false)
    }
  }

  const existeLancamento = diaSelecionado ? chuvaMap.has(format(diaSelecionado, 'yyyy-MM-dd')) : false

  if (!propId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CloudRain className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Selecione uma propriedade</h3>
            <p className="text-muted-foreground text-center">
              Para visualizar o histórico de chuva, selecione uma propriedade no menu superior.
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
            <CloudRain className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Histórico de Chuva
          </h1>
          <p className="text-sm text-muted-foreground">
            Lançamento manual de precipitação por dia
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2">
          <Droplets className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Total no mês</p>
            <p className="text-lg font-bold">{totalMesMm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm</p>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => setMesReferencia((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold capitalize">
              {format(mesReferencia, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setMesReferencia((m) => addMonths(m, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Weekday header */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-px">
                {celulas.map((dia, idx) => {
                  if (!dia) return <div key={`vazio-${idx}`} className="min-h-[3.5rem] sm:min-h-[5rem]" />
                  const key = format(dia, 'yyyy-MM-dd')
                  const mm = chuvaMap.get(key)
                  const hoje = format(new Date(), 'yyyy-MM-dd') === key
                  return (
                    <button
                      key={key}
                      onClick={() => abrirDia(dia)}
                      className={cn(
                        'relative flex flex-col items-center justify-start gap-1 p-1 sm:p-2 min-h-[3.5rem] sm:min-h-[5rem] rounded-lg border border-transparent transition-colors text-sm hover:bg-accent hover:border-border',
                        hoje && 'ring-2 ring-primary ring-inset',
                        mm != null && mm > 0 && 'bg-sky-50 dark:bg-sky-950/30'
                      )}
                    >
                      <span className={cn('font-medium text-xs sm:text-sm', hoje && 'text-primary font-bold')}>
                        {format(dia, 'd')}
                      </span>
                      {mm != null && (
                        <span className="text-[11px] sm:text-sm font-semibold text-sky-700 dark:text-sky-400">
                          {mm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mm
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog de lançamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Chuva em {diaSelecionado && format(diaSelecionado, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Precipitação (mm)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={mmInput}
              onChange={(e) => setMmInput(e.target.value)}
              placeholder="0,0"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {existeLancamento && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={excluir}
                disabled={excluindo || salvando}
              >
                {excluindo ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Excluir
              </Button>
            )}
            <Button onClick={salvar} disabled={salvando || excluindo}>
              {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
