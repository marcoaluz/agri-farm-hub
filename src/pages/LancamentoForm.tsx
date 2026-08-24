import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useTalhoes } from '@/hooks/useTalhoes'
import { ItemLancamentoCard, type ItemLancamento } from '@/components/lancamentos/ItemLancamentoCard'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Anexos } from '@/components/Anexos'

import { 
  ArrowLeft, 
  Loader2, 
  Package, 
  AlertCircle, 
  Check,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Calendar,
  MapPin,
  Users,
  Wrench,
  Truck,
  AlertTriangle,
  Fuel,
  Cog,
  Tractor
} from 'lucide-react'
import { PrateleiraIcon } from '@/components/icons/PrateleiraIcon'

// Interfaces
interface LancamentoFormData {
  servico_id: string
  talhao_id?: string
  data_execucao: string
  observacoes?: string
  itens: ItemLancamento[]
}

interface ServicoComTipo {
  id: string
  nome: string
  categoria?: string
  tipo_servico?: 'simples' | 'composto'
  custo_padrao?: number
  unidade_medida?: string
  requer_talhao: boolean
  ativo: boolean
}

export function LancamentoForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: lancamentoId } = useParams<{ id: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { propriedadeAtual, safraAtual } = useGlobal()
  const fromEstoque = location.state?.fromEstoque === true

  // Estado do formulário
  const [formData, setFormData] = useState<LancamentoFormData>({
    servico_id: '',
    data_execucao: (() => {
      const hoje = new Date()
      return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    })(),
    itens: []
  })
  const [dadosOriginais, setDadosOriginais] = useState<LancamentoFormData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingItens, setLoadingItens] = useState(false)
  const [validandoEstoque, setValidandoEstoque] = useState(false)
  const [adicionandoTipo, setAdicionandoTipo] = useState<'produto' | 'maquina' | 'servico_simples' | 'abastecimento' | 'manutencao' | 'reposicao' | null>(null)
  const [reposicaoMaquinaId, setReposicaoMaquinaId] = useState<string | null>(null)
  const [custoAltoDialog, setCustoAltoDialog] = useState<{
    open: boolean
    valor: string
    resolve: ((value: boolean) => void) | null
  }>({ open: false, valor: '', resolve: null })

  // Hooks de dados
  const { data: servicos, isLoading: loadingServicos } = useQuery({
    queryKey: ['servicos', propriedadeAtual?.id],
    queryFn: async () => {
      if (!propriedadeAtual?.id) return []
      // RPC inclui serviços compartilhados (globais) de outras propriedades
      const { data, error } = await supabase.rpc('listar_servicos_usuario', {
        p_propriedade_id: propriedadeAtual.id,
      })
      if (error) throw error
      return ((data as any[]) || [])
        .filter(s => s.ativo !== false && !s.tem_valor_proprio)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '')) as ServicoComTipo[]
    },
    enabled: !!propriedadeAtual?.id
  })
  const { data: talhoes, isLoading: loadingTalhoes } = useTalhoes(propriedadeAtual?.id)

  // Dados para adição manual de itens
  const { data: produtos } = useQuery({
    queryKey: ['produtos-lancamento', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_produtos_usuario', {
        p_propriedade_id: propriedadeAtual!.id,
      })
      if (error) throw error
      return ((data as any[]) || [])
        .filter(p => p.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    },
    enabled: !!propriedadeAtual?.id
  })

  const { data: maquinas } = useQuery({
    queryKey: ['maquinas-lancamento', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_maquinas_usuario' as any, {
        p_propriedade_id: propriedadeAtual!.id,
      })
      if (error) throw error
      const lista = ((data as any[]) || [])
        .filter(m => m.ativo !== false)
        .map(m => ({
          id: m.id || m.maquina_id,
          nome: m.nome,
          custo_hora: m.custo_hora ?? null,
          horimetro_atual: m.horimetro_atual ?? 0,
          unidade_calculo: m.unidade_calculo ?? 'h',
          km_atual: m.km_atual ?? 0,
          custo_km: m.custo_km ?? null,
        }))

      // A RPC pode não retornar as colunas novas — enriquece direto da tabela.
      const ids = lista.map(m => m.id).filter(Boolean)
      if (ids.length) {
        const { data: extras } = await supabase
          .from('maquinas' as any)
          .select('id, unidade_calculo, km_atual, custo_km')
          .in('id', ids)
        if (extras) {
          const byId = new Map((extras as any[]).map(e => [e.id, e]))
          lista.forEach(m => {
            const e = byId.get(m.id)
            if (e) {
              m.unidade_calculo = e.unidade_calculo ?? m.unidade_calculo
              m.km_atual = e.km_atual ?? m.km_atual
              m.custo_km = e.custo_km ?? m.custo_km
            }
          })
        }
      }

      return lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))

    },
    enabled: !!propriedadeAtual?.id
  })

  const { data: categoriasManutencao } = useQuery({
    queryKey: ['categorias-manutencao'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_categorias_manutencao')
      if (error) throw error
      return (data as { id: string; nome: string }[]) || []
    },
  })

  const { data: descricoesManutencao } = useQuery({
    queryKey: ['descricoes-manutencao'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_descricoes_manutencao')
      if (error) throw error
      return (data as { id: string; nome: string }[]) || []
    },
  })

  const { data: tiposCombustivel } = useQuery({
    queryKey: ['tipos-combustivel'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_tipos_combustivel')
      if (error) throw error
      return (data as { id: string; nome: string }[]) || []
    },
  })

  const { data: servicosSimples } = useQuery({
    queryKey: ['servicos-simples-lancamento', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_servicos_usuario', {
        p_propriedade_id: propriedadeAtual!.id,
      })
      if (error) throw error
      return ((data as any[]) || [])
        .filter(s => s.ativo !== false && s.tem_valor_proprio)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    },
    enabled: !!propriedadeAtual?.id
  })

  // Obter área do talhão selecionado
  const talhaoSelecionado = talhoes?.find(t => t.id === formData.talhao_id)
  const areaHa = talhaoSelecionado?.area_ha
  
  // Obter serviço selecionado
  const servicoSelecionado = servicos?.find(s => s.id === formData.servico_id)

  // Carregar lançamento existente para edição
  useEffect(() => {
    if (lancamentoId) {
      carregarLancamento(lancamentoId)
    }
  }, [lancamentoId])

  const carregarLancamento = async (id: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          *,
          lancamentos_itens(
            *,
            produto:produtos(id, nome, unidade_medida, saldo_atual),
            maquina:maquinas(id, nome, custo_hora, horimetro_atual),
            servico_ref:servicos(id, nome, custo_padrao, unidade_medida)
          )
        `)
        .eq('id', id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        const loaded: LancamentoFormData = {
          servico_id: data.servico_id,
          talhao_id: data.talhao_id || undefined,
          data_execucao: data.data_execucao,
          observacoes: data.observacoes || '',
          itens: data.lancamentos_itens?.map((li: any) => ({
            tipo_ref: li.tipo_ref,
            produto_id: li.produto_id || null,
            maquina_id: li.maquina_id || null,
            servico_ref_id: li.servico_ref_id || null,
            nome: li.produto?.nome || li.maquina?.nome || (li.tipo_ref === 'abastecimento' ? `Abastecimento — ${li.maquina?.nome || ''}` : li.servico_ref?.nome) || '',
            unidade: li.produto?.unidade_medida || li.servico_ref?.unidade_medida || 'hora',
            custo_unitario_ref: li.maquina?.custo_hora || li.servico_ref?.custo_padrao || undefined,
            quantidade: li.quantidade,
            custo_unitario: li.custo_unitario,
            custo_total: li.custo_total,
            detalhamento_lotes: li.detalhamento_lotes,
            origem_estoque: li.tipo_ref === 'abastecimento' ? !!li.produto_id : undefined,
            litros: li.litros ?? undefined,
            combustivel_tipo: li.combustivel_tipo || '',
            horimetro_informado: li.horimetro_informado ?? undefined,
            momento_abastecimento: li.momento_abastecimento || null,
            observacao: li.observacao || '',
            categoria_manutencao: li.categoria_manutencao || '',
            descricao: li.descricao || '',
            oficina: li.oficina || '',
            proximo_horimetro: li.proximo_horimetro ?? undefined,
            momento_manutencao: li.momento_manutencao || null,
          })) || []
        }
        setFormData(loaded)
        setDadosOriginais(structuredClone(loaded))
      }
    } catch (error) {
      console.error('Erro ao carregar lançamento:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o lançamento.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Carregar itens do serviço selecionado (nova estrutura)
  const carregarItensServico = useCallback(async (servicoId: string) => {
    if (!servicoId) {
      setFormData(prev => ({ ...prev, itens: [] }))
      return
    }

    const servico = servicos?.find(s => s.id === servicoId)

    // Serviço Simples: o próprio serviço é o item
    if (servico?.tipo_servico === 'simples') {
      const itemSimples: ItemLancamento = {
        tipo_ref: 'servico_simples',
        servico_ref_id: servico.id,
        nome: servico.nome,
        unidade: servico.unidade_medida || 'servico',
        custo_unitario_ref: servico.custo_padrao || 0,
        quantidade: 1,
        obrigatorio: true,
      }
      setFormData(prev => ({
        ...prev,
        servico_id: servicoId,
        itens: [itemSimples]
      }))
      return
    }

    // Serviço Composto: carregar itens vinculados direto de servicos_itens
    setLoadingItens(true)
    try {
      const { data, error } = await supabase
        .from('servicos_itens')
        .select(`
          id,
          tipo_item,
          tipo_ref,
          obrigatorio,
          quantidade_sugerida,
          ordem,
          produto:produtos (
            id, nome, unidade_medida, saldo_atual
          ),
          maquina:maquinas (
            id, nome, custo_hora, horimetro_atual
          )
        `)
        .eq('servico_id', servicoId)
        .order('ordem')

      if (error) throw error

      const itensFormatados: ItemLancamento[] = ((data as any[]) || []).map((si: any) => {
        if (si.tipo_ref === 'produto' || (!si.tipo_ref && si.produto?.id)) {
          return {
            tipo_ref: 'produto',
            produto_id: si.produto?.id || null,
            maquina_id: null,
            nome: si.produto?.nome || '',
            unidade: si.produto?.unidade_medida || 'kg',
            custo_unitario_ref: 0, // calculado por FIFO
            quantidade: si.quantidade_sugerida || 0,
            obrigatorio: si.obrigatorio,
            estoque_disponivel: si.produto?.saldo_atual || 0,
          } as ItemLancamento
        }
        if (si.tipo_ref === 'maquina' || (!si.tipo_ref && si.maquina?.id)) {
          return {
            tipo_ref: 'maquina',
            produto_id: null,
            maquina_id: si.maquina?.id || null,
            nome: si.maquina?.nome || '',
            unidade: 'hora',
            custo_unitario_ref: si.maquina?.custo_hora || 0,
            quantidade: si.quantidade_sugerida || 0,
            obrigatorio: si.obrigatorio,
            estoque_disponivel: null,
          } as ItemLancamento
        }
        return null
      }).filter(Boolean) as ItemLancamento[]

      setFormData(prev => ({
        ...prev,
        servico_id: servicoId,
        itens: itensFormatados
      }))
    } catch (error: any) {
      console.error('Erro ao carregar itens do serviço:', JSON.stringify(error))
      toast({
        title: 'Erro ao carregar itens',
        description: error?.message || 'Erro desconhecido. Ver console.',
        variant: 'destructive'
      })
    } finally {
      setLoadingItens(false)
    }
  }, [toast, servicos])

  // Handler para mudança de serviço
  const handleServicoChange = (value: string) => {
    setFormData(prev => ({ ...prev, servico_id: value, itens: [] }))
    carregarItensServico(value)
  }

  // Handler para mudança de talhão
  const handleTalhaoChange = (value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      talhao_id: value === 'none' ? undefined : value 
    }))
  }

  // Adicionar item manualmente
  const adicionarProduto = (produtoId: string) => {
    const produto = produtos?.find(p => p.id === produtoId)
    if (!produto) return
    // Evitar duplicatas
    if (formData.itens.some(i => i.produto_id === produtoId)) {
      toast({ title: 'Produto já adicionado', variant: 'destructive' })
      return
    }
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, {
        tipo_ref: 'produto',
        produto_id: produto.id,
        nome: produto.nome,
        unidade: produto.unidade_medida || 'unidade',
        quantidade: 0,
        estoque_disponivel: produto.saldo_atual,
      }]
    }))
    setAdicionandoTipo(null)
  }

  const adicionarMaquina = (maquinaId: string) => {
    const maquina = maquinas?.find(m => m.id === maquinaId)
    if (!maquina) return
    if (formData.itens.some(i => i.tipo_ref === 'maquina' && i.maquina_id === maquinaId)) {
      toast({ title: 'Máquina já adicionada', variant: 'destructive' })
      return
    }
    const ehKm = (maquina as any).unidade_calculo === 'km'
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, {
        tipo_ref: 'maquina',
        maquina_id: maquina.id,
        nome: maquina.nome,
        unidade: ehKm ? 'km' : 'hora',
        custo_unitario_ref: (ehKm ? (maquina as any).custo_km : maquina.custo_hora) || 0,
        quantidade: 0,
      }]
    }))
    setAdicionandoTipo(null)
  }

  const adicionarAbastecimento = (maquinaId: string) => {
    const maquina = maquinas?.find(m => m.id === maquinaId)
    if (!maquina) return
    if (formData.itens.some(i => i.tipo_ref === 'abastecimento' && i.maquina_id === maquinaId)) {
      toast({ title: 'Já existe abastecimento para essa máquina neste lançamento', variant: 'destructive' })
      return
    }
    const temHorasNoMesmoLancamento = formData.itens.some(i => i.tipo_ref === 'maquina' && i.maquina_id === maquinaId)
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, {
        tipo_ref: 'abastecimento',
        maquina_id: maquina.id,
        nome: `Abastecimento — ${maquina.nome}`,
        origem_estoque: true,
        produto_id: null,
        litros: 0,
        combustivel_tipo: '',
        custo_total: 0,
        horimetro_informado: maquina.horimetro_atual || 0,
        momento_abastecimento: temHorasNoMesmoLancamento ? 'antes' : null,
        observacao: '',
        quantidade: 1,
      }]
    }))
    setAdicionandoTipo(null)
  }

  const adicionarManutencao = (maquinaId: string) => {
    const maquina = maquinas?.find(m => m.id === maquinaId)
    if (!maquina) return
    if (formData.itens.some(i => i.tipo_ref === 'manutencao' && i.maquina_id === maquinaId)) {
      toast({ title: 'Já existe manutenção para essa máquina neste lançamento', variant: 'destructive' })
      return
    }
    const temHorasNoMesmoLancamento = formData.itens.some(i => i.tipo_ref === 'maquina' && i.maquina_id === maquinaId)
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, {
        tipo_ref: 'manutencao',
        maquina_id: maquina.id,
        nome: `Manutenção — ${maquina.nome}`,
        categoria_manutencao: '',
        descricao: '',
        oficina: '',
        custo_total: 0,
        custo_unitario: 0,
        horimetro_informado: maquina.horimetro_atual || 0,
        momento_manutencao: temHorasNoMesmoLancamento ? 'antes' : null,
        proximo_horimetro: undefined,
        observacao: '',
        quantidade: 1,
      }]
    }))
    setAdicionandoTipo(null)
  }



  const adicionarReposicao = (produtoId: string) => {
    if (!reposicaoMaquinaId) return
    const produto = produtos?.find(p => p.id === produtoId)
    const maquina = maquinas?.find(m => m.id === reposicaoMaquinaId)
    if (!produto || !maquina) return
    if (formData.itens.some(i => i.tipo_ref === 'produto' && i.produto_id === produtoId && i.maquina_id === reposicaoMaquinaId)) {
      toast({ title: 'Essa peça já foi adicionada para essa máquina', variant: 'destructive' })
      return
    }
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, {
        tipo_ref: 'produto',
        produto_id: produto.id,
        maquina_id: maquina.id,
        nome: produto.nome,
        unidade: produto.unidade_medida || 'unidade',
        quantidade: 0,
        estoque_disponivel: produto.saldo_atual,
      }]
    }))
    // Não fecha o seletor nem reseta a máquina — permite adicionar mais peças pra mesma máquina
  }

  const adicionarServicoSimples = (servicoRefId: string) => {
    const svc = servicosSimples?.find(s => s.id === servicoRefId)
    if (!svc) return
    if (formData.itens.some(i => i.servico_ref_id === servicoRefId)) {
      toast({ title: 'Serviço já adicionado', variant: 'destructive' })
      return
    }
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, {
        tipo_ref: 'servico_simples',
        servico_ref_id: svc.id,
        nome: svc.nome,
        unidade: svc.unidade_medida || 'servico',
        custo_unitario_ref: svc.custo_padrao || 0,
        quantidade: 0,
      }]
    }))
    setAdicionandoTipo(null)
  }

  // Calcular resumo financeiro em tempo real
  const resumoFinanceiro = useMemo(() => {
    const itensValidos = formData.itens.filter(i => i.quantidade && i.quantidade > 0)

    const nomeMaquina = (maquinaId?: string | null) =>
      (maquinas as any[] | undefined)?.find(m => m.id === maquinaId)?.nome || 'Máquina'

    const agruparPorMaquina = (itens: any[]) => {
      const mapa = new Map()
      itens.forEach(i => {
        const nome = nomeMaquina(i.maquina_id)
        mapa.set(nome, (mapa.get(nome) || 0) + (i.custo_total || 0))
      })
      return Array.from(mapa.entries()).map(([nome, valor]) => ({ nome, valor }))
    }

    // Produto de estoque comum (não vinculado a máquina) — Troca/Reposição tem linha própria
    const totalProdutos = itensValidos
      .filter(i => i.tipo_ref === 'produto' && !i.maquina_id)
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)

    const itensReposicao = itensValidos.filter(i => i.tipo_ref === 'produto' && !!i.maquina_id)
    const totalReposicao = itensReposicao.reduce((sum, i) => sum + (i.custo_total || 0), 0)
    const reposicaoPorMaquina = agruparPorMaquina(itensReposicao)

    const totalServicos = itensValidos
      .filter(i => i.tipo_ref === 'servico_simples')
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)

    const totalMaquinas = itensValidos
      .filter(i => i.tipo_ref === 'maquina')
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)

    const itensAbastecimento = itensValidos.filter(i => i.tipo_ref === 'abastecimento')
    const totalAbastecimento = itensAbastecimento.reduce((sum, i) => sum + (i.custo_total || 0), 0)
    const abastecimentoPorMaquina = agruparPorMaquina(itensAbastecimento)

    const totalManutencao = itensValidos
      .filter(i => i.tipo_ref === 'manutencao')
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)

    const custoTotal = totalProdutos + totalReposicao + totalServicos + totalMaquinas + totalAbastecimento + totalManutencao
    const custoPorHa = areaHa && areaHa > 0 ? custoTotal / areaHa : null

    const temEstoqueInsuficiente = itensValidos.some(
      i => i.tipo_ref === 'produto' &&
           i.quantidade > 0 &&
           (i.detalhamento_lotes === null ||
            (Array.isArray(i.detalhamento_lotes) && i.detalhamento_lotes.length === 0))
    ) || itensValidos.some(i => {
      if (i.tipo_ref !== 'abastecimento' || !i.origem_estoque || !i.produto_id) return false
      const produtoSel = (produtos as any[] | undefined)?.find(p => p.id === i.produto_id)
      if (!produtoSel) return false
      return Number(i.litros || 0) > Number(produtoSel.saldo_atual || 0)
    })

    return {
      totalItens: itensValidos.length,
      custoTotal,
      custoPorHa,
      totalProdutos,
      totalReposicao,
      reposicaoPorMaquina,
      totalServicos,
      totalMaquinas,
      totalAbastecimento,
      abastecimentoPorMaquina,
      totalManutencao,
      temEstoqueInsuficiente
    }
  }, [formData.itens, areaHa, produtos, maquinas])

  // Detectar se houve mudança real (para modo edição)
  const temAlteracaoReal = useMemo(() => {
    if (!dadosOriginais || !lancamentoId) return true

    if (formData.data_execucao !== dadosOriginais.data_execucao) return true
    if (formData.servico_id !== dadosOriginais.servico_id) return true
    if (formData.talhao_id !== dadosOriginais.talhao_id) return true
    if (formData.observacoes !== dadosOriginais.observacoes) return true

    if (formData.itens.length !== dadosOriginais.itens.length) return true
    for (let i = 0; i < formData.itens.length; i++) {
      const atual = formData.itens[i]
      const original = dadosOriginais.itens[i]
      if (!original) return true
      if (atual.produto_id !== original.produto_id) return true
      if (atual.maquina_id !== original.maquina_id) return true
      if (atual.servico_ref_id !== original.servico_ref_id) return true
      if (Number(atual.quantidade) !== Number(original.quantidade)) return true
      if (atual.custo_personalizado !== original.custo_personalizado) return true
      if (atual.custo_unitario_override !== original.custo_unitario_override) return true
      if (Number(atual.custo_total || 0) !== Number(original.custo_total || 0)) return true
      if ((atual.origem_estoque || false) !== (original.origem_estoque || false)) return true
      if ((atual.litros ?? null) !== (original.litros ?? null)) return true
      if ((atual.combustivel_tipo || '') !== (original.combustivel_tipo || '')) return true
      if ((atual.horimetro_informado ?? null) !== (original.horimetro_informado ?? null)) return true
      if ((atual.proximo_horimetro ?? null) !== (original.proximo_horimetro ?? null)) return true
      if ((atual.momento_abastecimento || null) !== (original.momento_abastecimento || null)) return true
      if ((atual.momento_manutencao || null) !== (original.momento_manutencao || null)) return true
      if ((atual.categoria_manutencao || '') !== (original.categoria_manutencao || '')) return true
      if ((atual.descricao || '') !== (original.descricao || '')) return true
      if ((atual.oficina || '') !== (original.oficina || '')) return true
      if ((atual.observacao || '') !== (original.observacao || '')) return true
    }

    return false
  }, [formData, dadosOriginais, lancamentoId])

  // Mutation para salvar lançamento
  const salvarMutation = useMutation({
    mutationFn: async (data: LancamentoFormData) => {
      if (!propriedadeAtual || !safraAtual) {
        throw new Error('Selecione propriedade e safra')
      }

      setValidandoEstoque(true)

      // ETAPA 1: CALCULAR CUSTOS FINAIS
      const itensComCusto: ItemLancamento[] = []
      let custoTotal = 0

      for (const itemForm of data.itens) {
        if (!itemForm.quantidade || itemForm.quantidade <= 0) continue

        if (itemForm.tipo_ref === 'produto' && itemForm.produto_id) {
          // FIFO: buscar lotes
          const { data: lotes } = await supabase
            .from('lotes')
            .select('id, nota_fiscal, quantidade_disponivel, custo_unitario, data_entrada')
            .eq('produto_id', itemForm.produto_id)
            .gt('quantidade_disponivel', 0)
            .order('data_entrada', { ascending: true })

          let qtdRestante = itemForm.quantidade
          let custoItem = 0
          const previewConsumo: any[] = []
          let estoqueTotal = 0

          for (const lote of lotes || []) {
            estoqueTotal += lote.quantidade_disponivel
            if (qtdRestante <= 0) continue
            const consumida = Math.min(qtdRestante, lote.quantidade_disponivel)
            const parcial = consumida * lote.custo_unitario
            previewConsumo.push({
              lote_id: lote.id,
              quantidade_consumida: consumida,
              custo_unitario: lote.custo_unitario,
              custo_parcial: parcial,
            })
            custoItem += parcial
            qtdRestante -= consumida
          }

          if (qtdRestante > 0) {
            throw new Error(`Estoque insuficiente de "${itemForm.nome}". Faltam ${qtdRestante.toFixed(2)} ${itemForm.unidade}`)
          }

          itensComCusto.push({
            ...itemForm,
            custo_unitario: itemForm.quantidade > 0 ? custoItem / itemForm.quantidade : 0,
            custo_total: custoItem,
            detalhamento_lotes: previewConsumo,
          })
          custoTotal += custoItem

        } else if (itemForm.tipo_ref === 'maquina' && itemForm.maquina_id) {
          const custoUnitario = itemForm.custo_unitario_override ?? itemForm.custo_unitario_ref ?? itemForm.custo_unitario ?? 0
          const custoItem = custoUnitario * itemForm.quantidade
          itensComCusto.push({
            ...itemForm,
            custo_unitario: custoUnitario,
            custo_total: custoItem,
          })
          custoTotal += custoItem

        } else if (itemForm.tipo_ref === 'servico_simples' && itemForm.servico_ref_id) {
          const custoUnitario = itemForm.custo_unitario_override ?? itemForm.custo_unitario_ref ?? itemForm.custo_unitario ?? 0
          const custoItem = custoUnitario * itemForm.quantidade
          itensComCusto.push({
            ...itemForm,
            custo_unitario: custoUnitario,
            custo_total: custoItem,
          })
          custoTotal += custoItem

        } else if (itemForm.tipo_ref === 'abastecimento' && itemForm.maquina_id) {
          const custoItem = itemForm.custo_total || 0
          itensComCusto.push({
            ...itemForm,
            custo_unitario: 0,
            custo_total: custoItem,
          })
          custoTotal += custoItem

        } else if (itemForm.tipo_ref === 'manutencao' && itemForm.maquina_id) {
          const custoItem = itemForm.custo_total || 0
          itensComCusto.push({
            ...itemForm,
            custo_unitario: 0,
            custo_total: custoItem,
          })
          custoTotal += custoItem
        }
      }

      setValidandoEstoque(false)

      // Confirmação para custos altos
      if (custoTotal > 10000) {
        const confirmar = await new Promise<boolean>((resolve) => {
          setCustoAltoDialog({ open: true, valor: custoTotal.toFixed(2), resolve })
        })
        setCustoAltoDialog({ open: false, valor: '', resolve: null })
        if (!confirmar) throw new Error('Operação cancelada pelo usuário')
      }

      if (lancamentoId) {
        // ========== MODO EDIÇÃO ==========
        const userId = (await supabase.auth.getUser()).data.user?.id

        // PASSO 1: Buscar itens antigos para reverter
        const { data: itensAntigos } = await supabase
          .from('lancamentos_itens')
          .select('*, produto:produtos(id), maquina:maquinas(id, horimetro_atual)')
          .eq('lancamento_id', lancamentoId)

        // PASSO 2: Reverter lotes e horímetro
        if (itensAntigos) {
          for (const ia of itensAntigos) {
            // Reverter FIFO
            if (ia.tipo_ref === 'produto' && ia.detalhamento_lotes && Array.isArray(ia.detalhamento_lotes)) {
              for (const lc of ia.detalhamento_lotes) {
                const { data: loteAtual } = await supabase
                  .from('lotes')
                  .select('quantidade_disponivel')
                  .eq('id', lc.lote_id)
                  .single()
                if (loteAtual) {
                  await supabase.from('lotes').update({
                    quantidade_disponivel: loteAtual.quantidade_disponivel + (lc.quantidade_consumida || 0)
                  }).eq('id', lc.lote_id)
                }
              }
            }
            // Reverter horímetro
            if (ia.tipo_ref === 'maquina' && ia.maquina_id && ia.quantidade > 0) {
              const { data: maq } = await supabase
                .from('maquinas')
                .select('horimetro_atual')
                .eq('id', ia.maquina_id)
                .single()
              if (maq) {
                await supabase.from('maquinas').update({
                  horimetro_atual: Math.max(0, maq.horimetro_atual - ia.quantidade)
                }).eq('id', ia.maquina_id)
              }
            }
          }
        }

        // PASSO 3: Deletar itens antigos
        await supabase.from('lancamentos_itens').delete().eq('lancamento_id', lancamentoId)
        await supabase.from('maquina_manutencoes').delete().eq('lancamento_id', lancamentoId)
        await supabase.from('abastecimentos').delete().eq('lancamento_id', lancamentoId)

        // PASSO 4: Atualizar cabeçalho
        const { error: erroLanc } = await supabase
          .from('lancamentos')
          .update({
            servico_id: data.servico_id,
            talhao_id: data.talhao_id || null,
            data_execucao: data.data_execucao,
            observacoes: data.observacoes || null,
            custo_total: custoTotal,
            editado_por: userId,
            editado_em: new Date().toISOString(),
          })
          .eq('id', lancamentoId)
        if (erroLanc) throw erroLanc

        // PASSO 5: Inserir novos itens
        if (itensComCusto.length > 0) {
          const { error: erroItens } = await supabase
            .from('lancamentos_itens')
            .insert(itensComCusto.map(item => ({
              lancamento_id: lancamentoId,
              tipo_ref: item.tipo_ref,
              produto_id: item.produto_id || null,
              maquina_id: item.maquina_id || null,
              servico_ref_id: item.servico_ref_id || null,
              quantidade: item.quantidade,
              custo_unitario: item.custo_unitario,
              custo_total: item.custo_total,
              detalhamento_lotes: item.detalhamento_lotes || null,
              litros: item.litros ?? null,
              combustivel_tipo: item.combustivel_tipo || null,
              horimetro_informado: item.horimetro_informado ?? null,
              momento_abastecimento: item.momento_abastecimento || null,
              observacao: item.observacao || null,
              categoria_manutencao: item.categoria_manutencao || null,
              descricao: item.descricao || null,
              oficina: item.oficina || null,
              proximo_horimetro: item.proximo_horimetro ?? null,
              momento_manutencao: item.momento_manutencao || null,
            })))
          if (erroItens) throw erroItens
        }

        // PASSO 6: Aplicar novo consumo
        await aplicarConsumoEHorimetro(itensComCusto)
        await sincronizarAbastecimentos(lancamentoId, itensComCusto, data.data_execucao)
        await sincronizarManutencoes(lancamentoId, itensComCusto, data.data_execucao, propriedadeAtual.id, userId)

        return { id: lancamentoId }
      }

      // ========== MODO CRIAÇÃO ==========
      const userId = (await supabase.auth.getUser()).data.user?.id

      const { data: novoLancamento, error: erroLanc } = await supabase
        .from('lancamentos')
        .insert({
          propriedade_id: propriedadeAtual.id,
          safra_id: safraAtual.id,
          servico_id: data.servico_id,
          talhao_id: data.talhao_id || null,
          data_execucao: data.data_execucao,
          observacoes: data.observacoes || null,
          custo_total: custoTotal,
          criado_por: userId,
        })
        .select('id')
        .single()

      if (erroLanc) throw erroLanc

      if (itensComCusto.length > 0) {
        const { error: erroItens } = await supabase
          .from('lancamentos_itens')
          .insert(itensComCusto.map(item => ({
            lancamento_id: novoLancamento.id,
            tipo_ref: item.tipo_ref,
            produto_id: item.produto_id || null,
            maquina_id: item.maquina_id || null,
            servico_ref_id: item.servico_ref_id || null,
            quantidade: item.quantidade,
            custo_unitario: item.custo_unitario,
            custo_total: item.custo_total,
            detalhamento_lotes: item.detalhamento_lotes || null,
            litros: item.litros ?? null,
            combustivel_tipo: item.combustivel_tipo || null,
            horimetro_informado: item.horimetro_informado ?? null,
            momento_abastecimento: item.momento_abastecimento || null,
            observacao: item.observacao || null,
              categoria_manutencao: item.categoria_manutencao || null,
              descricao: item.descricao || null,
              oficina: item.oficina || null,
              proximo_horimetro: item.proximo_horimetro ?? null,
              momento_manutencao: item.momento_manutencao || null,
            })))
        if (erroItens) throw erroItens
      }

      await aplicarConsumoEHorimetro(itensComCusto)
      await sincronizarAbastecimentos(novoLancamento.id, itensComCusto, data.data_execucao)
      await sincronizarManutencoes(novoLancamento.id, itensComCusto, data.data_execucao, propriedadeAtual.id, userId)

      return { id: novoLancamento.id }
    },
    onSuccess: (_data, variables) => {
      const maquinasAtualizadas = variables.itens
        .filter(i => i.tipo_ref === 'maquina' && i.quantidade > 0)
        .map(i => `${i.nome}: +${i.quantidade}h`)

      if (maquinasAtualizadas.length > 0) {
        toast({
          title: '✅ Lançamento salvo com sucesso!',
          description: (
            <div className="space-y-1 mt-1">
              <p className="text-sm">Estoque e custos atualizados automaticamente.</p>
              <p className="text-sm font-medium">⚙️ Horímetros atualizados:</p>
              {maquinasAtualizadas.map((texto, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {texto}</p>
              ))}
            </div>
          )
        })
      } else {
        toast({
          title: '✅ Lançamento salvo com sucesso!',
          description: 'Estoque e custos atualizados automaticamente.'
        })
      }

      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['preview-custo'] })
      queryClient.invalidateQueries({ queryKey: ['preview-custo-direto'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] })
      queryClient.invalidateQueries({ queryKey: ['maquinas'] })
      queryClient.invalidateQueries({ queryKey: ['manutencoes-proximas'] })
      queryClient.invalidateQueries({ queryKey: ['manutencoes-todas'] })
      queryClient.invalidateQueries({ queryKey: ['abastecimentos-stats'] })

      navigate('/lancamentos')
    },
    onError: (error: Error) => {
      setValidandoEstoque(false)
      const isSafraFechada = error.message.includes('Safra fechada')
      toast({
        title: isSafraFechada ? 'Safra fechada' : '❌ Erro ao salvar lançamento',
        description: isSafraFechada
          ? 'A safra selecionada está fechada. Reabra a safra em "Safras" para continuar lançando operações nela, ou selecione outra safra ativa.'
          : error.message,
        variant: isSafraFechada ? 'default' : 'destructive'
      })
    }
  })

// Helper: sincronizar registros em abastecimentos a partir dos itens de abastecimento do lançamento
  // (mantém o Histórico de Abastecimentos e "Últ. abastecimento" da tela Máquinas em dia)
  const sincronizarAbastecimentos = async (
    lancamentoIdSalvo: string,
    itens: ItemLancamento[],
    dataExecucao: string
  ) => {
    const abastecimentosDoLancamento = itens.filter(i => i.tipo_ref === 'abastecimento' && i.maquina_id)
    if (abastecimentosDoLancamento.length === 0) return
    await supabase.from('abastecimentos').insert(abastecimentosDoLancamento.map(item => ({
      maquina_id: item.maquina_id,
      data: dataExecucao,
      horimetro: item.horimetro_informado ?? 0,
      combustivel_tipo: item.combustivel_tipo || null,
      quantidade_litros: item.litros || 0,
      custo_total: item.custo_total || 0,
      custo_litro: item.litros && item.litros > 0 ? (item.custo_total || 0) / item.litros : null,
      observacoes: item.observacao || null,
      lancamento_id: lancamentoIdSalvo,
    })))
  }

  // Helper: sincronizar registros em maquina_manutencoes a partir dos itens de manutenção do lançamento
  const sincronizarManutencoes = async (
    lancamentoIdSalvo: string,
    itens: ItemLancamento[],
    dataExecucao: string,
    propriedadeId: string,
    userId?: string
  ) => {
    const manutencoes = itens.filter(i => i.tipo_ref === 'manutencao' && i.maquina_id)
    if (manutencoes.length === 0) return
    await supabase.from('maquina_manutencoes').insert(manutencoes.map(item => ({
      propriedade_id: propriedadeId,
      safra_id: safraAtual?.id || null,
      maquina_id: item.maquina_id,
      tipo: item.categoria_manutencao || 'Outros',
      descricao: item.descricao || item.nome || 'Manutenção',
      data_realizada: dataExecucao,
      status: 'realizada',
      horimetro_na_manutencao: item.horimetro_informado ?? null,
      proximo_horimetro: item.proximo_horimetro ?? null,
      custo: item.custo_total ?? null,
      oficina: item.oficina || null,
      observacoes: item.observacao || null,
      usuario_id: userId || null,
      lancamento_id: lancamentoIdSalvo,
    })))
  }

  // Helper: aplicar consumo FIFO e horímetro
  const aplicarConsumoEHorimetro = async (itens: ItemLancamento[]) => {
    const prioridade = (it: any): number => {
      if (it.tipo_ref === 'abastecimento' && it.momento_abastecimento !== 'depois') return 0
      if (it.tipo_ref === 'manutencao' && it.momento_manutencao !== 'depois') return 0
      if (it.tipo_ref === 'maquina') return 1
      if (it.tipo_ref === 'abastecimento' && it.momento_abastecimento === 'depois') return 2
      if (it.tipo_ref === 'manutencao' && it.momento_manutencao === 'depois') return 2
      return 1
    }

    const itensOrdenados = [...itens].sort((a, b) => prioridade(a) - prioridade(b))

    for (const item of itensOrdenados) {
      // Consumir lotes FIFO
      if (item.tipo_ref === 'produto' && item.detalhamento_lotes && item.detalhamento_lotes.length > 0) {
        for (const lc of item.detalhamento_lotes) {
          const { data: loteAtual } = await supabase
            .from('lotes')
            .select('quantidade_disponivel')
            .eq('id', lc.lote_id)
            .single()
          if (loteAtual) {
            await supabase.from('lotes').update({
              quantidade_disponivel: Math.max(0, loteAtual.quantidade_disponivel - lc.quantidade_consumida)
            }).eq('id', lc.lote_id)
          }
        }
      }
      // Atualizar horímetro ou quilometragem, conforme o tipo da máquina
      if (item.tipo_ref === 'maquina' && item.maquina_id && item.quantidade > 0) {
        const { data: maq } = await supabase
          .from('maquinas')
          .select('horimetro_atual, km_atual, unidade_calculo')
          .eq('id', item.maquina_id)
          .single()
        if (maq) {
          if ((maq as any).unidade_calculo === 'km') {
            await supabase.from('maquinas').update({
              km_atual: Number((maq as any).km_atual || 0) + item.quantidade
            }).eq('id', item.maquina_id)
          } else {
            await supabase.from('maquinas').update({
              horimetro_atual: maq.horimetro_atual + item.quantidade
            }).eq('id', item.maquina_id)
          }
        }
      }
      // Abastecimento: atualiza horímetro informado e baixa combustível do estoque (FIFO)
      if (item.tipo_ref === 'abastecimento' && item.maquina_id && item.horimetro_informado != null) {
        await supabase.from('maquinas').update({
          horimetro_atual: item.horimetro_informado
        }).eq('id', item.maquina_id)

        if (item.origem_estoque && item.produto_id && item.litros && item.litros > 0) {
          // Mesmo mecanismo de consumo FIFO já usado para itens de produto:
          // consome dos lotes mais antigos até atender a quantidade (litros).
          let restante = item.litros
          const { data: lotes } = await supabase
            .from('lotes')
            .select('id, quantidade_disponivel, data_entrada')
            .eq('produto_id', item.produto_id)
            .gt('quantidade_disponivel', 0)
            .order('data_entrada', { ascending: true })
          if (lotes) {
            for (const lote of lotes) {
              if (restante <= 0) break
              const consumir = Math.min(Number(lote.quantidade_disponivel), restante)
              await supabase.from('lotes').update({
                quantidade_disponivel: Math.max(0, Number(lote.quantidade_disponivel) - consumir)
              }).eq('id', lote.id)
              restante -= consumir
            }
          }
        }
      }
      // Manutenção: apenas atualiza o horímetro informado, se preenchido (sem baixa de estoque)
      if (item.tipo_ref === 'manutencao' && item.maquina_id && item.horimetro_informado != null) {
        await supabase.from('maquinas').update({
          horimetro_atual: item.horimetro_informado
        }).eq('id', item.maquina_id)
      }
    }
  }

  // Validar formulário
  const validarFormulario = (): boolean => {
    if (!formData.servico_id) {
      toast({ title: 'Serviço não selecionado', description: 'Selecione um serviço para continuar', variant: 'destructive' })
      return false
    }
    if (!formData.data_execucao) {
      toast({ title: 'Data não informada', description: 'Informe a data de execução', variant: 'destructive' })
      return false
    }
    if (resumoFinanceiro.temEstoqueInsuficiente) {
      toast({ title: 'Estoque insuficiente', description: 'Ajuste as quantidades antes de salvar.', variant: 'destructive' })
      return false
    }
    return true
  }

  const safraFechada = (safraAtual as any)?.fechada === true

  const handleSalvar = () => {
    if (safraFechada) {
      toast({ title: 'Safra fechada', description: 'Esta safra está fechada — somente leitura.', variant: 'destructive' })
      return
    }
    if (!validarFormulario()) return
    salvarMutation.mutate(formData)
  }

  if (!propriedadeAtual || !safraAtual) {
    return (
      <div className="w-full max-w-full py-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p>Selecione uma propriedade e safra para criar lançamentos.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/lancamentos')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full py-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/lancamentos" className="hover:text-foreground transition-colors">Lançamentos</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">
          {lancamentoId ? 'Editar' : 'Novo'} Lançamento
        </span>
      </nav>

      {/* Back to Estoque button */}
      {fromEstoque && (
        <Button variant="outline" size="sm" onClick={() => navigate('/estoque')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Estoque
        </Button>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(fromEstoque ? '/estoque' : '/lancamentos')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {lancamentoId ? 'Editar' : 'Novo'} Lançamento
          </h1>
          <p className="text-muted-foreground">
            {propriedadeAtual.nome} • Safra {safraAtual.ano_inicio}/{safraAtual.ano_fim}
          </p>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Warning de edição com horímetro */}
        {lancamentoId && formData.itens.some(i => i.tipo_ref === 'maquina') && (
          <Alert className="border-amber-300 bg-amber-50/50 dark:border-amber-700/50 dark:bg-amber-950/20 mb-6">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              Este lançamento atualizou o horímetro de máquinas. Ao editar, os valores serão ajustados automaticamente.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
          {/* Coluna Esquerda: Formulário */}
          <div className="space-y-6">
            {/* Card do Cabeçalho */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Informações da Operação
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                {(safraAtual as any)?.fechada && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>🔒 Safra fechada — somente leitura.</strong> Não é possível salvar alterações nesta safra.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* DATA */}
                  <div className="space-y-2">
                    <Label htmlFor="data_execucao">Data da Execução *</Label>
                    <Input
                      id="data_execucao"
                      type="date"
                      value={formData.data_execucao}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_execucao: e.target.value }))}
                      required
                      className="w-full"
                    />
                  </div>

                  {/* SERVIÇO */}
                  <div className="space-y-2">
                    <Label htmlFor="servico">Serviço *</Label>
                    <Select value={formData.servico_id} onValueChange={handleServicoChange} disabled={loadingServicos}>
                      <SelectTrigger id="servico">
                        <SelectValue placeholder={loadingServicos ? "Carregando serviços..." : "Selecione o serviço"} />
                      </SelectTrigger>
                      <SelectContent>
                        {servicos?.map((servico) => (
                          <SelectItem key={servico.id} value={servico.id}>
                            {servico.nome}
                            {servico.tipo_servico === 'simples' ? ' (Simples)' : ''}
                          </SelectItem>
                        ))}
                        {(!servicos || servicos.length === 0) && !loadingServicos && (
                          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            Nenhum serviço cadastrado
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* TALHÃO */}
                <div className="space-y-2">
                  <Label htmlFor="talhao" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Talhão {servicoSelecionado?.requer_talhao ? '*' : '(opcional)'}
                  </Label>
                  <Select value={formData.talhao_id || 'none'} onValueChange={handleTalhaoChange} disabled={loadingTalhoes}>
                    <SelectTrigger id="talhao">
                      <SelectValue placeholder={loadingTalhoes ? "Carregando talhões..." : "Selecione o talhão"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem talhão específico</SelectItem>
                      {talhoes?.map((talhao) => (
                        <SelectItem key={talhao.id} value={talhao.id}>
                          {talhao.nome} ({talhao.area_ha} ha)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Vincule a um talhão para rastrear custos por área
                  </p>
                </div>

                {/* OBSERVAÇÕES */}
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value.slice(0, 500) }))}
                    placeholder="Observações sobre esta operação..."
                    rows={3}
                    className="resize-none"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {formData.observacoes?.length || 0}/500
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Indicador de carregamento de itens */}
            {loadingItens && (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Carregando itens do serviço...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SEÇÃO DE ITENS */}
            {formData.servico_id && !loadingItens && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Itens da Operação
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {formData.itens.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Este serviço não possui itens vinculados. Adicione itens manualmente abaixo.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    formData.itens.map((itemForm, index) => (
                      <ItemLancamentoCard
                        key={`${itemForm.tipo_ref}-${itemForm.produto_id || itemForm.maquina_id || itemForm.servico_ref_id || index}`}
                        itemForm={itemForm}
                        produtos={produtos}
                        temMaquinaNoLancamento={!!itemForm.maquina_id && formData.itens.some(i => i.tipo_ref === 'maquina' && i.maquina_id === itemForm.maquina_id)}
                        categoriasManutencao={categoriasManutencao}
                        descricoesManutencao={descricoesManutencao}
                        maquinas={maquinas}
                        tiposCombustivel={tiposCombustivel}
                        onUpdate={(updated) => {
                          const newItens = [...formData.itens]
                          newItens[index] = updated
                          setFormData(prev => ({ ...prev, itens: newItens }))
                        }}
                        onRemove={() => {
                          if (itemForm.obrigatorio) {
                            toast({ title: 'Item obrigatório', description: 'Este item não pode ser removido.', variant: 'destructive' })
                            return
                          }
                          setFormData(prev => ({ ...prev, itens: prev.itens.filter((_, i) => i !== index) }))
                        }}
                      />
                    ))
                  )}

                  {/* Botões de adição manual */}
                  <Separator className="my-4" />
                  <div>
                    <p className="text-sm font-medium mb-3">Adicionar ao Lançamento</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setAdicionandoTipo(adicionandoTipo === 'produto' ? null : 'produto')}>
                        <PrateleiraIcon className="h-4 w-4 mr-1" />
                        + Produto do Estoque
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setAdicionandoTipo(adicionandoTipo === 'maquina' ? null : 'maquina')}>
                        <Tractor className="h-4 w-4 mr-1" />
                        + Máquina
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setAdicionandoTipo(adicionandoTipo === 'servico_simples' ? null : 'servico_simples')}>
                        <Wrench className="h-4 w-4 mr-1" />
                        + Custo Diária
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setAdicionandoTipo(adicionandoTipo === 'abastecimento' ? null : 'abastecimento')}>
                        <Fuel className="h-4 w-4 mr-1" />
                        + Abastecimento
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setAdicionandoTipo(adicionandoTipo === 'manutencao' ? null : 'manutencao')}>
                        <Cog className="h-4 w-4 mr-1" />
                        + Manutenção
                      </Button>
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => {
                          const abrindo = adicionandoTipo !== 'reposicao'
                          setAdicionandoTipo(abrindo ? 'reposicao' : null)
                          if (!abrindo) setReposicaoMaquinaId(null)
                        }}
                      >
                        <Tractor className="h-4 w-4 mr-1" />
                        + Troca/Reposição
                      </Button>
                    </div>

                    {/* Select para tipo selecionado */}
                    {adicionandoTipo === 'produto' && (
                      <div className="mt-3">
                        <Select onValueChange={adicionarProduto}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um produto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {produtos
                              ?.filter(p => !formData.itens.some(i => i.produto_id === p.id))
                              .map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nome} ({p.unidade_medida}) — Estoque: {p.saldo_atual ?? 0}
                                </SelectItem>
                              ))}
                            {(!produtos || produtos.filter(p => !formData.itens.some(i => i.produto_id === p.id)).length === 0) && (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                {produtos?.length ? 'Todos os produtos já foram adicionados' : 'Nenhum produto cadastrado'}
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {adicionandoTipo === 'maquina' && (
                      <div className="mt-3">
                        <Select onValueChange={adicionarMaquina}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma máquina..." />
                          </SelectTrigger>
                          <SelectContent>
                            {maquinas?.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {(m as any).unidade_calculo === 'km'
                                  ? `${m.nome} — R$ ${((m as any).custo_km || 0).toFixed(2)}/km`
                                  : `${m.nome} — R$ ${(m.custo_hora || 0).toFixed(2)}/h`}
                              </SelectItem>
                            ))}
                            {(!maquinas || maquinas.length === 0) && (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Nenhuma máquina cadastrada
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {adicionandoTipo === 'servico_simples' && (
                      <div className="mt-3">
                        <Select onValueChange={adicionarServicoSimples}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um custo de serviço..." />
                          </SelectTrigger>
                          <SelectContent>
                            {servicosSimples?.filter(s => s.id !== formData.servico_id).map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.nome} — R$ {(s.custo_padrao || 0).toFixed(2)}/{s.unidade_medida}
                              </SelectItem>
                            ))}
                            {(!servicosSimples || servicosSimples.length === 0) && (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Nenhum serviço com valor cadastrado
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {adicionandoTipo === 'abastecimento' && (
                      <div className="mt-3">
                        <Select onValueChange={(maquinaId) => {
                          adicionarAbastecimento(maquinaId)
                          setAdicionandoTipo(null)
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a máquina abastecida..." />
                          </SelectTrigger>
                          <SelectContent>
                            {maquinas?.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.nome} — R$ {(m.custo_hora || 0).toFixed(2)}/h
                              </SelectItem>
                            ))}
                            {(!maquinas || maquinas.length === 0) && (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Nenhuma máquina cadastrada
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {adicionandoTipo === 'manutencao' && (
                      <div className="mt-3">
                        <Select onValueChange={(maquinaId) => {
                          adicionarManutencao(maquinaId)
                          setAdicionandoTipo(null)
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a máquina em manutenção..." />
                          </SelectTrigger>
                          <SelectContent>
                            {maquinas?.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.nome} — Horímetro: {m.horimetro_atual ?? 0}h
                              </SelectItem>
                            ))}
                            {(!maquinas || maquinas.length === 0) && (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Nenhuma máquina cadastrada
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {adicionandoTipo === 'reposicao' && (
                      <div className="mt-3 space-y-3">
                        {!reposicaoMaquinaId ? (
                          <Select onValueChange={setReposicaoMaquinaId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o trator/máquina..." />
                            </SelectTrigger>
                            <SelectContent>
                              {maquinas?.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                              ))}
                              {(!maquinas || maquinas.length === 0) && (
                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                  Nenhuma máquina cadastrada
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2">
                              <span>Máquina: <strong>{maquinas?.find(m => m.id === reposicaoMaquinaId)?.nome}</strong></span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setReposicaoMaquinaId(null)}>Trocar</Button>
                            </div>
                            <Select onValueChange={adicionarReposicao}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a peça (categoria Máquina)..." />
                              </SelectTrigger>
                              <SelectContent>
                                {produtos?.filter(p => (p.categoria || '').toLowerCase().includes('máquina') || (p.categoria || '').toLowerCase().includes('maquina')).map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.nome} — {p.saldo_atual} {p.unidade_medida}</SelectItem>
                                ))}
                                {(!produtos || produtos.filter(p => (p.categoria || '').toLowerCase().includes('máquina') || (p.categoria || '').toLowerCase().includes('maquina')).length === 0) && (
                                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                    Nenhum produto cadastrado na categoria "Máquina"
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button" variant="outline" size="sm" className="w-full"
                              onClick={() => { setAdicionandoTipo(null); setReposicaoMaquinaId(null) }}
                            >
                              Concluir
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {lancamentoId && propriedadeAtual?.id && (
              <Card>
                <CardContent className="pt-4">
                  <Anexos
                    entidadeTipo="lancamento"
                    entidadeId={lancamentoId}
                    propriedadeId={propriedadeAtual.id}
                  />
                </CardContent>
              </Card>
            )}

            {/* Botões - Mobile */}

            <div className="lg:hidden flex flex-col gap-3 pt-4 border-t">
              <Button
                type="button"
                onClick={handleSalvar}
                disabled={safraFechada || salvarMutation.isPending || validandoEstoque || !formData.servico_id || resumoFinanceiro.temEstoqueInsuficiente || !temAlteracaoReal}
                className="w-full"
                size="lg"
              >
                {salvarMutation.isPending || validandoEstoque ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {validandoEstoque ? 'Validando estoque...' : 'Salvando...'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {lancamentoId ? 'Salvar Alterações' : 'Salvar Lançamento'}
                  </>
                )}
              </Button>
              {lancamentoId && !temAlteracaoReal && (
                <p className="text-xs text-muted-foreground text-center mt-1">Nenhuma alteração detectada</p>
              )}
              <Button type="button" variant="outline" onClick={() => navigate('/lancamentos')} disabled={salvarMutation.isPending} className="w-full">
                Cancelar
              </Button>
            </div>
          </div>

          {/* Coluna Direita: Resumo Financeiro (Sticky) */}
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-6">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Resumo Financeiro
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-6">
                  {resumoFinanceiro.totalItens === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Adicione quantidades aos itens para ver o resumo de custos
                    </p>
                  ) : (
                    <>
                      {resumoFinanceiro.totalProdutos > 0 && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <PrateleiraIcon className="h-4 w-4 text-blue-600" />
                            <span className="text-sm">Insumos</span>
                          </div>
                          <span className="font-semibold text-blue-700">
                            R$ {resumoFinanceiro.totalProdutos.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {resumoFinanceiro.totalReposicao > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Tractor className="h-4 w-4 text-amber-600" />
                              <span className="text-sm">Troca/Reposição</span>
                            </div>
                            <span className="font-semibold text-amber-700">
                              R$ {resumoFinanceiro.totalReposicao.toFixed(2)}
                            </span>
                          </div>

                          {resumoFinanceiro.reposicaoPorMaquina.map((m: any) => (
                            <div key={m.nome} className="flex justify-between items-center pl-6 text-xs text-muted-foreground">
                              <span>{m.nome}</span>
                              <span>R$ {m.valor.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {resumoFinanceiro.totalServicos > 0 && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-600" />
                            <span className="text-sm">Serviços</span>
                          </div>
                          <span className="font-semibold text-purple-700">
                            R$ {resumoFinanceiro.totalServicos.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {resumoFinanceiro.totalMaquinas > 0 && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Tractor className="h-4 w-4 text-orange-600" />
                            <span className="text-sm">Máquinas</span>
                          </div>
                          <span className="font-semibold text-orange-700">
                            R$ {resumoFinanceiro.totalMaquinas.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {resumoFinanceiro.totalAbastecimento > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Fuel className="h-4 w-4 text-amber-600" />
                              <span className="text-sm">Abastecimento</span>
                            </div>
                            <span className="font-semibold text-amber-700">
                              R$ {resumoFinanceiro.totalAbastecimento.toFixed(2)}
                            </span>
                          </div>

                          {resumoFinanceiro.abastecimentoPorMaquina.map((m: any) => (
                            <div key={m.nome} className="flex justify-between items-center pl-6 text-xs text-muted-foreground">
                              <span>{m.nome}</span>
                              <span>R$ {m.valor.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {resumoFinanceiro.totalManutencao > 0 && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Cog className="h-4 w-4 text-red-600" />
                            <span className="text-sm">Manutenção</span>
                          </div>
                          <span className="font-semibold text-red-700">
                            R$ {resumoFinanceiro.totalManutencao.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <Separator />

                      <div className="bg-primary text-primary-foreground p-4 rounded-lg -mx-6 -mb-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">💰 CUSTO TOTAL:</span>
                          <span className="text-2xl font-bold">
                            R$ {resumoFinanceiro.custoTotal.toFixed(2)}
                          </span>
                        </div>

                        {resumoFinanceiro.custoPorHa !== null && (
                          <div className="flex justify-between items-center text-sm opacity-90">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              <span>Custo por hectare:</span>
                            </div>
                            <span className="font-semibold">
                              R$ {resumoFinanceiro.custoPorHa.toFixed(2)}/ha
                            </span>
                          </div>
                        )}

                        <p className="text-xs opacity-75 mt-2">
                          {resumoFinanceiro.totalItens} {resumoFinanceiro.totalItens === 1 ? 'item' : 'itens'} com quantidade
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Botões - Desktop */}
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  onClick={handleSalvar}
                  disabled={safraFechada || salvarMutation.isPending || validandoEstoque || !formData.servico_id || resumoFinanceiro.temEstoqueInsuficiente || !temAlteracaoReal}
                  className="w-full"
                  size="lg"
                >
                  {salvarMutation.isPending || validandoEstoque ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {validandoEstoque ? 'Validando estoque...' : 'Salvando...'}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {lancamentoId ? 'Salvar Alterações' : 'Salvar Lançamento'}
                    </>
                  )}
                </Button>
                {lancamentoId && !temAlteracaoReal && (
                  <p className="text-xs text-muted-foreground text-center mt-1">Nenhuma alteração detectada</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/lancamentos')}
                  disabled={salvarMutation.isPending}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Dialog de confirmação para custo alto */}
      <AlertDialog 
        open={custoAltoDialog.open} 
        onOpenChange={(open) => {
          if (!open && custoAltoDialog.resolve) custoAltoDialog.resolve(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Atenção — Custo Elevado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  O custo total deste lançamento é de{' '}
                  <strong className="text-foreground text-lg">R$ {custoAltoDialog.valor}</strong>
                </p>
                <p>Deseja confirmar e salvar este lançamento?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => custoAltoDialog.resolve?.(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => custoAltoDialog.resolve?.(true)}>Sim, Salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
