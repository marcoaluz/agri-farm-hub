import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { RefreshCw, X } from 'lucide-react'
import { aplicarAtualizacaoPendente } from '@/lib/registerServiceWorker'

export function UpdateAvailableBanner() {
  const [disponivel, setDisponivel] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const location = useLocation()
  const pathnameInicial = useRef(location.pathname)

  useEffect(() => {
    const handler = () => setDisponivel(true)
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  // Assim que o usuário navega pra uma tela diferente (clicou em algo no menu),
  // aplica a atualização pendente sozinho — nesse momento não tem formulário
  // em andamento sendo interrompido, já que a pessoa mesma está saindo da tela.
  useEffect(() => {
    if (disponivel && location.pathname !== pathnameInicial.current) {
      setAtualizando(true)
      aplicarAtualizacaoPendente()
    }
  }, [location.pathname, disponivel])

  if (!disponivel || atualizando) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-full bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg animate-in fade-in slide-in-from-bottom-4">
      <span className="font-medium">Nova versão do Agro GFI disponível</span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 gap-1 rounded-full text-xs"
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
        className="text-primary-foreground/70 hover:text-primary-foreground"
        title="Atualiza sozinho quando eu trocar de tela"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
