import { useState, useMemo, Fragment } from 'react'
import { format, addDays, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Plus, Search, Check, Pencil, Trash2, CalendarIcon,
  ChevronDown, ChevronLeft, ChevronRight,
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
import {
  useTransacoes, useFluxoCaixaMensal, useMarcarPago, useDeleteTransacao,
  statusEfetivo, type Transacao, type FiltrosTransacao,
} from '@/hooks/useTransacoes'
import { TransacaoForm } from '@/components/financeiro/TransacaoForm'
import { ParcelasExpansivel } from '@/components/financeiro/ParcelasExpansivel'
import { TransacaoOrigemAcoes, useIdsComAnexo } from '@/components/financeiro/TransacaoOrigemAcoes'
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
  const propId = propriedadeAtual?.id
  const { data: idsComAnexo } = useIdsComAnexo(propId)
  const safraId = safraAtual?.id

  // Filters
  const [filtros, setFiltros] = useState<FiltrosTransacao>({})
  const [busca, setBusca] = useState('')
  const [dataInicio, setDataInicio] = useState<Date | undefined>()
  const [dataFim, setDataFim] = useState<Date | undefined>()

  // Navegação por mês (mês corrente por padrão)
  const [mesAtual, setMesAtual] = useState(new Date())
  const inicioMes = startOfMonth(mesAtual)
  const fimMes = endOfMonth(mesAtual)

  // Parcelas expandidas
  const [expandidos, setExpandidos] = useState<string[]>([])
  const toggleExpandido = (id: string) => {
    setExpandidos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

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
  const deletar = useDeleteTransacao()

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Transacao | null>(null)
  const [deletandoId, setDeletandoId] = useState<string | null>(null)

  // Computed KPIs
  const kpis = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]
    const em7dias = format(addDays(new Date(), 7), 'yyyy-MM-dd')
    // Use ALL transactions (no filters) for KPIs
    let totalReceitas = 0, totalDespesas = 0, aVencer = 0
    todasTransacoes.forEach(t => {
      const st = statusEfetivo(t)
      if (st === 'cancelado') return
      if (t.tipo === 'receita') totalReceitas += t.valor
      else totalDespesas += t.valor
      if (st === 'pendente' && t.data_vencimento >= hoje && t.data_vencimento <= em7dias) {
        aVencer += t.valor
      }
      if (st === 'vencido') aVencer += t.valor
    })
    return { totalReceitas, totalDespesas, saldo: totalReceitas - totalDespesas, aVencer }
  }, [todasTransacoes])

  // Monthly chart data from all transacoes (unfiltered)
  const chartMensal = useMemo(() => {
    const map: Record<string, { mes: string; receitas: number; despesas: number }> = {}
    todasTransacoes.forEach(t => {
      if (statusEfetivo(t) === 'cancelado') return
      const m = t.data_vencimento.substring(0, 7) // yyyy-MM
      if (!map[m]) map[m] = { mes: m, receitas: 0, despesas: 0 }
      if (t.tipo === 'receita') map[m].receitas += t.valor
      else map[m].despesas += t.valor
    })
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).map(d => ({
      ...d,
      label: format(parseISO(d.mes + '-01'), 'MMM/yy', { locale: ptBR }),
    }))
  }, [todasTransacoes])

  // Pie data (unfiltered)
  const pieDespesas = useMemo(() => {
    const map: Record<string, number> = {}
    todasTransacoes.forEach(t => {
      if (t.tipo !== 'despesa' || statusEfetivo(t) === 'cancelado') return
      map[t.categoria] = (map[t.categoria] || 0) + t.valor
    })
    return Object.entries(map).map(([name, value]) => ({
      name: categoriasLabel[name] || name, value,
    })).sort((a, b) => b.value - a.value)
  }, [todasTransacoes])

  // Próximos vencimentos (unfiltered)
  const proxVencimentos = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]
    const em15 = format(addDays(new Date(), 15), 'yyyy-MM-dd')
    return todasTransacoes
      .filter(t => {
        const st = statusEfetivo(t)
        return (st === 'pendente' || st === 'vencido') && t.data_vencimento <= em15
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
      .slice(0, 10)
  }, [todasTransacoes])

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

  // Paginação
  const [page, setPage] = useState(0)
  const perPage = 15
  const totalPages = Math.ceil(transacoes.length / perPage)
  const transacoesPag = transacoes.slice(page * perPage, (page + 1) * perPage)

  // Totalizadores da aba transações
  const totais = useMemo(() => {
    let rec = 0, desp = 0
    transacoes.forEach(t => {
      if (statusEfetivo(t) === 'cancelado') return
      if (t.tipo === 'receita') rec += t.valor
      else desp += t.valor
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">Gestão de receitas, despesas e fluxo de caixa</p>
        </div>
        <Button onClick={() => { setEditando(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Transação
        </Button>
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo">📊 Resumo</TabsTrigger>
          <TabsTrigger value="transacoes">📋 Transações</TabsTrigger>
          <TabsTrigger value="fluxo">📈 Fluxo de Caixa</TabsTrigger>
        </TabsList>

        {/* ═══ ABA RESUMO ═══ */}
        <TabsContent value="resumo" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4 text-success" /> Receitas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-success">{fmt(kpis.totalReceitas)}</div><p className="text-xs text-muted-foreground mt-1">Na safra atual</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" /> Despesas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{fmt(kpis.totalDespesas)}</div><p className="text-xs text-muted-foreground mt-1">Na safra atual</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Saldo</CardTitle></CardHeader><CardContent><div className={cn('text-2xl font-bold', kpis.saldo >= 0 ? 'text-success' : 'text-destructive')}>{fmt(kpis.saldo)}</div><p className="text-xs text-muted-foreground mt-1">Projetado</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> A Vencer</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-warning-foreground">{fmt(kpis.aVencer)}</div><p className="text-xs text-muted-foreground mt-1">Próx. 7 dias + vencidos</p></CardContent></Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="px-0 pt-0"><CardTitle className="text-base">Receitas vs Despesas Mensal</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                {chartMensal.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartMensal}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <ReTooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 70%, 40%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-[280px] flex items-center justify-center text-muted-foreground">Sem dados</div>}
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
                      <div key={t.id} className={cn('flex items-center justify-between p-3 rounded-lg', st === 'vencido' ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/50')}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span>{urgBadge}</span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{t.descricao}</p>
                            <p className="text-xs text-muted-foreground">{format(parseISO(t.data_vencimento), 'dd/MM/yyyy')} · {categoriasLabel[t.categoria] || t.categoria}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-bold text-destructive">{fmt(t.valor)}</span>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => marcarPago.mutate(t.id, { onSuccess: () => toast.success('Marcado como pago') })} disabled={marcarPago.isPending}>
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

          <div className="flex flex-wrap gap-2 items-end">
            <Select value={filtros.tipo || 'todos'} onValueChange={v => { setFiltros(f => ({ ...f, tipo: v === 'todos' ? undefined : v })); setPage(0) }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtros.categoria || 'todos'} onValueChange={v => { setFiltros(f => ({ ...f, categoria: v === 'todos' ? undefined : v })); setPage(0) }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                <SelectItem value="todos">Todas</SelectItem>
                {Object.entries(categoriasLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtros.status || 'todos'} onValueChange={v => { setFiltros(f => ({ ...f, status: v === 'todos' ? undefined : v })); setPage(0) }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('text-xs', dataInicio && 'border-primary')}>
                  <CalendarIcon className="h-3 w-3 mr-1" />{dataInicio ? format(dataInicio, 'dd/MM/yy') : 'De'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={d => { setDataInicio(d || undefined); setPage(0) }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('text-xs', dataFim && 'border-primary')}>
                  <CalendarIcon className="h-3 w-3 mr-1" />{dataFim ? format(dataFim, 'dd/MM/yy') : 'Até'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={d => { setDataFim(d || undefined); setPage(0) }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar descrição..." value={busca} onChange={e => { setBusca(e.target.value); setPage(0) }} />
            </div>

            {(filtros.tipo || filtros.categoria || filtros.status || dataInicio || dataFim || busca) && (
              <Button variant="ghost" size="sm" onClick={() => { setFiltros({}); setBusca(''); setDataInicio(undefined); setDataFim(undefined); setPage(0) }}>Limpar</Button>
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
                  const expandido = expandidos.includes(t.id)
                  return (
                    <Fragment key={t.id}>
                    <TableRow className={cn(st === 'vencido' && 'bg-destructive/5')}>

                      <TableCell className="whitespace-nowrap">{format(parseISO(t.data_vencimento), 'dd/MM/yy')}</TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1 min-w-0">
                          {t.parcelado && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleExpandido(t.id)} title="Ver parcelas">
                              <ChevronDown className={cn('h-4 w-4 transition-transform', expandido && 'rotate-180')} />
                            </Button>
                          )}
                          <div className="min-w-0">
                            <p className="truncate max-w-[200px] font-medium">{t.descricao}</p>
                            {t.parcela_numero && <span className="text-xs text-muted-foreground">Parcela {t.parcela_numero}/{t.parcela_total}</span>}
                            <TransacaoOrigemAcoes origem={t.origem} idsComAnexo={idsComAnexo} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{categoriasLabel[t.categoria] || t.categoria}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{t.fornecedor_cliente || '—'}</TableCell>
                      <TableCell className={cn('text-right font-semibold whitespace-nowrap', t.tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                        {t.tipo === 'receita' ? '+' : '-'} {fmt(t.valor)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center">
                          <StatusBadge status={st} />
                          {t.parcelado && <ParcelasIndicador n={t.numero_parcelas} />}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!t.parcelado && (st === 'pendente' || st === 'vencido') && (
                            <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" title="Marcar como pago" onClick={() => marcarPago.mutate(t.id, { onSuccess: () => toast.success('Pago!') })}>
                              <Check className="h-4 w-4 mr-1" /> Pagar
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => { setEditando(t); setFormOpen(true) }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => setDeletandoId(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {t.parcelado && expandido && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="p-0">
                          <ParcelasExpansivel transacaoId={t.id} />
                        </TableCell>
                      </TableRow>
                    )}
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
                  <Card
                    key={t.id}
                    className={cn('cursor-pointer transition-colors hover:bg-muted/50', st === 'vencido' && 'bg-destructive/5')}
                    onClick={() => { setEditando(t); setFormOpen(true) }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{t.descricao}</div>
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            <div>{categoriasLabel[t.categoria] || t.categoria} · {format(parseISO(t.data_vencimento), 'dd/MM/yy')}</div>
                            {t.parcela_numero && <div>Parcela {t.parcela_numero}/{t.parcela_total}</div>}
                          </div>
                          <TransacaoOrigemAcoes origem={t.origem} compact idsComAnexo={idsComAnexo} />
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={cn('font-semibold whitespace-nowrap', t.tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                            {t.tipo === 'receita' ? '+' : '-'} {fmt(t.valor)}
                          </div>
                          <div className="mt-1 inline-flex items-center">
                            <StatusBadge status={st} />
                            {t.parcelado && (
                              <span className="text-xs text-muted-foreground ml-1">({t.numero_parcelas}x)</span>
                            )}
                          </div>

                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        {(st === 'pendente' || st === 'vencido') && (
                          <Button size="sm" variant="outline" className="h-11" onClick={e => { e.stopPropagation(); marcarPago.mutate(t.id, { onSuccess: () => toast.success('Pago!') }) }}>
                            <Check className="mr-1 h-4 w-4" /> Pago
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-11 text-destructive" onClick={e => { e.stopPropagation(); setDeletandoId(t.id) }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={fluxoAcumulado}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <ReTooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="receitas" name="Receitas" stroke="hsl(142, 70%, 40%)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="acumulado" name="Saldo Acumulado" stroke="hsl(199, 89%, 48%)" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-[320px] flex items-center justify-center text-muted-foreground">Sem dados de fluxo de caixa</div>}
            </CardContent>
          </Card>

          {/* Tabela mensal */}
          <Card>
            <Table>
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
    </div>
  )
}
