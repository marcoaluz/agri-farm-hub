import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart3, ClipboardList, DollarSign, Sprout, TrendingUp, Package,
  ArrowUpDown, ChevronUp, ChevronDown, Download, FileX, Lock, Circle, Leaf,
  FileSpreadsheet, FileText, ListTree, AlertTriangle, Tractor, ShieldCheck, ShieldAlert,



} from 'lucide-react'
import { PrateleiraIcon } from '@/components/icons/PrateleiraIcon'
import {
  BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { PizzaCategoria } from '@/components/charts/PizzaCategoria'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { useGlobal } from '@/contexts/GlobalContext'
import { cn } from '@/lib/utils'


import { exportarExcel, exportarPDF, exportarCustosDetalhadosPDF, exportarEstoquePDF, exportarInsumosPDF, exportarObservacoesPDF, exportarMaquinasPDF, type Coluna } from '@/lib/exportTabela'
import { TRANSACAO_CATEGORIA_LABELS } from '@/lib/enumLabels'

function labelGrupo(valor: any): string {
  const v = String(valor ?? '')
  if (!v) return ''
  if (TRANSACAO_CATEGORIA_LABELS[v]) return TRANSACAO_CATEGORIA_LABELS[v]
  return v
    .replace(/_/g, ' ')
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}


/* ───────────────── helpers ───────────────── */
const fmt = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN = (v: number, d = 2) =>
  (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtPct = (v: number) => `${(Number(v) || 0).toFixed(1)}%`
const fmtData = (s?: string) => (s ? format(new Date(String(s).substring(0, 10) + 'T12:00:00'), 'dd/MM/yyyy') : '-')

// Remove sufixo entre parênteses do fim da unidade (ex: "Sacas (60kg)" -> "Sacas")
const unidadeCurta = (u?: string) => (u || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

// Formata só a coluna de Quantidade de um item Operacional, de acordo com o tipo.
// Nota: item.vezes (quantas vezes o item apareceu no lançamento) continua vindo do backend
// normalmente, só não é mais exibido aqui — fica disponível pra reexibir no futuro sem precisar
// mudar o RPC de novo.
const formatarQtdeOperacional = (item: any): string => {
  const qtd = item.quantidade != null ? fmtN(Number(item.quantidade)) : null
  const un = unidadeCurta(item.unidade)
  switch (item.tipo_ref) {
    case 'produto':
      return qtd != null ? `${qtd} (${un})` : '-'
    case 'maquina':
    case 'servico_simples':
      return qtd != null ? `${qtd}(${un})` : '-'
    case 'abastecimento':
      return qtd != null ? `(${qtd} ${un})` : '-'
    case 'manutencao':
      return qtd != null ? qtd : '-'
    default:
      return qtd != null ? `${qtd}${un ? ` (${un})` : ''}` : '-'
  }
}

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

/* Botões de exportação reutilizáveis */
function ExportButtons({
  propriedadeNome, nomeAba, nomeArquivo, colunas, linhas, safraNome,
}: {
  propriedadeNome: string
  nomeAba: string
  nomeArquivo: string
  colunas: Coluna[]
  linhas: any[]
  safraNome?: string
}) {
  const disabled = !linhas || linhas.length === 0
  return (
    <div className="flex flex-wrap justify-end gap-2 mb-2">
      <Button
        variant="outline" size="sm" disabled={disabled} className="flex-1 sm:flex-none min-w-[140px]"
        onClick={async () => { await exportarPDF({ nomeArquivo, propriedadeNome, nomeAba, colunas, linhas, safraNome }) }}
      >
        <FileText className="h-4 w-4 mr-1" /> Exportar PDF
      </Button>
      <Button
        variant="outline" size="sm" disabled={disabled} className="flex-1 sm:flex-none min-w-[140px]"
        onClick={() => exportarExcel({ nomeArquivo, nomeAba, colunas, linhas, propriedadeNome, safraNome })}
      >
        <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
      </Button>
    </div>

  )
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
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full">
            <TabsTrigger value="operacional" className="whitespace-nowrap"><ClipboardList className="h-4 w-4 mr-1" />Operacional</TabsTrigger>
            <TabsTrigger value="financeiro" className="whitespace-nowrap"><DollarSign className="h-4 w-4 mr-1" />Financeiro</TabsTrigger>
            <TabsTrigger value="talhao" className="whitespace-nowrap"><Sprout className="h-4 w-4 mr-1" />Por Talhão</TabsTrigger>
            <TabsTrigger value="comparativo" className="whitespace-nowrap"><TrendingUp className="h-4 w-4 mr-1" />Comparativo</TabsTrigger>
            <TabsTrigger value="insumos" className="whitespace-nowrap"><Package className="h-4 w-4 mr-1" />Insumos</TabsTrigger>
            <TabsTrigger value="custos" className="whitespace-nowrap"><ListTree className="h-4 w-4 mr-1" />Custos Detalhados</TabsTrigger>
            <TabsTrigger value="estoque" className="whitespace-nowrap"><PrateleiraIcon className="h-4 w-4 mr-1" />Estoque/Insumos</TabsTrigger>

            <TabsTrigger value="observacoes" className="whitespace-nowrap"><ClipboardList className="h-4 w-4 mr-1" />Observações</TabsTrigger>
            <TabsTrigger value="maquinas" className="whitespace-nowrap"><Tractor className="h-4 w-4 mr-1" />Máquinas</TabsTrigger>
            <TabsTrigger value="sanidade" className="whitespace-nowrap"><ShieldCheck className="h-4 w-4 mr-1" />Sanidade</TabsTrigger>


          </TabsList>
        </div>


        <TabsContent value="operacional"><AbaOperacional propId={propId} safraId={safraId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>
        <TabsContent value="financeiro"><AbaFinanceiro propId={propId} safraId={safraId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>
        <TabsContent value="talhao"><AbaPorTalhao propId={propId} safraId={safraId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>
        <TabsContent value="comparativo"><AbaComparativo propId={propId} safraAtualId={safraId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>
        <TabsContent value="insumos"><AbaInsumos propId={propId} safraId={safraId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>
        <TabsContent value="custos"><AbaCustosDetalhados propId={propId} safraId={safraId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>
        <TabsContent value="estoque"><AbaEstoque propId={propId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>

        <TabsContent value="observacoes"><AbaObservacoes propId={propId} safraId={safraId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>
        <TabsContent value="maquinas"><AbaMaquinas propId={propId} safraId={safraId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>
        <TabsContent value="sanidade"><AbaSanidade propId={propId} propriedadeNome={propriedadeAtual?.nome || ''} /></TabsContent>



      </Tabs>
    </div>
  )
}

/* ════════════════════════════════════════════════
   ABA 1 — OPERACIONAL
   ════════════════════════════════════════════════ */
function AbaOperacional({ propId, safraId, propriedadeNome }: { propId: string; safraId: string; propriedadeNome: string }) {
  const { safraAtual } = useGlobal()
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
  const cats = (catQ.data || []).map((c: any) => ({
    categoria: c.out_categoria || 'Outros',
    custo_total: Number(c.custo_total || 0),
    total_lancamentos: c.total_lancamentos,
    itens: c.itens || [],
  }))

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
      <ExportButtons
        propriedadeNome={propriedadeNome}
        safraNome={safraAtual?.nome}
        nomeAba="Operacional"
        nomeArquivo="relatorio-operacional"
        colunas={[
          { header: 'Data', key: 'data', width: 12 },
          { header: 'Serviço', key: 'servico', width: 24 },
          { header: 'Categoria', key: 'categoria', width: 18 },
          { header: 'Talhão', key: 'talhao', width: 18 },
          { header: 'Área (ha)', key: 'area', width: 10 },
          { header: 'Custo Total (R$)', key: 'custo', width: 16 },
          { header: 'Custo/ha (R$)', key: 'custoHa', width: 14 },
          { header: 'Observações', key: 'obs', width: 30 },
        ]}
        linhas={ordenados.map((l: any) => ({
          data: fmtData(l.data_execucao),
          servico: l.servico_nome || '',
          categoria: l.servico_categoria || '',
          talhao: l.talhao_nome || '',
          area: l.talhao_area_ha ? fmtN(Number(l.talhao_area_ha)) : '',
          custo: fmt(Number(l.custo_total || 0)),
          custoHa: l.custo_por_ha ? fmt(Number(l.custo_por_ha)) : '',
          obs: l.observacoes || '',
        }))}
      />

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
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-background border rounded-lg shadow-md p-3 text-sm">
                        <p className="font-semibold mb-1">{d.categoria}</p>
                        <p className="mb-1">Total: <span className="font-medium">{fmt(Number(d.custo_total))}</span></p>
                        {d.itens && d.itens.length > 0 && (
                          <div className="border-t pt-1 mt-1 space-y-0.5">
                            {d.itens.map((it: any, idx: number) => (
                              <p key={idx} className="text-xs">
                                {it.nome} {it.vezes}x = {fmt(Number(it.valor))}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }}
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
   ABA — OBSERVAÇÕES (busca por palavra-chave)
   ════════════════════════════════════════════════ */
function AbaObservacoes({ propId, safraId, propriedadeNome }: { propId: string; safraId: string; propriedadeNome: string }) {

  const { safraAtual } = useGlobal()

  const [termo, setTermo] = useState('')

  const [termoBuscado, setTermoBuscado] = useState('')

  const resQ = useQuery({

    queryKey: ['rel-observacoes', propId, safraId, termoBuscado],

    queryFn: async () => {

      const { data, error } = await db.rpc('get_relatorio_por_observacao', {

        p_propriedade_id: propId, p_safra_id: safraId, p_termo: termoBuscado,

      })

      if (error) throw error

      return (data || []) as any[]

    },

    enabled: !!termoBuscado,

  })

  const resultados = resQ.data || []

  const buscar = () => setTermoBuscado(termo.trim())

  // Agrupa por descrição igual, e dentro de cada descrição, sub-agrupa por

  // serviço+talhão igual (ex: 3x "Manutenção - John Jeer" viram 1 linha "3x").

  const grupos = useMemo(() => {

    const mapaDescricao = new Map<string, { descricao: string; subtotal: number; subgrupos: Map<string, { rotulo: string; vezes: number; valor: number }> }>()

    resultados.forEach((r: any) => {

      const textoOriginal = (r.observacoes_manutencao || r.observacoes_abastecimento || r.observacoes || 'Sem descrição').trim()

      const chaveDescricao = textoOriginal.toLowerCase()

      if (!mapaDescricao.has(chaveDescricao)) {

        mapaDescricao.set(chaveDescricao, { descricao: textoOriginal, subtotal: 0, subgrupos: new Map() })

      }

      const g = mapaDescricao.get(chaveDescricao)!

      g.subtotal += Number(r.custo_total || 0)

      const rotulo = `${r.servico_nome || '-'}${r.talhao_nome ? ` · ${r.talhao_nome}` : ''}`

      const chaveSub = rotulo.toLowerCase()

      if (!g.subgrupos.has(chaveSub)) {

        g.subgrupos.set(chaveSub, { rotulo, vezes: 0, valor: 0 })

      }

      const sg = g.subgrupos.get(chaveSub)!

      sg.vezes += 1

      sg.valor += Number(r.custo_total || 0)

    })

    return Array.from(mapaDescricao.values())

      .map((g) => ({ descricao: g.descricao, subtotal: g.subtotal, itens: Array.from(g.subgrupos.values()) }))

      .sort((a, b) => b.subtotal - a.subtotal)

  }, [resultados])

  const totalGeral = grupos.reduce((s, g) => s + g.subtotal, 0)

  const handleExportPDF = () => {

    exportarObservacoesPDF({

      nomeArquivo: 'relatorio-observacoes',

      propriedadeNome,

      safraNome: safraAtual?.nome,

      termoBuscado,

      totalGeral,

      grupos,

    })

  }

  return (

    <div className="space-y-4">

      <Card>

        <CardContent className="pt-4 flex flex-wrap items-end gap-3">

          <div className="flex-1 min-w-[240px]">

            <label className="text-xs text-muted-foreground">Buscar palavra na Observação</label>

            <Input

              placeholder="Ex: adubação, chuva, quebrou..."

              value={termo}

              onChange={(e) => setTermo(e.target.value)}

              onKeyDown={(e) => { if (e.key === 'Enter') buscar() }}

            />

          </div>

          <Button onClick={buscar} disabled={!termo.trim()}>Buscar</Button>

        </CardContent>

      </Card>

      {!termoBuscado ? (

        <Card><CardContent className="pt-6"><EmptyState message="Digite uma palavra e clique em Buscar" /></CardContent></Card>

      ) : resQ.isLoading ? (

        <SkeletonAba />

      ) : resultados.length === 0 ? (

        <Card><CardContent className="pt-6"><EmptyState message={`Nenhuma observação encontrada com "${termoBuscado}"`} /></CardContent></Card>

      ) : (

        <>

          <div className="flex flex-wrap justify-end gap-2 mb-2">

            <Button variant="outline" size="sm" className="flex-1 sm:flex-none min-w-[140px]" onClick={handleExportPDF}>

              <FileText className="h-4 w-4 mr-1" /> Exportar PDF

            </Button>

            <Button

              variant="outline" size="sm" className="flex-1 sm:flex-none min-w-[140px]"

              onClick={() => exportarExcel({

                nomeArquivo: 'relatorio-observacoes',

                nomeAba: 'Observações',

                propriedadeNome,

                safraNome: safraAtual?.nome,

                colunas: [

                  { header: 'Descrição', key: 'descricao', width: 26 },

                  { header: 'Serviço/Talhão', key: 'rotulo', width: 26 },

                  { header: 'Vezes', key: 'vezes', width: 10 },

                  { header: 'Valor', key: 'valor', width: 14 },

                ],

                linhas: grupos.flatMap((g) =>

                  g.itens.map((it) => ({

                    descricao: g.descricao,

                    rotulo: it.rotulo,

                    vezes: it.vezes,

                    valor: fmt(it.valor),

                  }))

                )

              })}

            >

              <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel

            </Button>

          </div>

          <Card>

            <CardHeader>

              <CardTitle className="text-base flex items-center gap-2">

                <ClipboardList className="h-4 w-4" />

                Observações — "{termoBuscado}"

                <span className="ml-auto text-sm font-normal text-muted-foreground">

                  Total: <span className="font-bold text-foreground">{fmt(totalGeral)}</span>

                </span>

              </CardTitle>

            </CardHeader>

            <CardContent className="space-y-4">

              <div className="flex items-center text-xs font-medium text-muted-foreground pl-4 pb-1">

                <span className="flex-1">Item</span>

                <span className="w-20 text-right">Qtd</span>

                <span className="w-28 text-right">Valor</span>

              </div>

              {grupos.map((g, gi) => (

                <div key={gi}>

                  <div className="flex items-center justify-between font-semibold text-sm border-b pb-1 mb-1">

                    <span>{g.descricao}</span>

                    <span>{fmt(g.subtotal)}</span>

                  </div>

                  {g.itens.map((item, idx) => (

                    <div key={idx} className="flex items-center text-sm pl-4 py-1 text-foreground/80">

                      <span className="flex-1 truncate">{item.rotulo}</span>

                      <span className="w-20 text-right text-xs text-muted-foreground">{item.vezes}x</span>

                      <span className="w-28 text-right font-medium">{fmt(item.valor)}</span>

                    </div>

                  ))}

                </div>

              ))}

            </CardContent>

          </Card>

        </>

      )}

    </div>

  )

}

/* ════════════════════════════════════════════════
   ABA — SANIDADE (cobertura vacinal + histórico)
   ════════════════════════════════════════════════ */
function AbaSanidade({ propId, propriedadeNome }: { propId: string; propriedadeNome: string }) {
  const sanQ = useQuery({
    queryKey: ['rel-sanidade', propId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_relatorio_sanidade', { p_propriedade_id: propId })
      if (error) throw error
      return data as any
    },
    enabled: !!propId,
  })

  const dados = sanQ.data
  const fmtData = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—')

  if (sanQ.isLoading) return <SkeletonAba />
  if (!dados || (!dados.eventos?.length && !dados.cobertura_por_rebanho?.length)) {
    return <Card><CardContent className="pt-6"><EmptyState message="Nenhum evento sanitário registrado ainda" /></CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard title="Total gasto (Sanidade)" value={fmt(Number(dados.total_gasto || 0))} accent="negative" />
        <KpiCard title="Eventos registrados" value={String(dados.eventos?.length || 0)} />
        <KpiCard
          title="Animais sem nenhuma aplicação"
          value={String((dados.animais_pendentes || []).length)}
          accent={(dados.animais_pendentes || []).length > 0 ? 'negative' : undefined}
        />
      </div>

      {dados.cobertura_por_rebanho?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cobertura por Rebanho</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dados.cobertura_por_rebanho.map((cb: any) => {
              const pct = cb.total_animais > 0 ? Math.round((cb.animais_com_alguma_vacina / cb.total_animais) * 100) : 0
              return (
                <div key={cb.rebanho_id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{cb.rebanho_nome}</span>
                    <span className="text-muted-foreground">{cb.animais_com_alguma_vacina}/{cb.total_animais} com alguma aplicação</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', pct === 100 ? 'bg-green-600' : pct > 0 ? 'bg-amber-500' : 'bg-destructive')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {dados.animais_pendentes?.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <ShieldAlert className="h-4 w-4" />
              Animais sem nenhuma aplicação registrada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dados.animais_pendentes.map((a: any) => (
                <Badge key={a.animal_id} variant="outline" className="border-amber-300">
                  {a.animal_nome}
                  {a.sexo === 'macho' && <span className="text-blue-600 ml-1">♂</span>}
                  {a.sexo === 'femea' && <span className="text-pink-600 ml-1">♀</span>}
                  <span className="text-muted-foreground ml-1">· {a.rebanho_nome}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Histórico de Eventos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Rebanho</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Animais</TableHead>
                <TableHead>Próxima dose</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dados.eventos || []).map((ev: any) => (
                <TableRow key={ev.id}>
                  <TableCell>{fmtData(ev.data_aplicacao)}</TableCell>
                  <TableCell className="font-medium">{ev.rebanho_nome}</TableCell>
                  <TableCell className="capitalize">{ev.tipo}</TableCell>
                  <TableCell>{ev.descricao}</TableCell>
                  <TableCell>{ev.controle_individual ? `${ev.qtd_animais_aplicados} animal(is)` : 'Lote inteiro'}</TableCell>
                  <TableCell>{fmtData(ev.data_proxima)}</TableCell>
                  <TableCell className="text-right">{ev.custo ? fmt(Number(ev.custo)) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

/* ════════════════════════════════════════════════

   ABA 2 — FINANCEIRO
   ════════════════════════════════════════════════ */
function AbaFinanceiro({ propId, safraId, propriedadeNome }: { propId: string; safraId: string; propriedadeNome: string }) {
  const { safraAtual } = useGlobal()
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
    const custo = custoFin
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
      <ExportButtons
        propriedadeNome={propriedadeNome}
        safraNome={safraAtual?.nome}
        nomeAba="Financeiro"
        nomeArquivo="relatorio-financeiro"
        colunas={[
          { header: 'Mês', key: 'mes', width: 12 },
          { header: 'Custo Lançamentos (R$)', key: 'custoLanc', width: 20 },
          { header: 'Custo Financeiro (R$)', key: 'custoFin', width: 20 },
          { header: 'Receitas (R$)', key: 'receitas', width: 16 },
          { header: 'Despesas (R$)', key: 'despesas', width: 16 },
          { header: 'Saldo do Mês (R$)', key: 'saldo', width: 18 },
          { header: 'Resultado Acumulado (R$)', key: 'acum', width: 22 },
        ]}
        linhas={evolChart.map((e, idx) => {
          const f = fluxoChart[idx] || { receitas: 0, despesas: 0, saldo: 0 }
          return {
            mes: e.mes,
            custoLanc: fmt(e.custo_lancamentos),
            custoFin: fmt(e.custo_financeiro),
            receitas: fmt(Number(f.receitas || 0)),
            despesas: fmt(Number(f.despesas || 0)),
            saldo: fmt(Number(f.saldo || 0)),
            acum: fmt(e.resultado_acum),
          }
        })}
      />

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
          <CardContent>
            {breakChart.length === 0 ? <EmptyChart /> : (
              <PizzaCategoria dados={breakChart} emptyLabel="Sem custos" />
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
function AbaPorTalhao({ propId, safraId, propriedadeNome }: { propId: string; safraId: string; propriedadeNome: string }) {
  const { safraAtual } = useGlobal()
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
      nome: c.nome, custo_total: c.custo, colhida: c.colhida, unidade: c.unidade,
    })), [cards])

  if (talhaoQ.isLoading || rentQ.isLoading) return <SkeletonAba />
  if (cards.length === 0) return <Card><CardContent className="pt-6"><EmptyState message="Nenhum talhão com operações nesta safra" /></CardContent></Card>

  return (
    <div className="space-y-4">
      <ExportButtons
        propriedadeNome={propriedadeNome}
        safraNome={safraAtual?.nome}
        nomeAba="Por Talhão"
        nomeArquivo="relatorio-por-talhao"
        colunas={[
          { header: 'Talhão', key: 'nome', width: 22 },
          { header: 'Cultura', key: 'cultura', width: 18 },
          { header: 'Área (ha)', key: 'area', width: 10 },
          { header: 'Operações', key: 'ops', width: 10 },
          { header: 'Custo Total (R$)', key: 'custo', width: 16 },
          { header: 'Custo/ha (R$)', key: 'custoHa', width: 14 },
          { header: 'Colhido', key: 'colhido', width: 14 },
          { header: 'Produtividade/ha', key: 'prod', width: 16 },
          { header: 'Receita estimada (R$)', key: 'receita', width: 18 },
          { header: 'Resultado estimado (R$)', key: 'resultado', width: 18 },
        ]}
        linhas={cards.map((c) => ({
          nome: c.nome,
          cultura: c.cultura || '',
          area: fmtN(c.area),
          ops: c.ops,
          custo: fmt(c.custo),
          custoHa: fmt(c.custoHa),
          colhido: c.colhida > 0 ? `${fmtN(c.colhida)} ${c.unidade}` : '',
          prod: c.produtividade > 0 ? `${fmtN(c.produtividade)} ${c.unidade}/ha` : '',
          receita: fmt(c.receita),
          resultado: fmt(c.resultado),
        }))}
      />

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
        <CardHeader><CardTitle className="text-base">Custo vs Quantidade Colhida por Talhão</CardTitle></CardHeader>
        <CardContent style={{ height: Math.max(280, chartData.length * 42 + 60) }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" xAxisId="custo" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <XAxis type="number" xAxisId="prod" orientation="top" fontSize={11} hide />
              <YAxis type="category" dataKey="nome" fontSize={11} width={120} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-background border rounded-lg shadow-md p-3 text-sm">
                      <p className="font-semibold mb-1">{d.nome}</p>
                      <p>Custo: <span className="font-medium">{fmt(Number(d.custo_total))}</span></p>
                      <p>Quantidade Colhida: <span className="font-medium">{fmtN(d.colhida)} {d.unidade}</span></p>
                    </div>
                  )
                }}
              />
              <Legend />
              <Bar xAxisId="custo" dataKey="custo_total" name="Custo" fill="hsl(0,72%,51%)" />
              <Bar xAxisId="prod" dataKey="colhida" name="Quantidade Colhida" fill="hsl(142,70%,40%)" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

/* ════════════════════════════════════════════════
   ABA 4 — COMPARATIVO DE SAFRAS
   ════════════════════════════════════════════════ */
function AbaComparativo({ propId, safraAtualId, propriedadeNome }: { propId: string; safraAtualId: string; propriedadeNome: string }) {
  const { safraAtual } = useGlobal()
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
      <ExportButtons
        propriedadeNome={propriedadeNome}
        safraNome={safraAtual?.nome}
        nomeAba="Comparativo de Safras"
        nomeArquivo="relatorio-comparativo"
        colunas={[
          { header: 'Safra', key: 'safra', width: 18 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Receita (R$)', key: 'receita', width: 16 },
          { header: 'Custo Total (R$)', key: 'custo', width: 16 },
          { header: 'Resultado (R$)', key: 'resultado', width: 16 },
          { header: 'Margem %', key: 'margem', width: 10 },
          { header: 'Área (ha)', key: 'area', width: 10 },
          { header: 'Custo/ha (R$)', key: 'custoHa', width: 14 },
          { header: 'Lançamentos', key: 'lanc', width: 12 },
        ]}
        linhas={safras.map((s: any) => {
          const resultado = Number(s.resultado || (Number(s.receita || 0) - Number(s.custo_total || 0)))
          return {
            safra: s.safra_nome || '',
            status: s.fechada ? 'Fechada' : s.ativa ? 'Ativa' : 'Inativa',
            receita: fmt(Number(s.receita || 0)),
            custo: fmt(Number(s.custo_total || 0)),
            resultado: fmt(resultado),
            margem: fmtPct(Number(s.margem_pct || 0)),
            area: fmtN(Number(s.area_ha || 0)),
            custoHa: fmt(Number(s.custo_por_ha || 0)),
            lanc: Number(s.total_lancamentos || 0),
          }
        })}
      />

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
                <Tooltip formatter={(v: number, n: string) => n === 'Margem %' ? [`${Number(v).toFixed(1)}%`, 'Margem'] : [fmt(Number(v)), n]} />
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
function AbaInsumos({ propId, safraId, propriedadeNome }: { propId: string; safraId: string; propriedadeNome: string }) {
  const { safraAtual } = useGlobal()
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

  const TIPO_ESTOQUE_LABEL_INS: Record<string, string> = { agricola: 'Agrícola', pecuario: 'Pecuária', geral: 'Geral' }
  const ORDEM_TIPO: Record<string, number> = { agricola: 1, pecuario: 2, geral: 3 }

  const gruposPorTipo = useMemo(() => {
    const mapa = new Map<string, any[]>()
    itens.forEach((i: any) => {
      const tipo = i.tipo_estoque || 'agricola'
      if (!mapa.has(tipo)) mapa.set(tipo, [])
      mapa.get(tipo)!.push(i)
    })
    return Array.from(mapa.entries())
      .map(([tipo_estoque, lista]) => ({
        tipo_estoque,
        subtotal: lista.reduce((s, i) => s + Number(i.custo_total || 0), 0),
        itens: lista,
      }))
      .sort((a, b) => (ORDEM_TIPO[a.tipo_estoque] || 9) - (ORDEM_TIPO[b.tipo_estoque] || 9))
  }, [itens])

  const handleExportInsumosPDF = () => {
    exportarInsumosPDF({ nomeArquivo: 'insumos', propriedadeNome, safraNome: safraAtual?.nome, grupos: gruposPorTipo })
  }

  const top10 = itens.slice(0, 10).map((i: any) => ({
    nome: i.produto_nome || '—',
    valor: Number(i.custo_total || 0),
    quantidade: Number(i.quantidade_total || 0),
    unidade: i.unidade_medida || '',
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
      <ExportButtons
        propriedadeNome={propriedadeNome}
        safraNome={safraAtual?.nome}
        nomeAba="Insumos"
        nomeArquivo="relatorio-insumos"
        colunas={[
          { header: '#', key: 'pos', width: 5 },
          { header: 'Produto', key: 'produto', width: 30 },
          { header: 'Unidade', key: 'unidade', width: 10 },
          { header: 'Qtd Total', key: 'qtd', width: 14 },
          { header: 'Custo Total (R$)', key: 'custo', width: 16 },
          { header: 'Custo Unit. Médio (R$)', key: 'unit', width: 18 },
          { header: '% do Total', key: 'pct', width: 10 },
          { header: 'Talhões', key: 'talhoes', width: 30 },
        ]}
        linhas={itens.map((i: any, idx: number) => ({
          pos: idx + 1,
          produto: i.produto_nome || '',
          unidade: i.unidade || '',
          qtd: fmtN(Number(i.quantidade_total || 0)),
          custo: fmt(Number(i.custo_total || 0)),
          unit: fmt(Number(i.custo_unitario_medio || 0)),
          pct: total > 0 ? ((Number(i.custo_total || 0) / total) * 100).toFixed(2) + '%' : '0%',
          talhoes: i.talhoes || '',
        }))}
      />

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
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-background border rounded-lg shadow-md p-3 text-sm">
                      <p className="font-semibold mb-1">{d.nome}</p>
                      <p>Custo: <span className="font-medium">{fmt(Number(d.valor))}</span></p>
                      <p>Quantidade: <span className="font-medium">{fmtN(d.quantidade)} {d.unidade}</span></p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="valor" name="Custo">
                {top10.map((d, i) => <Cell key={i} fill={colorScale(d.valor, maxCusto)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportInsumosPDF}>
          <FileText className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
      </div>

      {gruposPorTipo.map((grupo) => (
        <Card key={grupo.tipo_estoque}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{TIPO_ESTOQUE_LABEL_INS[grupo.tipo_estoque] || grupo.tipo_estoque}</CardTitle>
            <span className="text-sm font-semibold">{fmt(grupo.subtotal)}</span>
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
                  <TableHead className="text-right">Em Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupo.itens.map((i: any, idx: number) => {
                  const pct = total > 0 ? (Number(i.custo_total || 0) / total) * 100 : 0
                  return (
                    <TableRow key={i.produto_id || idx}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{i.produto_nome || '—'}</TableCell>
                      <TableCell>{i.unidade_medida || '-'}</TableCell>
                      <TableCell className="text-right">{fmtN(Number(i.quantidade_total || 0))}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(Number(i.custo_total || 0))}</TableCell>
                      <TableCell className="text-right">{fmt(Number(i.custo_unitario_medio || 0))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{i.talhoes_usados || '-'}</TableCell>
                      <TableCell className="text-right">{fmtN(Number(i.saldo_estoque || 0))} {i.unidade_medida}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
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
      <CardHeader className="pb-2 p-3 sm:p-4">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
        <div className={`text-lg sm:text-xl lg:text-2xl font-bold break-words ${cls}`}>{value}</div>
        {subValue && <p className="text-xs text-muted-foreground mt-0.5 break-words">{subValue}</p>}
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

/* ════════════════════════════════════════════════
   ABA 6 — CUSTOS DETALHADOS
   ════════════════════════════════════════════════ */
function AbaCustosDetalhados({ propId, safraId, propriedadeNome }: { propId: string; safraId: string; propriedadeNome: string }) {
  const { safraAtual } = useGlobal()
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [itemFiltro, setItemFiltro] = useState<{ tipo: string; id: string } | null>(null)
  const [talhaoFiltro, setTalhaoFiltro] = useState('')
  const [ordenarPor, setOrdenarPor] = useState('valor_desc')
  const [incluirOperacional, setIncluirOperacional] = useState(true)
  const [incluirFinanceiro, setIncluirFinanceiro] = useState(true)

  const itensFiltraveisQ = useQuery({
    queryKey: ['rel-itens-filtraveis', propId],
    queryFn: async () => {
      const { data, error } = await db.rpc('listar_itens_filtraveis', { p_propriedade_id: propId })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  const talhoesQ = useQuery({
    queryKey: ['rel-talhoes-lista', propId],
    queryFn: async () => {
      const { data, error } = await db.from('talhoes').select('id, nome').eq('propriedade_id', propId).eq('ativo', true).order('nome')
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  const categoriasServicoQ = useQuery({
    queryKey: ['rel-categorias-servico', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('listar_categorias_servico_usadas', { p_propriedade_id: propId, p_safra_id: safraId })
      if (error) throw error
      return (data || []).map((d: any) => d.categoria) as string[]
    },
    enabled: !!propId && !!safraId,
  })

  const relatorioQ = useQuery({
    queryKey: ['rel-custos-detalhado', propId, safraId, dataInicio, dataFim, categoriaFiltro, itemFiltro, talhaoFiltro, ordenarPor],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_relatorio_custos_detalhado', {
        p_propriedade_id: propId,
        p_safra_id: safraId,
        p_data_inicio: dataInicio || null,
        p_data_fim: dataFim || null,
        p_categoria: categoriaFiltro || null,
        p_item_tipo: itemFiltro?.tipo || null,
        p_item_id: itemFiltro?.id || null,
        p_talhao_id: talhaoFiltro || null,
        p_ordenar_por: ordenarPor,
      })
      if (error) throw error
      return data as any
    },
    enabled: !!propId && !!safraId,
  })

  const operacional = (relatorioQ.data?.operacional || []) as any[]
  const financeiro = (relatorioQ.data?.financeiro || []) as any[]

  const colunasExport: Coluna[] = [
    { header: 'Seção', key: 'secao', width: 14 },
    { header: 'Categoria', key: 'categoria', width: 18 },
    { header: 'Item', key: 'item', width: 24 },
    { header: 'Quantidade', key: 'quantidade', width: 14 },
    { header: 'Unidade', key: 'unidade', width: 10 },
    { header: 'Valor', key: 'valor', width: 14 },
  ]

  const linhasExport = useMemo(() => {
    const linhas: any[] = []
    operacional.forEach((grupo: any) => {
      (grupo.itens || []).forEach((item: any) => {
        linhas.push({
          secao: 'Operacional',
          categoria: labelGrupo(grupo.grupo),
          item: item.nome,
          quantidade: item.quantidade ?? '',
          unidade: item.unidade ?? '',
          valor: fmt(Number(item.valor)),
        })
      })
    })
    financeiro.forEach((grupo: any) => {
      (grupo.itens || []).forEach((item: any) => {
        linhas.push({
          secao: 'Financeiro',
          categoria: labelGrupo(grupo.grupo),
          item: item.nome,
          quantidade: '',
          unidade: '',
          valor: (item.tipo === 'receita' ? '+ ' : '- ') + fmt(Number(item.valor)),
        })
      })
    })
    return linhas
  }, [operacional, financeiro])

  const totalOperacional = operacional.reduce((s: number, g: any) => s + Number(g.subtotal || 0), 0)
  const totalDespesas = useMemo(() => {
    let soma = 0
    financeiro.forEach((grupo: any) => {
      (grupo.itens || []).forEach((item: any) => {
        if (item.tipo === 'despesa') soma += Number(item.valor || 0)
      })
    })
    return soma
  }, [financeiro])

  const totalReceitas = useMemo(() => {
    let soma = 0
    financeiro.forEach((grupo: any) => {
      (grupo.itens || []).forEach((item: any) => {
        if (item.tipo === 'receita') soma += Number(item.valor || 0)
      })
    })
    return soma
  }, [financeiro])

  const limparFiltros = () => {
    setDataInicio(''); setDataFim(''); setCategoriaFiltro(''); setItemFiltro(null); setTalhaoFiltro(''); setOrdenarPor('valor_desc')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2 mb-2">
        <Button
          variant="outline" size="sm" className="flex-1 sm:flex-none min-w-[140px]"
          onClick={() => exportarCustosDetalhadosPDF({
            nomeArquivo: 'custos-detalhados',
            propriedadeNome,
            safraNome: safraAtual?.nome,
            operacional: incluirOperacional
              ? operacional.map((g: any) => ({ ...g, grupo: labelGrupo(g.grupo) }))
              : [],
            financeiro: incluirFinanceiro
              ? financeiro.map((g: any) => ({ ...g, grupo: labelGrupo(g.grupo) }))
              : [],
            totalOperacional: incluirOperacional ? totalOperacional : 0,
            totalDespesas: incluirFinanceiro ? totalDespesas : 0,
            totalReceitas: incluirFinanceiro ? totalReceitas : 0,
          })}
        >
          <FileText className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
        <Button
          variant="outline" size="sm" className="flex-1 sm:flex-none min-w-[140px]"
          onClick={() => exportarExcel({ nomeArquivo: 'custos-detalhados', nomeAba: 'Custos Detalhados', colunas: colunasExport, linhas: linhasExport, propriedadeNome, safraNome: safraAtual?.nome })}
        >
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
        </Button>
      </div>
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">De</label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Até</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Select value={categoriaFiltro || '_todos'} onValueChange={v => setCategoriaFiltro(v === '_todos' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_todos">Todas</SelectItem>
                  {(categoriasServicoQ.data || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Item usado</label>
              <Select
                value={itemFiltro ? `${itemFiltro.tipo}:${itemFiltro.id}` : '_todos'}
                onValueChange={(v) => {
                  if (v === '_todos') { setItemFiltro(null); return }
                  const [tipo, id] = v.split(':')
                  setItemFiltro({ tipo, id })
                }}
              >
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_todos">Todos</SelectItem>
                  {(itensFiltraveisQ.data || []).map((it: any) => (
                    <SelectItem key={`${it.item_tipo}:${it.item_id}`} value={`${it.item_tipo}:${it.item_id}`}>
                      {it.item_nome} {it.item_tipo === 'maquina' ? '(máquina)' : it.item_tipo === 'servico' ? '(serviço)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Talhão</label>
              <Select value={talhaoFiltro || '_todos'} onValueChange={v => setTalhaoFiltro(v === '_todos' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_todos">Todos</SelectItem>
                  {(talhoesQ.data || []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ordenar por</label>
              <Select value={ordenarPor} onValueChange={setOrdenarPor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor_desc">Maior valor</SelectItem>
                  <SelectItem value="valor_asc">Menor valor</SelectItem>
                  <SelectItem value="nome_asc">Nome (A-Z)</SelectItem>
                  <SelectItem value="quantidade_desc">Maior quantidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(dataInicio || dataFim || categoriaFiltro || itemFiltro || talhaoFiltro) && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          )}
          <div className="flex gap-4 items-center mt-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={incluirOperacional} onCheckedChange={(v) => setIncluirOperacional(!!v)} />
              Operacional
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={incluirFinanceiro} onCheckedChange={(v) => setIncluirFinanceiro(!!v)} />
              Financeiro
            </label>
          </div>
        </CardContent>
      </Card>

      {relatorioQ.isLoading ? (
        <SkeletonAba />
      ) : (incluirOperacional ? operacional : []).length === 0 && (incluirFinanceiro ? financeiro : []).length === 0 ? (
        <Card><CardContent className="pt-6"><EmptyState message="Nenhum custo encontrado com esses filtros" /></CardContent></Card>
      ) : (
        <>
          {/* Seção Operacional */}
          {incluirOperacional && operacional.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Operacional
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    Total: <span className="font-bold text-foreground">{fmt(totalOperacional)}</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center text-xs font-medium text-muted-foreground pl-4 pb-1">
                  <span className="flex-1">Item</span>
                  <span className="w-36 text-right">Qtde.</span>
                  <span className="w-28 text-right">Valor</span>
                </div>
                {operacional.map((grupo: any) => (
                  <div key={grupo.grupo}>
                    <div className="flex items-center justify-between font-semibold text-sm border-b pb-1 mb-1">
                      <span>{labelGrupo(grupo.grupo)}</span>
                      <span>{fmt(Number(grupo.subtotal))}</span>
                    </div>
                    {(grupo.itens || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center text-sm pl-4 py-1 text-foreground/80">
                        <span className="flex-1">{item.nome}</span>
                        <span className="w-36 text-right text-xs text-muted-foreground">{formatarQtdeOperacional(item)}</span>
                        <span className="w-28 text-right font-medium">{fmt(Number(item.valor))}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Seção Financeiro */}
          {incluirFinanceiro && financeiro.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financeiro
                  <span className="ml-auto text-sm font-normal text-muted-foreground space-x-3">
                    <span>Despesas: <span className="font-bold text-destructive">{fmt(totalDespesas)}</span></span>
                    <span>Recebimentos: <span className="font-bold text-green-600">{fmt(totalReceitas)}</span></span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {financeiro.map((grupo: any) => (
                  <div key={grupo.grupo}>
                    <div className="flex items-center justify-between font-semibold text-sm border-b pb-1 mb-1">
                      <span>{labelGrupo(grupo.grupo)}</span>
                      <span>{fmt(Number(grupo.subtotal))}</span>
                    </div>
                    {(grupo.itens || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm pl-4 py-1 text-foreground/80">
                        <span>
                          {item.nome}
                          {item.quantidade != null && (
                            <span className="text-xs ml-1">
                              ({fmtN(item.quantidade)} {unidadeCurta(item.unidade)}{item.preco_medio != null ? ` · média R$${fmtN(item.preco_medio)}/${item.unidade}` : ''})
                            </span>
                          )}
                        </span>
                        <span className={item.tipo === 'receita' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {item.tipo === 'receita' ? '+' : '-'} {fmt(Number(item.valor))}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Os totais de Operacional e Financeiro não são somados entre si — são duas visões diferentes do mesmo dinheiro (consumo aplicado vs. dinheiro que saiu do banco).
          </p>
        </>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   ABA — ESTOQUE
   ════════════════════════════════════════════════ */
const TIPO_ESTOQUE_LABEL: Record<string, string> = {
  agricola: 'Agrícola',
  pecuario: 'Pecuária',
  geral: 'Geral',
}

function AbaEstoque({ propId, propriedadeNome }: { propId: string; propriedadeNome: string }) {
  const [categoriaFiltro, setCategoriaFiltro] = useState('')

  const [incluirAgricola, setIncluirAgricola] = useState(true)

  const [incluirPecuario, setIncluirPecuario] = useState(true)

  const [incluirGeral, setIncluirGeral] = useState(true)

  const categoriasQ = useQuery({
    queryKey: ['rel-estoque-categorias', propId],
    queryFn: async () => {
      const { data, error } = await db.rpc('listar_categorias_estoque_usadas', { p_propriedade_id: propId })
      if (error) throw error
      return (data || []) as { tipo_estoque: string; categoria: string }[]
    },
    enabled: !!propId,
  })

  const categoriasDisponiveis = useMemo(() => {
    const set = new Set((categoriasQ.data || []).map((c) => c.categoria))
    return Array.from(set).sort()
  }, [categoriasQ.data])

  const estoqueQ = useQuery({
    queryKey: ['rel-estoque', propId, categoriaFiltro],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_relatorio_estoque', {
        p_propriedade_id: propId,
        p_categoria: categoriaFiltro || null,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  const incluidos: Record<string, boolean> = { agricola: incluirAgricola, pecuario: incluirPecuario, geral: incluirGeral }

  const todosOsTipos = estoqueQ.data || []

  const tipos = todosOsTipos.filter((t: any) => incluidos[t.tipo_estoque] !== false)

  const totalProdutos = tipos.reduce((s: number, t: any) => s + Number(t.total_itens || 0), 0)

  const totalZerados = tipos.reduce((s: number, t: any) => s + Number(t.itens_zerados || 0), 0)

  const totalAbaixoMinimo = tipos.reduce(
    (s: number, t: any) =>
      s + (t.categorias || []).reduce(
        (s2: number, c: any) => s2 + (c.itens || []).filter((i: any) => i.abaixo_minimo).length,
        0
      ),
    0
  )

  const handleExportPDF = () => {
    exportarEstoquePDF({ nomeArquivo: 'estoque', propriedadeNome, tipos })
  }

  if (estoqueQ.isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <StatCard title="Total de Produtos" value={totalProdutos} icon={PrateleiraIcon} />
          <StatCard title="Itens Zerados" value={totalZerados} icon={FileX} variant={totalZerados > 0 ? 'warning' : 'default'} />
          <StatCard title="Abaixo do Mínimo" value={totalAbaixoMinimo} icon={AlertTriangle} variant={totalAbaixoMinimo > 0 ? 'warning' : 'default'} />
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap text-sm">

        <label className="flex items-center gap-2 cursor-pointer">

          <Checkbox checked={incluirAgricola} onCheckedChange={(v) => setIncluirAgricola(!!v)} />

          Agrícola

        </label>

        <label className="flex items-center gap-2 cursor-pointer">

          <Checkbox checked={incluirPecuario} onCheckedChange={(v) => setIncluirPecuario(!!v)} />

          Pecuária

        </label>

        <label className="flex items-center gap-2 cursor-pointer">

          <Checkbox checked={incluirGeral} onCheckedChange={(v) => setIncluirGeral(!!v)} />

          Geral

        </label>

      </div>



      <div className="flex items-center justify-between flex-wrap gap-2">
        <Select value={categoriaFiltro || 'todas'} onValueChange={(v) => setCategoriaFiltro(v === 'todas' ? '' : v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categoriasDisponiveis.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={tipos.length === 0}>
          <FileText className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
      </div>

      {tipos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum produto em estoque{categoriaFiltro ? ' nessa categoria' : ''}.
          </CardContent>
        </Card>
      ) : (
        tipos.map((tipo: any) => (
          <Card key={tipo.tipo_estoque}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{TIPO_ESTOQUE_LABEL[tipo.tipo_estoque] || tipo.tipo_estoque}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {tipo.total_itens} {tipo.total_itens === 1 ? 'produto' : 'produtos'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center text-xs font-medium text-muted-foreground pb-2 border-b">
                <span className="flex-1">Produto</span>
                <span className="w-36 text-right">Qtde. em estoque</span>
              </div>

              {(tipo.categorias || []).map((cat: any) => (
                <div key={cat.categoria} className="py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{cat.categoria}</span>
                    <span className="text-xs text-muted-foreground">
                      {cat.total_itens} {cat.total_itens === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  <div className="border-t pt-1" />

                  {(cat.itens || []).map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between py-1 text-sm ${item.abaixo_minimo ? 'text-red-600' : ''}`}
                    >
                      <span className="flex-1 truncate">
                        {item.nome}
                        {item.abaixo_minimo && (
                          <Badge variant="destructive" className="ml-2 text-[10px] py-0 px-1.5">
                            abaixo do mínimo
                          </Badge>
                        )}
                      </span>
                      <span className="w-36 text-right font-medium">
                        {fmtN(Number(item.saldo_atual))} {unidadeCurta(item.unidade)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   ABA — MÁQUINAS
   ════════════════════════════════════════════════ */
function AbaMaquinas({ propId, safraId, propriedadeNome }: { propId: string; safraId: string; propriedadeNome: string }) {

  const { safraAtual } = useGlobal()

  const maqQ = useQuery({

    queryKey: ['rel-maquinas', propId, safraId],

    queryFn: async () => {

      const { data, error } = await db.rpc('get_relatorio_por_maquina', {

        p_propriedade_id: propId, p_safra_id: safraId,

      })

      if (error) throw error

      return (data || []) as any[]

    },

  })

  const maquinasRaw = maqQ.data || []

  const totalGeral = maquinasRaw.reduce((s: number, m: any) => s + Number(m.custo_total || 0), 0)

  // Mesmo formato em seções do Custos Detalhados: cada máquina é um grupo,

  // Combustível/Manutenção/itens usados são as linhas dentro do grupo.

  const grupos = useMemo(() => {

    return maquinasRaw.map((m: any) => {

      const itens: { nome: string; qtdLabel: string; valor: number | null }[] = []



      if (m.horas_uso_direto > 0) {

        itens.push({

          nome: 'Uso da máquina (lançamentos)',

          qtdLabel: `${fmtN(Number(m.horas_uso_direto))} ${m.unidade_calculo === 'km' ? 'km' : 'h'}`,

          valor: Number(m.custo_uso_direto || 0),

        })

      }



      // Combustível: quantidade mostrada é litros de verdade, não contagem de eventos

      if (m.qtd_abastecimentos > 0) {

        itens.push({

          nome: `Combustível (${m.qtd_abastecimentos}x abastecido)`,

          qtdLabel: `${fmtN(Number(m.litros_total || 0))} L`,

          valor: Number(m.custo_abastecimento || 0),

        })

      }



      // Manutenção: uma linha por descrição distinta, com a quantidade usada embaixo

      // (produto do estoque com nome, ou peça comprada avulsa no modo Livre)

      ;(m.manutencoes_detalhadas || []).forEach((mnt: any) => {

        itens.push({

          nome: `${mnt.descricao}${mnt.vezes > 1 ? ` (${mnt.vezes}x)` : ''}`,

          qtdLabel: mnt.vezes > 1 ? `${mnt.vezes}x` : '—',

          valor: Number(mnt.valor || 0),

        })

        if (mnt.produto_qtd) {

          itens.push({

            nome: mnt.produto_nome ? `↳ ${mnt.produto_nome} (item do estoque)` : '↳ Quantidade usada',

            qtdLabel: `${fmtN(Number(mnt.produto_qtd || 0))} ${mnt.produto_nome ? unidadeCurta(mnt.produto_unidade) : 'un'}`,

            valor: null,

          })

        }

      })



      return {

        maquina_id: m.maquina_id,

        nome: `${m.maquina_nome}${m.modelo ? ` (${m.modelo})` : ''}`,

        subtotal: Number(m.custo_total || 0),

        horimetro: `${fmtN(Number(m.horimetro_atual || 0), 1)} ${m.unidade_calculo === 'km' ? 'km' : 'h'}`,

        itens,

      }

    })

  }, [maquinasRaw])

  const handleExportPDF = () => {

    exportarMaquinasPDF({

      nomeArquivo: 'relatorio-maquinas',

      propriedadeNome,

      safraNome: safraAtual?.nome,

      totalGeral,

      grupos,

    })

  }

  if (maqQ.isLoading) return <SkeletonAba />

  if (grupos.length === 0) return <Card><CardContent className="pt-6"><EmptyState message="Nenhuma máquina com abastecimento ou manutenção nesta safra" /></CardContent></Card>

  return (

    <div className="space-y-4">

      <div className="flex flex-wrap justify-end gap-2 mb-2">

        <Button variant="outline" size="sm" className="flex-1 sm:flex-none min-w-[140px]" onClick={handleExportPDF}>

          <FileText className="h-4 w-4 mr-1" /> Exportar PDF

        </Button>

        <Button

          variant="outline" size="sm" className="flex-1 sm:flex-none min-w-[140px]"

          onClick={() => exportarExcel({

            nomeArquivo: 'relatorio-maquinas',

            nomeAba: 'Máquinas',

            propriedadeNome,

            safraNome: safraAtual?.nome,

            colunas: [

              { header: 'Máquina', key: 'maquina', width: 22 },

              { header: 'Item', key: 'item', width: 26 },

              { header: 'Qtd', key: 'qtd', width: 12 },

              { header: 'Valor', key: 'valor', width: 14 },

            ],

            linhas: grupos.flatMap((g) =>

              g.itens.map((it) => ({

                maquina: g.nome,

                item: it.nome,

                qtd: it.qtdLabel,

                valor: it.valor != null ? fmt(it.valor) : '-',

              }))

            ),

          })}

        >

          <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel

        </Button>

      </div>

      <Card>

        <CardHeader>

          <CardTitle className="text-base flex items-center gap-2">

            <Tractor className="h-4 w-4" />

            Custo por Máquina

            <span className="ml-auto text-sm font-normal text-muted-foreground">

              Total: <span className="font-bold text-foreground">{fmt(totalGeral)}</span>

            </span>

          </CardTitle>

        </CardHeader>

        <CardContent className="space-y-4">

          <div className="flex items-center text-xs font-medium text-muted-foreground pl-4 pb-1">

            <span className="flex-1">Item</span>

            <span className="w-24 text-right">Qtd</span>

            <span className="w-28 text-right">Valor</span>

          </div>

          {grupos.map((g) => (

            <div key={g.maquina_id}>

              <div className="flex items-center justify-between font-semibold text-sm border-b pb-1 mb-1">

                <span className="flex items-center gap-2">

                  {g.nome}

                  <Badge variant="outline" className="text-[10px] font-normal">{g.horimetro}</Badge>

                </span>

                <span>{fmt(g.subtotal)}</span>

              </div>

              {g.itens.map((item, idx) => (

                <div key={idx} className="flex items-center text-sm pl-4 py-1 text-foreground/80">

                  <span className="flex-1 truncate">{item.nome}</span>

                  <span className="w-24 text-right text-xs text-muted-foreground">{item.qtdLabel}</span>

                  <span className="w-28 text-right font-medium">{item.valor != null ? fmt(item.valor) : '-'}</span>

                </div>

              ))}

            </div>

          ))}

        </CardContent>

      </Card>

    </div>

  )

}
