import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useSafraFechada } from '@/hooks/useSafraFechada'
import { useSafraContext } from '@/contexts/SafraContext'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Beef, Syringe, Milk, ArrowLeftRight, MapPin, Pencil, Trash2, AlertTriangle, Wheat, Scale, ShoppingCart, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays, addMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { LoteDialog } from '@/components/pecuaria/LoteDialog'
import { MovimentacaoDialog } from '@/components/pecuaria/MovimentacaoDialog'
import { CompraAnimaisDialog } from '@/components/pecuaria/CompraAnimaisDialog'
import { EventoSanitarioDialog } from '@/components/pecuaria/EventoSanitarioDialog'
import { StatusVacinacaoModal } from '@/components/pecuaria/StatusVacinacaoModal'
import { OrdenhaDialog } from '@/components/pecuaria/OrdenhaDialog'
import { RacaoDialog } from '@/components/pecuaria/RacaoDialog'
import { PesagemDialog } from '@/components/pecuaria/PesagemDialog'
import { AnimaisRebanhoDialog } from '@/components/pecuaria/AnimaisRebanhoDialog'
import { RankingLeiteCard } from '@/components/pecuaria/RankingLeiteCard'
import { RankingPesoCard } from '@/components/pecuaria/RankingPesoCard'

const ESPECIE_EMOJI: Record<string, string> = {
  bovino_corte: '🐄', bovino_leite: '🐄', ave_postura: '🐔', ave_corte: '🐔',
  suino: '🐷', ovino: '🐑', equino: '🐎', outro: '🐾',
}
const ESPECIE_LABEL: Record<string, string> = {
  bovino_corte: 'Bovino Corte', bovino_leite: 'Bovino Leite', ave_postura: 'Ave Postura',
  ave_corte: 'Ave Corte', suino: 'Suíno', ovino: 'Ovino', equino: 'Equino', outro: 'Outro',
}
const MOV_BADGE: Record<string, string> = {
  nascimento: 'bg-green-100 text-green-800', compra: 'bg-blue-100 text-blue-800',
  venda: 'bg-yellow-100 text-yellow-800', morte: 'bg-red-100 text-red-800',
  transferencia: 'bg-gray-100 text-gray-800',
  transferencia_entrada: 'bg-gray-100 text-gray-800', transferencia_saida: 'bg-gray-100 text-gray-800',
  ajuste_entrada: 'bg-emerald-100 text-emerald-800', ajuste_saida: 'bg-orange-100 text-orange-800',
}

export default function Pecuaria() {
  const { propriedadeAtual } = useGlobal()
  const { safraSelecionada } = useSafraContext()
  const { isFechada, verificarSafra } = useSafraFechada(safraSelecionada)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const propId = propriedadeAtual?.id

  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const highlightId = searchParams.get('highlight')
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'rebanho')

  useEffect(() => {
    if (tabFromUrl) setActiveTab(tabFromUrl)
  }, [tabFromUrl])



  // Dialogs state
  const [loteDialog, setLoteDialog] = useState(false)
  const [editLote, setEditLote] = useState<any>(null)
  const [movDialog, setMovDialog] = useState(false)
  const [compraDialog, setCompraDialog] = useState(false)
  const [compraRebanho, setCompraRebanho] = useState<any>(null)
  const [editMov, setEditMov] = useState<any>(null)
  const [editMovDialog, setEditMovDialog] = useState(false)
  const [deleteMovId, setDeleteMovId] = useState<string | null>(null)
  const [movRebanhoId, setMovRebanhoId] = useState<string | undefined>()
  const [sanitarioDialog, setSanitarioDialog] = useState(false)
  const [ordenhaDialog, setOrdenhaDialog] = useState(false)
  const [ordenhaEditando, setOrdenhaEditando] = useState<any>(null)
  const [deleteOrdenhaId, setDeleteOrdenhaId] = useState<string | null>(null)
  const [racaoDialog, setRacaoDialog] = useState(false)
  const [pesagemDialog, setPesagemDialog] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteSanId, setDeleteSanId] = useState<string | null>(null)
  const [deletePesagemId, setDeletePesagemId] = useState<string | null>(null)
  const [pesagemEditando, setPesagemEditando] = useState<any>(null)

  const [statusVacinacaoRebanho, setStatusVacinacaoRebanho] = useState<{ id: string; nome: string } | null>(null)
  const [animaisRebanho, setAnimaisRebanho] = useState<any>(null)

  // Filters
  const [filtroSanTipo, setFiltroSanTipo] = useState('todos')
  const [filtroSanRebanho, setFiltroSanRebanho] = useState('todos')
  const [mesOrdenha, setMesOrdenha] = useState(() => startOfMonth(new Date()))

  // === QUERIES ===
  const { data: rebanhos, isLoading: loadingRebanhos } = useQuery({
    queryKey: ['rebanhos', propId],
    queryFn: async () => {
      const { data, error } = await supabase.from('rebanhos' as any).select('*').eq('propriedade_id', propId).eq('ativo', true).order('nome')
      if (error) throw error
      return data as any[]
    },
    enabled: !!propId,
  })

  const rebanhosLeite = useMemo(() => (rebanhos || []).filter((r: any) => r.especie === 'bovino_leite'), [rebanhos])

  const { data: movimentacoes, isLoading: loadingMov } = useQuery({
    queryKey: ['rebanho-movimentacoes', propId],
    queryFn: async () => {
      const { data, error } = await supabase.from('rebanho_movimentacoes' as any)
        .select('*, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .order('data_evento', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as any[]
    },
    enabled: !!propId,
  })

  // Rola até a movimentação destacada quando vindo do Financeiro
  useEffect(() => {
    if (!highlightId || activeTab !== 'movimentacoes' || !movimentacoes?.length) return
    const timer = setTimeout(() => {
      const elemento = document.getElementById(`mov-${highlightId}`)
      if (elemento) {
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' })
        elemento.classList.add('bg-yellow-100')
        setTimeout(() => elemento.classList.remove('bg-yellow-100'), 3000)
      }
      setSearchParams(params => {
        params.delete('highlight')
        return params
      }, { replace: true })
    }, 300)
    return () => clearTimeout(timer)
  }, [highlightId, activeTab, movimentacoes, setSearchParams])


  const { data: eventosSanitarios, isLoading: loadingSan } = useQuery({
    queryKey: ['sanitario-eventos', propId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sanitario_eventos' as any)
        .select('*, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .order('data_aplicacao', { ascending: false })
      if (error) throw error
      return data as any[]
    },
    enabled: !!propId,
  })

  const { data: contagemAnimais } = useQuery({
    queryKey: ['sanitario-contagem', propId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sanitario_animais')
        .select('evento_id, animal_id, aplicado, animal:animais(nome, identificador, numero_brinco, sexo)')
      return (data || []) as any[]
    },
    enabled: !!propId,
  })


  const { data: ordenhas, isLoading: loadingOrdenha } = useQuery({
    queryKey: ['ordenhas', propId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ordenhas' as any)
        .select('*, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .order('data', { ascending: false })
      if (error) throw error
      return data as any[]
    },
    enabled: !!propId,
  })

  const { data: pesagens, isLoading: loadingPesagens } = useQuery({
    queryKey: ['pesagens', propId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pesagens' as any)
        .select('*, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .order('data_pesagem', { ascending: false })
        .limit(100)
      return (data || []) as any[]
    },
    enabled: !!propId,
  })

  // === DERIVED DATA ===
  const totalAnimais = (rebanhos || []).reduce((s: number, r: any) => s + (r.quantidade_atual || 0), 0)

  const { data: valoresLotes } = useQuery({
    queryKey: ['valores-lotes-pecuaria', propId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_valor_lotes_pecuaria' as any, { p_propriedade_id: propId })
      if (error) throw error
      const mapa: Record<string, { valor_total: number; custo_medio: number }> = {}
      ;(data || []).forEach((r: any) => {
        mapa[r.rebanho_id] = { valor_total: Number(r.valor_total), custo_medio: Number(r.custo_medio) }
      })
      return mapa
    },
    enabled: !!propId,
  })

  const { data: statsAno } = useQuery({
    queryKey: ['stats-pecuaria-ano', propId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_stats_pecuaria_ano' as any, { p_propriedade_id: propId })
      if (error) throw error
      const r = (data || [])[0] || {}
      return {
        nascimentosAno: Number(r.nascimentos_ano) || 0,
        mortesAno: Number(r.mortes_ano) || 0,
        vendasQtdAno: Number(r.vendas_qtd_ano) || 0,
        vendasValorAno: Number(r.vendas_valor_ano) || 0,
      }
    },
    enabled: !!propId,
  })

  const { data: alertasIdentificacao } = useQuery({
    queryKey: ['alertas-identificacao-pecuaria', propId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_alertas_identificacao_pecuaria' as any, { p_propriedade_id: propId })
      if (error) throw error
      const mapa: Record<string, number> = {}
      ;(data || []).forEach((r: any) => { mapa[r.rebanho_id] = Number(r.sem_identificacao) })
      return mapa
    },
    enabled: !!propId,
  })
  const totalLotes = (rebanhos || []).length

  const valorRebanho = useMemo(() => {
    if (!valoresLotes) return 0
    return Object.values(valoresLotes).reduce((s, v) => s + v.valor_total, 0)
  }, [valoresLotes])

  const eventosProximos = useMemo(() => {
    if (!eventosSanitarios) return 0
    const limite = addDays(new Date(), 30)
    return eventosSanitarios.filter((e: any) => e.data_proxima && new Date(e.data_proxima) <= limite).length
  }, [eventosSanitarios])

  // Leite KPIs
  const mesAtual = useMemo(() => {
    const now = new Date()
    const inicio = startOfMonth(now)
    const fim = endOfMonth(now)
    const ordsMes = (ordenhas || []).filter((o: any) => {
      const d = new Date(o.data)
      return d >= inicio && d <= fim
    })
    const totalLitros = ordsMes.reduce((s: number, o: any) => s + Number(o.litros || 0), 0)
    const diasUnicos = new Set(ordsMes.map((o: any) => o.data)).size
    const receitaMes = ordsMes.reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0)
    const vacasLact = new Set(ordsMes.map((o: any) => o.rebanho_id)).size
    return { totalLitros, mediaDiaria: diasUnicos > 0 ? totalLitros / diasUnicos : 0, receitaMes, vacasLact }
  }, [ordenhas])

  // Chart data - últimos 30 dias
  const chartData = useMemo(() => {
    if (!ordenhas) return []
    const now = new Date()
    const map: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = format(addDays(now, -i), 'yyyy-MM-dd')
      map[d] = 0
    }
    ordenhas.forEach((o: any) => { if (map[o.data] !== undefined) map[o.data] += Number(o.litros || 0) })
    return Object.entries(map).map(([data, litros]) => ({ data: format(new Date(data), 'dd/MM'), litros }))
  }, [ordenhas])

  // Filtered sanitario
  const eventosFiltrados = useMemo(() => {
    let filtered = eventosSanitarios || []
    if (filtroSanTipo !== 'todos') filtered = filtered.filter((e: any) => e.tipo === filtroSanTipo)
    if (filtroSanRebanho !== 'todos') filtered = filtered.filter((e: any) => e.rebanho_id === filtroSanRebanho)
    return filtered
  }, [eventosSanitarios, filtroSanTipo, filtroSanRebanho])

  // Ordenhas do mês selecionado
  const ordenhasDoMes = useMemo(() => {
    const inicio = startOfMonth(mesOrdenha)
    const fim = endOfMonth(mesOrdenha)
    return (ordenhas || []).filter((o: any) => {
      const d = new Date(o.data + 'T12:00:00')
      return d >= inicio && d <= fim
    })
  }, [ordenhas, mesOrdenha])

  // Delete rebanho
  async function handleExcluirMovimentacao() {
    if (!deleteMovId) return
    const { data: removidas, error } = await supabase
      .from('rebanho_movimentacoes' as any)
      .delete()
      .eq('id', deleteMovId)
      .select('id')
    if (error) {
      const fk = String(error.message || '').includes('foreign key') || (error as any).code === '23503'
      toast({
        title: fk ? 'Não é possível excluir: já existem registros vinculados' : 'Erro ao excluir',
        description: fk ? 'Exclua primeiro os registros vinculados a esta movimentação.' : error.message,
        variant: 'destructive',
      })
      return
    }
    if (!removidas || (removidas as any[]).length === 0) {
      toast({
        title: 'Nada foi excluído',
        description: 'A movimentação não foi encontrada ou você não tem permissão para excluí-la.',
        variant: 'destructive',
      })
      return
    }

    queryClient.invalidateQueries({ queryKey: ['rebanho-movimentacoes'] })
    queryClient.invalidateQueries({ queryKey: ['rebanho_movimentacoes'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes-com-anexo'] })
    queryClient.invalidateQueries({ queryKey: ['rebanhos'] })
    toast({ title: 'Movimentação excluída. Despesa correspondente removida do Financeiro.' })
    setDeleteMovId(null)
  }

  async function handleExcluirOrdenha() {
    if (!deleteOrdenhaId) return
    const ordenha = (ordenhas || []).find((o: any) => o.id === deleteOrdenhaId)

    if (ordenha?.lote_id) {
      const { data: lote } = await supabase
        .from('lotes' as any)
        .select('quantidade_original, quantidade_disponivel')
        .eq('id', ordenha.lote_id)
        .maybeSingle()
      if (lote) {
        const consumido = Math.max(Number((lote as any).quantidade_original) - Number((lote as any).quantidade_disponivel), 0)
        if (consumido <= 0) {
          await supabase.from('lotes' as any).delete().eq('id', ordenha.lote_id)
        } else {
          await supabase.from('lotes' as any).update({ quantidade_original: consumido, quantidade_disponivel: 0 } as any).eq('id', ordenha.lote_id)
        }
      }
    }

    const { data: removidas, error } = await supabase.from('ordenhas' as any).delete().eq('id', deleteOrdenhaId).select('id')
    if (error) {
      toast({ title: 'Erro ao excluir ordenha', description: error.message, variant: 'destructive' })
      return
    }
    if (!removidas || (removidas as any[]).length === 0) {
      toast({ title: 'Nada foi excluído', variant: 'destructive' })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['ordenhas'] })
    queryClient.invalidateQueries({ queryKey: ['ranking-leite'] })
    queryClient.invalidateQueries({ queryKey: ['produtos'] })
    queryClient.invalidateQueries({ queryKey: ['produtos-leite'] })
    queryClient.invalidateQueries({ queryKey: ['lotes'] })
    toast({ title: 'Ordenha excluída. Estoque ajustado.' })
    setDeleteOrdenhaId(null)
  }

  async function handleExcluirSanitario() {
    if (!deleteSanId) return
    const { data: removidos, error } = await supabase
      .from('sanitario_eventos' as any)
      .delete()
      .eq('id', deleteSanId)
      .select('id')
    if (error) {
      toast({ title: 'Erro ao excluir evento', description: error.message, variant: 'destructive' })
      return
    }
    if (!removidos || (removidos as any[]).length === 0) {
      toast({ title: 'Nada foi excluído', description: 'O evento não foi encontrado ou você não tem permissão.', variant: 'destructive' })
      return
    }

    queryClient.invalidateQueries({ queryKey: ['sanitario-eventos'] })
    queryClient.invalidateQueries({ queryKey: ['sanitario-contagem'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
    queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
    queryClient.invalidateQueries({ queryKey: ['produtos'] })
    queryClient.invalidateQueries({ queryKey: ['produtos-pecuarios'] })
    queryClient.invalidateQueries({ queryKey: ['lotes'] })
    toast({ title: 'Evento excluído. Lançamento removido e estoque devolvido (se veio do estoque).' })
    setDeleteSanId(null)
  }

  async function handleExcluirPesagem() {
    if (!deletePesagemId) return
    const { data: removidas, error } = await supabase.from('pesagens' as any).delete().eq('id', deletePesagemId).select('id')
    if (error) {
      toast({ title: 'Erro ao excluir pesagem', description: error.message, variant: 'destructive' })
      return
    }
    if (!removidas || (removidas as any[]).length === 0) {
      toast({ title: 'Nada foi excluído', description: 'A pesagem não foi encontrada ou você não tem permissão.', variant: 'destructive' })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['pesagens'] })
    queryClient.invalidateQueries({ queryKey: ['ranking-peso'] })
    toast({ title: 'Pesagem excluída.' })
    setDeletePesagemId(null)
  }

  async function handleDelete() {
    if (!deleteId) return

    // Remove primeiro os eventos sanitários do lote — dispara a limpeza de despesa e estoque vinculados
    const { error: erroSanitario } = await supabase
      .from('sanitario_eventos' as any)
      .delete()
      .eq('rebanho_id', deleteId)
    if (erroSanitario) {
      toast({ title: 'Erro ao excluir eventos sanitários do lote', description: erroSanitario.message, variant: 'destructive' })
      return
    }

    // Remove as movimentações do lote — dispara a limpeza das despesas/receitas correspondentes no Financeiro
    const { error: erroMovs } = await supabase
      .from('rebanho_movimentacoes' as any)
      .delete()
      .eq('rebanho_id', deleteId)
    if (erroMovs) {
      toast({ title: 'Erro ao excluir movimentações do lote', description: erroMovs.message, variant: 'destructive' })
      return
    }

    const { data: removidos, error } = await supabase
      .from('rebanhos' as any)
      .update({ ativo: false })
      .eq('id', deleteId)
      .select('id')
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    if (!removidos || (removidos as any[]).length === 0) {
      toast({ title: 'Nada foi excluído', description: 'O rebanho não foi encontrado ou você não tem permissão.', variant: 'destructive' })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['rebanhos'] })
    queryClient.invalidateQueries({ queryKey: ['rebanho-movimentacoes'] })
    queryClient.invalidateQueries({ queryKey: ['rebanho_movimentacoes'] })
    queryClient.invalidateQueries({ queryKey: ['sanitario-eventos'] })
    queryClient.invalidateQueries({ queryKey: ['sanitario-contagem'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes-com-anexo'] })
    toast({ title: 'Lote excluído. Movimentações, eventos sanitários e lançamentos financeiros vinculados também foram removidos.' })
    setDeleteId(null)
  }

  if (!propId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Beef className="h-6 w-6" /> Pecuária</h1>
        <Card className="mt-6"><CardContent className="py-12 text-center text-muted-foreground">Selecione uma propriedade para gerenciar a pecuária.</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Beef className="h-6 w-6" /> Pecuária</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full">
            <TabsTrigger value="rebanho" className="whitespace-nowrap">🐄 <span className="ml-1">Rebanho</span></TabsTrigger>
            <TabsTrigger value="sanidade" className="whitespace-nowrap">💉 <span className="ml-1">Sanidade</span></TabsTrigger>
            <TabsTrigger value="leite" className="whitespace-nowrap">🥛 <span className="ml-1">Leite</span></TabsTrigger>
            <TabsTrigger value="movimentacoes" className="whitespace-nowrap">↔️ <span className="ml-1">Movimentações</span></TabsTrigger>
            <TabsTrigger value="pesagens" className="whitespace-nowrap">⚖️ <span className="ml-1">Pesagens</span></TabsTrigger>
          </TabsList>
        </div>

        {/* ========= ABA REBANHO ========= */}
        <TabsContent value="rebanho" className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {loadingRebanhos ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
              <>
                <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground leading-tight">Total de Animais</p><p className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{totalAnimais}</p></CardContent></Card>
                <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground leading-tight">Lotes Ativos</p><p className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{totalLotes}</p></CardContent></Card>
                <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground leading-tight">Valor do Rebanho</p><p className="text-lg sm:text-xl lg:text-2xl font-bold break-words">R$ {valorRebanho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground mt-1 hidden sm:block">baseado em compras e vendas registradas</p></CardContent></Card>
                <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground leading-tight">Eventos Sanitários</p><p className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{eventosProximos}<span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">próx. 30d</span></p></CardContent></Card>
                <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground leading-tight">Vendido em {new Date().getFullYear()}</p><p className="text-lg sm:text-xl lg:text-2xl font-bold break-words">R$ {(statsAno?.vendasValorAno || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground mt-1 hidden sm:block">{statsAno?.vendasQtdAno || 0} animal(is)</p></CardContent></Card>
                <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground leading-tight">Nascimentos {new Date().getFullYear()}</p><p className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{statsAno?.nascimentosAno || 0}</p></CardContent></Card>
                <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground leading-tight">Mortes {new Date().getFullYear()}</p><p className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{statsAno?.mortesAno || 0}</p></CardContent></Card>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => { if (!verificarSafra('registrar ração')) return; setRacaoDialog(true) }} disabled={isFechada} title={isFechada ? 'Safra fechada' : ''}><Wheat className="h-4 w-4 mr-1" /> Registrar Ração</Button>
            <Button className="w-full sm:w-auto" onClick={() => { if (!verificarSafra('criar lote')) return; setEditLote(null); setLoteDialog(true) }} disabled={isFechada} title={isFechada ? 'Safra fechada' : ''}><Plus className="h-4 w-4 mr-1" /> Novo Lote</Button>
          </div>


          {loadingRebanhos ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />) : !rebanhos?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Beef className="h-12 w-12 mx-auto mb-2 opacity-40" /><p>Nenhum lote cadastrado.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {rebanhos.map((r: any) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="text-lg flex items-center gap-2 cursor-pointer hover:underline"
                        onClick={() => setAnimaisRebanho(r)}
                      >
                        <span className="text-2xl">{ESPECIE_EMOJI[r.especie] || '🐾'}</span>
                        {r.nome}
                      </CardTitle>
                      <Badge variant="secondary">{ESPECIE_LABEL[r.especie] || r.especie}</Badge>
                    </div>
                    {(r.quantidade_atual === 0 || (alertasIdentificacao?.[r.id] || 0) > 0) && (
                      <div className="flex gap-2 flex-wrap mt-2">
                        {r.quantidade_atual === 0 && (
                          <span className="text-[10px] font-medium uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">
                            Lote vazio
                          </span>
                        )}
                        {(alertasIdentificacao?.[r.id] || 0) > 0 && (
                          <span className="text-[10px] font-medium uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                            {alertasIdentificacao[r.id]} sem identificação
                          </span>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Quantidade:</span> <strong>{r.quantidade_atual}</strong></div>
                      {r.raca && <div><span className="text-muted-foreground">Raça:</span> {r.raca}</div>}
                      {r.finalidade && <div><span className="text-muted-foreground">Finalidade:</span> {r.finalidade}</div>}
                      {r.localizacao && <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{r.localizacao}</div>}
                      {valoresLotes?.[r.id] && valoresLotes[r.id].valor_total > 0 && (
                        <>
                          <div><span className="text-muted-foreground">Valor do lote:</span> <strong>R$ {valoresLotes[r.id].valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                          <div><span className="text-muted-foreground">Custo médio:</span> R$ {valoresLotes[r.id].custo_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => setAnimaisRebanho(r)}>
                        <Users className="h-3 w-3 mr-1" /> Animais
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setCompraRebanho(r); setCompraDialog(true) }}>
                        <ShoppingCart className="h-3 w-3 mr-1" /> Registrar compra
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setMovRebanhoId(r.id); setMovDialog(true) }}>
                        <ArrowLeftRight className="h-3 w-3 mr-1" /> Movimentação
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditLote(r); setLoteDialog(true) }}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========= ABA SANIDADE ========= */}
        <TabsContent value="sanidade" className="space-y-4">
          <div className="flex justify-end">
            <Select onValueChange={(id) => {
              const r = rebanhos?.find((r: any) => r.id === id)
              if (r) setStatusVacinacaoRebanho({ id: r.id, nome: r.nome })
            }}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Ver status por rebanho..." />
              </SelectTrigger>
              <SelectContent>
                {(rebanhos || []).filter((r: any) => r.controle_individual !== false).map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Select value={filtroSanTipo} onValueChange={setFiltroSanTipo}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="vacina">Vacina</SelectItem>
                  <SelectItem value="vermifugacao">Vermifugação</SelectItem>
                  <SelectItem value="medicamento">Medicamento</SelectItem>
                  <SelectItem value="exame">Exame</SelectItem>
                  <SelectItem value="cirurgia">Cirurgia</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroSanRebanho} onValueChange={setFiltroSanRebanho}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Rebanho" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(rebanhos || []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { if (!verificarSafra('registrar evento sanitário')) return; setSanitarioDialog(true) }} disabled={isFechada} title={isFechada ? 'Safra fechada' : ''}><Plus className="h-4 w-4 mr-1" /> Registrar Evento</Button>
          </div>

          {loadingSan ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />) : !eventosFiltrados.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Syringe className="h-12 w-12 mx-auto mb-2 opacity-40" /><p>Nenhum evento sanitário registrado.</p></CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {eventosFiltrados.map((e: any) => {
                const isProximo = e.data_proxima && new Date(e.data_proxima) <= addDays(new Date(), 30)
                const tipoIcon = e.tipo === 'vacina' ? '💉' : e.tipo === 'exame' ? '🔬' : '💊'
                const animaisDoEvento = (contagemAnimais || []).filter((c: any) => c.evento_id === e.id && c.aplicado)
                const vacinados = animaisDoEvento.length
                const nomesAnimais = animaisDoEvento.map((c: any) => {
                  const a = c.animal
                  if (!a) return null
                  const nome = a.nome || a.identificador || a.numero_brinco || '?'
                  const simbolo = a.sexo === 'macho' ? ' ♂' : a.sexo === 'femea' ? ' ♀' : ''
                  return `${nome}${simbolo}`
                }).filter(Boolean)
                return (
                  <Card key={e.id} className={isProximo ? 'border-destructive/50' : ''}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{tipoIcon}</span>
                            <span className="font-medium capitalize">{e.tipo}</span>
                            {isProximo && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Próximo</Badge>}
                          </div>
                          <p className="text-sm">{e.descricao}</p>
                          <div className="text-xs text-muted-foreground flex gap-3 flex-wrap items-center">
                            <span>Aplicação: {format(new Date(e.data_aplicacao), 'dd/MM/yyyy')}</span>
                            {vacinados > 0 && (
                              nomesAnimais.length > 0 && nomesAnimais.length <= 4 ? (
                                nomesAnimais.map((n: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">{n}</Badge>
                                ))
                              ) : (
                                <Badge variant="outline" className="text-xs" title={nomesAnimais.join(', ')}>
                                  {vacinados} animal(is)
                                </Badge>
                              )
                            )}
                            {e.data_proxima && <span>Próxima: {format(new Date(e.data_proxima), 'dd/MM/yyyy')}</span>}
                            {e.rebanho && <span>Rebanho: {(e.rebanho as any).nome}</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="icon" className="text-destructive shrink-0"
                          title="Excluir evento"
                          onClick={() => setDeleteSanId(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ========= ABA LEITE ========= */}
        <TabsContent value="leite" className="space-y-4">
          {!rebanhosLeite.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Milk className="h-12 w-12 mx-auto mb-2 opacity-40" /><p>Nenhum rebanho leiteiro cadastrado.</p><p className="text-xs mt-1">Cadastre um lote com espécie "Bovino Leite" para habilitar esta aba.</p></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Litros no Mês</p><p className="text-2xl font-bold">{mesAtual.totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Média Diária</p><p className="text-2xl font-bold">{mesAtual.mediaDiaria.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Receita do Mês</p><p className="text-2xl font-bold">R$ {mesAtual.receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Rebanhos Leite</p><p className="text-2xl font-bold">{rebanhosLeite.length}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Produção Diária (30 dias)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="litros" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMesOrdenha(m => addMonths(m, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium capitalize min-w-[130px] text-center">
                    {format(mesOrdenha, 'MMMM/yyyy', { locale: ptBR })}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMesOrdenha(m => addMonths(m, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={() => { if (!verificarSafra('registrar ordenha')) return; setOrdenhaDialog(true) }} disabled={isFechada} title={isFechada ? 'Safra fechada' : ''}><Plus className="h-4 w-4 mr-1" /> Registrar Ordenha</Button>
              </div>

              <RankingLeiteCard propriedadeId={propId} />

              {loadingOrdenha ? <Skeleton className="h-48" /> : !ordenhasDoMes.length ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma ordenha neste mês.</CardContent></Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Turno</TableHead>
                        <TableHead>Litros</TableHead>
                        <TableHead className="hidden sm:table-cell">Descartado</TableHead>
                        <TableHead>Vacas</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordenhasDoMes.map((o: any) => (
                        <TableRow key={o.id}>
                          <TableCell>{format(new Date(o.data + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="capitalize">{o.turno}</TableCell>
                          <TableCell>{Number(o.litros).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</TableCell>
                          <TableCell className="hidden sm:table-cell">{Number(o.litros_descartados) > 0 ? `${Number(o.litros_descartados).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L` : '-'}</TableCell>
                          <TableCell>{o.vacas_ordenhadas || '-'}</TableCell>
                          <TableCell className="capitalize">{o.destino?.replace('_', ' ') || '-'}</TableCell>
                          <TableCell className="text-right">{o.valor_total ? `R$ ${Number(o.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" title="Editar" onClick={() => { setOrdenhaEditando(o); setOrdenhaDialog(true) }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Excluir" className="text-destructive" onClick={() => setDeleteOrdenhaId(o.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ========= ABA MOVIMENTAÇÕES ========= */}
        <TabsContent value="movimentacoes" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { if (!verificarSafra('registrar movimentação')) return; setMovRebanhoId(undefined); setMovDialog(true) }} disabled={isFechada} title={isFechada ? 'Safra fechada' : ''}><Plus className="h-4 w-4 mr-1" /> Nova Movimentação</Button>
          </div>

          {loadingMov ? <Skeleton className="h-48" /> : !movimentacoes?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><ArrowLeftRight className="h-12 w-12 mx-auto mb-2 opacity-40" /><p>Nenhuma movimentação registrada.</p></CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden sm:table-cell">Rebanho</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="hidden md:table-cell">Obs</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((m: any) => (
                    <TableRow key={m.id} id={`mov-${m.id}`} className="transition-colors">
                      <TableCell>{format(new Date(m.data_evento), 'dd/MM/yyyy')}</TableCell>
                      <TableCell><Badge className={MOV_BADGE[m.tipo] || 'bg-muted text-foreground'} variant="secondary">{m.tipo?.replace('_', ' ')}</Badge></TableCell>
                      <TableCell className="hidden sm:table-cell">{(m.rebanho as any)?.nome || '-'}</TableCell>
                      <TableCell>{m.quantidade}</TableCell>
                      <TableCell className="text-right">{m.valor_total ? `R$ ${Number(m.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[150px] truncate">{m.observacoes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => { setEditMov(m); setEditMovDialog(true) }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Excluir" className="text-destructive" onClick={() => setDeleteMovId(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ========= ABA PESAGENS ========= */}
        <TabsContent value="pesagens" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { if (!verificarSafra('registrar pesagem')) return; setPesagemDialog(true) }} disabled={isFechada} title={isFechada ? 'Safra fechada' : ''}><Scale className="h-4 w-4 mr-1" /> Registrar Pesagem</Button>
          </div>

          <RankingPesoCard propriedadeId={propId} />

          {loadingPesagens ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : !pesagens?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <span className="text-4xl block mb-2">⚖️</span>
                <p>Nenhuma pesagem registrada.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Rebanho</TableHead>
                    <TableHead>Peso (kg)</TableHead>
                    <TableHead className="hidden sm:table-cell">Peso Anterior (kg)</TableHead>
                    <TableHead>GMD (kg/dia)</TableHead>
                    <TableHead className="hidden md:table-cell">Responsável</TableHead>
                    <TableHead>Obs</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pesagens.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {format(new Date(p.data_pesagem + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{p.rebanho?.nome || '—'}</TableCell>
                      <TableCell>
                        {Number(p.peso_kg).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {p.peso_anterior_kg
                          ? Number(p.peso_anterior_kg).toLocaleString('pt-BR', { minimumFractionDigits: 1 })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {p.gmd_kg
                          ? <Badge variant="secondary" className="bg-green-100 text-green-800">+{Number(p.gmd_kg).toFixed(3)}</Badge>
                          : '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{p.responsavel || '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{p.observacoes || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => { setPesagemEditando(p); setPesagemDialog(true) }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Excluir" className="text-destructive" onClick={() => setDeletePesagemId(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <LoteDialog open={loteDialog} onOpenChange={setLoteDialog} propriedadeId={propId} lote={editLote} />
      <MovimentacaoDialog open={movDialog} onOpenChange={setMovDialog} propriedadeId={propId} rebanhos={rebanhos || []} rebanhoIdInicial={movRebanhoId} />
      <CompraAnimaisDialog
        open={editMovDialog}
        onOpenChange={o => { setEditMovDialog(o); if (!o) setEditMov(null) }}
        propriedadeId={propId}
        rebanho={null}
        movimentacao={editMov}
      />
      <CompraAnimaisDialog open={compraDialog} onOpenChange={setCompraDialog} propriedadeId={propId} rebanho={compraRebanho} />
      <StatusVacinacaoModal
        open={!!statusVacinacaoRebanho}
        onOpenChange={(o) => { if (!o) setStatusVacinacaoRebanho(null) }}
        rebanho={statusVacinacaoRebanho}
      />

      <EventoSanitarioDialog open={sanitarioDialog} onOpenChange={setSanitarioDialog} propriedadeId={propId} rebanhos={rebanhos || []} />
      <OrdenhaDialog
        open={ordenhaDialog}
        onOpenChange={o => { setOrdenhaDialog(o); if (!o) setOrdenhaEditando(null) }}
        propriedadeId={propId}
        rebanhosLeite={rebanhosLeite}
        ordenhaEditando={ordenhaEditando}
      />
      <RacaoDialog open={racaoDialog} onOpenChange={setRacaoDialog} propriedadeId={propId || ''} safraId={safraSelecionada?.id || ''} rebanhos={rebanhos || []} />
      <PesagemDialog
        open={pesagemDialog}
        onOpenChange={o => { setPesagemDialog(o); if (!o) setPesagemEditando(null) }}
        propriedadeId={propId || ''}
        rebanhos={rebanhos || []}
        pesagemEditando={pesagemEditando}
      />
      {animaisRebanho && (
        <AnimaisRebanhoDialog
          open={!!animaisRebanho}
          onOpenChange={o => { if (!o) setAnimaisRebanho(null) }}
          propriedadeId={propId}
          rebanho={animaisRebanho}
          rebanhos={rebanhos || []}
        />
      )}

      <AlertDialog open={!!deleteMovId} onOpenChange={o => { if (!o) setDeleteMovId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
            <AlertDialogDescription>
              A movimentação será removida e a despesa/receita correspondente será excluída do Financeiro. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirMovimentacao} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote?</AlertDialogTitle>
            <AlertDialogDescription>O lote será desativado e não aparecerá mais na listagem.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteOrdenhaId} onOpenChange={() => setDeleteOrdenhaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordenha?</AlertDialogTitle>
            <AlertDialogDescription>
              O leite que entrou no estoque a partir dessa ordenha será removido. Se parte já foi vendida, só o que ainda estiver disponível é ajustado. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirOrdenha} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePesagemId} onOpenChange={() => setDeletePesagemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pesagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Se outra pesagem mais recente usou esta como "peso anterior" pro cálculo de GMD, esse valor não será recalculado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirPesagem} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSanId} onOpenChange={() => setDeleteSanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento sanitário?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento correspondente no Financeiro/Lançamentos será removido, e se o produto veio do estoque, a quantidade usada será devolvida. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirSanitario} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
