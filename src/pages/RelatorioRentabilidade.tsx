import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useSafraContext } from '@/contexts/SafraContext'
import {
  ComposedChart, Bar, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { DollarSign, TrendingUp, TrendingDown, Wheat, BarChart3 } from 'lucide-react'

const fmt = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

const fmtN = (v: number | null | undefined, d = 2) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

const PIE_COLORS = [
  'hsl(142,70%,40%)', 'hsl(200,70%,50%)', 'hsl(40,90%,50%)',
  'hsl(0,72%,51%)', 'hsl(270,60%,50%)', 'hsl(180,60%,40%)',
  'hsl(320,60%,50%)', 'hsl(60,80%,45%)',
]

const db = supabase as any

export default function RelatorioRentabilidade() {
  const { propriedades, safras, propriedadeSelecionada, safraSelecionada, setPropriedadeSelecionada, setSafraSelecionada } = useSafraContext()

  const propId = propriedadeSelecionada?.id || ''
  const safraId = safraSelecionada?.id || ''
  const enabled = !!propId && !!safraId

  const resumo = useQuery({
    queryKey: ['rentabilidade-resumo', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_rentabilidade_safra', { p_propriedade_id: propId, p_safra_id: safraId })
      if (error) throw error
      return data
    },
    enabled,
  })

  const breakdown = useQuery({
    queryKey: ['rentabilidade-breakdown', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_breakdown_custos', { p_propriedade_id: propId, p_safra_id: safraId })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled,
  })

  const talhoes = useQuery({
    queryKey: ['rentabilidade-talhoes', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_rentabilidade_por_talhao', { p_propriedade_id: propId, p_safra_id: safraId })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled,
  })

  const insumos = useQuery({
    queryKey: ['rentabilidade-insumos', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_custo_por_insumo', { p_propriedade_id: propId, p_safra_id: safraId })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled,
  })

  const evolucao = useQuery({
    queryKey: ['rentabilidade-evolucao', propId, safraId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_evolucao_mensal', { p_propriedade_id: propId, p_safra_id: safraId })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled,
  })

  const comparativo = useQuery({
    queryKey: ['rentabilidade-comparativo', propId],
    queryFn: async () => {
      const { data, error } = await db.rpc('get_comparativo_safras', { p_propriedade_id: propId })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  const isLoading = resumo.isLoading || breakdown.isLoading || talhoes.isLoading || insumos.isLoading || evolucao.isLoading
  const r = resumo.data || {} as any

  const temProducaoZero = useMemo(() =>
    (talhoes.data || []).some((t: any) => !t.quantidade_colhida || Number(t.quantidade_colhida) === 0),
    [talhoes.data]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rentabilidade da Safra</h1>
        <p className="text-muted-foreground text-sm">Análise completa de custos, receitas e resultado por safra</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-64">
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
            <div className="w-64">
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
          </div>
        </CardContent>
      </Card>

      {!enabled && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione uma propriedade e safra para visualizar o relatório.</CardContent></Card>
      )}

      {enabled && isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
          <Skeleton className="col-span-full h-80" />
          <Skeleton className="col-span-full h-64" />
        </div>
      )}

      {enabled && !isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-[hsl(var(--success))]" />
                  <span className="text-sm font-medium text-muted-foreground">Receita Total</span>
                </div>
                <p className={`text-2xl font-bold ${Number(r.receita_total) > 0 ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}`}>
                  {fmt(r.receita_total)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Custo Total</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{fmt(r.custo_total)}</p>
                <p className="text-xs text-muted-foreground">{fmt(r.custo_por_ha)}/ha</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  {Number(r.resultado) >= 0 ? <TrendingUp className="h-5 w-5 text-[hsl(var(--success))]" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
                  <span className="text-sm font-medium text-muted-foreground">{Number(r.resultado) >= 0 ? 'Lucro' : 'Prejuízo'}</span>
                </div>
                <p className={`text-2xl font-bold ${Number(r.resultado) >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                  {fmt(r.resultado)}
                </p>
                <p className="text-xs text-muted-foreground">Margem: {fmtN(r.margem_pct, 1)}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Wheat className="h-5 w-5 text-[hsl(var(--accent))]" />
                  <span className="text-sm font-medium text-muted-foreground">Área Cultivada</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{fmtN(r.area_ha, 1)} ha</p>
                <p className="text-xs text-muted-foreground">Receita/ha: {fmt(r.receita_por_ha)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Evolução Mensal */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Evolução Mensal</CardTitle></CardHeader>
            <CardContent>
              {(evolucao.data || []).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Sem dados de evolução para esta safra.</p>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={evolucao.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes_label" />
                    <YAxis tickFormatter={v => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="custo_lancamentos" name="Custo Lançamentos" fill="hsl(0,72%,51%)" />
                    <Bar dataKey="custo_financeiro" name="Custo Financeiro" fill="hsl(270,60%,50%)" />
                    <Bar dataKey="receita" name="Receita" fill="hsl(142,70%,40%)" />
                    <Line type="monotone" dataKey="resultado_acum" name="Resultado Acumulado" stroke="hsl(200,70%,50%)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Breakdown de Custos */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">Distribuição de Custos</CardTitle></CardHeader>
              <CardContent>
                {(breakdown.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Sem dados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={breakdown.data} dataKey="valor_total" nameKey="categoria" cx="50%" cy="50%" outerRadius={100} label={({ categoria, percentual }) => `${categoria}: ${fmtN(percentual, 1)}%`}>
                        {(breakdown.data || []).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader><CardTitle className="text-lg">Detalhamento de Custos</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">% do total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(breakdown.data || []).sort((a: any, b: any) => Number(b.valor_total) - Number(a.valor_total)).map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.categoria}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={item.origem === 'lancamento' ? 'border-blue-300 text-blue-700' : 'border-purple-300 text-purple-700'}>
                              {item.origem === 'lancamento' ? 'Lançamento' : 'Financeiro'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{fmt(item.valor_total)}</TableCell>
                          <TableCell className="text-right">{fmtN(item.percentual, 1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rentabilidade por Talhão */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Rentabilidade por Talhão</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Talhão</TableHead>
                      <TableHead>Cultura</TableHead>
                      <TableHead className="text-right">Área (ha)</TableHead>
                      <TableHead className="text-right">Custo total</TableHead>
                      <TableHead className="text-right">Custo/ha</TableHead>
                      <TableHead className="text-right">Produção</TableHead>
                      <TableHead className="text-right">Produtiv./ha</TableHead>
                      <TableHead className="text-right">Resultado est.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(talhoes.data || []).map((t: any, i: number) => {
                      const res = Number(t.resultado_estimado ?? 0)
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{t.talhao_nome}</TableCell>
                          <TableCell>{t.cultura_nome || '—'}</TableCell>
                          <TableCell className="text-right">{fmtN(t.area_ha, 1)}</TableCell>
                          <TableCell className="text-right">{fmt(t.custo_total)}</TableCell>
                          <TableCell className="text-right">{fmt(t.custo_por_ha)}</TableCell>
                          <TableCell className="text-right">
                            {Number(t.quantidade_colhida) > 0 ? `${fmtN(t.quantidade_colhida)} ${t.unidade_label || ''}` : '—'}
                          </TableCell>
                          <TableCell className="text-right">{Number(t.produtividade_ha) > 0 ? fmtN(t.produtividade_ha) : '—'}</TableCell>
                          <TableCell className={`text-right font-semibold ${res > 0 ? 'text-[hsl(var(--success))]' : res < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {fmt(res)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {temProducaoZero && (
                <p className="text-xs text-muted-foreground mt-2">* Produção não registrada para alguns talhões nesta safra.</p>
              )}
            </CardContent>
          </Card>

          {/* Top Insumos */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Top Insumos Consumidos</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead>Unid.</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Custo total</TableHead>
                      <TableHead className="text-right">Custo médio</TableHead>
                      <TableHead className="w-40">%</TableHead>
                      <TableHead className="text-right">Talhões</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(insumos.data || []).map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.produto_nome}</TableCell>
                        <TableCell>{item.unidade_medida || '—'}</TableCell>
                        <TableCell className="text-right">{fmtN(item.quantidade_total)}</TableCell>
                        <TableCell className="text-right">{fmt(item.custo_total)}</TableCell>
                        <TableCell className="text-right">{fmt(item.custo_unitario_medio)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={Number(item.percentual ?? 0)} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-10 text-right">{fmtN(item.percentual, 1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.talhoes_usados ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Comparativo entre Safras */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Comparativo entre Safras</CardTitle></CardHeader>
            <CardContent>
              {comparativo.isLoading ? <Skeleton className="h-40" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Safra</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Resultado</TableHead>
                        <TableHead className="text-right">Margem%</TableHead>
                        <TableHead className="text-right">Custo/ha</TableHead>
                        <TableHead className="text-right">Lançamentos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(comparativo.data || []).map((s: any, i: number) => {
                        const isAtiva = s.ativa && !s.fechada
                        const status = s.fechada ? 'Fechada' : s.ativa ? 'Ativa' : 'Futura'
                        const statusColor = s.fechada ? 'bg-muted text-muted-foreground' : s.ativa ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        const res = Number(s.resultado ?? 0)
                        return (
                          <TableRow key={i} className={isAtiva ? 'border-l-[3px] border-l-[hsl(var(--success))]' : ''}>
                            <TableCell className="font-medium">{s.safra_nome}</TableCell>
                            <TableCell><Badge className={statusColor}>{status}</Badge></TableCell>
                            <TableCell className="text-right">{fmt(s.receita)}</TableCell>
                            <TableCell className="text-right">{fmt(s.custo_total)}</TableCell>
                            <TableCell className={`text-right font-semibold ${res >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>{fmt(res)}</TableCell>
                            <TableCell className="text-right">{fmtN(s.margem_pct, 1)}%</TableCell>
                            <TableCell className="text-right">{fmt(s.custo_por_ha)}</TableCell>
                            <TableCell className="text-right">{s.lancamentos ?? 0}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
