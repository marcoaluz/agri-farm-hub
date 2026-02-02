import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Interface de resposta do preview
export interface PreviewConsumoLote {
  lote_id: string
  lote_codigo: string
  nota_fiscal?: string
  data_entrada: string
  quantidade_consumida: number
  custo_unitario: number
  custo_parcial: number
}

export interface PreviewResponse {
  item_tipo: 'produto_estoque' | 'servico' | 'maquina_hora'
  custo_total: number
  custo_unitario: number
  
  // Se produto de estoque:
  preview_consumo?: PreviewConsumoLote[]
  estoque_disponivel?: number
  estoque_suficiente?: boolean
  quantidade_faltante?: number
}

// Hook auxiliar de debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Hook principal
export function usePreviewCusto(itemId: string | undefined, quantidade: number) {
  const debouncedQuantidade = useDebounce(quantidade, 500)

  return useQuery({
    queryKey: ['preview-custo', itemId, debouncedQuantidade],
    queryFn: async (): Promise<PreviewResponse | null> => {
      if (!itemId || debouncedQuantidade <= 0) {
        return null
      }

      // Tentar usar a função RPC se disponível
      const { data: rpcData, error: rpcError } = await supabase.rpc('preview_custo_item', {
        p_item_id: itemId,
        p_quantidade: debouncedQuantidade
      })

      // Se RPC existir e retornar dados, usar
      if (!rpcError && rpcData) {
        return rpcData as PreviewResponse
      }

      // Fallback: calcular no cliente se RPC não existir
      console.log('RPC não disponível, usando cálculo local:', rpcError?.message)
      return calcularPreviewLocal(itemId, debouncedQuantidade)
    },
    enabled: !!itemId && debouncedQuantidade > 0,
    staleTime: 0, // Sempre buscar atualizado
    gcTime: 1000 * 60 * 5 // Cache por 5 min
  })
}

// Função de fallback para calcular preview localmente
async function calcularPreviewLocal(itemId: string, quantidade: number): Promise<PreviewResponse | null> {
  // Buscar item para verificar tipo e dados relacionados
  const { data: item } = await supabase
    .from('itens')
    .select('tipo, custo_padrao, produto_id, maquina_id')
    .eq('id', itemId)
    .maybeSingle()

  if (!item) return null

  // Se não for produto de estoque, usar custo padrão direto
  if (item.tipo !== 'produto_estoque') {
    // Se for maquina_hora, buscar custo da máquina
    if (item.tipo === 'maquina_hora' && item.maquina_id) {
      const { data: maquina } = await supabase
        .from('maquinas')
        .select('custo_hora')
        .eq('id', item.maquina_id)
        .maybeSingle()
      
      const custoUnitario = maquina?.custo_hora || item.custo_padrao || 0
      return {
        item_tipo: 'maquina_hora',
        custo_unitario: custoUnitario,
        custo_total: custoUnitario * quantidade,
        estoque_disponivel: Infinity,
        estoque_suficiente: true
      }
    }
    
    // Serviço terceiro
    const custoUnitario = item.custo_padrao || 0
    return {
      item_tipo: item.tipo as PreviewResponse['item_tipo'],
      custo_unitario: custoUnitario,
      custo_total: custoUnitario * quantidade,
      estoque_disponivel: Infinity,
      estoque_suficiente: true
    }
  }

  // Se for produto de estoque, precisa do produto_id para buscar lotes
  if (!item.produto_id) {
    return {
      item_tipo: 'produto_estoque',
      custo_unitario: item.custo_padrao || 0,
      custo_total: (item.custo_padrao || 0) * quantidade,
      estoque_disponivel: 0,
      estoque_suficiente: false,
      quantidade_faltante: quantidade
    }
  }

  // Buscar lotes disponíveis usando FIFO (ordenados por data de entrada)
  // IMPORTANTE: lotes usa produto_id, não item_id
  const { data: lotes, error } = await supabase
    .from('lotes')
    .select('id, nota_fiscal, quantidade_disponivel, custo_unitario, data_entrada')
    .eq('produto_id', item.produto_id)
    .gt('quantidade_disponivel', 0)
    .order('data_entrada', { ascending: true })

  if (error) throw error

  // Calcular preview de consumo FIFO
  let quantidadeRestante = quantidade
  let custoTotal = 0
  const previewConsumo: PreviewConsumoLote[] = []
  let estoqueTotal = 0

  for (const lote of lotes || []) {
    estoqueTotal += lote.quantidade_disponivel

    if (quantidadeRestante <= 0) continue

    const quantidadeConsumida = Math.min(
      quantidadeRestante,
      lote.quantidade_disponivel
    )
    const custoParcial = quantidadeConsumida * lote.custo_unitario

    previewConsumo.push({
      lote_id: lote.id,
      lote_codigo: lote.id.substring(0, 8), // Usar parte do UUID como código
      nota_fiscal: lote.nota_fiscal || undefined,
      quantidade_consumida: quantidadeConsumida,
      custo_unitario: lote.custo_unitario,
      custo_parcial: custoParcial,
      data_entrada: lote.data_entrada
    })

    custoTotal += custoParcial
    quantidadeRestante -= quantidadeConsumida
  }

  return {
    item_tipo: 'produto_estoque',
    custo_unitario: quantidade > 0 ? custoTotal / quantidade : 0,
    custo_total: custoTotal,
    preview_consumo: previewConsumo,
    estoque_disponivel: estoqueTotal,
    estoque_suficiente: quantidadeRestante <= 0,
    quantidade_faltante: quantidadeRestante > 0 ? quantidadeRestante : undefined
  }
}
