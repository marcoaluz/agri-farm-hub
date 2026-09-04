import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  useEffect(() => {
    const onOffline = () => setOffline(true)
    const onOnline = () => setOffline(false)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-amber-950 text-sm font-medium py-1.5 px-4 flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      Sem conexão — mostrando os últimos dados salvos. Criar, editar ou excluir fica bloqueado até voltar o sinal.
    </div>
  )
}
