import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'

// Páginas
import { AuthPage } from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import { Propriedades } from '@/pages/Propriedades'
import { Talhoes } from '@/pages/Talhoes'
import { Estoque } from '@/pages/Estoque'
import { Itens } from '@/pages/Itens'
import { Servicos } from '@/pages/Servicos'
import { Lancamentos } from '@/pages/Lancamentos'
import { Maquinas } from '@/pages/Maquinas'
import { Financeiro } from '@/pages/Financeiro'
import { Relatorios } from '@/pages/Relatorios'
import { Configuracoes } from '@/pages/Configuracoes'
import NotFound from '@/pages/NotFound'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/auth" />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  return user ? <Navigate to="/" /> : <>{children}</>
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Rotas públicas */}
      <Route 
        path="/auth" 
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        } 
      />
      
      {/* Rotas protegidas */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="propriedades" element={<Propriedades />} />
        <Route path="talhoes" element={<Talhoes />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="itens" element={<Itens />} />
        <Route path="servicos" element={<Servicos />} />
        <Route path="lancamentos" element={<Lancamentos />} />
        <Route path="maquinas" element={<Maquinas />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>

      {/* Página não encontrada */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
