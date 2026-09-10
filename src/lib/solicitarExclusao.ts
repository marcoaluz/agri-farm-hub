import { supabase } from '@/lib/supabase'

export type TipoEntidadeExclusao = 'propriedade' | 'maquina' | 'rebanho'

export interface ResultadoSolicitacaoExclusao {
  executado: boolean
  mensagem?: string
}

/**
 * Solicita a exclusão de uma entidade.
 * Se o usuário tiver permissão, a exclusão acontece na hora (executado = true).
 * Caso contrário, fica registrado um pedido aguardando aprovação (executado = false).
 */
export async function solicitarExclusaoEntidade(
  tipo: TipoEntidadeExclusao,
  entidadeId: string,
  motivo?: string | null
): Promise<ResultadoSolicitacaoExclusao> {
  const { data, error } = await supabase.rpc('solicitar_exclusao_entidade' as any, {
    p_tipo: tipo,
    p_entidade_id: entidadeId,
    p_motivo: motivo?.trim() ? motivo.trim() : null,
  })

  if (error) throw new Error(error.message)

  const resultado = (Array.isArray(data) ? data[0] : data) as any
  return {
    executado: resultado?.executado === true,
    mensagem: resultado?.mensagem ?? undefined,
  }
}
