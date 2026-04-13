import { useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSafraContext } from '@/contexts/SafraContext'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Download, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { toast } from 'sonner'

const fmt = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

const fmtN = (v: number | null | undefined, d = 2) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

const PIE_COLORS = [
  'hsl(142,70%,40%)', 'hsl(200,70%,50%)', 'hsl(40,90%,50%)',
  'hsl(0,72%,51%)', 'hsl(270,60%,50%)', 'hsl(180,60%,40%)',
  'hsl(320,60%,50%)', 'hsl(60,80%,45%)',
]

type Fonte = 'lancamentos' | 'transacoes' | 'insumos' | 'producao'

const DIMENSOES: Record<Fonte, { value: string; label: string }[]> = {
  lancamentos: [
    { value: 'talhao', label: 'Talhão' },
    { value: 'cultura', label: 'Cultura' },
    { value: 'mes', label: 'Mês' },
    { value: 'servico', label: 'Serviço' },
    { value: 'categoria_servico', label: 'Categoria do serviço' },
  ],
  transacoes: [
    { value: 'categoria', label: 'Categoria' },
    { value: 'mes', label: 'Mês' },
    { value: 'tipo', label: 'Tipo' },
  ],
  insumos: [
    { value: 'produto', label: 'Produto' },
    { value: 'talhao', label: 'Talhão' },
    { value: 'mes', label: 'Mês' },
  ],
  producao: [
    { value: 'talhao', label: 'Talhão' },
    { value: 'cultura', label: 'Cultura' },
  ],
}

const db = supabase as any

interface Resultado { label: string; valor: number }

export default function RelatorioDinamico() {
  const { propriedades, safras, propriedadeSelecionada, safraSelecionada, setPropriedadeSelecionada, setSafraSelecionada } = useSafraContext()

  const [fonte, setFonte] = useState<Fonte>('lancamentos')
  const [dimensao, setDimensao] = useState('talhao')
  const [metrica, setMetrica] = useState('custo')
  const [periodoInicio, setPeriodoInicio] = useState<Date>()
  const [periodoFim, setPeriodoFim] = useState<Date>()
  const [resultado, setResultado] = useState<Resultado[]>([])
  const [loading, setLoading] = useState(false)
  const [sortCol, setSortCol] = useState<'label' | 'valor'>('valor')
  const [sortAsc, setSortAsc] = useState(false)

  const propId = propriedadeSelecionada?.id || ''
  const safraId = safraSelecionada?.id || ''

  const handleFonteChange = (v: Fonte) => {
    setFonte(v)
    setDimensao(DIMENSOES[v][0].value)
    setResultado([])
  }

  const extrairChave = useCallback((item: any, dim: string, src: Fonte): string => {
    if (src === 'lancamentos') {
      if (dim === 'talhao') return item.talhao?.nome || 'Sem talhão'
      if (dim === 'cultura') return item.talhao?.cultura || 'Sem cultura'
      if (dim === 'mes') {
        const d = item.data_execucao?.substring(0, 7)
        return d || 'Sem data'
      }
      if (dim === 'servico') return item.servico?.nome || 'Sem serviço'
      if (dim === 'categoria_servico') return item.servico?.categoria || 'Sem categoria'
    }
    if (src === 'transacoes') {
      if (dim === 'categoria') return item.categoria || 'Sem categoria'
      if (dim === 'mes') {
        const d = (item.data_pagamento || item.data_vencimento)?.substring(0, 7)
        return d || 'Sem data'
      }
      if (dim === 'tipo') return item.tipo === 'receita' ? 'Receita' : 'Despesa'
    }
    if (src === 'insumos') {
      if (dim === 'produto') return item.produto?.nome || 'Sem produto'
      if (dim === 'talhao') return item.lancamento?.talhao?.nome || 'Sem talhão'
      if (dim === 'mes') return item.lancamento?.data_execucao?.substring(0, 7) || 'Sem data'
    }
    if (src === 'producao') {
      if (dim === 'talhao') return item.talhao_nome || 'Sem talhão'
      if (dim === 'cultura') return item.cultura_nome || 'Sem cultura'
    }
    return 'Outro'
  }, [])

  const extrairValor = useCallback((item: any, met: string, src: Fonte): number => {
    if (met === 'count') return 1
    if (src === 'lancamentos') return parseFloat(item.custo_total || 0)
    if (src === 'transacoes') return parseFloat(item.valor || 0)
    if (src === 'insumos') return met === 'quantidade' ? parseFloat(item.quantidade || 0) : parseFloat(item.custo_total || 0)
    if (src === 'producao') return met === 'quantidade' ? parseFloat(item.quantidade_colhida || 0) : parseFloat(item.custo_total || 0)
    return 0
  }, [])

  const gerar = async () => {
    if (!propId || !safraId) {
      toast.error('Selecione propriedade e safra.')
      return
    }
    setLoading(true)
    try {
      let dados: any[] = []

      if (fonte === 'lancamentos') {
        const { data, error } = await db.from('lancamentos')
          .select('custo_total, data_execucao, talhao_id, servico:servicos(nome,categoria), talhao:talhoes(nome)')
          .eq('propriedade_id', propId).eq('safra_id', safraId)
        if (error) throw error
        dados = data || []
      } else if (fonte === 'transacoes') {
        const { data, error } = await db.from('transacoes')
          .select('valor, tipo, categoria, data_pagamento, data_vencimento')
          .eq('propriedade_id', propId).eq('safra_id', safraId)
        if (error) throw error
        dados = data || []
      } else if (fonte === 'insumos') {
        const { data, error } = await db.from('lancamentos_itens')
          .select('quantidade, custo_total, produto:produtos(nome,unidade_medida), lancamento:lancamentos!inner(safra_id,propriedade_id,data_execucao,talhao:talhoes(nome))')
          .eq('lancamento.propriedade_id', propId)
          .eq('lancamento.safra_id', safraId)
        if (error) throw error
        dados = data || []
      } else if (fonte === 'producao') {
        const { data, error } = await db.rpc('get_rentabilidade_por_talhao', { p_propriedade_id: propId, p_safra_id: safraId })
        if (error) throw error
        dados = data || []
      }

      // Filtro de período
      if (periodoInicio || periodoFim) {
        const ini = periodoInicio ? format(periodoInicio, 'yyyy-MM-dd') : null
        const fim = periodoFim ? format(periodoFim, 'yyyy-MM-dd') : null
        dados = dados.filter((item: any) => {
          const d = item.data_execucao || item.data_pagamento || item.data_vencimento || item.lancamento?.data_execucao
          if (!d) return true
          const ds = d.substring(0, 10)
          if (ini && ds < ini) return false
          if (fim && ds > fim) return false
          return true
        })
      }

      // Agrupar
      const agrupado = dados.reduce((acc: Record<string, Resultado>, item: any) => {
        const chave = extrairChave(item, dimensao, fonte)
        if (!acc[chave]) acc[chave] = { label: chave, valor: 0 }
        acc[chave].valor += extrairValor(item, metrica, fonte)
        return acc
      }, {} as Record<string, Resultado>)

      const res = Object.values(agrupado) as Resultado[]
      setResultado(res.sort((a, b) => b.valor - a.valor))
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao gerar relatório: ' + (err.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const total = useMemo(() => resultado.reduce((s, r) => s + r.valor, 0), [resultado])

  const sorted = useMemo(() => {
    const arr = [...resultado]
    arr.sort((a, b) => {
      const cmp = sortCol === 'label' ? a.label.localeCompare(b.label) : a.valor - b.valor
      return sortAsc ? cmp : -cmp
    })
    return arr
  }, [resultado, sortCol, sortAsc])

  const exportarCSV = () => {
    const headers = ['Dimensão', 'Valor', 'Percentual'].join(',')
    const rows = resultado.map(r => [
      `"${r.label}"`, r.valor.toFixed(2), total > 0 ? ((r.valor / total) * 100).toFixed(1) : '0.0',
    ].join(','))
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'relatorio_sga.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isMonthDim = dimensao === 'mes'
  const formatVal = metrica === 'custo' ? fmt : (v: number) => fmtN(v)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatório Dinâmico</h1>
        <p className="text-muted-foreground text-sm">Monte relatórios customizados com agrupamentos e métricas</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Painel de configuração */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Fonte de dados</label>
                <Select value={fonte} onValueChange={v => handleFonteChange(v as Fonte)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lancamentos">Lançamentos de campo</SelectItem>
                    <SelectItem value="transacoes">Transações financeiras</SelectItem>
                    <SelectItem value="insumos">Insumos consumidos</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Agrupar por</label>
                <Select value={dimensao} onValueChange={setDimensao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIMENSOES[fonte].map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Métrica</label>
                <Select value={metrica} onValueChange={setMetrica}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custo">Custo total (R$)</SelectItem>
                    <SelectItem value="quantidade">Quantidade / Volume</SelectItem>
                    <SelectItem value="count">Número de registros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Propriedade</label>
                <Select value={propId} onValueChange={v => {
                  const p = propriedades.find(x => x.id === v)
                  if (p) setPropriedadeSelecionada(p)
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {propriedades.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Safra</label>
                <Select value={safraId} onValueChange={v => {
                  const s = safras.find(x => x.id === v)
                  if (s) setSafraSelecionada(s)
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {safras.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">De</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('w-full justify-start text-left font-normal', !periodoInicio && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                        {periodoInicio ? format(periodoInicio, 'dd/MM/yy') : 'Início'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={periodoInicio} onSelect={setPeriodoInicio} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Até</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('w-full justify-start text-left font-normal', !periodoFim && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                        {periodoFim ? format(periodoFim, 'dd/MM/yy') : 'Fim'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={periodoFim} onSelect={setPeriodoFim} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Button onClick={gerar} disabled={loading || !propId || !safraId} className="w-full bg-primary text-primary-foreground">
                <Play className="h-4 w-4 mr-2" />
                {loading ? 'Gerando...' : 'Gerar relatório'}
              </Button>

              {resultado.length > 0 && (
                <Button variant="outline" onClick={exportarCSV} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Área de resultado */}
        <div>
          {loading && <Skeleton className="h-96" />}
          {!loading && resultado.length === 0 && (
            <Card><CardContent className="py-16 text-center text-muted-foreground">Configure os parâmetros e clique em "Gerar relatório".</CardContent></Card>
          )}
          {!loading && resultado.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue="tabela">
                  <TabsList>
                    <TabsTrigger value="tabela">Tabela</TabsTrigger>
                    <TabsTrigger value="barras">Barras</TabsTrigger>
                    <TabsTrigger value="pizza">Pizza</TabsTrigger>
                    <TabsTrigger value="linha" disabled={!isMonthDim}>Linha</TabsTrigger>
                  </TabsList>

                  <TabsContent value="tabela">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer" onClick={() => { setSortCol('label'); setSortAsc(sortCol === 'label' ? !sortAsc : true) }}>
                              Dimensão {sortCol === 'label' && (sortAsc ? '↑' : '↓')}
                            </TableHead>
                            <TableHead className="text-right cursor-pointer" onClick={() => { setSortCol('valor'); setSortAsc(sortCol === 'valor' ? !sortAsc : false) }}>
                              Valor {sortCol === 'valor' && (sortAsc ? '↑' : '↓')}
                            </TableHead>
                            <TableHead className="text-right">% do total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sorted.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{r.label}</TableCell>
                              <TableCell className="text-right">{formatVal(r.valor)}</TableCell>
                              <TableCell className="text-right">{total > 0 ? fmtN((r.valor / total) * 100, 1) : '0,0'}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell className="font-bold">TOTAL</TableCell>
                            <TableCell className="text-right font-bold">{formatVal(total)}</TableCell>
                            <TableCell className="text-right font-bold">100%</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="barras">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={resultado}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" angle={-30} textAnchor="end" height={80} />
                        <YAxis tickFormatter={v => metrica === 'custo' ? fmt(v) : String(v)} />
                        <Tooltip formatter={(v: number) => formatVal(v)} />
                        <Bar dataKey="valor" fill="hsl(142,70%,40%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  <TabsContent value="pizza">
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie data={resultado} dataKey="valor" nameKey="label" cx="50%" cy="50%" outerRadius={140}
                          label={({ label, valor }) => `${label}: ${total > 0 ? fmtN((valor / total) * 100, 1) : 0}%`}>
                          {resultado.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatVal(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  <TabsContent value="linha">
                    {isMonthDim && (
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={resultado}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis tickFormatter={v => metrica === 'custo' ? fmt(v) : String(v)} />
                          <Tooltip formatter={(v: number) => formatVal(v)} />
                          <Line type="monotone" dataKey="valor" stroke="hsl(142,70%,40%)" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
