import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 60 * 24, // 24h — precisa ser maior que o staleTime pra sobreviver offline
      refetchOnWindowFocus: false,
      retry: 1,
      // Se não tem internet, não fica tentando de novo e travando a tela —
      // só mostra o que já tinha em cache (se tiver)
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
})

// Guarda o cache no localStorage do navegador, pra sobreviver a fechar o app
// e reabrir sem internet — é o que permite ver telas já visitadas offline.
export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'agrogfi-cache-offline',
  throttleTime: 1000,
})
