import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Lancamento } from '@/types/supabase-local'
import { toast } from 'sonner'

export function useLancamentos(safraId?: string) {
  return useQuery({
    queryKey: ['lancamentos', safraId],
    queryFn: async () => {
      if (!safraId) return []

      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          *,
          servico:servicos(*),
          talhao:talhoes(*),
          lancamentos_itens(
            *,
            item:itens(*)
          )
        `)
        .eq('safra_id', safraId)
        .order('data_execucao', { ascending: false })

      if (error) throw error
      return data as Lancamento[]
    },
    enabled: !!safraId,
  })
}

export function useLancamento(id?: string) {
  return useQuery({
    queryKey: ['lancamento', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          *,
          servico:servicos(*),
          talhao:talhoes(*),
          lancamentos_itens(
            *,
            item:itens(*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Lancamento
    },
    enabled: !!id,
  })
}

export function useSolicitarExclusao() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      lancamentoId, 
      motivo,
      usuarioId 
    }: { 
      lancamentoId: string
      motivo: string
      usuarioId: string
    }) => {
      // Criar notificação para o proprietário aprovar
      const { data: lancamento, error: lancError } = await supabase
        .from('lancamentos')
        .select('propriedade_id, servico_id, data_execucao, custo_total')
        .eq('id', lancamentoId)
        .single()

      if (lancError) throw lancError

      // Buscar o serviço
      const { data: servico } = await supabase
        .from('servicos')
        .select('nome')
        .eq('id', lancamento.servico_id)
        .single()

      // Buscar o proprietário da propriedade
      const { data: propriedade, error: propError } = await supabase
        .from('propriedades')
        .select('user_id, nome')
        .eq('id', lancamento.propriedade_id)
        .single()

      if (propError) throw propError

      // Criar notificação de solicitação de exclusão
      const { error } = await supabase
        .from('notificacoes')
        .insert({
          usuario_id: propriedade.user_id,
          tipo: 'solicitacao_exclusao',
          titulo: 'Solicitação de Exclusão de Lançamento',
          mensagem: `Solicitação para excluir o lançamento "${servico?.nome || 'Serviço'}" de ${new Date(lancamento.data_execucao).toLocaleDateString('pt-BR')} (R$ ${lancamento.custo_total?.toFixed(2)}). Motivo: ${motivo}`,
          dados: {
            lancamento_id: lancamentoId,
            solicitado_por: usuarioId,
            motivo,
            tipo_acao: 'exclusao'
          },
          link_acao: `/lancamentos/${lancamentoId}`
        })

      if (error) throw error
      return { success: true }
    },
    onSuccess: () => {
      toast.success('Solicitação de exclusão enviada para aprovação do proprietário')
    },
    onError: (error) => {
      console.error('Erro ao solicitar exclusão:', error)
      toast.error('Erro ao enviar solicitação de exclusão')
    }
  })
}

export function useSolicitarEdicao() {
  return useMutation({
    mutationFn: async ({ 
      lancamentoId, 
      motivo,
      usuarioId 
    }: { 
      lancamentoId: string
      motivo: string
      usuarioId: string
    }) => {
      // Buscar dados do lançamento
      const { data: lancamento, error: lancError } = await supabase
        .from('lancamentos')
        .select('propriedade_id, servico_id, data_execucao, custo_total')
        .eq('id', lancamentoId)
        .single()

      if (lancError) throw lancError

      // Buscar o serviço
      const { data: servico } = await supabase
        .from('servicos')
        .select('nome')
        .eq('id', lancamento.servico_id)
        .single()

      // Buscar o proprietário
      const { data: propriedade, error: propError } = await supabase
        .from('propriedades')
        .select('user_id, nome')
        .eq('id', lancamento.propriedade_id)
        .single()

      if (propError) throw propError

      // Criar notificação de solicitação de edição
      const { error } = await supabase
        .from('notificacoes')
        .insert({
          usuario_id: propriedade.user_id,
          tipo: 'solicitacao_edicao',
          titulo: 'Solicitação de Edição de Lançamento',
          mensagem: `Solicitação para editar o lançamento "${servico?.nome || 'Serviço'}" de ${new Date(lancamento.data_execucao).toLocaleDateString('pt-BR')}. Motivo: ${motivo}`,
          dados: {
            lancamento_id: lancamentoId,
            solicitado_por: usuarioId,
            motivo,
            tipo_acao: 'edicao'
          },
          link_acao: `/lancamentos/${lancamentoId}`
        })

      if (error) throw error
      return { success: true }
    },
    onSuccess: () => {
      toast.success('Solicitação de edição enviada para aprovação do proprietário')
    },
    onError: (error) => {
      console.error('Erro ao solicitar edição:', error)
      toast.error('Erro ao enviar solicitação de edição')
    }
  })
}

export function useExcluirLancamento() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (lancamentoId: string) => {
      console.log('🗑️ Iniciando exclusão do lançamento:', lancamentoId)

      // ETAPA 1: BUSCAR ITENS DO LANÇAMENTO
      const { data: itensLancamento, error: fetchError } = await supabase
        .from('lancamentos_itens')
        .select(`
          id,
          item_id,
          quantidade,
          detalhamento_lotes,
          item:itens(tipo, produto_id)
        `)
        .eq('lancamento_id', lancamentoId)

      if (fetchError) {
        console.error('❌ Erro ao buscar itens:', fetchError)
        throw fetchError
      }

      console.log('📦 Itens encontrados:', itensLancamento?.length)

      // ETAPA 2: RESTAURAR ESTOQUE NOS LOTES
      for (const itemLanc of itensLancamento || []) {
        const item = itemLanc.item as any

        if (item?.tipo !== 'produto_estoque') {
          console.log(`⏭️ Item ${itemLanc.item_id} não é produto_estoque, pulando...`)
          continue
        }

        const detalhamento = itemLanc.detalhamento_lotes as any[]

        if (!detalhamento || !Array.isArray(detalhamento)) {
          console.warn(`⚠️ Item ${itemLanc.item_id} sem detalhamento de lotes`)
          continue
        }

        console.log(`🔄 Restaurando ${detalhamento.length} lotes do item ${itemLanc.item_id}`)

        for (const lote of detalhamento) {
          const quantidadeConsumida = lote.quantidade_consumida || lote.quantidade || 0

          if (quantidadeConsumida <= 0 || !lote.lote_id) {
            console.warn('⚠️ Lote inválido:', lote)
            continue
          }

          const { data: loteAtual, error: loteError } = await supabase
            .from('lotes')
            .select('quantidade_disponivel')
            .eq('id', lote.lote_id)
            .single()

          if (loteError || !loteAtual) {
            console.error('❌ Erro ao buscar lote:', lote.lote_id, loteError)
            continue
          }

          const novaQuantidade = (loteAtual.quantidade_disponivel || 0) + quantidadeConsumida
          console.log(`📈 Lote ${lote.lote_id}: ${loteAtual.quantidade_disponivel} + ${quantidadeConsumida} = ${novaQuantidade}`)

          const { error: updateError } = await supabase
            .from('lotes')
            .update({ quantidade_disponivel: novaQuantidade })
            .eq('id', lote.lote_id)

          if (updateError) {
            console.error('❌ Erro ao restaurar lote:', lote.lote_id, updateError)
            throw updateError
          }

          console.log(`✅ Lote ${lote.lote_id} restaurado com sucesso!`)
        }
      }

      // ETAPA 3: EXCLUIR ITENS DO LANÇAMENTO
      console.log('🗑️ Excluindo itens do lançamento...')
      const { error: itensError } = await supabase
        .from('lancamentos_itens')
        .delete()
        .eq('lancamento_id', lancamentoId)

      if (itensError) {
        console.error('❌ Erro ao excluir itens:', itensError)
        throw itensError
      }

      // ETAPA 4: EXCLUIR O LANÇAMENTO
      console.log('🗑️ Excluindo lançamento...')
      const { error } = await supabase
        .from('lancamentos')
        .delete()
        .eq('id', lancamentoId)

      if (error) {
        console.error('❌ Erro ao excluir lançamento:', error)
        throw error
      }

      console.log('✅ Lançamento excluído com sucesso!')
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['preview-custo'] })
      toast.success('Lançamento excluído e estoque restaurado com sucesso!')
    },
    onError: (error) => {
      console.error('❌ Erro ao excluir lançamento:', error)
      toast.error('Erro ao excluir lançamento. Tente novamente.')
    }
  })
}
