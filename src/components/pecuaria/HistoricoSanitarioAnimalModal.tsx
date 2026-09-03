import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldCheck, ShieldAlert } from 'lucide-react'

interface HistoricoSanitarioAnimalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  animal: any
}

export function HistoricoSanitarioAnimalModal({ open, onOpenChange, animal }: HistoricoSanitarioAnimalModalProps) {
  const { data: historico, isLoading } = useQuery({
    queryKey: ['historico-sanitario-animal', animal?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_historico_sanitario_animal' as any, { p_animal_id: animal.id })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: open && !!animal?.id,
  })

  const fmtData = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—')
  const nomeAnimal = animal?.nome || animal?.identificador || animal?.numero_brinco || 'Animal'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Histórico Sanitário — {nomeAnimal}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : !historico?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center text-muted-foreground">
            <ShieldAlert className="h-8 w-8 opacity-60" />
            <p className="text-sm">Nenhuma aplicação registrada para esse animal ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historico.map((h: any) => (
              <div key={h.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">
                      {h.tipo} — {h.descricao}
                    </p>
                  </div>
                  {h.custo != null && (
                    <span className="text-sm font-semibold whitespace-nowrap">
                      R$ {Number(h.custo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Aplicado em {fmtData(h.data_aplicacao)}
                  {h.data_proxima && ` · Próxima: ${fmtData(h.data_proxima)}`}
                </p>
                {h.rebanho_nome && (
                  <p className="text-xs text-muted-foreground mt-1">Rebanho: {h.rebanho_nome}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
