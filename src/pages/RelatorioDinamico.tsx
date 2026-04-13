import { useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSafraContext } from '@/contexts/SafraContext'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Download, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { toast } from 'sonner'

const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

const fmtN = (v: number | null | undefined, d = 2) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

const CORES = ['#1565C0', '#43A047', '#FB8C00', '#E53935', '#8E24AA', '#00ACC1', '#F9A825', '#6D4C41']

type Fonte = 'lancamentos' | 'transacoes' | 'insumos' | 'producao'

const DIMENSOES: Record<Fonte, { value: string; label: string }[]> = {
  lancamentos: [
    { value: 'talhao', label: 'Por talhão' },
    { value: 'mes', label: 'Por mês' },
    { value: 'servico', label: 'Por serviço' },
    { value: 'categoria', label: 'Por categoria do serviço' },
  ],
  transacoes: [
    { value: 'categoria', label: 'Por categoria' },
    { value: 'mes', label: 'Por mês' },
    { value: 'tipo', label: 'Por tipo (receita/despesa)' },
  ],
  insumos: [
    { value: 'produto', label: 'Por produto' },
    { value: 'talhao', label: 'Por talhão' },
    { value: 'mes', label: 'Por mês' },
  ],
  producao: [
    { value: 'talhao', label: 'Por talhão' },
    { value: 'cultura', label: 'Por cultura' },
    { value: 'mes', label: 'Por mês' },
  ],
}

const db = supabase as any

interface ResultadoRow { label: string; valor: number; count: number; percentual: number }

export default function RelatorioDinamico() {
  const { propriedades, safras, propriedadeSelecionada, safraSelecionada, setPropriedadeSelecionada, setSafraSelecionada } = useSafraContext()

  const [fonte, setFonte] = useState<Fonte>('lancamentos')
  const [dimensao, setDimensao] = useState('talhao')
  const [metrica, setMetrica] = useState('custo')
  const [periodoInicio, setPeriodoInicio] = useState<Date>()
  const [periodoFim, setPeriodoFim] = useState<Date>()
  const [resultado, setResultado] = useState<ResultadoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [gerado, setGerado] = useState(false)
  const [sortCol, setSortCol] = useState<'label' | 'valor' | 'count'>('valor')
  const [sortAsc, setSortAsc] = useState(false)

  const propId = propriedadeSelecionada?.id || ''
  const safraId = safraSelecionada?.id || ''

  const handleFonteChange = (v: Fonte) => {
    setFonte(v)
    setDimensao(DIMENSOES[v][0].value)
    setResultado([])
    setGerado(false)
  }

  const getChave = useCallback((item: any, dim: string, src: Fonte): string => {
    if (src === 'lancamentos') {
      if (dim === 'talhao') return item.talhao?.nome || 'Sem talhão'
      if (dim === 'mes') return item.data_execucao?.substring(0, 7) || 'Sem data'
      if (dim === 'servico') return item.servico?.nome || 'Sem serviço'
      if (dim === 'categoria') return item.servico?.categoria || 'Outros'
    }
    if (src === 'transacoes') {
      if (dim === 'categoria') return item.categoria || 'Outros'
      if (dim === 'mes') {
        const d = item.data_pagamento || item.data_vencimento
        return d ? d.substring(0, 7) : 'Sem data'
      }
      if (dim === 'tipo') return item.tipo === 'receita' ? 'Receita' : 'Despesa'
    }
    if (src === 'insumos') {
      if (dim === 'produto') return item.produto?.nome || 'Sem produto'
      if (dim === 'talhao') return item.lancamento?.talhao?.nome || 'Sem talhão'
      if (dim === 'mes') return item.lancamento?.data_execucao?.substring(0, 7) || 'Sem data'
    }
    if (src === 'producao') {
      if (dim === 'talhao') return item.talhao?.nome || 'Sem talhão'
      if (dim === 'cultura') return item.cultura?.nome_exibicao || 'Sem cultura'
      if (dim === 'mes') return item.data_colheita?.substring(0, 7) || 'Sem data'
    }
    return 'Outros'
  }, [])

  const getValor = useCallback((item: any, met: string, src: Fonte): number => {
    if (met === 'count') return 1
    if (src === 'lancamentos') return parseFloat(item.custo_total || 0)
    if (src === 'transacoes') return parseFloat(item.valor || 0)
    if (src === 'insumos') {
      if (met === 'quantidade') return parseFloat(item.quantidade || 0)
      return parseFloat(item.custo_total || 0)
    }
    if (src === 'producao') return parseFloat(item.quantidade_colhida || 0)
    return 0
  }, [])

  const gerar = async () => {
    if (!propId || !safraId) {
      toast.error('Selecione propriedade e safra.')
      return
    }
    setLoading(true)
    setGerado(true)
    try {
      let dados: any[] = []

      if (fonte === 'lancamentos') {
        const { data, error } = await db.from('lancamentos')
          .select('id, custo_total, data_execucao, servico:servicos(nome,categoria), talhao:talhoes(nome)')
          .eq('propriedade_id', propId).eq('safra_id', safraId)
        if (error) throw error
        dados = data || []
      } else if (fonte === 'transacoes') {
        const { data, error } = await db.from('transacoes')
          .select('id, valor, tipo, categoria, data_pagamento, data_vencimento, status')
          .eq('propriedade_id', propId).eq('safra_id', safraId)
        if (error) throw error
        dados = data || []
      } else if (fonte === 'insumos') {
        const { data, error } = await db.from('lancamentos_itens')
          .select('id, quantidade, custo_total, produto:produtos(nome,unidade_medida), lancamento:lancamentos!inner(safra_id,propriedade_id,data_execucao,talhao:talhoes(nome))')
          .eq('lancamento.propriedade_id', propId)
          .eq('lancamento.safra_id', safraId)
          .not('produto_id', 'is', null)
        if (error) throw error
        dados = data || []
      } else if (fonte === 'producao') {
        const { data, error } = await db.from('producoes')
          .select('id, quantidade_colhida, quantidade_vendida, quantidade_disponivel, preco_unitario_estimado, data_colheita, talhao:talhoes(nome), cultura:culturas_config(nome_exibicao,unidade_label)')
          .eq('propriedade_id', propId).eq('safra_id', safraId)
        if (error) throw error
        dados = data || []
      }

      // Filtro de período
      if (periodoInicio || periodoFim) {
        const ini = periodoInicio ? format(periodoInicio, 'yyyy-MM-dd') : null
        const fim = periodoFim ? format(periodoFim, 'yyyy-MM-dd') : null
        dados = dados.filter((item: any) => {
          let d: string | null = null
          if (fonte === 'lancamentos') d = item.data_execucao
          else if (fonte === 'transacoes') d = item.data_pagamento || item.data_vencimento
          else if (fonte === 'insumos') d = item.lancamento?.data_execucao
          else if (fonte === 'producao') d = item.data_colheita
          if (!d) return true
          const ds = d.substring(0, 10)
          if (ini && ds < ini) return false
          if (fim && ds > fim) return false
          return true
        })
      }

      // Agrupar com reduce
      const agrupado = dados.reduce((acc: Record<string, { label: string; valor: number; count: number }>, item: any) => {
        const chave = getChave(item, dimensao, fonte)
        if (!acc[chave]) acc[chave] = { label: chave, valor: 0, count: 0 }
        acc[chave].valor += getValor(item, metrica, fonte)
        acc[chave].count += 1
        return acc
      }, {})

      const res = Object.values(agrupado)
        .map(r => ({ ...r, valor: Math.round(r.valor * 100) / 100 }))
        .sort((a, b) => b.valor - a.valor)

      const total = res.reduce((s, r) => s + r.valor, 0)
      const comPct = res.map(r => ({
        ...r,
        percentual: total > 0 ? Math.round(r.valor / total * 1000) / 10 : 0,
      }))

      setResultado(comPct)
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao buscar dados: ' + (err.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const total = useMemo(() => resultado.reduce((s, r) => s + r.valor, 0), [resultado])
  const totalCount = useMemo(() => resultado.reduce((s, r) => s + r.count, 0), [resultado])

  const sorted = useMemo(() => {
    const arr = [...resultado]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'label') cmp = a.label.localeCompare(b.label)
      else if (sortCol === 'valor') cmp = a.valor - b.valor
      else cmp = a.count - b.count
      return sortAsc ? cmp : -cmp
    })
    return arr
  }, [resultado, sortCol, sortAsc])

  const dadosLinha = useMemo(() =>
    [...resultado].sort((a, b) => a.label.localeCompare(b.label)),
  [resultado])

  const isMonetario = fonte === 'transacoes' || metrica === 'custo'
  const formatVal = isMonetario ? formatBRL : (v: number) => fmtN(v)

  const colValorLabel = (() => {
    if (metrica === 'count') return 'Registros'
    if (fonte === 'transacoes') return 'Valor (R$)'
    if (fonte === 'producao') return 'Qtd colhida'
    if (fonte === 'insumos' && metrica === 'quantidade') return 'Quantidade'
    return 'Custo (R$)'
  })()

  const isMonthDim = dimensao === 'mes'

  const exportarCSV = () => {
    const headers = ['Dimensão', 'Valor', '% do total', 'Nº registros'].join(';')
    const rows = resultado.map(r =>
      [r.label, r.valor.toFixed(2), r.percentual.toString(), r.count.toString()].join(';')
    )
    const csv = '\uFEFF' + [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_sga_${new Date().toISOString().substring(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSort = (col: 'label' | 'valor' | 'count') => {
    setSortAsc(sortCol === col ? !sortAsc : col === 'label')
    setSortCol(col)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatório Dinâmico</h1>
        <p className="text-muted-foreground text-sm">Monte relatórios customizados com agrupamentos e métricas</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Painel esquerdo */}
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
                    <SelectItem value="quantidade">Quantidade</SelectItem>
                    <SelectItem value="count">Nº de registros</SelectItem>
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
          {loading && (
            <Card><CardContent className="pt-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-80" />
            </CardContent></Card>
          )}

          {!loading && !gerado && (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              Configure os filtros e clique em <strong>Gerar relatório</strong>.
            </CardContent></Card>
          )}

          {!loading && gerado && resultado.length === 0 && (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              Nenhum dado encontrado para os filtros selecionados.
            </CardContent></Card>
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

                  {/* TABELA */}
                  <TabsContent value="tabela">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('label')}>
                              Dimensão {sortCol === 'label' && (sortAsc ? '↑' : '↓')}
                            </TableHead>
                            <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('valor')}>
                              {colValorLabel} {sortCol === 'valor' && (sortAsc ? '↑' : '↓')}
                            </TableHead>
                            <TableHead className="text-right min-w-[140px]">% do total</TableHead>
                            <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('count')}>
                              Nº registros {sortCol === 'count' && (sortAsc ? '↑' : '↓')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sorted.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{r.label}</TableCell>
                              <TableCell className="text-right">{formatVal(r.valor)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <Progress
                                    value={Math.min(r.percentual, 100)}
                                    className="h-2 w-16"
                                  />
                                  <span className="text-xs w-12 text-right">{fmtN(r.percentual, 1)}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{r.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell className="font-bold">TOTAL</TableCell>
                            <TableCell className="text-right font-bold">{formatVal(total)}</TableCell>
                            <TableCell className="text-right font-bold">100%</TableCell>
                            <TableCell className="text-right font-bold">{totalCount}</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* BARRAS */}
                  <TabsContent value="barras">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={resultado}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" angle={-30} textAnchor="end" height={80} />
                        <YAxis tickFormatter={v => isMonetario ? formatBRL(v) : String(v)} />
                        <Tooltip formatter={(v: number) => isMonetario ? formatBRL(v) : fmtN(v)} />
                        <Bar dataKey="valor" name={colValorLabel}>
                          {resultado.map((_, i) => (
                            <Cell key={i} fill={CORES[i % CORES.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  {/* PIZZA */}
                  <TabsContent value="pizza">
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={resultado}
                          dataKey="valor"
                          nameKey="label"
                          cx="50%" cy="50%"
                          outerRadius={140}
                          label={({ label, percentual }) => `${label}: ${percentual}%`}
                        >
                          {resultado.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatVal(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  {/* LINHA */}
                  <TabsContent value="linha">
                    {isMonthDim && (
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={dadosLinha}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis tickFormatter={v => isMonetario ? formatBRL(v) : String(v)} />
                          <Tooltip formatter={(v: number) => formatVal(v)} />
                          <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot />
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
