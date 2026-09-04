import { useEffect } from 'react'
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
import { OfflineBanner } from "@/components/OfflineBanner";
import { limparServiceWorkerConflitante } from '@/lib/pushNotifications'
import { registerServiceWorker } from '@/lib/registerServiceWorker'

function App() {
  useEffect(() => {
    limparServiceWorkerConflitante()
    registerServiceWorker()
  }, [])

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <BrowserRouter>
        <TooltipProvider>
          <AuthProvider>
            <GlobalProvider>
              <OfflineBanner />
              <AppRoutes />
              <Toaster />
              <Sonner />
              <InstallPrompt />
              <UpdateAvailableBanner />
              <PushAutoReconnect />
            </GlobalProvider>
          </AuthProvider>
        </TooltipProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}

export default App;
