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
  Wrench
} from 'lucide-react'
import type { Servico } from '@/types'

// Interfaces
interface LancamentoFormData {
  servico_id: string
  talhao_id?: string
  data_execucao: string
  observacoes?: string
  itens: ItemLancamento[]
}

interface ServicoItem {
  id: string
  servico_id: string
  item_id: string
  quantidade_sugerida?: number
  obrigatorio: boolean
  ordem: number
  item: {
    id: string
    nome: string
    tipo: string
    unidade_medida: string
    produto_id?: string
    maquina_id?: string
  }
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
  const [loading, setLoading] = useState(false)
  const [loadingItens, setLoadingItens] = useState(false)
  const [validandoEstoque, setValidandoEstoque] = useState(false)

  // Hooks de dados - buscar serviços com tipo correto
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
      return data as Servico[]
    },
    enabled: !!propriedadeAtual?.id
  })
  const { data: talhoes, isLoading: loadingTalhoes } = useTalhoes(propriedadeAtual?.id)

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
            item:itens(id, nome, tipo, unidade_medida, produto_id, maquina_id)
          )
        `)
        .eq('id', id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setFormData({
          servico_id: data.servico_id,
          talhao_id: data.talhao_id || undefined,
          data_execucao: data.data_execucao,
          observacoes: data.observacoes || '',
          itens: data.lancamentos_itens?.map((li: any) => ({
            item_id: li.item_id,
            quantidade: li.quantidade,
            custo_unitario: li.custo_unitario,
            custo_total: li.custo_total,
            detalhamento_lotes: li.detalhamento_lotes,
            item: li.item
          })) || []
        })
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

  // Carregar itens do serviço selecionado
  const carregarItensServico = useCallback(async (servicoId: string) => {
    if (!servicoId) {
      setFormData(prev => ({ ...prev, itens: [] }))
      return
    }

    setLoadingItens(true)
    try {
      const { data, error } = await supabase
        .from('servicos_itens')
        .select(`
          *,
          item:itens(id, nome, tipo, unidade_medida, produto_id, maquina_id)
        `)
        .eq('servico_id', servicoId)
        .order('ordem')

      if (error) throw error

      const itensFormatados: ItemLancamento[] = (data as ServicoItem[] || []).map(si => ({
        item_id: si.item_id,
        quantidade: si.quantidade_sugerida || 0,
        obrigatorio: si.obrigatorio,
        item: si.item
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
  }, [toast])

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

  // Calcular resumo financeiro em tempo real
  const resumoFinanceiro = useMemo(() => {
    const itensValidos = formData.itens.filter(i => i.quantidade && i.quantidade > 0)
    
    const totalProdutos = itensValidos
      .filter(i => i.item?.tipo === 'produto_estoque')
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)
    
    const totalServicos = itensValidos
      .filter(i => i.item?.tipo === 'servico')
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)
    
    const totalMaquinas = itensValidos
      .filter(i => i.item?.tipo === 'maquina_hora')
      .reduce((sum, i) => sum + (i.custo_total || 0), 0)
    
    const custoTotal = totalProdutos + totalServicos + totalMaquinas
    const custoPorHa = areaHa && areaHa > 0 ? custoTotal / areaHa : null
    
    // Verificar se tem item com estoque insuficiente
    // Um item produto_estoque sem detalhamento_lotes ou com detalhamento vazio
    // quando tem quantidade > 0 indica estoque insuficiente
    const temEstoqueInsuficiente = itensValidos.some(
      i => i.item?.tipo === 'produto_estoque' && 
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

  // Mutation para salvar lançamento
  const salvarMutation = useMutation({
    mutationFn: async (data: LancamentoFormData) => {
      if (!propriedadeAtual || !safraAtual) {
        throw new Error('Selecione propriedade e safra')
      }

      setValidandoEstoque(true)

      // ETAPA 1: VALIDAR E CALCULAR CUSTOS FINAIS
      const itensComCusto = []
      let custoTotal = 0

      for (const itemForm of data.itens) {
        if (!itemForm.quantidade || itemForm.quantidade <= 0) continue

        // Buscar preview final do custo via RPC
        const { data: preview, error: rpcError } = await supabase
          .rpc('preview_custo_item', {
            p_item_id: itemForm.item_id,
            p_quantidade: itemForm.quantidade
          })

        if (rpcError) {
          console.warn('RPC preview_custo_item falhou:', rpcError.message)
          // Usar valores do form como fallback
        }

        const custoFinal = preview || {
          item_tipo: itemForm.item?.tipo || 'produto_estoque',
          custo_unitario: itemForm.custo_unitario || 0,
          custo_total: itemForm.custo_total || 0,
          preview_consumo: itemForm.detalhamento_lotes || null,
          estoque_suficiente: true
        }

        // Validar estoque
        if (custoFinal.item_tipo === 'produto_estoque' && !custoFinal.estoque_suficiente) {
          throw new Error(`Estoque insuficiente de "${itemForm.item?.nome}". Faltam ${custoFinal.quantidade_faltante?.toFixed(2)} ${itemForm.item?.unidade_medida}`)
        }

        itensComCusto.push({
          item_id: itemForm.item_id,
          quantidade: itemForm.quantidade,
          custo_unitario: custoFinal.custo_unitario || 0,
          custo_total: custoFinal.custo_total || 0,
          detalhamento_lotes: custoFinal.preview_consumo || null,
          item: itemForm.item
        })

        custoTotal += custoFinal.custo_total || 0
      }

      setValidandoEstoque(false)

      // Confirmação para custos altos
      if (custoTotal > 10000) {
        const confirmar = window.confirm(
          `⚠️ Atenção!\n\nO custo total deste lançamento é R$ ${custoTotal.toFixed(2)}.\n\nDeseja continuar?`
        )
        if (!confirmar) {
          throw new Error('Operação cancelada pelo usuário')
        }
      }

      // ETAPA 2: CRIAR LANÇAMENTO (cabeçalho)
      // Nota: schema real não tem campo 'status', apenas os campos básicos
      const { data: lancamento, error: erroLanc } = await supabase
        .from('lancamentos')
        .insert({
          propriedade_id: propriedadeAtual.id,
          safra_id: safraAtual.id,
          servico_id: data.servico_id,
          talhao_id: data.talhao_id || null,
          data_execucao: data.data_execucao,
          observacoes: data.observacoes || null,
          custo_total: custoTotal
        })
        .select()
        .single()

      if (erroLanc) throw erroLanc

      // ETAPA 3: CRIAR ITENS DO LANÇAMENTO
      const { error: erroItens } = await supabase
        .from('lancamentos_itens')
        .insert(
          itensComCusto.map(item => ({
            lancamento_id: lancamento.id,
            item_id: item.item_id,
            quantidade: item.quantidade,
            custo_unitario: item.custo_unitario,
            custo_total: item.custo_total,
            detalhamento_lotes: item.detalhamento_lotes
          }))
        )

      if (erroItens) throw erroItens

      // ETAPA 4: CONSUMIR LOTES FIFO (para produtos de estoque)
      for (const item of itensComCusto) {
        if (item.item?.tipo === 'produto_estoque' && item.detalhamento_lotes && item.detalhamento_lotes.length > 0) {
          for (const loteConsumo of item.detalhamento_lotes) {
            // Buscar quantidade atual do lote
            const { data: loteAtual } = await supabase
              .from('lotes')
              .select('quantidade_disponivel')
              .eq('id', loteConsumo.lote_id)
              .single()

            if (loteAtual) {
              const novaQtd = Math.max(0, loteAtual.quantidade_disponivel - loteConsumo.quantidade_consumida)
              
              await supabase
                .from('lotes')
                .update({ quantidade_disponivel: novaQtd })
                .eq('id', loteConsumo.lote_id)
            }
          }
        }

        // Se for hora de máquina, tentar atualizar horímetro
        if (item.item?.tipo === 'maquina_hora' && item.item?.maquina_id) {
          try {
            await supabase.rpc('atualizar_horimetro', {
              p_maquina_id: item.item.maquina_id,
              p_horas: item.quantidade
            })
          } catch (e) {
            console.warn('RPC atualizar_horimetro não disponível')
          }
        }
      }

      return lancamento
    },
    onSuccess: () => {
      toast({
        title: '✅ Lançamento salvo com sucesso!',
        description: 'Estoque e custos atualizados automaticamente.'
      })

      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['preview-custo'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] })

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

  // Validar formulário antes de salvar
  const validarFormulario = (): boolean => {
    if (!formData.servico_id) {
      toast({
        title: 'Serviço não selecionado',
        description: 'Selecione um serviço para continuar',
        variant: 'destructive'
      })
      return false
    }

    if (!formData.data_execucao) {
      toast({
        title: 'Data não informada',
        description: 'Informe a data de execução',
        variant: 'destructive'
      })
      return false
    }

    // Validar quantidade de itens obrigatórios
    const itensObrigatorios = formData.itens.filter(i => i.obrigatorio)
    for (const item of itensObrigatorios) {
      if (!item.quantidade || item.quantidade <= 0) {
        toast({
          title: 'Item obrigatório sem quantidade',
          description: `O item "${item.item?.nome}" é obrigatório`,
          variant: 'destructive'
        })
        return false
      }
    }

    // Verificar se ao menos um item tem quantidade
    const temItemComQtd = formData.itens.some(i => i.quantidade && i.quantidade > 0)
    if (!temItemComQtd) {
      toast({
        title: 'Nenhum item com quantidade',
        description: 'Informe a quantidade de pelo menos um item',
        variant: 'destructive'
      })
      return false
    }

    // Verificar estoque insuficiente
    if (resumoFinanceiro.temEstoqueInsuficiente) {
      toast({
        title: 'Estoque insuficiente',
        description: 'Um ou mais produtos possuem quantidade maior que o estoque disponível. Ajuste as quantidades antes de salvar.',
        variant: 'destructive'
      })
      return false
    }

    return true
  }

  // Handler do botão Salvar
  const handleSalvar = () => {
    if (!validarFormulario()) return
    salvarMutation.mutate(formData)
  }

  // Verificar se tem propriedade e safra selecionadas
  if (!propriedadeAtual || !safraAtual) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p>Selecione uma propriedade e safra para criar lançamentos.</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/lancamentos')}
              >
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
    <div className="container mx-auto py-6 space-y-6">
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
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/lancamentos')}
        >
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
        /* Layout em 2 colunas */
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
                {/* Grid para campos lado a lado */}
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* DATA */}
                  <div className="space-y-2">
                    <Label htmlFor="data_execucao">Data da Execução *</Label>
                    <Input
                      id="data_execucao"
                      type="date"
                      value={formData.data_execucao}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        data_execucao: e.target.value
                      }))}
                      required
                      className="w-full"
                    />
                  </div>

                  {/* SERVIÇO */}
                  <div className="space-y-2">
                    <Label htmlFor="servico">Serviço *</Label>
                    <Select
                      value={formData.servico_id}
                      onValueChange={handleServicoChange}
                      disabled={loadingServicos}
                    >
                      <SelectTrigger id="servico">
                        <SelectValue placeholder={
                          loadingServicos 
                            ? "Carregando serviços..." 
                            : "Selecione o serviço"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {servicos?.map((servico) => (
                          <SelectItem key={servico.id} value={servico.id}>
                            {servico.nome}
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
                  <Select
                    value={formData.talhao_id || 'none'}
                    onValueChange={handleTalhaoChange}
                    disabled={loadingTalhoes}
                  >
                    <SelectTrigger id="talhao">
                      <SelectValue placeholder={
                        loadingTalhoes 
                          ? "Carregando talhões..." 
                          : "Selecione o talhão"
                      } />
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
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      observacoes: e.target.value.slice(0, 500)
                    }))}
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
                        Este serviço não possui itens vinculados. Configure os itens do serviço para pré-carregar automaticamente.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    formData.itens.map((itemForm, index) => (
                      <ItemLancamentoCard
                        key={itemForm.item_id}
                        itemForm={itemForm}
                        onUpdate={(updated) => {
                          const newItens = [...formData.itens]
                          newItens[index] = updated
                          setFormData(prev => ({ ...prev, itens: newItens }))
                        }}
                        onRemove={() => {
                          if (itemForm.obrigatorio) {
                            toast({
                              title: 'Item obrigatório',
                              description: 'Este item é obrigatório e não pode ser removido.',
                              variant: 'destructive'
                            })
                            return
                          }
                          setFormData(prev => ({
                            ...prev,
                            itens: prev.itens.filter((_, i) => i !== index)
                          }))
                        }}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {/* Botões - Mobile */}
            <div className="lg:hidden flex flex-col gap-3 pt-4 border-t">
              <Button
                type="button"
                onClick={handleSalvar}
                disabled={salvarMutation.isPending || validandoEstoque || !formData.servico_id || resumoFinanceiro.temEstoqueInsuficiente}
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
                    Salvar Lançamento
                  </>
                )}
              </Button>
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

          {/* Coluna Direita: Resumo Financeiro (Sticky) */}
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-6">
              {/* Card de Resumo Financeiro */}
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
                      {/* Totais por Tipo */}
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

                      {/* Total Geral */}
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
                  disabled={salvarMutation.isPending || validandoEstoque || !formData.servico_id || resumoFinanceiro.temEstoqueInsuficiente}
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
                      Salvar Lançamento
                    </>
                  )}
                </Button>
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
      )}
    </div>
  )
}
