import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Edit, Trash2 } from 'lucide-react'

interface SolicitacaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipo: 'edicao' | 'exclusao'
  lancamentoInfo: {
    servico: string
    data: string
    custo: number
  }
  onConfirm: (motivo: string) => void
  isLoading?: boolean
}

export function SolicitacaoDialog({
  open,
  onOpenChange,
  tipo,
  lancamentoInfo,
  onConfirm,
  isLoading = false
}: SolicitacaoDialogProps) {
  const [motivo, setMotivo] = useState('')

  const handleConfirm = () => {
    if (!motivo.trim()) return
    onConfirm(motivo)
    setMotivo('')
  }

  const isExclusao = tipo === 'exclusao'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isExclusao ? (
              <>
                <Trash2 className="h-5 w-5 text-destructive" />
                Solicitar Exclusão
              </>
            ) : (
              <>
                <Edit className="h-5 w-5 text-primary" />
                Solicitar Edição
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isExclusao 
              ? 'A exclusão deste lançamento precisa ser aprovada pelo proprietário.'
              : 'A edição deste lançamento precisa ser aprovada pelo proprietário.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 space-y-1">
            <p className="text-sm font-medium">{lancamentoInfo.servico}</p>
            <p className="text-sm text-muted-foreground">
              {lancamentoInfo.data} • R$ {lancamentoInfo.custo.toFixed(2)}
            </p>
          </div>

          {isExclusao && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                Esta ação não pode ser desfeita. O estoque consumido não será restaurado automaticamente.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo">
              Motivo da {isExclusao ? 'exclusão' : 'edição'} *
            </Label>
            <Textarea
              id="motivo"
              placeholder={`Descreva o motivo para ${isExclusao ? 'excluir' : 'editar'} este lançamento...`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant={isExclusao ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!motivo.trim() || isLoading}
          >
            {isLoading ? 'Enviando...' : 'Enviar Solicitação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
