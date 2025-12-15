import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useServicos } from '@/hooks/useServicos'
import { useTalhoes } from '@/hooks/useTalhoes'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'

// Interfaces
interface ItemLancamento {
  item_id: string
  quantidade: number
  custo_unitario?: number
  custo_total?: number
  detalhamento_lotes?: any
  obrigatorio?: boolean
  item?: {
    id: string
    nome: string
    tipo: string
    unidade_medida: string
  }
}

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
  }
}

export function LancamentoForm() {
  const navigate = useNavigate()
  const { id: lancamentoId } = useParams<{ id: string }>()
  const { toast } = useToast()
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
            item:itens(id, nome, tipo, unidade_medida)
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
          item:itens(id, nome, tipo, unidade_medida)
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

  // Validação do formulário
  const isFormValid = () => {
    if (!formData.servico_id) return false
    if (!formData.data_execucao) return false
    if (!safraAtual) return false
    return true
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
        <form className="space-y-6">
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

          {/* Placeholder para a Parte 2 - Lista de Itens */}
          {formData.servico_id && !loadingItens && (
            <Card>
              <CardHeader>
                <CardTitle>Itens do Lançamento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  {formData.itens.length > 0 
                    ? `${formData.itens.length} item(ns) carregado(s) do serviço`
                    : 'Nenhum item vinculado a este serviço'
                  }
                </p>
                {/* A lista detalhada de itens será implementada na Parte 2 */}
              </CardContent>
            </Card>
          )}

          {/* Ações do Formulário */}
          <Card>
            <CardFooter className="flex justify-between py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/lancamentos')}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid() || loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {lancamentoId ? 'Salvar Alterações' : 'Criar Lançamento'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  )
}
