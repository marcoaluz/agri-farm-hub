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
  item_tipo: 'produto_estoque' | 'servico' | 'maquina_hora' | 'produto' | 'maquina' | 'servico_simples'
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

// Hook legado (mantido para compatibilidade)
export function usePreviewCusto(itemId: string | undefined, quantidade: number) {
  const debouncedQuantidade = useDebounce(quantidade, 500)

  return useQuery({
    queryKey: ['preview-custo', itemId, debouncedQuantidade],
    queryFn: async (): Promise<PreviewResponse | null> => {
      if (!itemId || debouncedQuantidade <= 0) {
        return null
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('preview_custo_item', {
        p_item_id: itemId,
        p_quantidade: debouncedQuantidade
      })

      if (!rpcError && rpcData) {
        return rpcData as PreviewResponse
      }

      console.log('RPC não disponível, usando cálculo local:', rpcError?.message)
      return calcularPreviewLocal(itemId, debouncedQuantidade)
    },
    enabled: !!itemId && debouncedQuantidade > 0,
    staleTime: 0,
    gcTime: 1000 * 60 * 5
  })
}

// === NOVO HOOK: Preview por referência direta ===
export function usePreviewCustoDireto(
  tipoRef: 'produto' | 'maquina' | 'servico_simples' | undefined,
  produtoId: string | null | undefined,
  maquinaId: string | null | undefined,
  servicoRefId: string | null | undefined,
  quantidade: number,
  custoDireto?: number // custo_hora ou custo_padrao já conhecido
) {
  const debouncedQuantidade = useDebounce(quantidade, 500)

  return useQuery({
    queryKey: ['preview-custo-direto', tipoRef, produtoId, maquinaId, servicoRefId, debouncedQuantidade],
    queryFn: async (): Promise<PreviewResponse | null> => {
      if (!tipoRef || debouncedQuantidade <= 0) return null

      if (tipoRef === 'produto' && produtoId) {
        return calcularPreviewProduto(produtoId, debouncedQuantidade)
      }

      if (tipoRef === 'maquina') {
        let custoHora = custoDireto || 0
        if (!custoHora && maquinaId) {
          const { data } = await supabase
            .from('maquinas')
            .select('custo_hora')
            .eq('id', maquinaId)
            .single()
          custoHora = data?.custo_hora || 0
        }
        return {
          item_tipo: 'maquina',
          custo_unitario: custoHora,
          custo_total: custoHora * debouncedQuantidade,
          estoque_suficiente: true
        }
      }

      if (tipoRef === 'servico_simples') {
        let custoPadrao = custoDireto || 0
        if (!custoPadrao && servicoRefId) {
          const { data } = await supabase
            .from('servicos')
            .select('custo_padrao')
            .eq('id', servicoRefId)
            .single()
          custoPadrao = data?.custo_padrao || 0
        }
        return {
          item_tipo: 'servico_simples',
          custo_unitario: custoPadrao,
          custo_total: custoPadrao * debouncedQuantidade,
          estoque_suficiente: true
        }
      }

      return null
    },
    enabled: !!tipoRef && debouncedQuantidade > 0,
    staleTime: 0,
    gcTime: 1000 * 60 * 5
  })
}

// Preview FIFO direto com produto_id
async function calcularPreviewProduto(produtoId: string, quantidade: number): Promise<PreviewResponse> {
  const { data: lotes, error } = await supabase
    .from('lotes')
    .select('id, nota_fiscal, quantidade_disponivel, custo_unitario, data_entrada')
    .eq('produto_id', produtoId)
    .gt('quantidade_disponivel', 0)
    .order('data_entrada', { ascending: true })

  if (error) throw error

  let quantidadeRestante = quantidade
  let custoTotal = 0
  const previewConsumo: PreviewConsumoLote[] = []
  let estoqueTotal = 0

  for (const lote of lotes || []) {
    estoqueTotal += lote.quantidade_disponivel
    if (quantidadeRestante <= 0) continue

    const quantidadeConsumida = Math.min(quantidadeRestante, lote.quantidade_disponivel)
    const custoParcial = quantidadeConsumida * lote.custo_unitario

    previewConsumo.push({
      lote_id: lote.id,
      lote_codigo: lote.id.substring(0, 8),
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
    item_tipo: 'produto',
    custo_unitario: quantidade > 0 ? custoTotal / quantidade : 0,
    custo_total: custoTotal,
    preview_consumo: previewConsumo,
    estoque_disponivel: estoqueTotal,
    estoque_suficiente: quantidadeRestante <= 0,
    quantidade_faltante: quantidadeRestante > 0 ? quantidadeRestante : undefined
  }
}

// Função legada de fallback
async function calcularPreviewLocal(itemId: string, quantidade: number): Promise<PreviewResponse | null> {
  const { data: item } = await supabase
    .from('itens')
    .select('tipo, custo_padrao, produto_id, maquina_id')
    .eq('id', itemId)
    .maybeSingle()

  if (!item) return null

  if (item.tipo !== 'produto_estoque') {
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
    
    const custoUnitario = item.custo_padrao || 0
    return {
      item_tipo: item.tipo as PreviewResponse['item_tipo'],
      custo_unitario: custoUnitario,
      custo_total: custoUnitario * quantidade,
      estoque_disponivel: Infinity,
      estoque_suficiente: true
    }
  }

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

  return calcularPreviewProduto(item.produto_id, quantidade)
}
