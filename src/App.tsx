import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter } from "react-router-dom";
import { queryClient, persister } from "@/lib/queryClient";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalProvider } from "@/contexts/GlobalContext";
import { AppRoutes } from "@/routes";
import { InstallPrompt } from "@/components/InstallPrompt";
import { UpdateAvailableBanner } from "@/components/UpdateAvailableBanner";
import { PushAutoReconnect } from "@/components/PushAutoReconnect";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { limparServiceWorkerConflitante } from '@/lib/pushNotifications'
import { registerServiceWorker } from '@/lib/registerServiceWorker'

function App() {
  useEffect(() => {
    limparServiceWorkerConflitante()
    registerServiceWorker()
  }, [])

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // não usa cache com mais de 24h como se fosse atual
        // Nunca guarda dado sensível de sessão/autenticação no cache persistido —
        // só resultados de consulta (relatórios, listas, etc)
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = String(query.queryKey?.[0] ?? '')
            return !key.toLowerCase().includes('auth') && !key.toLowerCase().includes('session')
          },
        },
      }}
    >
      <BrowserRouter>
        <TooltipProvider>
          <AuthProvider>
            <GlobalProvider>
              <AppErrorBoundary>
                <AppRoutes />
                <Toaster />
                <Sonner />
                <InstallPrompt />
                <UpdateAvailableBanner />
                <PushAutoReconnect />
              </AppErrorBoundary>
            </GlobalProvider>
          </AuthProvider>
        </TooltipProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}

export default App;
