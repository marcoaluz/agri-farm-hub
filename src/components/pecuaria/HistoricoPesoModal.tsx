import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface HistoricoPesoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  animal: any
}

export function HistoricoPesoModal({ open, onOpenChange, animal }: HistoricoPesoModalProps) {
  const { data: pesagens, isLoading } = useQuery({
    queryKey: ['pesagens-animal', animal?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pesagens_animal' as any, { p_animal_id: animal.id })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: open && !!animal?.id,
  })

  const nomeAnimal = animal?.nome || animal?.identificador || animal?.numero_brinco || 'animal'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evolução de Peso — {nomeAnimal}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-48" />
        ) : !pesagens?.length ? (
          <p className="py-8 text-center text-muted-foreground">Nenhuma pesagem registrada.</p>
        ) : (
          <>
            {pesagens.length >= 2 && (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={[...pesagens].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="data_pesagem"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v} kg`, 'Peso']} />
                  <Line type="monotone" dataKey="peso_kg" stroke="#16a34a" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}

            <div className="space-y-2 mt-4">
              {pesagens.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm">{new Date(p.data_pesagem + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{p.peso_kg} kg</span>
                    {p.ganho_desde_anterior !== null && p.ganho_desde_anterior !== undefined && (
                      <Badge variant={p.ganho_desde_anterior >= 0 ? 'default' : 'destructive'}>
                        {p.ganho_desde_anterior > 0 ? '+' : ''}{p.ganho_desde_anterior} kg
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
