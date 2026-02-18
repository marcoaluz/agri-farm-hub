import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
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
  AlertTriangle
} from 'lucide-react'

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
  const { id: lancamentoId } = useParams<{ id: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { propriedadeAtual, safraAtual } = useGlobal()

  // Estado do formulário
  const [formData, setFormData] = useState<LancamentoFormData>({
    servico_id: '',
    data_execucao: new Date().toISOString().split('T')[0],
    itens: []
  })
  const [dadosOriginais, setDadosOriginais] = useState<LancamentoFormData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingItens, setLoadingItens] = useState(false)
  const [validandoEstoque, setValidandoEstoque] = useState(false)
  const [adicionandoTipo, setAdicionandoTipo] = useState<'produto' | 'maquina' | 'servico_simples' | null>(null)
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
      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('propriedade_id', propriedadeAtual.id)
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data as ServicoComTipo[]
    },
    enabled: !!propriedadeAtual?.id
  })
  const { data: talhoes, isLoading: loadingTalhoes } = useTalhoes(propriedadeAtual?.id)

  // Dados para adição manual de itens
  const { data: produtos } = useQuery({
    queryKey: ['produtos-lancamento', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, unidade, saldo_atual')
        .eq('propriedade_id', propriedadeAtual?.id)
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data
    },
    enabled: !!propriedadeAtual?.id
  })

  const { data: maquinas } = useQuery({
    queryKey: ['maquinas-lancamento', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maquinas')
        .select('id, nome, custo_hora, horimetro_atual')
        .eq('propriedade_id', propriedadeAtual?.id)
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data
    },
    enabled: !!propriedadeAtual?.id
  })

  const { data: servicosSimples } = useQuery({
    queryKey: ['servicos-simples-lancamento', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select('id, nome, custo_padrao, unidade_medida')
        .eq('propriedade_id', propriedadeAtual?.id)
        .eq('tipo_servico', 'simples')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data
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
            produto:produtos(id, nome, unidade, saldo_atual),
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
            tipo_ref: li.tipo_ref || (li.item_id ? undefined : undefined),
            produto_id: li.produto_id || null,
            maquina_id: li.maquina_id || null,
            servico_ref_id: li.servico_ref_id || null,
            nome: li.produto?.nome || li.maquina?.nome || li.servico_ref?.nome || '',
            unidade: li.produto?.unidade || li.servico_ref?.unidade_medida || 'hora',
            custo_unitario_ref: li.maquina?.custo_hora || li.servico_ref?.custo_padrao || undefined,
            quantidade: li.quantidade,
            custo_unitario: li.custo_unitario,
            custo_total: li.custo_total,
            detalhamento_lotes: li.detalhamento_lotes,
            // Legado
            item_id: li.item_id || null,
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

    // Serviço Composto: carregar itens vinculados
    setLoadingItens(true)
    try {
      const { data, error } = await supabase
        .from('servicos_itens')
        .select(`
          id, tipo_ref, obrigatorio, quantidade_sugerida,
          produto:produtos(id, nome, unidade, saldo_atual),
          maquina:maquinas(id, nome, custo_hora, horimetro_atual),
          servico_ref:servicos(id, nome, custo_padrao, unidade_medida)
        `)
        .eq('servico_id', servicoId)
        .order('ordem')

      if (error) throw error

      const itensFormatados: ItemLancamento[] = ((data as any[]) || []).map(si => ({
        tipo_ref: si.tipo_ref,
        produto_id: si.produto?.id || null,
        maquina_id: si.maquina?.id || null,
        servico_ref_id: si.servico_ref?.id || null,
        nome: si.produto?.nome || si.maquina?.nome || si.servico_ref?.nome || '',
        unidade: si.produto?.unidade || si.servico_ref?.unidade_medida || 'hora',
        custo_unitario_ref: si.maquina?.custo_hora || si.servico_ref?.custo_padrao || undefined,
        quantidade: si.quantidade_sugerida || 0,
        obrigatorio: si.obrigatorio,
        estoque_disponivel: si.produto?.saldo_atual || null,
      }))

      setFormData(prev => ({
        ...prev,
        servico_id: servicoId,
        itens: itensFormatados
      }))
    } catch (error) {
      console.error('Erro ao carregar itens do serviço:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os itens do serviço.',
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
        unidade: produto.unidade || 'unidade',
        quantidade: 0,
        estoque_disponivel: produto.saldo_atual,
      }]
    }))
    setAdicionandoTipo(null)
  }

  const adicionarMaquina = (maquinaId: string) => {
    const maquina = maquinas?.find(m => m.id === maquinaId)
    if (!maquina) return
    if (formData.itens.some(i => i.maquina_id === maquinaId)) {
      toast({ title: 'Máquina já adicionada', variant: 'destructive' })
      return
    }
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, {
        tipo_ref: 'maquina',
        maquina_id: maquina.id,
        nome: maquina.nome,
        unidade: 'hora',
        custo_unitario_ref: maquina.custo_hora || 0,
        quantidade: 0,
      }]
    }))
    setAdicionandoTipo(null)
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
    
    const totalProdutos = itensValidos
      .filter(i => i.tipo_ref === 'produto')
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)
    
    const totalServicos = itensValidos
      .filter(i => i.tipo_ref === 'servico_simples')
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)
    
    const totalMaquinas = itensValidos
      .filter(i => i.tipo_ref === 'maquina')
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)
    
    const custoTotal = totalProdutos + totalServicos + totalMaquinas
    const custoPorHa = areaHa && areaHa > 0 ? custoTotal / areaHa : null
    
    const temEstoqueInsuficiente = itensValidos.some(
      i => i.tipo_ref === 'produto' && 
           i.quantidade > 0 &&
           (i.detalhamento_lotes === null || 
            (Array.isArray(i.detalhamento_lotes) && i.detalhamento_lotes.length === 0))
    )
    
    return {
      totalItens: itensValidos.length,
      custoTotal,
      custoPorHa,
      totalProdutos,
      totalServicos,
      totalMaquinas,
      temEstoqueInsuficiente
    }
  }, [formData.itens, areaHa])

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
          const custoUnitario = itemForm.custo_unitario_ref || itemForm.custo_unitario || 0
          const custoItem = custoUnitario * itemForm.quantidade
          itensComCusto.push({
            ...itemForm,
            custo_unitario: custoUnitario,
            custo_total: custoItem,
          })
          custoTotal += custoItem

        } else if (itemForm.tipo_ref === 'servico_simples' && itemForm.servico_ref_id) {
          const custoUnitario = itemForm.custo_unitario_ref || itemForm.custo_unitario || 0
          const custoItem = custoUnitario * itemForm.quantidade
          itensComCusto.push({
            ...itemForm,
            custo_unitario: custoUnitario,
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
              item_id: null,
              quantidade: item.quantidade,
              custo_unitario: item.custo_unitario,
              custo_total: item.custo_total,
              detalhamento_lotes: item.detalhamento_lotes || null,
            })))
          if (erroItens) throw erroItens
        }

        // PASSO 6: Aplicar novo consumo
        await aplicarConsumoEHorimetro(itensComCusto)

        return { id: lancamentoId }
      }

      // ========== MODO CRIAÇÃO ==========
      const userId = (await supabase.auth.getUser()).data.user?.id

      const { data: novoLancamento, error: erroLanc } = await supabase
        .from('lancamentos')
        .insert({
          propriedade_id: propriedadeAtual,
          safra_id: safraAtual,
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
            item_id: null,
            quantidade: item.quantidade,
            custo_unitario: item.custo_unitario,
            custo_total: item.custo_total,
            detalhamento_lotes: item.detalhamento_lotes || null,
          })))
        if (erroItens) throw erroItens
      }

      await aplicarConsumoEHorimetro(itensComCusto)

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

      navigate('/lancamentos')
    },
    onError: (error: Error) => {
      setValidandoEstoque(false)
      toast({
        title: '❌ Erro ao salvar lançamento',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Helper: aplicar consumo FIFO e horímetro
  const aplicarConsumoEHorimetro = async (itens: ItemLancamento[]) => {
    for (const item of itens) {
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
      // Atualizar horímetro
      if (item.tipo_ref === 'maquina' && item.maquina_id && item.quantidade > 0) {
        const { data: maq } = await supabase
          .from('maquinas')
          .select('horimetro_atual')
          .eq('id', item.maquina_id)
          .single()
        if (maq) {
          await supabase.from('maquinas').update({
            horimetro_atual: maq.horimetro_atual + item.quantidade
          }).eq('id', item.maquina_id)
        }
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

  const handleSalvar = () => {
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

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/lancamentos')}>
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
                        <Package className="h-4 w-4 mr-1" />
                        + Produto do Estoque
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setAdicionandoTipo(adicionandoTipo === 'maquina' ? null : 'maquina')}>
                        <Truck className="h-4 w-4 mr-1" />
                        + Máquina
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setAdicionandoTipo(adicionandoTipo === 'servico_simples' ? null : 'servico_simples')}>
                        <Wrench className="h-4 w-4 mr-1" />
                        + Serviço Simples
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
                            {produtos?.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome} ({p.unidade}) — Estoque: {p.saldo_atual ?? 0}
                              </SelectItem>
                            ))}
                            {(!produtos || produtos.length === 0) && (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Nenhum produto cadastrado
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

                    {adicionandoTipo === 'servico_simples' && (
                      <div className="mt-3">
                        <Select onValueChange={adicionarServicoSimples}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um serviço simples..." />
                          </SelectTrigger>
                          <SelectContent>
                            {servicosSimples?.filter(s => s.id !== formData.servico_id).map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.nome} — R$ {(s.custo_padrao || 0).toFixed(2)}/{s.unidade_medida}
                              </SelectItem>
                            ))}
                            {(!servicosSimples || servicosSimples.length === 0) && (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Nenhum serviço simples cadastrado
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botões - Mobile */}
            <div className="lg:hidden flex flex-col gap-3 pt-4 border-t">
              <Button
                type="button"
                onClick={handleSalvar}
                disabled={salvarMutation.isPending || validandoEstoque || !formData.servico_id || resumoFinanceiro.temEstoqueInsuficiente || !temAlteracaoReal}
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
                            <Package className="h-4 w-4 text-blue-600" />
                            <span className="text-sm">Produtos</span>
                          </div>
                          <span className="font-semibold text-blue-700">
                            R$ {resumoFinanceiro.totalProdutos.toFixed(2)}
                          </span>
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
                            <Wrench className="h-4 w-4 text-orange-600" />
                            <span className="text-sm">Máquinas</span>
                          </div>
                          <span className="font-semibold text-orange-700">
                            R$ {resumoFinanceiro.totalMaquinas.toFixed(2)}
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
                  disabled={salvarMutation.isPending || validandoEstoque || !formData.servico_id || resumoFinanceiro.temEstoqueInsuficiente || !temAlteracaoReal}
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
