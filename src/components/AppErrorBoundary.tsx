import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro inesperado na interface:', error, info)
  }

  private recarregar = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h1 className="text-xl font-semibold text-foreground">Não foi possível exibir esta tela</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Recarregue para restaurar os dados e continuar usando o Agro GFI.
          </p>
          <Button className="mt-5 gap-2" onClick={this.recarregar}>
            <RefreshCw className="h-4 w-4" />
            Recarregar
          </Button>
        </section>
      </main>
    )
  }
}