import { toast } from 'sonner'
import { useSafraContext } from '@/contexts/SafraContext'

/**
 * Verificação global de safra fechada.
 * Use `verificarSafra('criar lançamento')` antes de qualquer criação/edição.
 * Se `safra` não for informada, usa a safra selecionada no contexto.
 */
export function useSafraFechada(safra?: any) {
  const ctx = useSafraContext()
  const safraAtiva = safra !== undefined ? safra : ctx.safraSelecionada

  const isFechada = (safraAtiva as any)?.fechada === true

  const verificarSafra = (acao?: string) => {
    if (isFechada) {
      toast.error(
        `Safra ${(safraAtiva as any)?.nome ?? ''} está fechada.${
          acao ? ` Não é possível ${acao}.` : ''
        } Reabra a safra para continuar.`
      )
      return false
    }
    return true
  }

  return { isFechada, verificarSafra, safraAtiva }
}
