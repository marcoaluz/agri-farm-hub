import { useState } from 'react'
import { useFecharSafra, useReabrirSafra } from '@/hooks/useSafraFechamento'
import { useSafraPermissions } from '@/hooks/useSafraPermissions'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Lock, LockOpen, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Wheat, Sprout, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogFecharSafraProps {
  safra: {
    id: string
    nome: string
    propriedade_id: string
    fechada?: boolean
  }
}

interface ResumoSafra {
  receita_total?: number
  custo_total?: number
  resultado?: number
  margem_pct?: number
  custo_por_ha?: number
  area_ha?: number
}

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtNum = (n: number, digits = 2) =>
  (n || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

export function DialogFecharSafra({ safra }: DialogFecharSafraProps) {
  const { user } = useAuth()
  const fecharSafra = useFecharSafra()
  const reabrirSafra = useReabrirSafra()
  const { data: perms } = useSafraPermissions(safra.propriedade_id)

  const [openClose, setOpenClose] = useState(false)
  const [openReopen, setOpenReopen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmName, setConfirmName] = useState('')

  // Buscar resumo da safra ao abrir o dialog de fechamento
  const { data: resumo, isLoading: loadingResumo } = useQuery({
    queryKey: ['rentabilidade-safra', safra.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rentabilidade_safra' as any, {
        p_propriedade_id: safra.propriedade_id,
        p_safra_id: safra.id,
      })
      if (error) throw error
      // RPC pode retornar array ou objeto único
      const row = Array.isArray(data) ? data[0] : data
      return (row || {}) as ResumoSafra
    },
    enabled: openClose && !safra.fechada,
  })

  // Não mostra nada se usuário não tem permissão
  if (!perms?.canClose && !safra.fechada) return null
  if (safra.fechada && !perms?.canReopen) return null

  const handleFechar = async () => {
    if (!user?.id) return
    await fecharSafra.mutateAsync({ safraId: safra.id, usuarioId: user.id })
    setOpenClose(false)
    setStep(1)
    setConfirmName('')
  }

  const handleReabrir = async () => {
    if (!user?.id) return
    await reabrirSafra.mutateAsync({ safraId: safra.id, usuarioId: user.id })
    setOpenReopen(false)
  }

  // ========== Botão de REABRIR ==========
  if (safra.fechada) {
    return (
      <AlertDialog open={openReopen} onOpenChange={setOpenReopen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">
            <LockOpen className="h-4 w-4 mr-2" />
            Reabrir Safra
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LockOpen className="h-5 w-5 text-blue-500" />
              Reabrir Safra?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Deseja reabrir a safra "<strong>{safra.nome}</strong>"?
                </p>
                <p className="text-muted-foreground">
                  Lançamentos e movimentações voltarão a ser permitidos.
                </p>
              </div>
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
    )
  }

  // ========== Botão de FECHAR (2 etapas) ==========
  const resultado = resumo?.resultado ?? 0
  const isPositivo = resultado >= 0
  const nomesIguais = confirmName.trim() === safra.nome.trim()

  return (
    <Dialog
      open={openClose}
      onOpenChange={(o) => {
        setOpenClose(o)
        if (!o) {
          setStep(1)
          setConfirmName('')
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lock className="h-4 w-4 mr-2" />
          Fechar Safra
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? (
              <>
                <BarChart3 className="h-5 w-5 text-primary" />
                Resumo da Safra "{safra.nome}"
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Fechamento
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Etapa {step} de 2 — {step === 1 ? 'Revise os números antes de fechar' : 'Confirme a operação'}
          </DialogDescription>
        </DialogHeader>

        {/* ========== ETAPA 1: RESUMO ========== */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            {loadingResumo ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <ResumoCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Receita Total"
                  value={fmtBRL(resumo?.receita_total ?? 0)}
                  color="text-green-600 dark:text-green-400"
                />
                <ResumoCard
                  icon={<TrendingDown className="h-4 w-4" />}
                  label="Custo Total"
                  value={fmtBRL(resumo?.custo_total ?? 0)}
                  color="text-red-600 dark:text-red-400"
                />
                <ResumoCard
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Resultado"
                  value={fmtBRL(resultado)}
                  color={isPositivo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                  highlight
                />
                <ResumoCard
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="Margem"
                  value={`${fmtNum(resumo?.margem_pct ?? 0, 1)}%`}
                  color={isPositivo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                />
                <ResumoCard
                  icon={<Sprout className="h-4 w-4" />}
                  label="Custo por Hectare"
                  value={`${fmtBRL(resumo?.custo_por_ha ?? 0)}/ha`}
                  color="text-amber-600 dark:text-amber-400"
                />
                <ResumoCard
                  icon={<Wheat className="h-4 w-4" />}
                  label="Área Total"
                  value={`${fmtNum(resumo?.area_ha ?? 0, 2)} ha`}
                  color="text-foreground"
                />
              </div>
            )}
          </div>
        )}

        {/* ========== ETAPA 2: CONFIRMAÇÃO ========== */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-md p-4 text-sm space-y-2">
              <p className="font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Ao fechar esta safra:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-1">
                <li>Nenhum lançamento poderá ser criado ou editado</li>
                <li>Nenhum lote de estoque poderá ser alterado</li>
                <li>A safra ficará disponível apenas para consulta</li>
                <li>Somente administradores e proprietários podem reabrir</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmName" className="text-sm">
                Para confirmar, digite o nome da safra:{' '}
                <span className="font-mono font-semibold text-foreground">{safra.nome}</span>
              </Label>
              <Input
                id="confirmName"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={safra.nome}
                autoComplete="off"
                className={cn(
                  confirmName && !nomesIguais && 'border-destructive focus-visible:ring-destructive',
                )}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => setOpenClose(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setStep(2)} disabled={loadingResumo}>
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={fecharSafra.isPending}>
                Voltar
              </Button>
              <Button
                onClick={handleFechar}
                disabled={!nomesIguais || fecharSafra.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {fecharSafra.isPending ? 'Fechando...' : 'Confirmar Fechamento'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResumoCard({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color?: string
  highlight?: boolean
}) {
  return (
    <Card className={cn(highlight && 'border-2 border-primary/40 shadow-sm')}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <p className={cn('text-base font-bold leading-tight', color)}>{value}</p>
      </CardContent>
    </Card>
  )
}
