import { useState } from 'react'
import { HeaderGlobal } from './HeaderGlobal'
import { Sidebar } from './Sidebar'
import { Outlet } from 'react-router-dom'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <HeaderGlobal onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3 sm:p-6 max-w-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
