import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { Propriedade, Safra } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'

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

const GlobalContext = createContext<GlobalContextType | undefined>(undefined)

export function GlobalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [propriedadeAtual, setPropriedadeAtualState] = useState<Propriedade | null>(null)
  const [safraAtual, setSafraAtualState] = useState<Safra | null>(null)
  const [propriedades, setPropriedades] = useState<Propriedade[]>([])
  const [safras, setSafras] = useState<Safra[]>([])
  const [loading, setLoading] = useState(true)

  // Carregar propriedades do usuário
  const fetchPropriedades = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('propriedades')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('nome')

      if (error) throw error

      const propriedadesData = (data || []) as Propriedade[]
      setPropriedades(propriedadesData)

      // Se não houver propriedade selecionada, selecionar a primeira
      if (propriedadesData.length > 0) {
        const savedPropId = localStorage.getItem('sga_propriedade_id')
        const propToSelect = propriedadesData.find(p => p.id === savedPropId) || propriedadesData[0]
        setPropriedadeAtualState(propToSelect)
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Erro ao carregar propriedades:', error)
      setLoading(false)
    }
  }, [user])

  // Carregar safras da propriedade atual
  const fetchSafras = useCallback(async () => {
    if (!propriedadeAtual) {
      setSafras([])
      setSafraAtualState(null)
      return
    }

    try {
      const { data, error } = await supabase
        .from('safras')
        .select('*')
        .eq('propriedade_id', propriedadeAtual.id)
        .order('ano_inicio', { ascending: false })

      if (error) throw error

      const safrasData = (data || []) as Safra[]
      setSafras(safrasData)

      // Se não houver safra selecionada, selecionar a ativa ou primeira
      if (safrasData.length > 0) {
        const savedSafraId = localStorage.getItem('sga_safra_id')
        const safraToSelect = 
          safrasData.find(s => s.id === savedSafraId) ||
          safrasData.find(s => s.ativa) || 
          safrasData[0]
        setSafraAtualState(safraToSelect)
      } else {
        setSafraAtualState(null)
      }
    } catch (error) {
      console.error('Erro ao carregar safras:', error)
    } finally {
      setLoading(false)
    }
  }, [propriedadeAtual])

  // Efeito para carregar propriedades quando o usuário mudar
  useEffect(() => {
    if (user) {
      fetchPropriedades()
    } else {
      setPropriedades([])
      setPropriedadeAtualState(null)
      setSafras([])
      setSafraAtualState(null)
      setLoading(false)
    }
  }, [user, fetchPropriedades])

  // Efeito para carregar safras quando a propriedade mudar
  useEffect(() => {
    fetchSafras()
  }, [propriedadeAtual, fetchSafras])

  const setPropriedadeAtual = useCallback((propriedade: Propriedade) => {
    setPropriedadeAtualState(propriedade)
    localStorage.setItem('sga_propriedade_id', propriedade.id)
    // Limpar safra ao mudar propriedade
    setSafraAtualState(null)
    localStorage.removeItem('sga_safra_id')
  }, [])

  const setSafraAtual = useCallback((safra: Safra) => {
    setSafraAtualState(safra)
    localStorage.setItem('sga_safra_id', safra.id)
  }, [])

  const value = {
    propriedadeAtual,
    safraAtual,
    propriedades,
    safras,
    setPropriedadeAtual,
    setSafraAtual,
    loading,
    refetchPropriedades: fetchPropriedades,
    refetchSafras: fetchSafras,
  }

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>
}

export function useGlobal() {
  const context = useContext(GlobalContext)
  if (context === undefined) {
    throw new Error('useGlobal must be used within a GlobalProvider')
  }
  return context
}
