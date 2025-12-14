import { Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import Dashboard from '@/pages/Dashboard'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import NotFound from '@/pages/NotFound'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route 
          path="/animals" 
          element={
            <PlaceholderPage 
              title="Gestão de Animais" 
              description="Módulo para cadastro, visualização e gerenciamento de todos os animais do rebanho."
            />
          } 
        />
        <Route 
          path="/lots" 
          element={
            <PlaceholderPage 
              title="Gestão de Lotes" 
              description="Organize e gerencie seus lotes de animais de forma eficiente."
            />
          } 
        />
        <Route 
          path="/health" 
          element={
            <PlaceholderPage 
              title="Saúde Animal" 
              description="Controle de vacinas, tratamentos e exames veterinários."
            />
          } 
        />
        <Route 
          path="/production" 
          element={
            <PlaceholderPage 
              title="Produção" 
              description="Acompanhamento e registro da produção (leite, ovos, lã, etc)."
            />
          } 
        />
        <Route 
          path="/alerts" 
          element={
            <PlaceholderPage 
              title="Alertas" 
              description="Central de notificações e alertas do sistema."
            />
          } 
        />
        <Route 
          path="/users" 
          element={
            <PlaceholderPage 
              title="Usuários" 
              description="Gerenciamento de usuários e permissões do sistema."
            />
          } 
        />
        <Route 
          path="/settings" 
          element={
            <PlaceholderPage 
              title="Configurações" 
              description="Configurações gerais do sistema e preferências."
            />
          } 
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
