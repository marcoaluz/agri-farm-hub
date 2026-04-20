import { useState } from 'react'
import { HeaderGlobal } from './HeaderGlobal'
import { Sidebar } from './Sidebar'
import { Outlet } from 'react-router-dom'
import { AssistenteIA } from '@/components/assistente/AssistenteIA'
import { SafraFechadaBanner } from '@/components/safras/SafraFechadaBanner'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <HeaderGlobal onMenuClick={() => setSidebarOpen(true)} />
        <SafraFechadaBanner />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <div className="p-3 sm:p-6 max-w-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <AssistenteIA />
    </div>
  )
}
