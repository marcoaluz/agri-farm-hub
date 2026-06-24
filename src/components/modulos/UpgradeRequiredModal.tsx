import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Lock, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  open: boolean
  onClose: () => void
  modulo: string
  planoMinimo?: string
}

const MODULO_LABELS: Record<string, string> = {
  pecuaria: 'Pecuária',
  financeiro: 'Financeiro',
  relatorios: 'Relatórios',
  auditoria: 'Auditoria',
}

const PLANO_LABELS: Record<string, { nome: string; preco: string }> = {
  essencial: { nome: 'Essencial', preco: 'R$ 49,90/mês' },
  profissional: { nome: 'Profissional', preco: 'R$ 119,90/mês' },
  avancado: { nome: 'Avançado', preco: 'R$ 249,90/mês' },
}

export function UpgradeRequiredModal({ open, onClose, modulo, planoMinimo = 'profissional' }: Props) {
  const navigate = useNavigate()
  const moduloNome = MODULO_LABELS[modulo] || modulo
  const plano = PLANO_LABELS[planoMinimo] || PLANO_LABELS.profissional

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <DialogTitle className="text-center">Módulo {moduloNome} bloqueado</DialogTitle>
          <DialogDescription className="text-center">
            Este recurso está disponível a partir do plano {plano.nome}.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Plano {plano.nome}</p>
              <p className="text-sm text-muted-foreground">{plano.preco}</p>
              <p className="text-xs text-muted-foreground mt-1">ou pague anual e economize 15%</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={() => navigate('/planos')} className="w-full" size="lg">
            Ver planos e fazer upgrade
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Continuar com o plano atual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
