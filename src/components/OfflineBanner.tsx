import { useIsOffline } from '@/hooks/useIsOffline'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const offline = useIsOffline()

  if (!offline) return null

  return (
    <div className="w-full flex-shrink-0 bg-amber-500 text-amber-950 text-sm font-medium py-1.5 px-4 flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      Sem conexão — mostrando os últimos dados salvos. Criar, editar ou excluir fica bloqueado até voltar o sinal.
    </div>
  )
}
