import { supabase } from '@/lib/supabase'

export interface LoteConsumido {
  lote_id: string
  quantidade_consumida: number
  custo_unitario: number
  custo_parcial: number
}

export interface ResultadoConsumoFIFO {
  custoTotal: number
  detalhamento: LoteConsumido[]
}

/** Consome quantidade de um produto pelos lotes mais antigos primeiro (FIFO), deduzindo o saldo disponível de cada lote. */
export async function consumirFIFO(produtoId: string, quantidade: number): Promise<ResultadoConsumoFIFO> {
  const { data: lotes, error } = await supabase
    .from('lotes')
    .select('id, quantidade_disponivel, custo_unitario, data_entrada')
    .eq('produto_id', produtoId)
    .gt('quantidade_disponivel', 0)
    .order('data_entrada', { ascending: true })

  if (error) throw error

  let restante = quantidade
  let custoTotal = 0
  const detalhamento: LoteConsumido[] = []

  for (const lote of lotes || []) {
    if (restante <= 0) break
    const consumida = Math.min(restante, Number(lote.quantidade_disponivel))
    const parcial = consumida * Number(lote.custo_unitario)
    detalhamento.push({
      lote_id: lote.id,
      quantidade_consumida: consumida,
      custo_unitario: Number(lote.custo_unitario),
      custo_parcial: parcial,
    })
    custoTotal += parcial
    restante -= consumida
  }

  if (restante > 0.0001) {
    throw new Error(`Estoque insuficiente. Faltam ${restante.toFixed(2)} unidade(s).`)
  }

  for (const d of detalhamento) {
    const lote = (lotes || []).find(l => l.id === d.lote_id)!
    await supabase
      .from('lotes')
      .update({ quantidade_disponivel: Number(lote.quantidade_disponivel) - d.quantidade_consumida })
      .eq('id', d.lote_id)
  }

  return { custoTotal, detalhamento }
}

/** Devolve ao estoque as quantidades registradas em um detalhamento de consumo FIFO anterior (usado ao cancelar/excluir). */
export async function restaurarFIFO(detalhamento: LoteConsumido[] | null | undefined) {
  if (!detalhamento || !Array.isArray(detalhamento) || detalhamento.length === 0) return
  for (const d of detalhamento) {
    const { data: lote } = await supabase
      .from('lotes')
      .select('quantidade_disponivel')
      .eq('id', d.lote_id)
      .single()
    if (lote) {
      await supabase
        .from('lotes')
        .update({ quantidade_disponivel: Number(lote.quantidade_disponivel) + d.quantidade_consumida })
        .eq('id', d.lote_id)
    }
  }
}
