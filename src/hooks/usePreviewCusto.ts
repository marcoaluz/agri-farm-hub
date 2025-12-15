import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface LoteConsumo {
  lote_id: string
  lote_codigo: string
  quantidade_consumida: number
  custo_unitario: number
  custo_parcial: number
  data_entrada: string
}

export interface PreviewCusto {
  custo_unitario: number
  custo_total: number
  preview_consumo: LoteConsumo[]
  estoque_disponivel: number
  estoque_suficiente: boolean
}

export function usePreviewCusto(itemId: string | undefined, quantidade: number) {
  return useQuery({
    queryKey: ['preview-custo', itemId, quantidade],
    queryFn: async (): Promise<PreviewCusto | null> => {
      if (!itemId || quantidade <= 0) return null

      // Buscar item para verificar tipo
      const { data: item } = await supabase
        .from('itens')
        .select('tipo, custo_unitario')
        .eq('id', itemId)
        .maybeSingle()

      if (!item) return null

      // Se não for produto de estoque, usar custo unitário direto
      if (item.tipo !== 'produto_estoque') {
        const custoUnitario = item.custo_unitario || 0
        return {
          custo_unitario: custoUnitario,
          custo_total: custoUnitario * quantidade,
          preview_consumo: [],
          estoque_disponivel: Infinity,
          estoque_suficiente: true
        }
      }

      // Buscar lotes disponíveis usando FIFO (ordenados por data de entrada)
      const { data: lotes, error } = await supabase
        .from('lotes')
        .select('id, codigo, quantidade_disponivel, custo_unitario, data_entrada')
        .eq('item_id', itemId)
        .gt('quantidade_disponivel', 0)
        .order('data_entrada', { ascending: true })

      if (error) throw error

      // Calcular preview de consumo FIFO
      let quantidadeRestante = quantidade
      let custoTotal = 0
      const previewConsumo: LoteConsumo[] = []
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
          lote_codigo: lote.codigo,
          quantidade_consumida: quantidadeConsumida,
          custo_unitario: lote.custo_unitario,
          custo_parcial: custoParcial,
          data_entrada: lote.data_entrada
        })

        custoTotal += custoParcial
        quantidadeRestante -= quantidadeConsumida
      }

      return {
        custo_unitario: quantidade > 0 ? custoTotal / quantidade : 0,
        custo_total: custoTotal,
        preview_consumo: previewConsumo,
        estoque_disponivel: estoqueTotal,
        estoque_suficiente: quantidadeRestante <= 0
      }
    },
    enabled: !!itemId && quantidade > 0,
    staleTime: 5000 // Cache por 5 segundos para evitar muitas requisições
  })
}
