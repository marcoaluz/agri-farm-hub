import { useState, useMemo, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart3, DollarSign, TrendingUp, Wheat, ChevronUp, ChevronDown, Eye, EyeOff, AlertTriangle, ArrowUpDown } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGlobal } from '@/contexts/GlobalContext'
import { useRelatorioOperacional, useRelatorioFinanceiro, useRelatorioComparativo, statusEfetivoTransacao, type FiltrosRelatorio } from '@/hooks/useRelatorios'
import { BotaoExportacao } from '@/components/relatorios/BotaoExportacao'
import { exportarExcel, exportarPDFCompleto, exportarPDFSintetico } from '@/lib/exportRelatorio'

const PIE_COLORS = ['hsl(142,70%,40%)', 'hsl(200,70%,50%)', 'hsl(40,90%,50%)', 'hsl(0,72%,51%)', 'hsl(270,60%,50%)', 'hsl(180,60%,40%)']

const categoriasFinLabel: Record<string, string> = {
  insumos: 'Insumos', combustivel: 'Combustível', manutencao: 'Manutenção',
  mao_de_obra: 'Mão de Obra', arrendamento: 'Arrendamento', maquinario: 'Maquinário',
  venda_producao: 'Venda Produção', servicos_terceiros: 'Serv. Terceiros', impostos: 'Impostos', outros: 'Outros',
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

const PER_PAGE = 20

function DatePickerField({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder: string }) {
  const date = value ? new Date(value + 'T12:00:00') : undefined
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('w-[140px] justify-start text-left font-normal', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-1 h-3.5 w-3.5" />
          {value ? format(new Date(value + 'T12:00:00'), 'dd/MM/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  )
}

export function Relatorios() {
  const { propriedadeAtual, safraAtual, safras } = useGlobal()
  const propId = propriedadeAtual?.id || ''
  const safraId = safraAtual?.id || ''

  // Operacional filters
  const [filtrosOp, setFiltrosOp] = useState<FiltrosRelatorio>({})
  const [showChartsOp, setShowChartsOp] = useState(true)
  const [sortOp, setSortOp] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'data_execucao', dir: 'desc' })
  const [pageOp, setPageOp] = useState(0)

  // Financeiro filters
  const [filtrosFin, setFiltrosFin] = useState<FiltrosRelatorio>({})
  const [showChartsFin, setShowChartsFin] = useState(true)
  const [sortFin, setSortFin] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'data_vencimento', dir: 'desc' })
  const [pageFin, setPageFin] = useState(0)

  // Talhão tab
  const [talhaoSel, setTalhaoSel] = useState<string>('')
  const [filtrosTalhao, setFiltrosTalhao] = useState<FiltrosRelatorio>({})

  // Comparativo
  const [safraCompIds, setSafraCompIds] = useState<string[]>([])

  useEffect(() => { setPageOp(0) }, [filtrosOp])
  useEffect(() => { setPageFin(0) }, [filtrosFin])

  // Data hooks
  const opData = useRelatorioOperacional(propId, safraId, filtrosOp)
  const talhaoData = useRelatorioOperacional(propId, safraId, { ...filtrosTalhao, talhao_id: talhaoSel || undefined })
  const finData = useRelatorioFinanceiro(propId, safraId, filtrosFin)
  const compData = useRelatorioComparativo(propId, safraCompIds.length > 0 ? safraCompIds : [safraId])

  const semContexto = !propriedadeAtual || !safraAtual

  // ── OPERACIONAL KPIs ──
  const lancamentos = opData.lancamentos.data || []
  const kpisOp = useMemo(() => {
    const custoTotal = lancamentos.reduce((s, l: any) => s + Number(l.custo_total || 0), 0)
    const areas = new Set<string>()
    let areaTotal = 0
    lancamentos.forEach((l: any) => {
      if (l.talhao_id && !areas.has(l.talhao_id)) {
        areas.add(l.talhao_id)
        areaTotal += Number(l.talhao_area_ha || 0)
      }
    })
    return { totalLancamentos: lancamentos.length, custoTotal, areaTotal, custoMedioHa: areaTotal > 0 ? custoTotal / areaTotal : 0 }
  }, [lancamentos])

  // ── OPERACIONAL sort/paginate ──
  const lancOrdenados = useMemo(() => {
    const sorted = [...lancamentos].sort((a: any, b: any) => {
      const va = a[sortOp.col], vb = b[sortOp.col]
      if (va == null) return 1; if (vb == null) return -1
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortOp.dir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [lancamentos, sortOp])
  const totalPagesOp = Math.ceil(lancOrdenados.length / PER_PAGE)
  const lancPag = lancOrdenados.slice(pageOp * PER_PAGE, (pageOp + 1) * PER_PAGE)
  const custoMedioHaGeral = kpisOp.custoMedioHa

  // ── OPERACIONAL charts ──
  const chartMensalOp = useMemo(() => {
    const porMes = opData.porMes.data || []
    return porMes.map((m: any) => ({
      mes: m.mes ? format(new Date(m.mes), 'MMM/yy', { locale: ptBR }) : '—',
      custo: Number(m.custo_total_mes || 0),
    }))
  }, [opData.porMes.data])

  const pieCategOp = useMemo(() => {
    return (opData.porCategoria.data || []).slice(0, 6).map((c: any) => ({
      name: c.categoria || 'Outros', value: Number(c.custo_total || 0),
    }))
  }, [opData.porCategoria.data])

  // ── FINANCEIRO KPIs ──
  const transacoes = finData.transacoes.data || []
  const kpisFin = useMemo(() => {
    let rec = 0, desp = 0, vencido = 0
    transacoes.forEach((t: any) => {
      const st = statusEfetivoTransacao(t)
      if (st === 'cancelado') return
      if (t.tipo === 'receita') rec += Number(t.valor || 0)
      if (t.tipo === 'despesa') desp += Number(t.valor || 0)
      if (st === 'vencido') vencido += Number(t.valor || 0)
    })
    return { rec, desp, saldo: rec - desp, vencido }
  }, [transacoes])

  // ── FINANCEIRO sort/paginate ──
  const transOrdenadas = useMemo(() => {
    return [...transacoes].sort((a: any, b: any) => {
      const va = a[sortFin.col], vb = b[sortFin.col]
      if (va == null) return 1; if (vb == null) return -1
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortFin.dir === 'asc' ? cmp : -cmp
    })
  }, [transacoes, sortFin])
  const totalPagesFin = Math.ceil(transOrdenadas.length / PER_PAGE)
  const transPag = transOrdenadas.slice(pageFin * PER_PAGE, (pageFin + 1) * PER_PAGE)

  const totaisFin = useMemo(() => {
    const r = transacoes.filter((t: any) => t.tipo === 'receita' && statusEfetivoTransacao(t) !== 'cancelado').reduce((s: number, t: any) => s + Number(t.valor), 0)
    const d = transacoes.filter((t: any) => t.tipo === 'despesa' && statusEfetivoTransacao(t) !== 'cancelado').reduce((s: number, t: any) => s + Number(t.valor), 0)
    return { rec: r, desp: d, saldo: r - d }
  }, [transacoes])

  // ── FINANCEIRO charts ──
  const chartMensalFin = useMemo(() => {
    const map: Record<string, { rec: number; desp: number }> = {}
    transacoes.forEach((t: any) => {
      if (statusEfetivoTransacao(t) === 'cancelado') return
      const m = t.data_vencimento?.substring(0, 7)
      if (!m) return
      if (!map[m]) map[m] = { rec: 0, desp: 0 }
      if (t.tipo === 'receita') map[m].rec += Number(t.valor)
      else map[m].desp += Number(t.valor)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({
      mes: format(parseISO(m + '-01'), 'MMM/yy', { locale: ptBR }), receitas: v.rec, despesas: v.desp,
    }))
  }, [transacoes])

  const pieDespFin = useMemo(() => {
    const map: Record<string, number> = {}
    transacoes.forEach((t: any) => {
      if (t.tipo !== 'despesa' || statusEfetivoTransacao(t) === 'cancelado') return
      map[t.categoria] = (map[t.categoria] || 0) + Number(t.valor)
    })
    return Object.entries(map).map(([k, v]) => ({ name: categoriasFinLabel[k] || k, value: v })).sort((a, b) => b.value - a.value)
  }, [transacoes])

  // ── POR TALHÃO ──
  const talhoes = opData.porTalhao.data || []
  const talhaoDetalhe = talhaoSel ? talhoes.find((t: any) => t.talhao_id === talhaoSel) : null
  const lancTalhao = talhaoData.lancamentos.data || []

  const kpisTalhaoComp = useMemo(() => {
    if (!talhoes.length) return { total: 0, maiorHa: 0, menorHa: 0, media: 0 }
    const custos = talhoes.map((t: any) => Number(t.custo_por_ha || 0)).filter((v: number) => v > 0)
    return {
      total: talhoes.length,
      maiorHa: custos.length ? Math.max(...custos) : 0,
      menorHa: custos.length ? Math.min(...custos) : 0,
      media: custos.length ? custos.reduce((s: number, v: number) => s + v, 0) / custos.length : 0,
    }
  }, [talhoes])

  // ── COMPARATIVO ──
  const compResults = compData.porSafra.data || []

  // ── SORT TOGGLE ──
  function toggleSort(current: { col: string; dir: 'asc' | 'desc' }, col: string, setter: (v: any) => void) {
    if (current.col === col) setter({ col, dir: current.dir === 'asc' ? 'desc' : 'asc' })
    else setter({ col, dir: 'asc' })
  }

  const SortIcon = ({ col, current }: { col: string; current: { col: string; dir: string } }) => {
    if (current.col !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return current.dir === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
  }

  // ── EXPORT HANDLERS (Operacional) ──
  const handleExcelOp = () => {
    exportarExcel({
      titulo: 'Relatório Operacional', nomeArquivo: `relatorio-operacional-${safraAtual?.nome || ''}`,
      abas: [
        { nome: 'Lançamentos', colunas: ['Data', 'Serviço', 'Categoria', 'Talhão', 'Área (ha)', 'Custo Total', 'Custo/ha'],
          linhas: lancamentos.map((l: any) => [l.data_execucao ? format(new Date(l.data_execucao), 'dd/MM/yyyy') : '-', l.servico_nome || '-', l.servico_categoria || '-', l.talhao_nome || '-', l.talhao_area_ha || '-', Number(l.custo_total || 0), l.custo_por_ha || '-']),
          totais: ['TOTAL', '', '', '', `${fmtN(kpisOp.areaTotal)} ha`, fmt(kpisOp.custoTotal), fmt(kpisOp.custoMedioHa)] },
        { nome: 'Por Categoria', colunas: ['Categoria', 'Lançamentos', 'Custo Total'],
          linhas: (opData.porCategoria.data || []).map((c: any) => [c.categoria || '-', c.total_lancamentos || 0, Number(c.custo_total || 0)]) },
        { nome: 'Por Talhão', colunas: ['Talhão', 'Área (ha)', 'Lançamentos', 'Custo Total', 'Custo/ha'],
          linhas: talhoes.map((t: any) => [t.talhao_nome || '-', t.area_ha || '-', t.total_lancamentos || 0, Number(t.custo_total || 0), t.custo_por_ha || '-']) },
      ],
    })
  }

  const handlePdfCompletoOp = () => {
    exportarPDFCompleto({
      titulo: 'Relatório Operacional', subtitulo: 'Detalhado', nomeArquivo: `relatorio-operacional-${safraAtual?.nome || ''}`,
      propriedade: propriedadeAtual?.nome || '-', safra: safraAtual?.nome || '-',
      periodo: `${filtrosOp.data_inicio || 'Início'} a ${filtrosOp.data_fim || 'Hoje'}`,
      kpis: [
        { label: 'Total Lançamentos', valor: String(kpisOp.totalLancamentos) },
        { label: 'Custo Total', valor: fmt(kpisOp.custoTotal) },
        { label: 'Área Total', valor: `${fmtN(kpisOp.areaTotal)} ha` },
        { label: 'Custo Médio/ha', valor: fmt(kpisOp.custoMedioHa) },
      ],
      tabelas: [
        { titulo: 'Lançamentos', colunas: ['Data', 'Serviço', 'Categoria', 'Talhão', 'Área', 'Custo', 'Custo/ha'],
          linhas: lancamentos.map((l: any) => [l.data_execucao ? format(new Date(l.data_execucao), 'dd/MM/yyyy') : '-', l.servico_nome || '-', l.servico_categoria || '-', l.talhao_nome || '-', l.talhao_area_ha ? `${l.talhao_area_ha} ha` : '-', fmt(Number(l.custo_total || 0)), l.custo_por_ha ? fmt(l.custo_por_ha) : '-']),
          rodape: ['TOTAL', '', '', '', `${fmtN(kpisOp.areaTotal)} ha`, fmt(kpisOp.custoTotal), fmt(kpisOp.custoMedioHa)] },
      ],
    })
  }

  const handlePdfSinteticoOp = () => {
    exportarPDFSintetico({
      titulo: 'Relatório Operacional — Sintético', nomeArquivo: `relatorio-sintetico-${safraAtual?.nome || ''}`,
      propriedade: propriedadeAtual?.nome || '-', safra: safraAtual?.nome || '-',
      periodo: `${filtrosOp.data_inicio || 'Início'} a ${filtrosOp.data_fim || 'Hoje'}`,
      kpis: [
        { label: 'Total Lançamentos', valor: String(kpisOp.totalLancamentos) },
        { label: 'Custo Total', valor: fmt(kpisOp.custoTotal) },
        { label: 'Área Total', valor: `${fmtN(kpisOp.areaTotal)} ha` },
        { label: 'Custo Médio/ha', valor: fmt(kpisOp.custoMedioHa) },
      ],
      resumos: [
        { titulo: 'Custos por Categoria', itens: [
          ...(opData.porCategoria.data || []).map((c: any) => ({ label: c.categoria || '-', valor: `${fmt(Number(c.custo_total || 0))} (${kpisOp.custoTotal > 0 ? ((Number(c.custo_total || 0) / kpisOp.custoTotal) * 100).toFixed(1) : 0}%)` })),
          { label: 'TOTAL GERAL', valor: fmt(kpisOp.custoTotal), destaque: true },
        ] },
        { titulo: 'Custos por Talhão', itens: talhoes.map((t: any) => ({ label: `${t.talhao_nome || '-'} (${t.area_ha || '-'} ha)`, valor: `${fmt(Number(t.custo_total || 0))} | ${t.custo_por_ha ? fmt(t.custo_por_ha) + '/ha' : '-'}` })) },
      ],
    })
  }

  // ── EXPORT HANDLERS (Financeiro) ──
  const handleExcelFin = () => {
    exportarExcel({
      titulo: 'Relatório Financeiro', nomeArquivo: `relatorio-financeiro-${safraAtual?.nome || ''}`,
      abas: [{ nome: 'Transações', colunas: ['Data Venc.', 'Descrição', 'Tipo', 'Categoria', 'Fornecedor', 'Valor', 'Status'],
        linhas: transacoes.map((t: any) => [t.data_vencimento || '-', t.descricao || '-', t.tipo, categoriasFinLabel[t.categoria] || t.categoria, t.fornecedor_cliente || '-', Number(t.valor || 0), statusEfetivoTransacao(t)]),
        totais: ['', '', '', '', 'Receitas:', totaisFin.rec, `Despesas: ${fmt(totaisFin.desp)} | Saldo: ${fmt(totaisFin.saldo)}`] }],
    })
  }

  const handlePdfCompletoFin = () => {
    exportarPDFCompleto({
      titulo: 'Relatório Financeiro', subtitulo: 'Completo', nomeArquivo: `relatorio-financeiro-${safraAtual?.nome || ''}`,
      propriedade: propriedadeAtual?.nome || '-', safra: safraAtual?.nome || '-',
      periodo: `${filtrosFin.data_inicio || 'Início'} a ${filtrosFin.data_fim || 'Hoje'}`,
      kpis: [{ label: 'Receitas', valor: fmt(kpisFin.rec) }, { label: 'Despesas', valor: fmt(kpisFin.desp) }, { label: 'Saldo', valor: fmt(kpisFin.saldo) }, { label: 'Vencido', valor: fmt(kpisFin.vencido) }],
      tabelas: [{ titulo: 'Transações', colunas: ['Data', 'Descrição', 'Categoria', 'Fornecedor', 'Valor', 'Status'],
        linhas: transacoes.map((t: any) => [t.data_vencimento || '-', t.descricao || '-', categoriasFinLabel[t.categoria] || t.categoria, t.fornecedor_cliente || '-', fmt(Number(t.valor || 0)), statusEfetivoTransacao(t)]),
        rodape: ['', 'TOTAIS', '', 'Receitas:', fmt(totaisFin.rec), `Despesas: ${fmt(totaisFin.desp)}`] }],
    })
  }

  const handlePdfSinteticoFin = () => {
    exportarPDFSintetico({
      titulo: 'Relatório Financeiro — Sintético', nomeArquivo: `relatorio-fin-sintetico-${safraAtual?.nome || ''}`,
      propriedade: propriedadeAtual?.nome || '-', safra: safraAtual?.nome || '-',
      periodo: `${filtrosFin.data_inicio || 'Início'} a ${filtrosFin.data_fim || 'Hoje'}`,
      kpis: [{ label: 'Receitas', valor: fmt(kpisFin.rec) }, { label: 'Despesas', valor: fmt(kpisFin.desp) }, { label: 'Saldo', valor: fmt(kpisFin.saldo) }, { label: 'Vencido', valor: fmt(kpisFin.vencido) }],
      resumos: [{ titulo: 'Despesas por Categoria', itens: pieDespFin.map(c => ({ label: c.name, valor: fmt(c.value) })) }],
    })
  }

  // ── STATUS BADGE ──
  const StatusBadge = ({ status }: { status: string }) => {
    const st = status
    const cls: Record<string, string> = {
      pendente: 'bg-yellow-100 text-yellow-700', pago: 'bg-green-100 text-green-700',
      vencido: 'bg-red-100 text-red-700', cancelado: 'bg-muted text-muted-foreground',
    }
    return <Badge variant="outline" className={cls[st] || ''}>{st.charAt(0).toUpperCase() + st.slice(1)}</Badge>
  }

  if (semContexto) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Selecione uma propriedade e safra</p>
        <p className="text-sm">Use o header para selecionar antes de gerar relatórios</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Análises detalhadas e exportações</p>
      </div>

      <Tabs defaultValue="operacional" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="operacional">📊 Operacional</TabsTrigger>
          <TabsTrigger value="financeiro">💰 Financeiro</TabsTrigger>
          <TabsTrigger value="talhao">🌾 Por Talhão</TabsTrigger>
          <TabsTrigger value="comparativo">📈 Comparativos</TabsTrigger>
        </TabsList>

        {/* ════════════ ABA OPERACIONAL ════════════ */}
        <TabsContent value="operacional" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-end">
                <DatePickerField value={filtrosOp.data_inicio} onChange={(v) => setFiltrosOp(f => ({ ...f, data_inicio: v || undefined }))} placeholder="Data início" />
                <DatePickerField value={filtrosOp.data_fim} onChange={(v) => setFiltrosOp(f => ({ ...f, data_fim: v || undefined }))} placeholder="Data fim" />
                <Select value={filtrosOp.talhao_id || '_all'} onValueChange={(v) => setFiltrosOp(f => ({ ...f, talhao_id: v === '_all' ? undefined : v }))}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Talhão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos os talhões</SelectItem>
                    {talhoes.map((t: any) => <SelectItem key={t.talhao_id} value={t.talhao_id}>{t.talhao_nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtrosOp.categoria || '_all'} onValueChange={(v) => setFiltrosOp(f => ({ ...f, categoria: v === '_all' ? undefined : v }))}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas categorias</SelectItem>
                    {(opData.porCategoria.data || []).map((c: any) => <SelectItem key={c.categoria} value={c.categoria}>{c.categoria}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => setFiltrosOp({})}>Limpar</Button>
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Lançamentos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{kpisOp.totalLancamentos}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Custo Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{fmt(kpisOp.custoTotal)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Área Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmtN(kpisOp.areaTotal)} ha</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Custo Médio/ha</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(kpisOp.custoMedioHa)}</div></CardContent></Card>
          </div>

          {/* Toggle gráficos */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setShowChartsOp(!showChartsOp)}>
              {showChartsOp ? <><EyeOff className="h-4 w-4 mr-1" /> Ocultar Gráficos</> : <><Eye className="h-4 w-4 mr-1" /> Mostrar Gráficos</>}
            </Button>
            <BotaoExportacao onExportarPDFCompleto={handlePdfCompletoOp} onExportarPDFSintetico={handlePdfSinteticoOp} onExportarExcel={handleExcelOp} isLoading={opData.lancamentos.isLoading} />
          </div>

          {/* Gráficos */}
          {showChartsOp && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">Custo por Mês</CardTitle></CardHeader><CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMensalOp}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} /><Tooltip formatter={(v: number) => fmt(v)} /><Bar dataKey="custo" name="Custo" fill="hsl(142,70%,40%)" radius={[4,4,0,0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Custo por Categoria</CardTitle></CardHeader><CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={pieCategOp} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {pieCategOp.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
                </ResponsiveContainer>
              </CardContent></Card>
            </div>
          )}

          {/* Tabela */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[{ k: 'data_execucao', l: 'Data' }, { k: 'servico_nome', l: 'Serviço' }, { k: 'servico_categoria', l: 'Categoria' }, { k: 'talhao_nome', l: 'Talhão' }, { k: 'talhao_area_ha', l: 'Área (ha)' }, { k: 'custo_total', l: 'Custo Total' }, { k: 'custo_por_ha', l: 'Custo/ha' }].map(c => (
                      <TableHead key={c.k} className="cursor-pointer select-none" onClick={() => toggleSort(sortOp, c.k, setSortOp)}>
                        <span className="flex items-center">{c.l}<SortIcon col={c.k} current={sortOp} /></span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opData.lancamentos.isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : lancPag.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>
                  ) : lancPag.map((l: any, i: number) => {
                    const custoHa = Number(l.custo_por_ha || 0)
                    const isAlto = custoMedioHaGeral > 0 && custoHa > custoMedioHaGeral * 1.5
                    return (
                      <TableRow key={l.id || i} className={isAlto ? 'bg-amber-50' : ''}>
                        <TableCell>{l.data_execucao ? format(new Date(l.data_execucao), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="font-medium">{l.servico_nome || '-'}</TableCell>
                        <TableCell>{l.servico_categoria || '-'}</TableCell>
                        <TableCell>{l.talhao_nome || '-'}</TableCell>
                        <TableCell>{l.talhao_area_ha ? fmtN(Number(l.talhao_area_ha)) : '-'}</TableCell>
                        <TableCell className="font-medium">{fmt(Number(l.custo_total || 0))}</TableCell>
                        <TableCell className={isAlto ? 'font-bold text-amber-700' : ''}>{custoHa ? fmt(custoHa) : '-'} {isAlto && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-amber-500" />}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                {lancPag.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">TOTAL</TableCell>
                      <TableCell className="font-bold">{fmtN(kpisOp.areaTotal)} ha</TableCell>
                      <TableCell className="font-bold">{fmt(kpisOp.custoTotal)}</TableCell>
                      <TableCell className="font-bold">{fmt(kpisOp.custoMedioHa)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
              {totalPagesOp > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">Página {pageOp + 1} de {totalPagesOp} ({lancOrdenados.length} registros)</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pageOp === 0} onClick={() => setPageOp(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={pageOp >= totalPagesOp - 1} onClick={() => setPageOp(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════ ABA FINANCEIRO ════════════ */}
        <TabsContent value="financeiro" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-end">
                <DatePickerField value={filtrosFin.data_inicio} onChange={(v) => setFiltrosFin(f => ({ ...f, data_inicio: v || undefined }))} placeholder="Data início" />
                <DatePickerField value={filtrosFin.data_fim} onChange={(v) => setFiltrosFin(f => ({ ...f, data_fim: v || undefined }))} placeholder="Data fim" />
                <Select value={filtrosFin.tipo || '_all'} onValueChange={(v) => setFiltrosFin(f => ({ ...f, tipo: v === '_all' ? undefined : v }))}>
                  <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent><SelectItem value="_all">Todos</SelectItem><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
                </Select>
                <Select value={filtrosFin.categoria || '_all'} onValueChange={(v) => setFiltrosFin(f => ({ ...f, categoria: v === '_all' ? undefined : v }))}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent><SelectItem value="_all">Todas</SelectItem>{Object.entries(categoriasFinLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filtrosFin.status || '_all'} onValueChange={(v) => setFiltrosFin(f => ({ ...f, status: v === '_all' ? undefined : v }))}>
                  <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent><SelectItem value="_all">Todos</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem><SelectItem value="vencido">Vencido</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => setFiltrosFin({})}>Limpar</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">💰 Receitas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{fmt(kpisFin.rec)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">💸 Despesas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{fmt(kpisFin.desp)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">⚖️ Saldo</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${kpisFin.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(kpisFin.saldo)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">⚠️ Vencido</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{fmt(kpisFin.vencido)}</div></CardContent></Card>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setShowChartsFin(!showChartsFin)}>
              {showChartsFin ? <><EyeOff className="h-4 w-4 mr-1" /> Ocultar Gráficos</> : <><Eye className="h-4 w-4 mr-1" /> Mostrar Gráficos</>}
            </Button>
            <BotaoExportacao onExportarPDFCompleto={handlePdfCompletoFin} onExportarPDFSintetico={handlePdfSinteticoFin} onExportarExcel={handleExcelFin} />
          </div>

          {showChartsFin && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">Receitas vs Despesas / Mês</CardTitle></CardHeader><CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMensalFin}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: number) => fmt(v)} /><Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="hsl(142,70%,40%)" radius={[4,4,0,0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="hsl(0,72%,51%)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader><CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={pieDespFin} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {pieDespFin.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
                </ResponsiveContainer>
              </CardContent></Card>
            </div>
          )}

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[{ k: 'data_vencimento', l: 'Data Venc.' }, { k: 'descricao', l: 'Descrição' }, { k: 'categoria', l: 'Categoria' }, { k: 'fornecedor_cliente', l: 'Fornecedor/Cliente' }, { k: 'valor', l: 'Valor' }, { k: 'status', l: 'Status' }].map(c => (
                      <TableHead key={c.k} className="cursor-pointer select-none" onClick={() => toggleSort(sortFin, c.k, setSortFin)}>
                        <span className="flex items-center">{c.l}<SortIcon col={c.k} current={sortFin} /></span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finData.transacoes.isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : transPag.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada</TableCell></TableRow>
                  ) : transPag.map((t: any) => {
                    const st = statusEfetivoTransacao(t)
                    return (
                      <TableRow key={t.id} className={st === 'vencido' ? 'bg-red-50' : ''}>
                        <TableCell>{t.data_vencimento ? format(new Date(t.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="font-medium">{t.descricao}</TableCell>
                        <TableCell>{categoriasFinLabel[t.categoria] || t.categoria}</TableCell>
                        <TableCell>{t.fornecedor_cliente || '-'}</TableCell>
                        <TableCell className={`font-medium ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{t.tipo === 'despesa' ? '-' : ''}{fmt(Number(t.valor))}</TableCell>
                        <TableCell><StatusBadge status={st} /></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                {transPag.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold">TOTAIS</TableCell>
                      <TableCell className="font-bold text-green-600">Receitas: {fmt(totaisFin.rec)}</TableCell>
                      <TableCell className="font-bold text-red-600">Despesas: {fmt(totaisFin.desp)}</TableCell>
                      <TableCell className={`font-bold ${totaisFin.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>Saldo: {fmt(totaisFin.saldo)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
              {totalPagesFin > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">Página {pageFin + 1} de {totalPagesFin} ({transOrdenadas.length} registros)</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pageFin === 0} onClick={() => setPageFin(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={pageFin >= totalPagesFin - 1} onClick={() => setPageFin(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════ ABA POR TALHÃO ════════════ */}
        <TabsContent value="talhao" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-end">
                <Select value={talhaoSel || '_all'} onValueChange={(v) => setTalhaoSel(v === '_all' ? '' : v)}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Selecione um talhão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos os talhões (comparativo)</SelectItem>
                    {talhoes.map((t: any) => <SelectItem key={t.talhao_id} value={t.talhao_id}>{t.talhao_nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <DatePickerField value={filtrosTalhao.data_inicio} onChange={(v) => setFiltrosTalhao(f => ({ ...f, data_inicio: v || undefined }))} placeholder="Data início" />
                <DatePickerField value={filtrosTalhao.data_fim} onChange={(v) => setFiltrosTalhao(f => ({ ...f, data_fim: v || undefined }))} placeholder="Data fim" />
              </div>
            </CardContent>
          </Card>

          {!talhaoSel ? (
            <>
              {/* COMPARATIVO */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Talhões</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{kpisTalhaoComp.total}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Maior Custo/ha</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{fmt(kpisTalhaoComp.maiorHa)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Menor Custo/ha</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{fmt(kpisTalhaoComp.menorHa)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Média Geral</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(kpisTalhaoComp.media)}</div></CardContent></Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-base">Custo Total por Talhão</CardTitle></CardHeader><CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={talhoes.slice(0, 10)} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} /><YAxis type="category" dataKey="talhao_nome" width={100} fontSize={10} /><Tooltip formatter={(v: number) => fmt(v)} /><Bar dataKey="custo_total" fill="hsl(142,70%,40%)" radius={[0,4,4,0]} /></BarChart>
                  </ResponsiveContainer>
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">Custo/ha por Talhão</CardTitle></CardHeader><CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...talhoes].sort((a: any, b: any) => Number(b.custo_por_ha || 0) - Number(a.custo_por_ha || 0)).slice(0, 10)} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} /><YAxis type="category" dataKey="talhao_nome" width={100} fontSize={10} /><Tooltip formatter={(v: number) => fmt(v)} /><Bar dataKey="custo_por_ha" fill="hsl(200,70%,50%)" radius={[0,4,4,0]} /></BarChart>
                  </ResponsiveContainer>
                </CardContent></Card>
              </div>

              <Card><CardContent className="pt-4">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Talhão</TableHead><TableHead>Área (ha)</TableHead><TableHead>Lançamentos</TableHead><TableHead>Custo Total</TableHead><TableHead>Custo/ha</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {talhoes.map((t: any) => (
                      <TableRow key={t.talhao_id} className="cursor-pointer hover:bg-muted/50" onClick={() => setTalhaoSel(t.talhao_id)}>
                        <TableCell className="font-medium">{t.talhao_nome || '-'}</TableCell>
                        <TableCell>{t.area_ha ? fmtN(Number(t.area_ha)) : '-'}</TableCell>
                        <TableCell>{t.total_lancamentos || 0}</TableCell>
                        <TableCell className="font-medium">{fmt(Number(t.custo_total || 0))}</TableCell>
                        <TableCell>{t.custo_por_ha ? fmt(Number(t.custo_por_ha)) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </>
          ) : (
            <>
              {/* DETALHE DO TALHÃO */}
              {talhaoDetalhe && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-6">
                      <div><span className="text-sm text-muted-foreground">Talhão</span><p className="text-lg font-bold">{talhaoDetalhe.talhao_nome}</p></div>
                      <div><span className="text-sm text-muted-foreground">Área</span><p className="text-lg font-bold">{talhaoDetalhe.area_ha ? `${fmtN(Number(talhaoDetalhe.area_ha))} ha` : '-'}</p></div>
                      <div><span className="text-sm text-muted-foreground">Total Investido</span><p className="text-lg font-bold text-red-600">{fmt(Number(talhaoDetalhe.custo_total || 0))}</p></div>
                      <div><span className="text-sm text-muted-foreground">Custo/ha</span><p className="text-lg font-bold">{talhaoDetalhe.custo_por_ha ? fmt(Number(talhaoDetalhe.custo_por_ha)) : '-'}</p></div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card><CardContent className="pt-4">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Data</TableHead><TableHead>Serviço</TableHead><TableHead>Categoria</TableHead><TableHead>Custo</TableHead><TableHead>Custo/ha</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {talhaoData.lancamentos.isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : lancTalhao.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum lançamento</TableCell></TableRow>
                    ) : lancTalhao.map((l: any, i: number) => (
                      <TableRow key={l.id || i}>
                        <TableCell>{l.data_execucao ? format(new Date(l.data_execucao), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="font-medium">{l.servico_nome || '-'}</TableCell>
                        <TableCell>{l.servico_categoria || '-'}</TableCell>
                        <TableCell className="font-medium">{fmt(Number(l.custo_total || 0))}</TableCell>
                        <TableCell>{l.custo_por_ha ? fmt(Number(l.custo_por_ha)) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </>
          )}
        </TabsContent>

        {/* ════════════ ABA COMPARATIVOS ════════════ */}
        <TabsContent value="comparativo" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-end">
                <span className="text-sm text-muted-foreground">Selecione safras para comparar:</span>
                {safras.map((s: any) => {
                  const id = typeof s === 'object' ? s.id : s
                  const nome = typeof s === 'object' ? s.nome : s
                  const sel = safraCompIds.includes(id)
                  return (
                    <Button key={id} variant={sel ? 'default' : 'outline'} size="sm" onClick={() => {
                      if (sel) setSafraCompIds(safraCompIds.filter(x => x !== id))
                      else if (safraCompIds.length < 3) setSafraCompIds([...safraCompIds, id])
                    }}>
                      {nome}
                    </Button>
                  )
                })}
                {safraCompIds.length === 0 && <span className="text-xs text-muted-foreground">(mostrando safra atual)</span>}
              </div>
            </CardContent>
          </Card>

          {compResults.length > 0 && (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {compResults.map((r: any, i: number) => {
                  const safra = safras.find((s: any) => (typeof s === 'object' ? s.id : s) === r.safra_id)
                  const nome = safra && typeof safra === 'object' ? safra.nome : r.safra_id
                  const prev = i > 0 ? compResults[i - 1] : null
                  const diff = prev && prev.custoTotal > 0 ? ((r.custoTotal - prev.custoTotal) / prev.custoTotal * 100) : null
                  return (
                    <Card key={r.safra_id}>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{nome}</CardTitle></CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{fmt(r.custoTotal)}</div>
                        <div className="text-sm text-muted-foreground">{fmtN(r.areaTotal)} ha · {fmt(r.custoHa)}/ha</div>
                        {diff !== null && (
                          <Badge variant="outline" className={diff > 0 ? 'text-red-600 mt-1' : 'text-green-600 mt-1'}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}% vs anterior
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Evolução mensal */}
              <Card><CardHeader><CardTitle className="text-base">Evolução Mensal de Custos</CardTitle></CardHeader><CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" fontSize={11} allowDuplicatedCategory={false} /><YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} /><Tooltip formatter={(v: number) => fmt(v)} /><Legend />
                    {compResults.map((r: any, i: number) => {
                      const safra = safras.find((s: any) => (typeof s === 'object' ? s.id : s) === r.safra_id)
                      const nome = safra && typeof safra === 'object' ? safra.nome : `Safra ${i + 1}`
                      const colors = ['hsl(142,70%,40%)', 'hsl(200,70%,50%)', 'hsl(40,90%,50%)']
                      const chartData = (r.meses || []).map((m: any) => ({ mes: m.mes ? format(new Date(m.mes), 'MMM/yy', { locale: ptBR }) : '—', custo: Number(m.custo_total_mes || 0) }))
                      return <Line key={r.safra_id} data={chartData} dataKey="custo" name={nome} stroke={colors[i % 3]} strokeWidth={2} dot={{ r: 3 }} />
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent></Card>

              {/* Tabela resumo */}
              <Card><CardContent className="pt-4">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Safra</TableHead><TableHead>Lançamentos</TableHead><TableHead>Custo Total</TableHead><TableHead>Área Total</TableHead><TableHead>Custo/ha Médio</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {compResults.map((r: any) => {
                      const safra = safras.find((s: any) => (typeof s === 'object' ? s.id : s) === r.safra_id)
                      const nome = safra && typeof safra === 'object' ? safra.nome : r.safra_id
                      return (
                        <TableRow key={r.safra_id}>
                          <TableCell className="font-medium">{nome}</TableCell>
                          <TableCell>{r.totalLancamentos}</TableCell>
                          <TableCell className="font-medium">{fmt(r.custoTotal)}</TableCell>
                          <TableCell>{fmtN(r.areaTotal)} ha</TableCell>
                          <TableCell>{fmt(r.custoHa)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
