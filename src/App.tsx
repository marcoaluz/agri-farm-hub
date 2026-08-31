import { useEffect } from 'react'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalProvider } from "@/contexts/GlobalContext";
import { AppRoutes } from "@/routes";
import { InstallPrompt } from "@/components/InstallPrompt";
import { UpdateAvailableBanner } from "@/components/UpdateAvailableBanner";
import { limparServiceWorkerConflitante, registerServiceWorker } from '@/lib/pushNotifications'

function App() {
  useEffect(() => {
    limparServiceWorkerConflitante()
    registerServiceWorker()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <AuthProvider>
            <GlobalProvider>
              <AppRoutes />
              <Toaster />
              <Sonner />
              <InstallPrompt />
              <UpdateAvailableBanner />
            </GlobalProvider>
          </AuthProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

