import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

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

interface SafraContextType {
  propriedades: Propriedade[]
  safras: Safra[]
  propriedadeSelecionada: Propriedade | null
  safraSelecionada: Safra | null
  loading: boolean

  setPropriedadeSelecionada: (p: Propriedade | null) => void
  setSafraSelecionada: (s: Safra | null) => void
  recarregarPropriedades: () => Promise<void>
  recarregarSafras: (propriedadeId: string) => Promise<void>
}

const SafraContext = createContext<SafraContextType | undefined>(undefined)

const STORAGE_PROP_KEY = 'sga_propriedade_id'
const STORAGE_SAFRA_KEY = 'sga_safra_id'

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function SafraProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [propriedades, setPropriedades] = useState<Propriedade[]>([])
  const [safras, setSafras] = useState<Safra[]>([])
  const [propriedadeSelecionada, setPropriedadeSelecionadaState] =
    useState<Propriedade | null>(null)
  const [safraSelecionada, setSafraSelecionadaState] =
    useState<Safra | null>(null)
  const [loading, setLoading] = useState(true)

  /* ---------- carregar propriedades -------------------------------- */
  const recarregarPropriedades = useCallback(async () => {
    if (!user) {
      setPropriedades([])
      setPropriedadeSelecionadaState(null)
      setSafras([])
      setSafraSelecionadaState(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Propriedades do próprio usuário
      const { data: proprias, error: e1 } = await supabase
        .from('propriedades')
        .select('id, nome, area_total, localizacao, ativo')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('nome')

      if (e1) throw e1

      // Propriedades compartilhadas via propriedades_usuarios
      const { data: compartilhadas, error: e2 } = await supabase
        .from('propriedades_usuarios')
        .select('propriedade_id')
        .eq('usuario_id', user.id)
        .eq('status_convite', 'aceito')

      // Buscar detalhes das compartilhadas (se houver)
      let propCompartilhadas: Propriedade[] = []
      if (!e2 && compartilhadas && compartilhadas.length > 0) {
        const ids = compartilhadas.map((c) => c.propriedade_id)
        const { data: detalhes } = await supabase
          .from('propriedades')
          .select('id, nome, area_total, localizacao, ativo')
          .in('id', ids)
          .eq('ativo', true)
          .order('nome')

        propCompartilhadas = (detalhes || []) as Propriedade[]
      }

      // Mesclar sem duplicatas
      const todasMap = new Map<string, Propriedade>()
      for (const p of [...(proprias || []), ...propCompartilhadas]) {
        todasMap.set(p.id, p as Propriedade)
      }
      const todas = Array.from(todasMap.values()).sort((a, b) =>
        a.nome.localeCompare(b.nome),
      )

      setPropriedades(todas)

      // Restaurar seleção do localStorage
      if (todas.length > 0) {
        const savedId = localStorage.getItem(STORAGE_PROP_KEY)
        const restaurada = todas.find((p) => p.id === savedId) || todas[0]
        setPropriedadeSelecionadaState(restaurada)
      } else {
        setPropriedadeSelecionadaState(null)
        setLoading(false)
      }
    } catch (error) {
      console.error('Erro ao carregar propriedades:', error)
      setLoading(false)
    }
  }, [user])

  /* ---------- carregar safras -------------------------------------- */
  const recarregarSafras = useCallback(
    async (propriedadeId: string) => {
      try {
        const { data, error } = await supabase
          .from('safras')
          .select('id, nome, ano_inicio, ano_fim, ativa, propriedade_id')
          .eq('propriedade_id', propriedadeId)
          .order('ano_inicio', { ascending: false })

        if (error) throw error

        const lista = (data || []) as Safra[]
        setSafras(lista)

        if (lista.length > 0) {
          const savedId = localStorage.getItem(STORAGE_SAFRA_KEY)
          const restaurada =
            lista.find((s) => s.id === savedId) ||
            lista.find((s) => s.ativa) ||
            lista[0]
          setSafraSelecionadaState(restaurada)
          localStorage.setItem(STORAGE_SAFRA_KEY, restaurada.id)
        } else {
          setSafraSelecionadaState(null)
          localStorage.removeItem(STORAGE_SAFRA_KEY)
        }
      } catch (error) {
        console.error('Erro ao carregar safras:', error)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /* ---------- efeitos ---------------------------------------------- */
  useEffect(() => {
    if (user) {
      recarregarPropriedades()
    } else {
      setPropriedades([])
      setPropriedadeSelecionadaState(null)
      setSafras([])
      setSafraSelecionadaState(null)
      setLoading(false)
    }
  }, [user, recarregarPropriedades])

  useEffect(() => {
    if (propriedadeSelecionada) {
      recarregarSafras(propriedadeSelecionada.id)
    } else {
      setSafras([])
      setSafraSelecionadaState(null)
    }
  }, [propriedadeSelecionada, recarregarSafras])

  /* ---------- setters públicos ------------------------------------- */
  const setPropriedadeSelecionada = useCallback(
    (p: Propriedade | null) => {
      setPropriedadeSelecionadaState(p)
      if (p) {
        localStorage.setItem(STORAGE_PROP_KEY, p.id)
      } else {
        localStorage.removeItem(STORAGE_PROP_KEY)
      }
      // Limpar safra ao trocar propriedade
      setSafraSelecionadaState(null)
      localStorage.removeItem(STORAGE_SAFRA_KEY)
    },
    [],
  )

  const setSafraSelecionada = useCallback((s: Safra | null) => {
    setSafraSelecionadaState(s)
    if (s) {
      localStorage.setItem(STORAGE_SAFRA_KEY, s.id)
    } else {
      localStorage.removeItem(STORAGE_SAFRA_KEY)
    }
  }, [])

  /* ---------- value ------------------------------------------------ */
  const value: SafraContextType = {
    propriedades,
    safras,
    propriedadeSelecionada,
    safraSelecionada,
    loading,
    setPropriedadeSelecionada,
    setSafraSelecionada,
    recarregarPropriedades,
    recarregarSafras,
  }

  return (
    <SafraContext.Provider value={value}>{children}</SafraContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useSafraContext() {
  const context = useContext(SafraContext)
  if (!context) {
    throw new Error('useSafraContext must be used inside SafraProvider')
  }
  return context
}
