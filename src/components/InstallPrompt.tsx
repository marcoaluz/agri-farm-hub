import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    setIsIOS(ios)

    const dismissed = localStorage.getItem('pwa-install-dismissed')
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone || dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    let timer: ReturnType<typeof setTimeout> | undefined
    if (ios) {
      timer = setTimeout(() => setShowBanner(true), 5000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShowBanner(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Instalar Agro GFI</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isIOS
              ? 'Toque em Compartilhar (ícone ↑) e depois em "Adicionar à Tela de Início".'
              : 'Acesse como app direto do seu celular.'}
          </p>
        </div>

        {!isIOS && (
          <Button size="sm" onClick={handleInstall} className="shrink-0 gap-1.5">
            <Download className="h-4 w-4" />
            Instalar
          </Button>
        )}

        <Button
          size="icon"
          variant="ghost"
          onClick={handleDismiss}
          aria-label="Dispensar"
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
