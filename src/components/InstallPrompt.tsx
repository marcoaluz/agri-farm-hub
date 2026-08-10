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

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    const dismissed =
      localStorage.getItem('pwa-install-dismissed') || localStorage.getItem('ios-install-dismissed')
    if (isStandalone || dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    let timer: ReturnType<typeof setTimeout> | undefined
    if (ios) {
      timer = setTimeout(() => setShowBanner(true), 3000)
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
    if (isIOS) localStorage.setItem('ios-install-dismissed', 'true')
  }

  if (!showBanner) return null

  if (isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-4 shadow-lg safe-area-bottom animate-slide-up">
        <div className="mx-auto flex max-w-lg items-start gap-3">
          <img src="/pwa-192x192.png" alt="Agro GFI" className="h-12 w-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Instalar Agro GFI</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Toque em
              <span className="mx-1 inline-flex items-center align-middle text-info">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </span>
              e depois <strong>"Adicionar à Tela de Início"</strong>
            </p>
          </div>
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

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Instalar Agro GFI</p>
          <p className="mt-1 text-xs text-muted-foreground">Acesse como app direto do seu celular.</p>
        </div>

        <Button size="sm" onClick={handleInstall} className="shrink-0 gap-1.5">
          <Download className="h-4 w-4" />
          Instalar
        </Button>

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

