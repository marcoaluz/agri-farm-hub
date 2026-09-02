import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { statusInscricaoPush, ativarPushNotifications } from '@/lib/pushNotifications'

/**
 * Se o usuário já concedeu permissão de notificação antes, mas o navegador
 * "perdeu" a inscrição (comum depois de atualizações do Service Worker),
 * reconecta sozinho — sem pedir permissão de novo (o navegador já sabe que
 * foi autorizado, então isso não mostra nenhum popup pro usuário).
 */
export function PushAutoReconnect() {
  const { user } = useAuth()
  const jaTentou = useRef(false)

  useEffect(() => {
    if (!user?.id || jaTentou.current) return
    jaTentou.current = true

    ;(async () => {
      try {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
        const status = await statusInscricaoPush()
        if (status === 'inativo') {
          await ativarPushNotifications(user.id)
        }
      } catch {
        // Silencioso — se falhar, o usuário sempre pode reativar manualmente em Configurações
      }
    })()
  }, [user?.id])

  return null
}
