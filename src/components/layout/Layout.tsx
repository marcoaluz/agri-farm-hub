import { useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Outlet } from 'react-router-dom'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background max-w-[100vw] overflow-x-hidden">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      
      <div className="flex w-full overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="p-3 sm:p-6 w-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
