import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ClipboardList, Wheat, CheckCircle, AlertTriangle, ArrowRight,
  Coffee, Apple, Sprout, Leaf, Beef, Syringe,
} from 'lucide-react'
import { useModulos } from '@/hooks/useModulos'
import { useGlobal } from '@/contexts/GlobalContext'
import { supabase } from '@/lib/supabase'
import { ChartCard } from '@/components/common/ChartCard'
import { exportarResumoDashboard } from '@/lib/exportRelatorio'
import { FileDown } from 'lucide-react'
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs'
import { TabelaConsolidada } from '@/components/dashboard/TabelaConsolidada'
import { EstoqueProducao } from '@/components/dashboard/EstoqueProducao'
import { CardClima } from '@/components/dashboard/CardClima'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const PIE_COLORS = [
  'hsl(142, 45%, 28%)', 'hsl(42, 85%, 55%)', 'hsl(199, 89%, 48%)',
  'hsl(30, 35%, 45%)', 'hsl(262, 52%, 47%)', 'hsl(0, 72%, 51%)',
  'hsl(173, 58%, 39%)', 'hsl(326, 78%, 50%)',
]

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatMesLabel = (item: any) => {
  try {
    const dateStr = item.mes || item.month || item.periodo || ''
    if (dateStr.includes('T') || dateStr.includes('-')) {
      return format(new Date(dateStr), 'MMM/yy', { locale: ptBR })
    }
    return dateStr
  } catch {
    return item.mes || item.month || item.periodo || ''
  }
}

function DashboardPecuaria({ propId, navigate }: { propId: string; navigate: (path: string) => void }) {
  const { data: resumoPecuaria } = useQuery({
    queryKey: ['dash-pecuaria', propId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('rebanhos').select('id, nome, especie, quantidade_atual').eq('propriedade_id', propId).eq('ativo', true)
      return data || []
    },
    enabled: !!propId,
  })

  const { data: vacinasProximas } = useQuery({
    queryKey: ['dash-vacinas', propId],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0]
      const limite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { data } = await (supabase as any)
        .from('sanitario_eventos')
        .select('id, descricao, tipo, data_proxima, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .gte('data_proxima', hoje)
        .lte('data_proxima', limite)
        .order('data_proxima')
      return data || []
    },
    enabled: !!propId,
  })

  const totalAnimais = (resumoPecuaria || []).reduce((s: number, r: any) => s + (r.quantidade_atual || 0), 0)

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
        <Beef className="h-5 w-5 text-primary" />
        Pecuária
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Resumo do rebanho */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Rebanho Atual</h3>
            {!resumoPecuaria?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum lote cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {resumoPecuaria.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{r.nome}</span>
                    <Badge variant="secondary">{r.quantidade_atual} animais</Badge>
                  </div>
                ))}
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Total: {totalAnimais} animais</span>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/pecuaria')}>
                  Ver Pecuária
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas de vacinação */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Syringe className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground">Eventos Sanitários Próximos</h3>
              {vacinasProximas?.length ? (
                <Badge variant="destructive" className="ml-auto">{vacinasProximas.length}</Badge>
              ) : null}
            </div>
            {!vacinasProximas?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">✅ Nenhum evento nos próximos 30 dias.</p>
            ) : (
              <div className="space-y-2">
                {vacinasProximas.slice(0, 4).map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{v.descricao}</p>
                        {v.rebanho?.nome && (
                          <span className="text-xs text-muted-foreground">· {v.rebanho.nome}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 ml-2">
                      {format(new Date(v.data_proxima + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                    </Badge>
                  </div>
                ))}
                {vacinasProximas.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center">+{vacinasProximas.length - 4} outros eventos</p>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/pecuaria')}>
                  Ver todos na Pecuária
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { propriedadeAtual, safraAtual, propriedades, setPropriedadeAtual } = useGlobal()
  const navigate = useNavigate()
  const { modulos } = useModulos()
  const propId = propriedadeAtual?.id
  const safraId = safraAtual?.id
  const isConsolidado = !propId
  const enabledFiltered = !!propId && !!safraId

  // ── CONSOLIDATED QUERIES ──
  const { data: consolidadoData, isLoading: loadConsolidado } = useQuery({
    queryKey: ['dash-consolidado', safraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_dashboard_consolidado', {
        p_propriedade_id: null,
        p_safra_id: safraId || null,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: true,
  })

  const totaisConsolidados = useMemo(() => {
    if (!consolidadoData?.length) return { total_lancamentos: 0, custo_total: 0, area_operada_ha: 0, receitas_pagas: 0, despesas_pagas: 0, saldo: 0 }
    return consolidadoData.reduce((acc: any, row: any) => ({
      total_lancamentos: acc.total_lancamentos + Number(row.total_lancamentos || 0),
      custo_total: acc.custo_total + Number(row.custo_total || 0),
      area_operada_ha: acc.area_operada_ha + Number(row.area_operada_ha || 0),
      receitas_pagas: acc.receitas_pagas + Number(row.receitas_pagas || 0),
      despesas_pagas: acc.despesas_pagas + Number(row.despesas_pagas || 0),
      saldo: acc.saldo + Number(row.saldo || 0),
    }), { total_lancamentos: 0, custo_total: 0, area_operada_ha: 0, receitas_pagas: 0, despesas_pagas: 0, saldo: 0 })
  }, [consolidadoData])

  const { data: custosMesConsolidado, isLoading: loadMesConsolidado } = useQuery({
    queryKey: ['dash-custos-mes-consolidado'],
    queryFn: async () => {
      const { data: props } = await (supabase as any)
        .from('propriedades').select('id').eq('ativo', true)
      if (!props?.length) return []
      const results = await Promise.all(
        props.map((p: any) =>
          (supabase as any).rpc('get_custos_por_mes', {
            p_propriedade_id: p.id,
            p_safra_id: null,
          })
        )
      )
      const mesMap = new Map<string, number>()
      results.forEach((r: any) => {
        (r.data || []).forEach((item: any) => {
          const key = item.mes || item.month || item.periodo || ''
          mesMap.set(key, (mesMap.get(key) || 0) + Number(item.custo_total || 0))
        })
      })
      return Array.from(mesMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, custo_total]) => ({ mes, custo_total }))
    },
    enabled: isConsolidado,
  })

  const { data: custosCategConsolidado, isLoading: loadCatConsolidado } = useQuery({
    queryKey: ['dash-categ-consolidado'],
    queryFn: async () => {
      const { data: props } = await (supabase as any)
        .from('propriedades').select('id').eq('ativo', true)
      if (!props?.length) return []
      const results = await Promise.all(
        props.map((p: any) =>
          (supabase as any).rpc('get_relatorio_por_categoria', {
            p_propriedade_id: p.id,
            p_safra_id: null,
          })
        )
      )
      const catMap = new Map<string, number>()
      results.forEach((r: any) => {
        (r.data || []).forEach((item: any) => {
          const cat = item.categoria || 'Outros'
          catMap.set(cat, (catMap.get(cat) || 0) + Number(item.custo_total || 0))
        })
      })
      return Array.from(catMap.entries()).map(([categoria, custo_total]) => ({ categoria, custo_total }))
    },
    enabled: isConsolidado,
  })

  const { data: lancConsolidado, isLoading: loadLancConsolidado } = useQuery({
    queryKey: ['dash-lanc-consolidado'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('lancamentos')
        .select(`id, data_execucao, custo_total, propriedade_id, propriedades(nome), talhoes(nome), servicos(nome)`)
        .order('data_execucao', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data || []).map((l: any) => ({
        servico_nome: l.servicos?.nome || 'Serviço',
        talhao_nome: l.talhoes?.nome || 'Talhão',
        propriedade_nome: l.propriedades?.nome || '',
        data_execucao: l.data_execucao,
        custo_total: Number(l.custo_total || 0),
      }))
    },
    enabled: isConsolidado,
  })

  // ── FILTERED QUERIES ──
  const { data: lancData, isLoading: loadLanc } = useQuery({
    queryKey: ['dash-lanc', propId, safraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_relatorio_lancamentos', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: enabledFiltered,
  })

  const { data: transData, isLoading: loadTrans } = useQuery({
    queryKey: ['dash-trans', propId, safraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('transacoes').select('tipo,valor,status')
        .eq('propriedade_id', propId).eq('safra_id', safraId)
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: enabledFiltered,
  })

  const { data: custosMes, isLoading: loadMes } = useQuery({
    queryKey: ['dash-custos-mes', propId, safraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_custos_por_mes', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: enabledFiltered,
  })

  const { data: custosCategoria, isLoading: loadCat } = useQuery({
    queryKey: ['dash-custos-cat', propId, safraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_relatorio_por_categoria', {
        p_propriedade_id: propId, p_safra_id: safraId,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: enabledFiltered,
  })

  const { data: transVencidas } = useQuery({
    queryKey: ['dash-vencidas', propId, safraId],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0]
      const { data, error } = await (supabase as any)
        .from('transacoes').select('id')
        .eq('propriedade_id', propId).eq('safra_id', safraId)
        .eq('status', 'pendente').lt('data_vencimento', hoje)
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: enabledFiltered,
  })

  const { data: produtosBaixos } = useQuery({
    queryKey: ['dash-estoque-baixo', propId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('produtos').select('nome,saldo_atual,nivel_minimo')
        .eq('propriedade_id', propId).lt('saldo_atual', 10)
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  const { data: producaoSafra, isLoading: loadProd } = useQuery({
    queryKey: ['dash-producao', propId, safraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('producoes')
        .select(`*, cultura:culturas_config(nome_exibicao, unidade_label, icone), talhao:talhoes(nome)`)
        .eq('propriedade_id', propId)
        .eq('safra_id', safraId)
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: enabledFiltered,
  })

  // ── Computed (filtered mode) ──
  const totalLanc = lancData?.length ?? 0
  const custoTotal = lancData?.reduce((s: number, l: any) => s + Number(l.custo_total || 0), 0) ?? 0

  const areaOperada = (() => {
    if (!lancData?.length) return 0
    const seen = new Map<string, number>()
    lancData.forEach((l: any) => {
      if (l.talhao_id && !seen.has(l.talhao_id)) {
        seen.set(l.talhao_id, Number(l.talhao_area_ha || l.area_ha || 0))
      }
    })
    return Array.from(seen.values()).reduce((a, b) => a + b, 0)
  })()

  const saldo = (() => {
    if (!transData?.length) return 0
    return transData.reduce((s: number, t: any) => {
      if (t.status !== 'pago') return s
      return t.tipo === 'receita' ? s + Number(t.valor) : s - Number(t.valor)
    }, 0)
  })()

  const producaoAgrupada = useMemo(() => {
    if (!producaoSafra?.length) return []
    const map = new Map<string, { nome: string; unidade: string; icone: string; colhido: number; vendido: number; disponivel: number }>()
    producaoSafra.forEach((p: any) => {
      const nome = p.cultura?.nome_exibicao || 'Sem cultura'
      const existing = map.get(nome)
      if (existing) {
        existing.colhido += Number(p.quantidade_colhida || 0)
        existing.vendido += Number(p.quantidade_vendida || 0)
        existing.disponivel += Number(p.quantidade_disponivel || 0)
      } else {
        map.set(nome, {
          nome,
          unidade: p.cultura?.unidade_label || 'un',
          icone: p.cultura?.icone || '',
          colhido: Number(p.quantidade_colhida || 0),
          vendido: Number(p.quantidade_vendida || 0),
          disponivel: Number(p.quantidade_disponivel || 0),
        })
      }
    })
    return Array.from(map.values())
  }, [producaoSafra])

  const ultimosLanc = lancData
    ? [...lancData].sort((a: any, b: any) => (b.data_execucao || '').localeCompare(a.data_execucao || '')).slice(0, 5)
    : []

  // ── Render data (mode-aware) ──
  const dadosMesRender = isConsolidado ? custosMesConsolidado : custosMes
  const dadosCatRender = isConsolidado ? custosCategConsolidado : custosCategoria
  const isLoadingMesRender = isConsolidado ? loadMesConsolidado : loadMes
  const isLoadingCatRender = isConsolidado ? loadCatConsolidado : loadCat
  const ultimosLancRender = isConsolidado ? (lancConsolidado || []) : ultimosLanc
  const isLoadingLancRender = isConsolidado ? loadLancConsolidado : loadLanc

  const dadosMesFormatted = useMemo(() => {
    return (dadosMesRender || []).map((item: any) => ({
      ...item,
      mesLabel: formatMesLabel(item),
    }))
  }, [dadosMesRender])

  const totalCategoria = useMemo(() => {
    return (dadosCatRender || []).reduce((s: number, c: any) => s + Number(c.custo_total || 0), 0)
  }, [dadosCatRender])

  const alertas: { msg: string; tipo: 'high' | 'medium' }[] = []
  if (transVencidas?.length) alertas.push({ msg: `${transVencidas.length} transação(ões) vencida(s)`, tipo: 'high' })
  if (produtosBaixos?.length) alertas.push(...produtosBaixos.map((p: any) => ({ msg: `Estoque baixo: ${p.nome}`, tipo: 'medium' as const })))

  const isLoadingFiltered = loadLanc || loadTrans

  // KPI data based on mode
  const kpiData = isConsolidado
    ? {
        totalLanc: totaisConsolidados.total_lancamentos,
        custoTotal: totaisConsolidados.custo_total,
        areaOperada: totaisConsolidados.area_operada_ha,
        saldo: totaisConsolidados.saldo,
      }
    : { totalLanc, custoTotal, areaOperada, saldo }

  const kpiLoading = isConsolidado ? loadConsolidado : isLoadingFiltered

  const handleSelectPropriedade = (propIdSelected: string) => {
    const prop = propriedades.find((p) => p.id === propIdSelected)
    if (prop) setPropriedadeAtual(prop)
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {isConsolidado ? 'Dashboard — Visão Geral' : 'Dashboard'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isConsolidado
                ? `Todas as propriedades · ${safraAtual?.nome || 'Todas as safras'}`
                : `Safra ${safraAtual?.nome} — ${propriedadeAtual?.nome}`
              }
            </p>
          </div>
          {isConsolidado && (
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20 font-bold text-xs">
              CONSOLIDADO
            </Badge>
          )}
        </div>
        {!isConsolidado && (
          <Button asChild size="sm" className="gap-2">
            <Link to="/lancamentos/novo">
              <ClipboardList className="h-4 w-4" />
              Novo Lançamento
            </Link>
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <DashboardKPIs data={kpiData} isLoading={kpiLoading} />

      {/* Consolidated table */}
      {isConsolidado && consolidadoData?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Por Propriedade</h2>
          <TabelaConsolidada
            data={consolidadoData}
            onSelectPropriedade={handleSelectPropriedade}
          />
        </div>
      )}

      {/* Estoque de Produção (both modes) */}
      <EstoqueProducao propriedadeId={propId || null} isConsolidado={isConsolidado} />

      {/* Pecuária */}
      {modulos.pecuaria && propId && <DashboardPecuaria propId={propId} navigate={navigate} />}

      {/* Clima — consolidated: full width, above charts */}
      {isConsolidado && (
        <div className="w-full">
          <CardClima propriedades={propriedades} />
        </div>
      )}

      {/* Produção da Safra */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Produção da Safra</h2>
        {isConsolidado ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Sprout className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground py-4 text-center">
                Selecione uma propriedade para ver a produção da safra.
              </p>
            </CardContent>
          </Card>
        ) : loadProd ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : producaoAgrupada.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Sprout className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Nenhuma colheita registrada nesta safra</p>
              <Button asChild variant="outline" size="sm">
                <Link to="/talhoes">Registrar Produção</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {producaoAgrupada.map((item) => {
              const pct = item.colhido > 0 ? Math.round((item.vendido / item.colhido) * 100) : 0
              const IconComp = item.icone === 'coffee' ? Coffee : item.icone === 'wheat' ? Wheat : item.icone === 'apple' ? Apple : item.icone === 'sprout' ? Sprout : Leaf
              return (
                <Card key={item.nome}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <IconComp className="h-5 w-5 text-primary" />
                      <Badge variant="secondary">{item.nome}</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Colhido: <span className="font-medium text-foreground">{item.colhido.toLocaleString('pt-BR')} {item.unidade}</span></p>
                      <p>Vendido: <span className="font-medium text-foreground">{item.vendido.toLocaleString('pt-BR')} {item.unidade}</span></p>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20">
                      Disponível: {item.disponivel.toLocaleString('pt-BR')} {item.unidade}
                    </Badge>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Vendido</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress
                        value={pct}
                        className={`h-2 ${pct > 80 ? '[&>div]:bg-destructive' : pct >= 50 ? '[&>div]:bg-warning' : '[&>div]:bg-success'}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className={`grid gap-6 ${isConsolidado ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        <ChartCard title="Investimento por Mês" description="Custos consolidados por mês" className={isConsolidado ? 'lg:col-span-1' : 'lg:col-span-2'}>
          {isLoadingMesRender ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosMesFormatted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} interval={0} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [fmt(value), 'Custo']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="custo_total" name="Custo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* CardClima inline only in filtered mode */}
        {!isConsolidado && <CardClima />}

        <ChartCard title="Distribuição por Categoria" description="Custos por tipo de serviço" className={isConsolidado ? 'lg:col-span-1' : 'lg:col-span-3'}>
          {isLoadingCatRender ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosCatRender || []}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="custo_total"
                    nameKey="categoria"
                  >
                    {(dadosCatRender || []).map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [fmt(value), 'Custo']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {(dadosCatRender || []).map((item: any, i: number) => {
                  const pct = totalCategoria > 0 ? ((Number(item.custo_total || 0) / totalCategoria) * 100).toFixed(1) : '0.0'
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-muted-foreground truncate">{item.categoria} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Bottom row — Lançamentos + Alertas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Últimos Lançamentos */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-card-foreground">Últimos Lançamentos</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/lancamentos" className="gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          {isLoadingLancRender ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : ultimosLancRender.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lançamento encontrado.</p>
          ) : (
            <div className="space-y-3">
              {ultimosLancRender.map((l: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{l.servico_nome || 'Serviço'}</p>
                    <p className="text-xs text-muted-foreground">
                      {isConsolidado && l.propriedade_nome && `${l.propriedade_nome} · `}
                      {l.talhao_nome || 'Talhão'} • {l.data_execucao || '—'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground ml-3 shrink-0">{fmt(Number(l.custo_total || 0))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-card-foreground">Alertas do Sistema</h3>
          </div>
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle className="h-10 w-10 text-success mb-3" />
              <p className="text-sm text-muted-foreground">
                {isConsolidado ? 'Selecione uma propriedade para ver alertas detalhados' : 'Nenhum alerta no momento'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertas.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-4 transition-colors hover:bg-muted">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${a.tipo === 'high' ? 'bg-destructive animate-pulse' : 'bg-warning'}`} />
                    <span className="text-sm font-medium text-foreground">{a.msg}</span>
                  </div>
                  <Badge variant={a.tipo === 'high' ? 'destructive' : 'secondary'}>
                    {a.tipo === 'high' ? 'Urgente' : 'Atenção'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
