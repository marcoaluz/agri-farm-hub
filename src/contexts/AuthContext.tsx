import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

type UserStatus = 'pendente' | 'ativo' | 'inativo' | null

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  userStatus: UserStatus
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userStatus, setUserStatus] = useState<UserStatus>(null)
  const { toast } = useToast()
  const navigate = useNavigate()

  const fetchUserStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('status')
        .eq('id', userId)
        .single()

      if (error || !data) {
        setUserStatus(null)
        return
      }
      setUserStatus((data.status as UserStatus) || 'ativo')
    } catch {
      setUserStatus(null)
    }
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserStatus(session.user.id)
      } else {
        setUserStatus(null)
      }
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserStatus(session.user.id)
      } else {
        setUserStatus(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast({
        title: 'Login realizado com sucesso!',
        description: `Bem-vindo de volta, ${data.user.email}`,
      })

      navigate('/')
    } catch (error) {
      const authError = error as AuthError
      toast({
        title: 'Erro ao fazer login',
        description: authError.message,
        variant: 'destructive',
      })
      throw error
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
          emailRedirectTo: redirectUrl,
        },
      })

      if (error) throw error

      toast({
        title: 'Cadastro realizado!',
        description: 'Verifique seu email para confirmar a conta.',
      })

      navigate('/login')
    } catch (error) {
      const authError = error as AuthError
      toast({
        title: 'Erro ao criar conta',
        description: authError.message,
        variant: 'destructive',
      })
      throw error
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error && !error.message?.includes('session missing')) throw error

      setUser(null)
      setSession(null)
      setUserStatus(null)

      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      })

      navigate('/login')
    } catch (error) {
      const authError = error as AuthError
      toast({
        title: 'Erro ao sair',
        description: authError.message,
        variant: 'destructive',
      })
      navigate('/login')
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      toast({
        title: 'Email enviado!',
        description: 'Verifique sua caixa de entrada para redefinir a senha.',
      })
    } catch (error) {
      const authError = error as AuthError
      toast({
        title: 'Erro ao enviar email',
        description: authError.message,
        variant: 'destructive',
      })
      throw error
    }
  }

  const value = {
    user,
    session,
    loading,
    userStatus,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
