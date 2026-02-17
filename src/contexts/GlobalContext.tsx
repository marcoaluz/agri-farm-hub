/**
 * GlobalContext agora é um adapter fino sobre o SafraContext.
 * Todas as páginas que usam useGlobal() recebem os dados do SafraContext,
 * garantindo sincronização instantânea com o Header.
 */

import { useSafraContext } from './SafraContext'

interface Propriedade {
  id: string
  nome: string
  area_total: number | null
  localizacao: string | null
  ativo: boolean
}

interface Safra {
  id: string
  nome: string
  ano_inicio: number
  ano_fim: number | null
  ativa: boolean
  propriedade_id: string
}

interface GlobalContextType {
  propriedadeAtual: Propriedade | null
  safraAtual: Safra | null
  propriedades: Propriedade[]
  safras: Safra[]
  setPropriedadeAtual: (propriedade: Propriedade) => void
  setSafraAtual: (safra: Safra) => void
  loading: boolean
  refetchPropriedades: () => Promise<void>
  refetchSafras: () => Promise<void>
}

export function useGlobal(): GlobalContextType {
  const ctx = useSafraContext()

  return {
    propriedadeAtual: ctx.propriedadeSelecionada,
    safraAtual: ctx.safraSelecionada,
    propriedades: ctx.propriedades as Propriedade[],
    safras: ctx.safras as Safra[],
    setPropriedadeAtual: ctx.setPropriedadeSelecionada as (p: Propriedade) => void,
    setSafraAtual: ctx.setSafraSelecionada as (s: Safra) => void,
    loading: ctx.loading,
    refetchPropriedades: ctx.recarregarPropriedades,
    refetchSafras: async () => {
      if (ctx.propriedadeSelecionada) {
        await ctx.recarregarSafras(ctx.propriedadeSelecionada.id)
      }
    },
  }
}

// Manter export do GlobalProvider como no-op para não quebrar App.tsx
export function GlobalProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
