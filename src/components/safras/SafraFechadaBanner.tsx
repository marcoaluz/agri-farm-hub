import { useSafraContext } from '@/contexts/SafraContext'
import { useSafraPermissions } from '@/hooks/useSafraPermissions'
import { useReabrirSafra } from '@/hooks/useSafraFechamento'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Lock, LockOpen } from 'lucide-react'

/**
 * Banner global exibido quando a safra atualmente selecionada está fechada.
 * Renderizado abaixo do header.
 */
export function SafraFechadaBanner() {
  const { safraSelecionada, propriedadeSelecionada } = useSafraContext()
  const { user } = useAuth()
  const { data: perms } = useSafraPermissions(propriedadeSelecionada?.id)
  const reabrirSafra = useReabrirSafra()

  const fechada = (safraSelecionada as any)?.fechada === true
  if (!fechada || !safraSelecionada) return null

  const handleReabrir = async () => {
    if (!user?.id) return
    await reabrirSafra.mutateAsync({
      safraId: safraSelecionada.id,
      usuarioId: user.id,
    })
  }

  return (
    <div className="w-full bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
      <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200 min-w-0">
        <Lock className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">
          <strong>Safra "{safraSelecionada.nome}" fechada.</strong>{' '}
          <span className="hidden sm:inline">Nenhuma alteração pode ser realizada.</span>
        </span>
      </div>

      {perms?.canReopen && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/40 flex-shrink-0"
            >
              <LockOpen className="h-3 w-3 mr-1" />
              Reabrir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <LockOpen className="h-5 w-5 text-blue-500" />
                Reabrir Safra?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Deseja reabrir a safra "<strong>{safraSelecionada.nome}</strong>"?
                Lançamentos e movimentações voltarão a ser permitidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReabrir}
                disabled={reabrirSafra.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {reabrirSafra.isPending ? 'Reabrindo...' : 'Confirmar Reabertura'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
