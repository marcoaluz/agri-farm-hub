import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { format, addDays, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useSearchParams } from 'react-router-dom'
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Plus, Search, Check, CheckCheck, Undo2, Pencil, Trash2, CalendarIcon,
  ChevronLeft, ChevronRight, Eye,
} from 'lucide-react'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import { PizzaCategoria } from '@/components/charts/PizzaCategoria'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useGlobal } from '@/contexts/GlobalContext'
import { useSafraFechada } from '@/hooks/useSafraFechada'
import {
  useTransacoes, useFluxoCaixaMensal, useMarcarPago, useMarcarPagoParcela, useDeleteTransacao,
  statusEfetivo, type Transacao, type FiltrosTransacao,
} from '@/hooks/useTransacoes'
import { TransacaoForm } from '@/components/financeiro/TransacaoForm'
import { TransacaoOrigemAcoes, useIdsComAnexo } from '@/components/financeiro/TransacaoOrigemAcoes'
import { CustosOperacionais } from '@/components/financeiro/CustosOperacionais'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'


const PIE_COLORS = [
  'hsl(142, 45%, 28%)', 'hsl(42, 85%, 55%)', 'hsl(199, 89%, 48%)',
  'hsl(0, 72%, 51%)', 'hsl(30, 35%, 45%)', 'hsl(270, 50%, 50%)',
  'hsl(160, 60%, 40%)', 'hsl(20, 80%, 55%)', 'hsl(300, 40%, 50%)', 'hsl(80, 50%, 40%)',
]

const categoriasLabel: Record<string, string> = {
  insumos: 'Insumos', combustivel: 'Combustível', manutencao: 'Manutenção',
  mao_de_obra: 'Mão de Obra', arrendamento: 'Arrendamento', maquinario: 'Maquinário',
  venda_producao: 'Venda Produção', servicos_terceiros: 'Serviços Terceiros',
  impostos: 'Impostos', sanidade_animal: 'Sanidade Animal', alimentacao_animal: 'Alimentação / Ração',
  compra_animais: 'Compra de Animais', venda_animais: 'Venda de Animais', outros: 'Outros',
}

/** Transações geradas automaticamente por outros módulos NÃO podem ser editadas no Financeiro. */
const isAutoGerada = (t: Transacao) => !!t.origem && t.origem !== 'manual'

const origemLabel = (origem: string): string => {
  if (origem.startsWith('lavoura_lancamento') || origem === 'lancamento') return 'Lançamento'
  if (origem.startsWith('lote') || origem === 'abastecimento') return 'Estoque'
  if (origem.startsWith('pecuaria')) return 'Pecuária'
  if (origem.startsWith('venda_producao') || origem === 'venda_producao') return 'Venda'
  return 'Sistema'
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100' },
    pago: { label: 'Pago', cls: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' },
    vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100' },
    cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100' },
  }
  const s = map[status] || map.pendente
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>
}

function ParcelasIndicador({ n }: { n?: number | null }) {
  if (!n) return null
  return (
    <span className="bg-primary/10 text-primary text-xs font-medium px-1.5 py-0.5 rounded ml-1">
      {n}x
    </span>
  )
}

export function Financeiro() {
  const { propriedadeAtual, safraAtual } = useGlobal()
  const { isFechada, verificarSafra } = useSafraFechada(safraAtual)
  const propId = propriedadeAtual?.id
  const { data: idsComAnexo } = useIdsComAnexo(propId)
  const safraId = safraAtual?.id

  const [searchParams, setSearchParams] = useSearchParams()
  const transacaoDestaqueId = searchParams.get('transacao')

  // Filters
  const [filtros, setFiltros] = useState<FiltrosTransacao>({})
  const [busca, setBusca] = useState('')
  const [dataInicio, setDataInicio] = useState<Date | undefined>()
  const [dataFim, setDataFim] = useState<Date | undefined>()

  // Navegação por mês (mês corrente por padrão)
  const [mesAtual, setMesAtual] = useState(new Date())
  const inicioMes = startOfMonth(mesAtual)
  const fimMes = endOfMonth(mesAtual)

  const filtrosAtivos: FiltrosTransacao = {
    ...filtros,
    busca: busca || undefined,
    data_inicio: dataInicio ? format(dataInicio, 'yyyy-MM-dd') : format(inicioMes, 'yyyy-MM-dd'),
    data_fim: dataFim ? format(dataFim, 'yyyy-MM-dd') : format(fimMes, 'yyyy-MM-dd'),
  }



  const { data: transacoes = [], isLoading } = useTransacoes(propId, safraId, filtrosAtivos)
  const { data: todasTransacoes = [] } = useTransacoes(propId, safraId)
  const { data: fluxoMensal = [] } = useFluxoCaixaMensal(propId, safraId)
  const marcarPago = useMarcarPago()
  const marcarPagoParcela = useMarcarPagoParcela()
  const deletar = useDeleteTransacao()
  const queryClient = useQueryClient()

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Transacao | null>(null)
  const [deletandoId, setDeletandoId] = useState<string | null>(null)

  // Paginação
  const [page, setPage] = useState(0)
  const perPage = 15
  const totalPages = Math.ceil(transacoes.length / perPage)
  const transacoesPag = transacoes.slice(page * perPage, (page + 1) * perPage)

  // Deep-link para transação específica via ?transacao=abc123
  const [activeTab, setActiveTab] = useState(transacaoDestaqueId ? 'transacoes' : 'resumo')
  const [highlightedId, setHighlightedId] = useState<string | null>(transacaoDestaqueId)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!transacaoDestaqueId || !transacoes.length) return
    const idx = transacoes.findIndex(t => t.id === transacaoDestaqueId)
    if (idx >= 0) {
      const targetPage = Math.floor(idx / perPage)
      setPage(targetPage)
      setActiveTab('transacoes')
      setHighlightedId(transacaoDestaqueId)
    }
  }, [transacaoDestaqueId, transacoes.length])

  useEffect(() => {
    if (!highlightedId) return
    const el = document.getElementById(`transacao-${highlightedId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedId(null)
        setSearchParams(prev => {
          const next = new URLSearchParams(prev)
          next.delete('transacao')
          return next
        }, { replace: true })
      }, 3000)
    }
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [highlightedId, transacoesPag])

  // A view vw_movimentos_financeiros já entrega uma linha por parcela
  const movimentosFlatten = todasTransacoes

  // Confirmação de baixa (pagar/receber)
  const [pagandoAlvo, setPagandoAlvo] = useState<{ t: Transacao; todas: boolean } | null>(null)

  const invalidarFinanceiro = () => {
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
    queryClient.invalidateQueries({ queryKey: ['parcelas'] })
    queryClient.invalidateQueries({ queryKey: ['parcelas-calendario'] })
    queryClient.invalidateQueries({ queryKey: ['resumo-financeiro'] })
  }

  // Marcar uma parcela específica como paga/desfazer
  const pagarParcela = (parcelaId: string) => {
    marcarPagoParcela.mutate(
      { id: parcelaId, pagar: true },
      { onSuccess: () => toast.success('Parcela paga!') }
    )
  }

  // Marcar todas as parcelas restantes de uma transação como pagas
  const pagarTodasRestantes = async (transacaoId: string) => {
    const hoje = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('parcelas' as any)
      .update({ status: 'pago', data_pagamento: hoje })
      .eq('transacao_id', transacaoId)
      .neq('status', 'pago')
    if (error) {
      toast.error('Erro ao atualizar parcelas: ' + error.message)
      return
    }
    toast.success('Todas as parcelas restantes foram baixadas')
    invalidarFinanceiro()
  }

  const marcarPagoLinha = (t: Transacao) => {
    if (t.eh_parcela) pagarParcela(t.id)
    else marcarPago.mutate({ id: t.id, pagar: true }, { onSuccess: () => toast.success('Baixa registrada!') })
  }

  const executarBaixa = (alvo: { t: Transacao; todas: boolean }) => {
    if (alvo.todas) pagarTodasRestantes(alvo.t.transacao_id || alvo.t.id)
    else marcarPagoLinha(alvo.t)
  }

  const temParcelasRestantes = (t: Transacao) =>
    !!t.eh_parcela && !!t.numero_parcela && !!t.total_parcelas && t.numero_parcela < t.total_parcelas

  const labelBaixa = (t: Transacao) => (t.tipo === 'receita' ? 'Receber' : 'Pagar')

  // Computed KPIs
  const kpis = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]
    const em7dias = format(addDays(new Date(), 7), 'yyyy-MM-dd')
    // Use ALL transactions (no filters) for KPIs
    let totalReceitas = 0, totalDespesas = 0, aVencer = 0
    movimentosFlatten.forEach(t => {
      const st = statusEfetivo(t)
      if (st === 'cancelado') return
      if (st === 'pago') {
        if (t.tipo === 'receita') totalReceitas += t.valor
        else totalDespesas += t.valor
      }
      if (st === 'pendente' && t.data_vencimento >= hoje && t.data_vencimento <= em7dias) {
        aVencer += t.valor
      }
      if (st === 'vencido') aVencer += t.valor
    })
    return { totalReceitas, totalDespesas, saldo: totalReceitas - totalDespesas, aVencer }
  }, [movimentosFlatten])

  // Monthly chart data from all transacoes (unfiltered)
  const chartMensal = useMemo(() => {
    const map: Record<string, { mes: string; receitas: number; despesas: number }> = {}
    movimentosFlatten.forEach(t => {
      if (statusEfetivo(t) === 'cancelado') return
      const m = t.data_referencia.substring(0, 7) // yyyy-MM
      if (!map[m]) map[m] = { mes: m, receitas: 0, despesas: 0 }
      if (t.tipo === 'receita') map[m].receitas += t.valor
      else map[m].despesas += t.valor
    })
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).map(d => ({
      ...d,
      label: format(parseISO(d.mes + '-01'), 'MMM/yy', { locale: ptBR }),
    }))
  }, [movimentosFlatten])

  // Pie data (unfiltered)
  const pieDespesas = useMemo(() => {
    const map: Record<string, number> = {}
    movimentosFlatten.forEach(t => {
      if (t.tipo !== 'despesa' || statusEfetivo(t) === 'cancelado') return
      map[t.categoria] = (map[t.categoria] || 0) + t.valor
    })
    return Object.entries(map).map(([name, value]) => ({
      name: categoriasLabel[name] || name, value,
    })).sort((a, b) => b.value - a.value)
  }, [movimentosFlatten])

  // Próximos vencimentos (unfiltered)
  const proxVencimentos = useMemo(() => {
    const em15 = format(addDays(new Date(), 15), 'yyyy-MM-dd')
    return movimentosFlatten
      .filter(t => {
        const st = statusEfetivo(t)
        return (st === 'pendente' || st === 'vencido') && t.data_vencimento <= em15
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
      .slice(0, 10)
  }, [movimentosFlatten])

  // Fluxo de caixa acumulado
  const fluxoAcumulado = useMemo(() => {
    let acum = 0
    return (fluxoMensal as any[]).map((m: any) => {
      const rec = Number(m.total_receitas || 0)
      const desp = Number(m.total_despesas || 0)
      const saldo_mes = Number(m.saldo_mes || rec - desp)
      acum += saldo_mes
      return {
        mes: m.mes
          ? format(parseISO(m.mes + '-01'), 'MMM/yy', { locale: ptBR })
          : '—',
        receitas: rec,
        despesas: desp,
        saldo_mes,
        acumulado: acum,
      }
    })
  }, [fluxoMensal])

  // Totalizadores da aba transações (somente valores efetivamente pagos/recebidos)
  const totais = useMemo(() => {
    let rec = 0, desp = 0
    transacoes.forEach(t => {
      const st = statusEfetivo(t)
      if (st === 'cancelado') return
      if (st === 'pago') {
        if (t.tipo === 'receita') rec += t.valor
        else desp += t.valor
      }
    })
    return { rec, desp, saldo: rec - desp }
  }, [transacoes])

  if (!propId || !safraId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Selecione uma propriedade e safra para ver o financeiro.
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Gestão de receitas, despesas e fluxo de caixa</p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => { if (!verificarSafra('criar transação')) return; setEditando(null); setFormOpen(true) }}
          disabled={isFechada}
          title={isFechada ? 'Safra fechada' : ''}
        >
          <Plus className="h-4 w-4 mr-2" /> Nova Transação
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="resumo" className="text-xs sm:text-sm py-2">📊 Resumo</TabsTrigger>
          <TabsTrigger value="transacoes" className="text-xs sm:text-sm py-2">📋 Transações</TabsTrigger>
          <TabsTrigger value="fluxo" className="text-xs sm:text-sm py-2">📈 Fluxo</TabsTrigger>
          <TabsTrigger value="custos" className="text-xs sm:text-sm py-2">🚜 Custos</TabsTrigger>
        </TabsList>


        {/* ═══ ABA RESUMO ═══ */}
        <TabsContent value="resumo" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Card><CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4 text-success" /> Receitas</CardTitle></CardHeader><CardContent className="px-3 sm:px-6"><div className="text-lg sm:text-2xl font-bold text-success break-words">{fmt(kpis.totalReceitas)}</div><p className="text-xs text-muted-foreground mt-1">Na safra atual</p></CardContent></Card>
            <Card><CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" /> Despesas</CardTitle></CardHeader><CardContent className="px-3 sm:px-6"><div className="text-lg sm:text-2xl font-bold text-destructive break-words">{fmt(kpis.totalDespesas)}</div><p className="text-xs text-muted-foreground mt-1">Na safra atual</p></CardContent></Card>
            <Card><CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Saldo</CardTitle></CardHeader><CardContent className="px-3 sm:px-6"><div className={cn('text-lg sm:text-2xl font-bold break-words', kpis.saldo >= 0 ? 'text-success' : 'text-destructive')}>{fmt(kpis.saldo)}</div><p className="text-xs text-muted-foreground mt-1">Projetado</p></CardContent></Card>
            <Card><CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> A Vencer</CardTitle></CardHeader><CardContent className="px-3 sm:px-6"><div className="text-lg sm:text-2xl font-bold text-warning-foreground break-words">{fmt(kpis.aVencer)}</div><p className="text-xs text-muted-foreground mt-1">Próx. 7 dias + vencidos</p></CardContent></Card>
          </div>


          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="px-0 pt-0"><CardTitle className="text-base">Receitas vs Despesas Mensal</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                {chartMensal.length > 0 ? (
                  <div className="h-[250px] sm:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartMensal}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis fontSize={11} width={40} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                        <ReTooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 70%, 40%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="h-[250px] sm:h-[280px] flex items-center justify-center text-muted-foreground">Sem dados</div>}

              </CardContent>
            </Card>

            <Card className="p-4">
              <CardHeader className="px-0 pt-0"><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                <PizzaCategoria dados={pieDespesas} emptyLabel="Sem despesas" />
              </CardContent>
            </Card>
          </div>

          {/* Próximos vencimentos */}
          <Card className="p-4">
            <CardHeader className="px-0 pt-0"><CardTitle className="text-base">Próximos Vencimentos</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              {proxVencimentos.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">Nenhum vencimento próximo.</p>
              ) : (
                <div className="space-y-2">
                  {proxVencimentos.map(t => {
                    const st = statusEfetivo(t)
                    const hoje = new Date().toISOString().split('T')[0]
                    const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
                    let urgBadge = '🟢'
                    if (st === 'vencido') urgBadge = '🔴'
                    else if (t.data_vencimento <= amanha) urgBadge = '🟡'
                    return (
                      <div key={`${t.id}-${t.parcela_numero ?? 0}`} className={cn('flex items-center justify-between p-3 rounded-lg', st === 'vencido' ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/50')}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span>{urgBadge}</span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{t.descricao}</p>
                            <p className="text-xs text-muted-foreground">{format(parseISO(t.data_vencimento), 'dd/MM/yyyy')} · {categoriasLabel[t.categoria] || t.categoria}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-bold text-destructive">{fmt(t.valor)}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (t.eh_parcela) {
                                marcarPagoParcela.mutate({ id: t.id, pagar: true }, { onSuccess: () => toast.success('Marcado como pago') })
                              } else {
                                marcarPago.mutate({ id: t.id, pagar: true }, { onSuccess: () => toast.success('Marcado como pago') })
                              }
                            }}
                            disabled={marcarPago.isPending || marcarPagoParcela.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" /> Pagar
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ ABA TRANSAÇÕES ═══ */}
        <TabsContent value="transacoes" className="space-y-4">
          {/* Navegação por mês */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => { setMesAtual(prev => subMonths(prev, 1)); setPage(0) }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-bold capitalize">
              {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
            </h3>
            <Button variant="outline" size="icon" onClick={() => { setMesAtual(prev => addMonths(prev, 1)); setPage(0) }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Filtros */}

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end">
            <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
              <Select value={filtros.tipo || 'todos'} onValueChange={v => { setFiltros(f => ({ ...f, tipo: v === 'todos' ? undefined : v })); setPage(0) }}>
                <SelectTrigger className="text-xs sm:text-sm sm:w-[130px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtros.categoria || 'todos'} onValueChange={v => { setFiltros(f => ({ ...f, categoria: v === 'todos' ? undefined : v })); setPage(0) }}>
                <SelectTrigger className="text-xs sm:text-sm sm:w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="todos">Todas</SelectItem>
                  {Object.entries(categoriasLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtros.status || 'todos'} onValueChange={v => { setFiltros(f => ({ ...f, status: v === 'todos' ? undefined : v })); setPage(0) }}>
                <SelectTrigger className="text-xs sm:text-sm sm:w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('flex-1 sm:flex-none text-xs', dataInicio && 'border-primary')}>
                    <CalendarIcon className="h-3 w-3 mr-1" />{dataInicio ? format(dataInicio, 'dd/MM/yy') : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={d => { setDataInicio(d || undefined); setPage(0) }} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('flex-1 sm:flex-none text-xs', dataFim && 'border-primary')}>
                    <CalendarIcon className="h-3 w-3 mr-1" />{dataFim ? format(dataFim, 'dd/MM/yy') : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={d => { setDataFim(d || undefined); setPage(0) }} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="relative flex-1 sm:min-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 text-sm" placeholder="Buscar descrição..." value={busca} onChange={e => { setBusca(e.target.value); setPage(0) }} />
            </div>

            {(filtros.tipo || filtros.categoria || filtros.status || dataInicio || dataFim || busca) && (
              <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => { setFiltros({}); setBusca(''); setDataInicio(undefined); setDataFim(undefined); setPage(0) }}>Limpar</Button>
            )}
          </div>


          {/* Tabela */}
          <Card>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Venc.</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Fornecedor/Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : transacoesPag.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada.</TableCell></TableRow>
                ) : transacoesPag.map(t => {
                  const st = statusEfetivo(t)
                  return (
                    <Fragment key={t.id}>
                    <TableRow
                      id={`transacao-${t.id}`}
                      className={cn(
                        st === 'vencido' && 'bg-destructive/5',
                        highlightedId === t.id && 'ring-2 ring-primary bg-primary/10 animate-pulse'
                      )}
                    >

                      <TableCell className="whitespace-nowrap">{format(parseISO(t.data_vencimento), 'dd/MM/yy')}</TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1 min-w-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate max-w-[200px] font-medium">{t.descricao}</p>
                              {isAutoGerada(t) && (
                                <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border shrink-0">
                                  Auto · {origemLabel(t.origem!)}
                                </Badge>
                              )}
                            </div>
                            {t.parcela_numero && <span className="text-xs text-muted-foreground">Parcela {t.parcela_numero}/{t.parcela_total}</span>}
                            <TransacaoOrigemAcoes origem={t.origem} idsComAnexo={idsComAnexo} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{categoriasLabel[t.categoria] || t.categoria}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{t.fornecedor_cliente || '—'}</TableCell>
                      <TableCell className={cn('text-right font-semibold whitespace-nowrap', t.tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                        {t.tipo === 'receita' ? '+' : '-'} {fmt(t.valor)}
                        {t.eh_parcela && (
                          <div className="text-xs font-normal text-muted-foreground">
                            {t.numero_parcela}/{t.total_parcelas} · Total {fmt(Number(t.valor_total_transacao) || 0)}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex items-center">
                          <StatusBadge status={st} />
                          {t.parcelado && <ParcelasIndicador n={t.numero_parcelas} />}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver detalhes">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 text-sm space-y-2" align="end">
                              <p className="font-semibold">{t.descricao}</p>
                              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                                <span>Categoria:</span><span className="text-foreground">{categoriasLabel[t.categoria] || t.categoria}</span>
                                <span>Valor:</span><span className="text-foreground">{fmt(t.valor)}</span>
                                {t.eh_parcela && (<><span>Parcela:</span><span className="text-foreground">{t.numero_parcela}/{t.total_parcelas} · Total {fmt(Number(t.valor_total_transacao) || 0)}</span></>)}
                                <span>Vencimento:</span><span className="text-foreground">{format(parseISO(t.data_vencimento), 'dd/MM/yyyy')}</span>
                                {t.data_pagamento && (<><span>Pago em:</span><span className="text-foreground">{format(parseISO(t.data_pagamento), 'dd/MM/yyyy')}</span></>)}
                                <span>{t.tipo === 'receita' ? 'Cliente:' : 'Fornecedor:'}</span><span className="text-foreground">{t.fornecedor_cliente || '—'}</span>
                                {t.numero_nf && (<><span>Nº NF:</span><span className="text-foreground">{t.numero_nf}</span></>)}
                                <span>Status:</span><span className="text-foreground capitalize">{statusEfetivo(t)}</span>
                                {isAutoGerada(t) && (<><span>Origem:</span><span className="text-foreground">{origemLabel(t.origem!)}</span></>)}
                              </div>
                            </PopoverContent>
                          </Popover>
                          {(st === 'pendente' || st === 'vencido') && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" title={`Marcar como ${t.tipo === 'receita' ? 'recebido' : 'pago'}`} onClick={() => setPagandoAlvo({ t, todas: false })}>
                                <Check className="h-4 w-4 mr-1" /> {labelBaixa(t)}
                              </Button>
                              {temParcelasRestantes(t) && (
                                <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" title={`${labelBaixa(t)} todas as restantes`} onClick={() => setPagandoAlvo({ t, todas: true })}>
                                  <CheckCheck className="h-4 w-4 mr-1" /> Todas
                                </Button>
                              )}
                            </>
                          )}
                          {st === 'pago' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-muted-foreground"
                              title="Desfazer baixa"
                              onClick={() => {
                                if (t.eh_parcela) {
                                  marcarPagoParcela.mutate({ id: t.id, pagar: false }, { onSuccess: () => toast.success('Desfeito') })
                                } else {
                                  marcarPago.mutate({ id: t.id, pagar: false }, { onSuccess: () => toast.success('Desfeito') })
                                }
                              }}
                              disabled={marcarPago.isPending || marcarPagoParcela.isPending}
                            >
                              <Undo2 className="h-4 w-4 mr-1" /> Desfazer
                            </Button>
                          )}
                          {!isAutoGerada(t) ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => { setEditando(t); setFormOpen(true) }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => setDeletandoId(t.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic pr-1">
                              Via {origemLabel(t.origem!)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    </Fragment>

                  )
                })}

              </TableBody>
            </Table>
            </div>

            {/* Mobile: cards */}
            <div className="block md:hidden p-3 space-y-2">
              {isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
              ) : transacoesPag.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
              ) : transacoesPag.map(t => {
                const st = statusEfetivo(t)
                return (
                  <Fragment key={t.id}>
                  <Card
                    id={`transacao-${t.id}`}
                    className={cn(
                      'transition-colors',
                      isAutoGerada(t) ? 'cursor-default' : 'cursor-pointer hover:bg-muted/50',
                      st === 'vencido' && 'bg-destructive/5',
                      highlightedId === t.id && 'ring-2 ring-primary bg-primary/10 animate-pulse'
                    )}
                    onClick={() => { if (!isAutoGerada(t)) { setEditando(t); setFormOpen(true) } }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{t.descricao}</span>
                            {isAutoGerada(t) && (
                              <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border shrink-0">
                                Auto · {origemLabel(t.origem!)}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            <div>{categoriasLabel[t.categoria] || t.categoria} · {format(parseISO(t.data_vencimento), 'dd/MM/yy')}</div>
                            {t.parcela_numero && <div>Parcela {t.parcela_numero}/{t.parcela_total}</div>}
                          </div>
                          <TransacaoOrigemAcoes origem={t.origem} compact idsComAnexo={idsComAnexo} />
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={cn('font-semibold whitespace-nowrap', t.tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                            {t.tipo === 'receita' ? '+' : '-'} {fmt(t.valor)}
                            {t.eh_parcela && (
                              <div className="text-xs font-normal text-muted-foreground">
                                {t.numero_parcela}/{t.total_parcelas} · Total {fmt(Number(t.valor_total_transacao) || 0)}
                              </div>
                            )}
                          </div>

                          <div className="mt-1 inline-flex items-center">
                            <StatusBadge status={st} />
                            {t.parcelado && <ParcelasIndicador n={t.numero_parcelas} />}
                          </div>

                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        {(st === 'pendente' || st === 'vencido') && (
                          <>
                            <Button size="sm" variant="outline" className="h-11 text-green-700 border-green-300 hover:bg-green-50" onClick={e => { e.stopPropagation(); setPagandoAlvo({ t, todas: false }) }}>
                              <Check className="mr-1 h-4 w-4" /> {labelBaixa(t)}
                            </Button>
                            {temParcelasRestantes(t) && (
                              <Button size="sm" variant="outline" className="h-11 text-green-700 border-green-300 hover:bg-green-50" onClick={e => { e.stopPropagation(); setPagandoAlvo({ t, todas: true }) }}>
                                <CheckCheck className="mr-1 h-4 w-4" /> Todas
                              </Button>
                            )}
                          </>
                        )}
                        {st === 'pago' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-11 text-muted-foreground"
                            onClick={e => {
                              e.stopPropagation()
                              if (t.eh_parcela) {
                                marcarPagoParcela.mutate({ id: t.id, pagar: false }, { onSuccess: () => toast.success('Desfeito') })
                              } else {
                                marcarPago.mutate({ id: t.id, pagar: false }, { onSuccess: () => toast.success('Desfeito') })
                              }
                            }}
                            disabled={marcarPago.isPending || marcarPagoParcela.isPending}
                          >
                            <Undo2 className="mr-1 h-4 w-4" /> Desfazer
                          </Button>
                        )}
                        {isAutoGerada(t) ? (
                          <span className="text-xs text-muted-foreground italic self-center">Via {origemLabel(t.origem!)}</span>
                        ) : (
                          <Button size="sm" variant="outline" className="h-11 text-destructive" onClick={e => { e.stopPropagation(); setDeletandoId(t.id) }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  </Fragment>
                )
              })}

            </div>

            {/* Totalizadores + Paginação */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-4 border-t">
              <div className="flex gap-4 text-sm flex-wrap">
                <span>Receitas: <strong className="text-success">{fmt(totais.rec)}</strong></span>
                <span>Despesas: <strong className="text-destructive">{fmt(totais.desp)}</strong></span>
                <span>Saldo: <strong className={totais.saldo >= 0 ? 'text-success' : 'text-destructive'}>{fmt(totais.saldo)}</strong></span>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
                  <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próximo</Button>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ═══ ABA FLUXO DE CAIXA ═══ */}
        <TabsContent value="fluxo" className="space-y-6">
          <Card className="p-4">
            <CardHeader className="px-0 pt-0"><CardTitle className="text-base">Fluxo de Caixa Acumulado</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              {fluxoAcumulado.length > 0 ? (
                <div className="h-[250px] sm:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fluxoAcumulado}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" fontSize={11} />
                      <YAxis fontSize={11} width={40} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <ReTooltip formatter={(v: number) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="receitas" name="Receitas" stroke="hsl(142, 70%, 40%)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="acumulado" name="Saldo Acumulado" stroke="hsl(199, 89%, 48%)" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="h-[250px] sm:h-[320px] flex items-center justify-center text-muted-foreground">Sem dados de fluxo de caixa</div>}
            </CardContent>
          </Card>

          {/* Tabela mensal */}
          <Card className="overflow-x-auto">
            <Table className="min-w-[560px]">

              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Saldo do Mês</TableHead>
                  <TableHead className="text-right">Saldo Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fluxoAcumulado.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sem dados</TableCell></TableRow>
                ) : fluxoAcumulado.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium capitalize">{m.mes}</TableCell>
                    <TableCell className="text-right text-success">{fmt(m.receitas)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(m.despesas)}</TableCell>
                    <TableCell className={cn('text-right font-medium', m.saldo_mes >= 0 ? 'text-success' : 'text-destructive')}>{fmt(m.saldo_mes)}</TableCell>
                    <TableCell className={cn('text-right font-bold', m.acumulado >= 0 ? 'text-success' : 'text-destructive')}>{fmt(m.acumulado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ═══ ABA CUSTOS OPERACIONAIS ═══ */}
        <TabsContent value="custos" className="space-y-6">
          <CustosOperacionais />
        </TabsContent>
      </Tabs>

      {/* Dialog Form */}
      <TransacaoForm open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditando(null) }} transacao={editando} />

      {/* Confirm Delete */}
      <AlertDialog open={!!deletandoId} onOpenChange={() => setDeletandoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (deletandoId) deletar.mutate(deletandoId, {
                onSuccess: () => { toast.success('Transação excluída'); setDeletandoId(null) },
                onError: (e: any) => toast.error(e?.message || 'Erro ao excluir'),
              })
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm baixa (pagar / receber) */}
      <AlertDialog open={!!pagandoAlvo} onOpenChange={() => setPagandoAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pagandoAlvo?.todas
                ? `Marcar todas as parcelas restantes como ${pagandoAlvo?.t.tipo === 'receita' ? 'recebidas' : 'pagas'}?`
                : `Marcar como ${pagandoAlvo?.t.tipo === 'receita' ? 'recebido' : 'pago'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pagandoAlvo?.todas
                ? `Todas as parcelas pendentes desta transação serão marcadas como ${pagandoAlvo?.t.tipo === 'receita' ? 'recebidas' : 'pagas'} com a data de hoje.`
                : `O lançamento será baixado com a data de hoje.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pagandoAlvo) executarBaixa(pagandoAlvo); setPagandoAlvo(null) }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
