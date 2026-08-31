import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = 'BGEGgmPtzH4Q9jaE0A31XtMZ17x7ElDoJgEEt7BCWaSPoigokchBHLxjL9Uv2rqbAcVEbdPgRqb3ctxIoz-HNqA'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function pushEhSuportado() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

// Remove qualquer inscrição antiga de push-sw.js (o service worker separado que
// causava a tela branca) — limpeza de segurança, roda sempre, não faz nada se não achar.
export async function limparServiceWorkerConflitante() {
  if (!('serviceWorker' in navigator)) return
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const reg of registrations) {
      const url = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || ''
      if (url.includes('push-sw.js')) {
        await reg.unregister()
      }
    }
  } catch {
    /* limpeza best-effort */
  }
}

export async function statusInscricaoPush(): Promise<'ativo' | 'inativo' | 'negado' | 'nao_suportado'> {
  if (!pushEhSuportado()) return 'nao_suportado'
  if (Notification.permission === 'denied') return 'negado'
  const registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration) return 'inativo'
  const sub = await registration.pushManager.getSubscription()
  return sub ? 'ativo' : 'inativo'
}

export async function ativarPushNotifications(usuarioId: string) {
  if (!pushEhSuportado()) {
    throw new Error('Este navegador não suporta notificações push.')
  }

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') {
    throw new Error('Permissão de notificação negada.')
  }

  // Usa o Service Worker principal do app (já registrado por registerServiceWorker.ts) —
  // não registra um separado, pra não repetir o conflito de antes.
  const registration = await navigator.serviceWorker.ready

  let sub = await registration.pushManager.getSubscription()
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions' as any).upsert(
    {
      usuario_id: usuarioId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'usuario_id,endpoint' },
  )
  if (error) throw error

  return sub
}

export async function desativarPushNotifications(usuarioId: string) {
  const registration = await navigator.serviceWorker.getRegistration('/')
  const sub = await registration?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions' as any).delete().eq('usuario_id', usuarioId).eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

export async function enviarPushTeste() {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ titulo: 'Agro GFI', mensagem: 'Notificação de teste — chegou! 🎉', link: '/' }),
  })
  return resp.json()
}
