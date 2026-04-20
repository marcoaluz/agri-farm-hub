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
  latitude: number | null
  longitude: number | null
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

  // Cache de safras por propriedade para troca instantânea
  const [safrasCache, setSafrasCache] = useState<Map<string, Safra[]>>(new Map())

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

      const { data, error } = await supabase
        .from('propriedades')
        .select('id, nome, area_total, localizacao, ativo, latitude, longitude')
        .eq('ativo', true)
        .order('nome')

      if (error) throw error

      const todas = (data || []) as Propriedade[]

      setPropriedades(todas)

      // Pré-carregar safras de TODAS as propriedades em paralelo
      if (todas.length > 0) {
        const safrasPromises = todas.map(async (prop) => {
          const { data } = await supabase
            .from('safras')
            .select('id, nome, ano_inicio, ano_fim, ativa, propriedade_id')
            .eq('propriedade_id', prop.id)
            .order('ano_inicio', { ascending: false })
          return { propId: prop.id, safras: (data || []) as Safra[] }
        })

        const resultados = await Promise.all(safrasPromises)
        const novoCache = new Map<string, Safra[]>()
        for (const r of resultados) {
          novoCache.set(r.propId, r.safras)
        }
        setSafrasCache(novoCache)

        // Restaurar seleção do localStorage
        const savedId = localStorage.getItem(STORAGE_PROP_KEY)
        if (savedId) {
          const restaurada = todas.find((p) => p.id === savedId)
          if (restaurada) {
            setPropriedadeSelecionadaState(restaurada)

            // Já aplicar safras da propriedade restaurada do cache
            const safrasDaProp = novoCache.get(restaurada.id) || []
            setSafras(safrasDaProp)
            if (safrasDaProp.length > 0) {
              const savedSafraId = localStorage.getItem(STORAGE_SAFRA_KEY)
              const safraRestaurada =
                safrasDaProp.find((s) => s.id === savedSafraId) ||
                safrasDaProp.find((s) => s.ativa) ||
                safrasDaProp[0]
              setSafraSelecionadaState(safraRestaurada)
              localStorage.setItem(STORAGE_SAFRA_KEY, safraRestaurada.id)
            } else {
              setSafraSelecionadaState(null)
            }
          } else {
            // savedId não encontrado nas propriedades
            setPropriedadeSelecionadaState(null)
            localStorage.removeItem(STORAGE_PROP_KEY)
          }
        } else {
          // Primeiro acesso: sem seleção = visão geral consolidada
          setPropriedadeSelecionadaState(null)
        }
      } else {
        setPropriedadeSelecionadaState(null)
      }
    } catch (error) {
      console.error('Erro ao carregar propriedades:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  /* ---------- carregar safras (para refresh manual) ----------------- */
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

        // Atualizar cache
        setSafrasCache((prev) => {
          const next = new Map(prev)
          next.set(propriedadeId, lista)
          return next
        })

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
      setSafrasCache(new Map())
      setLoading(false)
    }
  }, [user, recarregarPropriedades])

  /* ---------- setters públicos ------------------------------------- */
  const setPropriedadeSelecionada = useCallback(
    (p: Propriedade | null) => {
      setPropriedadeSelecionadaState(p)
      if (p) {
        localStorage.setItem(STORAGE_PROP_KEY, p.id)
        // Aplicar safras do cache instantaneamente (sem fetch)
        const cached = safrasCache.get(p.id)
        if (cached) {
          setSafras(cached)
          if (cached.length > 0) {
            const savedId = localStorage.getItem(STORAGE_SAFRA_KEY)
            const safraToSelect =
              cached.find((s) => s.id === savedId) ||
              cached.find((s) => s.ativa) ||
              cached[0]
            setSafraSelecionadaState(safraToSelect)
            localStorage.setItem(STORAGE_SAFRA_KEY, safraToSelect.id)
          } else {
            setSafraSelecionadaState(null)
            localStorage.removeItem(STORAGE_SAFRA_KEY)
          }
        } else {
          // Sem cache: buscar do servidor
          setSafras([])
          setSafraSelecionadaState(null)
          localStorage.removeItem(STORAGE_SAFRA_KEY)
          recarregarSafras(p.id)
        }
      } else {
        localStorage.removeItem(STORAGE_PROP_KEY)
        setSafras([])
        setSafraSelecionadaState(null)
        localStorage.removeItem(STORAGE_SAFRA_KEY)
      }
    },
    [safrasCache, recarregarSafras],
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
