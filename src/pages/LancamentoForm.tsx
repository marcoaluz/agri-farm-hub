import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useServicos } from '@/hooks/useServicos'
import { useTalhoes } from '@/hooks/useTalhoes'
import { ItemLancamentoCard, type ItemLancamento } from '@/components/lancamentos/ItemLancamentoCard'
import { ResumoFinanceiro } from '@/components/lancamentos/ResumoFinanceiro'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2, Package, AlertCircle, Check } from 'lucide-react'

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

  // Hooks de dados
  const { data: servicos, isLoading: loadingServicos } = useServicos(propriedadeAtual?.id)
  const { data: talhoes, isLoading: loadingTalhoes } = useTalhoes(propriedadeAtual?.id)

  // Obter área do talhão selecionado
  const talhaoSelecionado = talhoes?.find(t => t.id === formData.talhao_id)
  const areaHa = talhaoSelecionado?.area_ha

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

  // Mutation para salvar lançamento
  const salvarMutation = useMutation({
    mutationFn: async (data: LancamentoFormData) => {
      if (!propriedadeAtual || !safraAtual) {
        throw new Error('Selecione propriedade e safra')
      }

      // 1. CRIAR LANÇAMENTO (cabeçalho)
      const { data: lancamento, error: erroLanc } = await supabase
        .from('lancamentos')
        .insert({
          propriedade_id: propriedadeAtual.id,
          safra_id: safraAtual.id,
          servico_id: data.servico_id,
          talhao_id: data.talhao_id || null,
          data_execucao: data.data_execucao,
          observacoes: data.observacoes || null,
          custo_total: 0,
          status: 'concluido'
        })
        .select()
        .single()

      if (erroLanc) throw erroLanc

      let custoTotal = 0

      // 2. PROCESSAR CADA ITEM
      for (const itemForm of data.itens) {
        if (!itemForm.quantidade || itemForm.quantidade <= 0) continue

        // Buscar preview final do custo via RPC ou fallback local
        let preview = null
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('preview_custo_item', {
            p_item_id: itemForm.item_id,
            p_quantidade: itemForm.quantidade
          })

        if (!rpcError && rpcData) {
          preview = rpcData
        } else {
          // Usar valores já calculados no cliente
          preview = {
            item_tipo: itemForm.item?.tipo || 'produto_estoque',
            custo_unitario: itemForm.custo_unitario || 0,
            custo_total: itemForm.custo_total || 0,
            preview_consumo: itemForm.detalhamento_lotes || null
          }
        }

        // Salvar item do lançamento
        const { error: erroItem } = await supabase
          .from('lancamentos_itens')
          .insert({
            lancamento_id: lancamento.id,
            item_id: itemForm.item_id,
            quantidade: itemForm.quantidade,
            custo_unitario: preview.custo_unitario || 0,
            custo_total: preview.custo_total || 0,
            detalhamento_lotes: preview.preview_consumo || null
          })

        if (erroItem) throw erroItem

        // Se for produto de estoque, consumir via FIFO
        if (preview.item_tipo === 'produto_estoque' && itemForm.item?.produto_id) {
          const { error: erroFifo } = await supabase
            .rpc('consumir_estoque_fifo', {
              p_produto_id: itemForm.item.produto_id,
              p_quantidade: itemForm.quantidade,
              p_lancamento_id: lancamento.id
            })

          // Log mas não bloqueia se RPC não existir ainda
          if (erroFifo) {
            console.warn('RPC consumir_estoque_fifo não disponível:', erroFifo.message)
          }
        }

        // Se for hora de máquina, atualizar horímetro
        if (preview.item_tipo === 'maquina_hora' && itemForm.item?.maquina_id) {
          const { error: erroHor } = await supabase
            .rpc('atualizar_horimetro', {
              p_maquina_id: itemForm.item.maquina_id,
              p_horas: itemForm.quantidade
            })

          if (erroHor) {
            console.warn('RPC atualizar_horimetro não disponível:', erroHor.message)
          }
        }

        custoTotal += preview.custo_total || 0
      }

      // 3. ATUALIZAR CUSTO TOTAL DO LANÇAMENTO
      const { error: erroUpdate } = await supabase
        .from('lancamentos')
        .update({ custo_total: custoTotal })
        .eq('id', lancamento.id)

      if (erroUpdate) throw erroUpdate

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

      navigate('/lancamentos')
    },
    onError: (error: Error) => {
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

    return true
  }

  // Handler do botão Salvar
  const handleSalvar = () => {
    if (!validarFormulario()) return
    salvarMutation.mutate(formData)
  }

  // Preparar dados para o resumo financeiro
  const itensParaResumo = formData.itens
    .filter(i => i.quantidade && i.quantidade > 0)
    .map(i => ({
      item_id: i.item_id,
      nome: i.item?.nome || 'Item',
      tipo: (i.item?.tipo || 'produto_estoque') as 'produto_estoque' | 'servico' | 'maquina_hora',
      quantidade: i.quantidade || 0,
      custo_total: i.custo_total || 0,
      unidade_medida: i.item?.unidade_medida || 'un'
    }))

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
        <div className="space-y-6">
          {/* Card do Cabeçalho */}
          <Card>
            <CardHeader>
              <CardTitle>Informações da Operação</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Grid para campos lado a lado em telas maiores */}
              <div className="grid gap-6 md:grid-cols-2">
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
                <Label htmlFor="talhao">Talhão (opcional)</Label>
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
                    observacoes: e.target.value
                  }))}
                  placeholder="Observações sobre esta operação..."
                  rows={3}
                  className="resize-none"
                />
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

          {/* RESUMO FINANCEIRO */}
          {itensParaResumo.length > 0 && (
            <ResumoFinanceiro 
              itens={itensParaResumo} 
              areaHa={areaHa}
            />
          )}

          {/* Rodapé do Formulário */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/lancamentos')}
              disabled={salvarMutation.isPending}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={handleSalvar}
              disabled={salvarMutation.isPending || !formData.servico_id}
              className="min-w-[200px]"
            >
              {salvarMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Salvar Lançamento
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
