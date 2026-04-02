import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { SafraProvider } from '@/contexts/SafraContext'

// Páginas de autenticação
import { LoginPage } from '@/pages/auth/Login'
import { CadastroPage } from '@/pages/auth/Cadastro'
import { RecuperarSenhaPage } from '@/pages/auth/RecuperarSenha'

// Páginas protegidas
import Dashboard from '@/pages/Dashboard'
import { Propriedades } from '@/pages/Propriedades'
import { SafrasPage } from '@/pages/Safras'
import { Talhoes } from '@/pages/Talhoes'
import { Estoque } from '@/pages/Estoque'

import { Servicos } from '@/pages/Servicos'
import { Lancamentos } from '@/pages/Lancamentos'
import { LancamentoForm } from '@/pages/LancamentoForm'
import { Maquinas } from '@/pages/Maquinas'
import Pecuaria from '@/pages/Pecuaria'
import { Financeiro } from '@/pages/Financeiro'
import { Relatorios } from '@/pages/Relatorios'
import { Configuracoes } from '@/pages/Configuracoes'
import Auditoria from '@/pages/Auditoria'
import AdminDashboard from '@/pages/admin/Dashboard'
import GestaoUsuarios from '@/pages/admin/GestaoUsuarios'
import ModulosPropriedades from '@/pages/admin/ModulosPropriedades'
import Perfil from '@/pages/Perfil'
import Notificacoes from '@/pages/Notificacoes'
import NotFound from '@/pages/NotFound'

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
        path="/login" 
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } 
      />
      <Route 
        path="/signup" 
        element={
          <PublicRoute>
            <CadastroPage />
          </PublicRoute>
        } 
      />
      <Route 
        path="/cadastro" 
        element={
          <PublicRoute>
            <CadastroPage />
          </PublicRoute>
        } 
      />
      
      {/* Recuperar senha */}
      <Route 
        path="/esqueci-senha" 
        element={
          <PublicRoute>
            <RecuperarSenhaPage />
          </PublicRoute>
        }
      />
      <Route 
        path="/recuperar-senha" 
        element={
          <PublicRoute>
            <RecuperarSenhaPage />
          </PublicRoute>
        }
      />
      
      {/* Redirect /auth to /login */}
      <Route path="/auth" element={<Navigate to="/login" />} />
      
      {/* Rotas protegidas */}
      <Route
        path="/"
        element={
           <ProtectedRoute>
            <SafraProvider>
              <Layout />
            </SafraProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="propriedades" element={<Propriedades />} />
        <Route path="safras" element={<SafrasPage />} />
        <Route path="talhoes" element={<Talhoes />} />
        <Route path="estoque" element={<Estoque />} />
        
        <Route path="servicos" element={<Servicos />} />
        <Route path="lancamentos" element={<Lancamentos />} />
        <Route path="lancamentos/novo" element={<LancamentoForm />} />
        <Route path="lancamentos/:id" element={<LancamentoForm />} />
        <Route path="maquinas" element={<Maquinas />} />
        <Route path="pecuaria" element={<Pecuaria />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="notificacoes" element={<Notificacoes />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/usuarios" element={<GestaoUsuarios />} />
      </Route>

      {/* Página não encontrada */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
