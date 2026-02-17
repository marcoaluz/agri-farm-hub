import { useState } from 'react'
import { HeaderGlobal } from './HeaderGlobal'
import { Sidebar } from './Sidebar'
import { Outlet } from 'react-router-dom'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <HeaderGlobal onMenuClick={() => setSidebarOpen(true)} />
      
      <div className="flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <div className="p-3 sm:p-6 max-w-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
