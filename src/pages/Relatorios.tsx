import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart3, ClipboardList, DollarSign, Sprout, TrendingUp, Package,
  ArrowUpDown, ChevronUp, ChevronDown, Download, FileX, Lock, Circle, Leaf,
} from 'lucide-react'
import {
  BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useGlobal } from '@/contexts/GlobalContext'

/* ───────────────── helpers ───────────────── */
const fmt = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN = (v: number, d = 2) =>
  (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtPct = (v: number) => `${(Number(v) || 0).toFixed(1)}%`
const fmtData = (s?: string) => (s ? format(new Date(String(s).substring(0, 10) + 'T12:00:00'), 'dd/MM/yyyy') : '-')

const PALETTE = [
  'hsl(142,70%,40%)', 'hsl(0,72%,51%)', 'hsl(40,90%,50%)', 'hsl(200,70%,50%)',
  'hsl(270,60%,50%)', 'hsl(180,60%,40%)', 'hsl(20,80%,55%)', 'hsl(330,65%,55%)',
  'hsl(90,60%,40%)', 'hsl(260,60%,55%)',
]

const db = supabase as any

/* CSV helpers (BOM UTF-8) */
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: any) => {
    const s = String(v ?? '')
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* Sort icon */
function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
  return dir === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
}

/* gradiente de cores por valor (amarelo → vermelho) */
function colorScale(value: number, max: number) {
  if (max <= 0) return 'hsl(50,80%,55%)'
  const t = Math.min(1, value / max)
  // hue 50 (amarelo) → 0 (vermelho)
  const hue = 50 - t * 50
  return `hsl(${hue.toFixed(0)},80%,50%)`
}

/* ════════════════════════════════════════════════
   PÁGINA
   ════════════════════════════════════════════════ */
export function Relatorios() {
  const { propriedadeAtual, safraAtual } = useGlobal()
  const propId = propriedadeAtual?.id || ''
  const safraId = safraAtual?.id || ''
  const semContexto = !propId || !safraId

  if (semContexto) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Selecione uma propriedade e safra</p>
        <p className="text-sm">Use o seletor no topo para ver os relatórios.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">
          {propriedadeAtual?.nome} · {safraAtual?.nome}
        </p>
      </div>

      <Tabs defaultValue="operacional" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="operacional"><ClipboardList className="h-4 w-4 mr-1" />Operacional</TabsTrigger>
          <TabsTrigger value="financeiro"><DollarSign className="h-4 w-4 mr-1" />Financeiro</TabsTrigger>
          <TabsTrigger value="talhao"><Sprout className="h-4 w-4 mr-1" />Por Talhão</TabsTrigger>
          <TabsTrigger value="comparativo"><TrendingUp className="h-4 w-4 mr-1" />Comparativo</TabsTrigger>
          <TabsTrigger value="insumos"><Package className="h-4 w-4 mr-1" />Insumos</TabsTrigger>
        </TabsList>

        <TabsContent value="operacional"><AbaOperacional propId={propId} safraId={safraId} /></TabsContent>
        <TabsContent value="financeiro"><AbaFinanceiro propId={propId} safraId={safraId} /></TabsContent>
        <TabsContent value="talhao"><AbaPorTalhao propId={propId} safraId={safraId} /></TabsContent>
        <TabsContent value="comparativo"><AbaComparativo propId={propId} safraAtualId={safraId} /></TabsContent>
        <TabsContent value="insumos"><AbaInsumos propId={propId} safraId={safraId} /></TabsContent>
      </Tabs>
    </div>
  )
}

/* ════════════════════════════════════════════════
   ABA 1 — OPERACIONAL
   ════════════════════════════════════════════════ */
function AbaOperacional({ propId, safraId }: { propId: string; safraId: string }) {
  const lancQ = useQuery({
    queryKey: ['rel-op-lanc', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_relatorio_lancamentos', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
  })
  const catQ = useQuery({
    queryKey: ['rel-op-cat', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_relatorio_por_categoria', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
  })

  const [filtroCat, setFiltroCat] = useState<string>('_all')
  const [filtroTalhao, setFiltroTalhao] = useState<string>('_all')
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'data_execucao', dir: 'desc' })
  const [page, setPage] = useState(0)
  const PER = 10

  const lanc = lancQ.data || []
  const cats = catQ.data || []

  const talhoesUnicos = useMemo(() => {
    const m = new Map<string, string>()
    lanc.forEach((l: any) => { if (l.talhao_id) m.set(l.talhao_id, l.talhao_nome || '—') })
    return Array.from(m.entries())
  }, [lanc])

  const filtrados = useMemo(() => {
    return lanc.filter((l: any) =>
      (filtroCat === '_all' || l.servico_categoria === filtroCat) &&
      (filtroTalhao === '_all' || l.talhao_id === filtroTalhao)
    )
  }, [lanc, filtroCat, filtroTalhao])

  const ordenados = useMemo(() => {
    const arr = [...filtrados]
    arr.sort((a: any, b: any) => {
      const va = a[sort.col], vb = b[sort.col]
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtrados, sort])

  const totalPages = Math.max(1, Math.ceil(ordenados.length / PER))
  const pageData = ordenados.slice(page * PER, (page + 1) * PER)

  const kpis = useMemo(() => {
    const total = lanc.length
    const custo = lanc.reduce((s: number, l: any) => s + Number(l.custo_total || 0), 0)
    const areas = new Set<string>()
    let area = 0
    lanc.forEach((l: any) => {
      if (l.talhao_id && !areas.has(l.talhao_id)) {
        areas.add(l.talhao_id)
        area += Number(l.talhao_area_ha || 0)
      }
    })
    return {
      total,
      custo,
      medio: total > 0 ? custo / total : 0,
      custoHa: area > 0 ? custo / area : 0,
    }
  }, [lanc])

  const toggleSort = (col: string) =>
    setSort((c) => (c.col === col ? { col, dir: c.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))

  const exportCSV = () => {
    const headers = ['Data', 'Serviço', 'Categoria', 'Talhão', 'Área (ha)', 'Custo Total', 'Custo/ha', 'Observações']
    const rows = ordenados.map((l: any) => [
      fmtData(l.data_execucao), l.servico_nome || '', l.servico_categoria || '',
      l.talhao_nome || '', Number(l.talhao_area_ha || 0),
      Number(l.custo_total || 0), Number(l.custo_por_ha || 0), l.observacoes || '',
    ])
    downloadCSV(`relatorio-operacional-${Date.now()}.csv`, headers, rows)
  }

  if (lancQ.isLoading || catQ.isLoading) return <SkeletonAba />

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total de Lançamentos" value={String(kpis.total)} />
        <KpiCard title="Custo Total" value={fmt(kpis.custo)} accent="negative" />
        <KpiCard title="Custo Médio / Lançamento" value={fmt(kpis.medio)} />
        <KpiCard title="Custo Médio / Hectare" value={fmt(kpis.custoHa)} />
      </div>

      {/* Gráfico por categoria */}
      <Card>
        <CardHeader><CardTitle className="text-base">Custo por Categoria</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {cats.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoria" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, n: string) =>
                    n === 'custo_total' ? [fmt(Number(v)), 'Custo'] : [v, 'Lançamentos']
                  }
                />
                <Legend />
                <Bar dataKey="custo_total" name="Custo Total" fill="hsl(142,70%,40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Filtros + export */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground">Categoria</label>
            <Select value={filtroCat} onValueChange={(v) => { setFiltroCat(v); setPage(0) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {cats.map((c: any) => (
                  <SelectItem key={c.categoria} value={c.categoria}>{c.categoria}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground">Talhão</label>
            <Select value={filtroTalhao} onValueChange={(v) => { setFiltroTalhao(v); setPage(0) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {talhoesUnicos.map(([id, nome]) => (
                  <SelectItem key={id} value={id}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={ordenados.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-4">
          {ordenados.length === 0 ? (
            <EmptyState message="Nenhum lançamento encontrado" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('data_execucao')}>
                      <span className="flex items-center">Data<SortIcon active={sort.col === 'data_execucao'} dir={sort.dir} /></span>
                    </TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Talhão</TableHead>
                    <TableHead className="text-right">Área (ha)</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('custo_total')}>
                      <span className="flex items-center justify-end">Custo Total<SortIcon active={sort.col === 'custo_total'} dir={sort.dir} /></span>
                    </TableHead>
                    <TableHead className="text-right">Custo/ha</TableHead>
                    <TableHead>Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((l: any, i: number) => (
                    <TableRow key={l.id || i}>
                      <TableCell>{fmtData(l.data_execucao)}</TableCell>
                      <TableCell className="font-medium">{l.servico_nome || '-'}</TableCell>
                      <TableCell>{l.servico_categoria || '-'}</TableCell>
                      <TableCell>{l.talhao_nome || '-'}</TableCell>
                      <TableCell className="text-right">{l.talhao_area_ha ? fmtN(Number(l.talhao_area_ha)) : '-'}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(l.custo_total || 0))}</TableCell>
                      <TableCell className="text-right">{l.custo_por_ha ? fmt(Number(l.custo_por_ha)) : '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">{l.observacoes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={page} totalPages={totalPages} total={ordenados.length} onChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ════════════════════════════════════════════════
   ABA 2 — FINANCEIRO
   ════════════════════════════════════════════════ */
function AbaFinanceiro({ propId, safraId }: { propId: string; safraId: string }) {
  const evolQ = useQuery({
    queryKey: ['rel-fin-evol', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_evolucao_mensal', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
  })
  const fluxoQ = useQuery({
    queryKey: ['rel-fin-fluxo', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_fluxo_caixa_mensal', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
  })
  const breakQ = useQuery({
    queryKey: ['rel-fin-break', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_breakdown_custos', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
  })

  const evol = evolQ.data || []
  const fluxo = fluxoQ.data || []
  const breakdown = breakQ.data || []

  const kpis = useMemo(() => {
    const receita = evol.reduce((s: number, m: any) => s + Number(m.receita || 0), 0)
    const custoLanc = evol.reduce((s: number, m: any) => s + Number(m.custo_lancamentos || 0), 0)
    const custoFin = evol.reduce((s: number, m: any) => s + Number(m.custo_financeiro || 0), 0)
    const custo = custoLanc + custoFin
    const resultado = receita - custo
    const margem = receita > 0 ? (resultado / receita) * 100 : 0
    return { receita, custo, resultado, margem }
  }, [evol])

  const evolChart = useMemo(() =>
    evol.map((m: any) => ({
      mes: m.mes_label || (m.mes ? format(new Date(String(m.mes).substring(0, 10) + 'T12:00:00'), 'MMM/yy', { locale: ptBR }) : '—'),
      custo_lancamentos: Number(m.custo_lancamentos || 0),
      custo_financeiro: Number(m.custo_financeiro || 0),
      resultado_acum: Number(m.resultado_acum || 0),
    })), [evol])

  const fluxoChart = useMemo(() =>
    fluxo.map((m: any) => ({
      mes: m.mes_label || (m.mes ? format(new Date(String(m.mes).substring(0, 10) + 'T12:00:00'), 'MMM/yy', { locale: ptBR }) : '—'),
      receitas: Number(m.total_receitas || 0),
      despesas: Number(m.total_despesas || 0),
      saldo: Number(m.saldo_mes || 0),
    })), [fluxo])

  const breakTotal = breakdown.reduce((s: number, b: any) => s + Number(b.valor_total || 0), 0)
  const breakChart = useMemo(() =>
    breakdown.map((b: any) => ({
      name: b.categoria || 'Outros',
      value: Number(b.valor_total || 0),
      origem: b.origem || '',
      pct: breakTotal > 0 ? (Number(b.valor_total || 0) / breakTotal) * 100 : 0,
    })), [breakdown, breakTotal])

  if (evolQ.isLoading || fluxoQ.isLoading || breakQ.isLoading) return <SkeletonAba />

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Receita Total" value={fmt(kpis.receita)} accent="positive" />
        <KpiCard title="Custo Total" value={fmt(kpis.custo)} accent="negative" />
        <KpiCard title="Resultado Final" value={fmt(kpis.resultado)} accent={kpis.resultado >= 0 ? 'positive' : 'negative'} />
        <KpiCard title="Margem %" value={fmtPct(kpis.margem)} accent={kpis.margem >= 0 ? 'positive' : 'negative'} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolução Mensal</CardTitle></CardHeader>
        <CardContent className="h-[320px]">
          {evolChart.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evolChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(Number(v))} />
                <Legend />
                <Bar yAxisId="left" dataKey="custo_lancamentos" name="Custo Lançamentos" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="custo_financeiro" name="Custo Financeiro" fill="hsl(20,80%,55%)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="resultado_acum" name="Resultado Acum." stroke="hsl(200,70%,50%)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Fluxo de Caixa Mensal</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {fluxoChart.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fluxoChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(Number(v))} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(142,70%,40%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(200,70%,50%)" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Breakdown de Custos</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {breakChart.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}
                  >
                    {breakChart.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, _: any, item: any) => [
                      `${fmt(Number(v))} (${item.payload.pct.toFixed(1)}%)`,
                      item.payload.origem ? `${item.payload.name} · ${item.payload.origem}` : item.payload.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   ABA 3 — POR TALHÃO
   ════════════════════════════════════════════════ */
function AbaPorTalhao({ propId, safraId }: { propId: string; safraId: string }) {
  const talhaoQ = useQuery({
    queryKey: ['rel-talhao', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_relatorio_por_talhao', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
  })
  const rentQ = useQuery({
    queryKey: ['rel-talhao-rent', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_rentabilidade_por_talhao', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
  })

  const base = talhaoQ.data || []
  const rent = rentQ.data || []

  const cards = useMemo(() => {
    const rentMap = new Map<string, any>()
    rent.forEach((r: any) => rentMap.set(r.talhao_id, r))
    return base.map((t: any) => {
      const r = rentMap.get(t.talhao_id) || {}
      return {
        talhao_id: t.talhao_id,
        nome: t.talhao_nome || '—',
        cultura: r.cultura_nome || t.cultura_nome || '',
        unidade: r.unidade_label || 'un',
        area: Number(t.area_ha || r.area_ha || 0),
        custo: Number(t.custo_total || 0),
        custoHa: Number(t.custo_por_ha || 0),
        ops: Number(t.total_lancamentos || 0),
        colhida: Number(r.quantidade_colhida || 0),
        produtividade: Number(r.produtividade_ha || 0),
        receita: Number(r.receita_estimada || 0),
        resultado: Number(r.resultado_estimado || 0),
        primeira: t.primeira_operacao || r.primeira_operacao,
        ultima: t.ultima_operacao || r.ultima_operacao,
      }
    })
  }, [base, rent])

  const chartData = useMemo(() =>
    [...cards].sort((a, b) => b.custo - a.custo).map((c) => ({
      nome: c.nome, custo_total: c.custo, receita_estimada: c.receita,
    })), [cards])

  if (talhaoQ.isLoading || rentQ.isLoading) return <SkeletonAba />
  if (cards.length === 0) return <Card><CardContent className="pt-6"><EmptyState message="Nenhum talhão com operações nesta safra" /></CardContent></Card>

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.talhao_id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{c.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.cultura ? <><Leaf className="inline h-3 w-3 mr-1" />{c.cultura} · </> : null}
                    {fmtN(c.area)} ha
                  </p>
                </div>
                <Badge variant="outline">{c.ops} {c.ops === 1 ? 'op.' : 'ops.'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Custo Total</p>
                  <p className="font-semibold text-destructive">{fmt(c.custo)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo / ha</p>
                  <p className="font-semibold">{fmt(c.custoHa)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Colhido</p>
                  <p className="font-semibold">{c.colhida > 0 ? `${fmtN(c.colhida)} ${c.unidade}` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Produtividade / ha</p>
                  <p className="font-semibold">{c.produtividade > 0 ? `${fmtN(c.produtividade)} ${c.unidade}/ha` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receita estimada</p>
                  <p className="font-semibold text-success">{fmt(c.receita)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Resultado estimado</p>
                  <p className={`font-semibold ${c.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(c.resultado)}</p>
                </div>
              </div>
              {(c.primeira || c.ultima) && (
                <p className="text-xs text-muted-foreground border-t pt-2">
                  Período: {fmtData(c.primeira)} → {fmtData(c.ultima)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Custo vs Receita por Talhão</CardTitle></CardHeader>
        <CardContent style={{ height: Math.max(280, chartData.length * 42 + 60) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="nome" fontSize={11} width={120} />
              <Tooltip formatter={(v: number) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="custo_total" name="Custo" fill="hsl(0,72%,51%)" />
              <Bar dataKey="receita_estimada" name="Receita estimada" fill="hsl(142,70%,40%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

/* ════════════════════════════════════════════════
   ABA 4 — COMPARATIVO DE SAFRAS
   ════════════════════════════════════════════════ */
function AbaComparativo({ propId, safraAtualId }: { propId: string; safraAtualId: string }) {
  const compQ = useQuery({
    queryKey: ['rel-comp-safras', propId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_comparativo_safras', {
        p_propriedade_id: propId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
  })

  const safras = (compQ.data || []).slice().sort((a: any, b: any) =>
    String(a.safra_nome || '').localeCompare(String(b.safra_nome || ''))
  )

  const chart = safras
    .filter((s: any) => Number(s.custo_total || 0) > 0)
    .map((s: any) => ({
      safra: s.safra_nome,
      receita: Number(s.receita || 0),
      custo: Number(s.custo_total || 0),
      margem_pct: Number(s.margem_pct || 0),
    }))

  const renderStatus = (s: any) => {
    if (s.fechada) return <Badge variant="outline" className="border-warning text-warning"><Lock className="h-3 w-3 mr-1" />Fechada</Badge>
    if (s.ativa) return <Badge variant="outline" className="border-success text-success"><Circle className="h-3 w-3 mr-1 fill-success" />Ativa</Badge>
    return <Badge variant="outline" className="text-muted-foreground"><Circle className="h-3 w-3 mr-1" />Inativa</Badge>
  }

  if (compQ.isLoading) return <SkeletonAba />
  if (safras.length === 0) return <Card><CardContent className="pt-6"><EmptyState message="Nenhuma safra para comparar" /></CardContent></Card>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Comparativo Detalhado</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Safra</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Custo Total</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Margem %</TableHead>
                <TableHead className="text-right">Área (ha)</TableHead>
                <TableHead className="text-right">Custo/ha</TableHead>
                <TableHead className="text-right">Lançamentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safras.map((s: any) => {
                const resultado = Number(s.resultado || (Number(s.receita || 0) - Number(s.custo_total || 0)))
                const isAtual = s.safra_id === safraAtualId
                return (
                  <TableRow key={s.safra_id} className={isAtual ? 'bg-muted/40' : ''}>
                    <TableCell className="font-medium">
                      {s.safra_nome}
                      {isAtual && <Badge variant="secondary" className="ml-2 text-xs">atual</Badge>}
                    </TableCell>
                    <TableCell>{renderStatus(s)}</TableCell>
                    <TableCell className="text-right">{fmt(Number(s.receita || 0))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(s.custo_total || 0))}</TableCell>
                    <TableCell className={`text-right font-semibold ${resultado >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {fmt(resultado)}
                    </TableCell>
                    <TableCell className="text-right">{fmtPct(Number(s.margem_pct || 0))}</TableCell>
                    <TableCell className="text-right">{fmtN(Number(s.area_ha || 0))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(s.custo_por_ha || 0))}</TableCell>
                    <TableCell className="text-right">{Number(s.total_lancamentos || 0)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Receita × Custo × Margem</CardTitle></CardHeader>
        <CardContent className="h-[340px]">
          {chart.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="safra" fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip formatter={(v: number, n: string) => n === 'margem_pct' ? [`${Number(v).toFixed(1)}%`, 'Margem'] : [fmt(Number(v)), n === 'receita' ? 'Receita' : 'Custo']} />
                <Legend />
                <Bar yAxisId="left" dataKey="receita" name="Receita" fill="hsl(142,70%,40%)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="custo" name="Custo" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="margem_pct" name="Margem %" stroke="hsl(200,70%,50%)" strokeWidth={2} />
                <ReferenceLine yAxisId="right" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ════════════════════════════════════════════════
   ABA 5 — INSUMOS
   ════════════════════════════════════════════════ */
function AbaInsumos({ propId, safraId }: { propId: string; safraId: string }) {
  const insQ = useQuery({
    queryKey: ['rel-insumos', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_custo_por_insumo', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
  })

  const itens = useMemo(() => {
    const arr = (insQ.data || []).slice()
    arr.sort((a: any, b: any) => Number(b.custo_total || 0) - Number(a.custo_total || 0))
    return arr
  }, [insQ.data])

  const total = itens.reduce((s: number, i: any) => s + Number(i.custo_total || 0), 0)
  const maxCusto = itens.length ? Number(itens[0].custo_total || 0) : 0
  const top1 = itens[0]

  const top10 = itens.slice(0, 10).map((i: any) => ({
    nome: i.produto_nome || '—',
    valor: Number(i.custo_total || 0),
  }))

  const exportCSV = () => {
    const headers = ['#', 'Produto', 'Unidade', 'Qtd Total', 'Custo Total', 'Custo Unitário Médio', '% do Total', 'Talhões']
    const rows = itens.map((i: any, idx: number) => [
      idx + 1, i.produto_nome || '', i.unidade || '',
      Number(i.quantidade_total || 0), Number(i.custo_total || 0),
      Number(i.custo_unitario_medio || 0),
      total > 0 ? ((Number(i.custo_total || 0) / total) * 100).toFixed(2) : '0',
      i.talhoes || '',
    ])
    downloadCSV(`insumos-${Date.now()}.csv`, headers, rows)
  }

  if (insQ.isLoading) return <SkeletonAba />
  if (itens.length === 0) return <Card><CardContent className="pt-6"><EmptyState message="Nenhum insumo registrado nesta safra" /></CardContent></Card>

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <KpiCard title="Total gasto em insumos" value={fmt(total)} accent="negative" />
        <KpiCard title="Insumo mais caro" value={top1?.produto_nome || '—'} subValue={top1 ? fmt(Number(top1.custo_total || 0)) : ''} />
        <KpiCard title="Insumos distintos" value={String(itens.length)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 — Custo por Insumo</CardTitle></CardHeader>
        <CardContent style={{ height: Math.max(280, top10.length * 36 + 60) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="nome" fontSize={11} width={140} />
              <Tooltip formatter={(v: number) => fmt(Number(v))} />
              <Bar dataKey="valor" name="Custo">
                {top10.map((d, i) => <Cell key={i} fill={colorScale(d.valor, maxCusto)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ranking de Insumos</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Qtd Total</TableHead>
                <TableHead className="text-right">Custo Total</TableHead>
                <TableHead className="text-right">Custo Unit. Médio</TableHead>
                <TableHead className="w-[180px]">% do Total</TableHead>
                <TableHead>Talhões</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((i: any, idx: number) => {
                const pct = total > 0 ? (Number(i.custo_total || 0) / total) * 100 : 0
                const isTop = idx === 0
                return (
                  <TableRow key={i.produto_id || idx} className={isTop ? 'bg-warning/10' : ''}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className={isTop ? 'font-semibold' : 'font-medium'}>{i.produto_nome || '—'}</TableCell>
                    <TableCell>{i.unidade || '-'}</TableCell>
                    <TableCell className="text-right">{fmtN(Number(i.quantidade_total || 0))}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(Number(i.custo_total || 0))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(i.custo_unitario_medio || 0))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{i.talhoes || '-'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

/* ════════════════════════════════════════════════
   COMPONENTES UTILITÁRIOS
   ════════════════════════════════════════════════ */
function KpiCard({ title, value, subValue, accent }: { title: string; value: string; subValue?: string; accent?: 'positive' | 'negative' }) {
  const cls = accent === 'positive' ? 'text-success' : accent === 'negative' ? 'text-destructive' : 'text-foreground'
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${cls} truncate`}>{value}</div>
        {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
      </CardContent>
    </Card>
  )
}

function SkeletonAba() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-[280px]" />
      <Skeleton className="h-[200px]" />
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
      <BarChart3 className="h-10 w-10 opacity-40 mb-2" />
      <p className="text-sm">Sem dados para exibir</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FileX className="h-10 w-10 opacity-40 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function Pagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (n: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages} ({total} registros)</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>Anterior</Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>Próxima</Button>
      </div>
    </div>
  )
}

export default Relatorios
