import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, X } from 'lucide-react'
import { aplicarAtualizacaoPendente } from '@/lib/registerServiceWorker'

export function UpdateAvailableBanner() {
  const [disponivel, setDisponivel] = useState(false)
  const [atualizando, setAtualizando] = useState(false)

  useEffect(() => {
    const handler = () => setDisponivel(true)
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  if (!disponivel || atualizando) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-lg border bg-foreground text-background px-4 py-3 shadow-lg animate-fade-in">
      <span className="text-sm font-medium">Nova versão do Agro GFI disponível</span>
      <Button
        size="sm"
        variant="secondary"
        className="gap-1.5 h-8"
        onClick={() => {
          setAtualizando(true)
          aplicarAtualizacaoPendente()
        }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Atualizar agora
      </Button>
      <button
        onClick={() => setDisponivel(false)}
        className="text-background/70 hover:text-background"
        title="Fechar aviso"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
