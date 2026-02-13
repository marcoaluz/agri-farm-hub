import { useState } from 'react'
import { useFecharSafra, useReabrirSafra } from '@/hooks/useSafraFechamento'
import { useAuth } from '@/contexts/AuthContext'
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
import { Button } from '@/components/ui/button'
import { Lock, LockOpen, AlertTriangle } from 'lucide-react'

interface DialogFecharSafraProps {
  safra: {
    id: string
    nome: string
    fechada?: boolean
  }
}

export function DialogFecharSafra({ safra }: DialogFecharSafraProps) {
  const { user } = useAuth()
  const fecharSafra = useFecharSafra()
  const reabrirSafra = useReabrirSafra()
  const [open, setOpen] = useState(false)

  const handleFechar = async () => {
    if (!user?.id) return
    
    await fecharSafra.mutateAsync({
      safraId: safra.id,
      usuarioId: user.id
    })
    
    setOpen(false)
  }

  const handleReabrir = async () => {
    if (!user?.id) return
    
    await reabrirSafra.mutateAsync({
      safraId: safra.id,
      usuarioId: user.id
    })
    
    setOpen(false)
  }

  if (safra.fechada) {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">
            <LockOpen className="h-4 w-4 mr-2" />
            Reabrir Safra
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Reabrir Safra?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você está prestes a reabrir a safra "<strong>{safra.nome}</strong>".
                </p>
                <p className="text-yellow-600 dark:text-yellow-400">
                  ⚠️ Após reabrir, será possível editar e excluir lançamentos e lotes desta safra novamente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReabrir} disabled={reabrirSafra.isPending}>
              {reabrirSafra.isPending ? 'Reabrindo...' : 'Sim, Reabrir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lock className="h-4 w-4 mr-2" />
          Fechar Safra
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Fechar Safra?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Você está prestes a fechar a safra "<strong>{safra.nome}</strong>".
              </p>
              <div className="bg-muted rounded-md p-3 text-sm">
                <p className="font-medium mb-1">🔒 Após o fechamento:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Nenhum lançamento poderá ser editado ou excluído</li>
                  <li>Nenhum lote poderá ser alterado</li>
                  <li>Os dados ficarão protegidos para auditoria</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                Você poderá reabrir a safra posteriormente se necessário.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleFechar}
            disabled={fecharSafra.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {fecharSafra.isPending ? 'Fechando...' : 'Sim, Fechar Safra'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
