import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Parcela {
  id: string
  numero_parcela: number
  valor: number
  data_vencimento: string
  data_pagamento: string | null
  status: string
}

interface Props {
  transacaoId: string
  enabled?: boolean
}

export function ParcelasList({ transacaoId, enabled = true }: Props) {
  const queryClient = useQueryClient()

  const { data: parcelas } = useQuery({
    queryKey: ['parcelas', transacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parcelas' as any)
        .select('*')
        .eq('transacao_id', transacaoId)
        .order('numero_parcela')
      if (error) throw error
      return (data || []) as unknown as Parcela[]
    },
    enabled: enabled && !!transacaoId,
  })

  if (!parcelas || parcelas.length === 0) return null

  const pagas = parcelas.filter(p => p.status === 'pago').length

  const togglePago = async (parcela: Parcela, checked: boolean) => {
    const { error } = await supabase
      .from('parcelas' as any)
      .update({
        status: checked ? 'pago' : 'pendente',
        data_pagamento: checked ? new Date().toISOString().split('T')[0] : null,
      })
      .eq('id', parcela.id)

    if (error) {
      toast.error('Erro ao atualizar parcela: ' + error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['parcelas', transacaoId] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
  }

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="text-sm font-semibold mb-3">
        Parcelas ({pagas}/{parcelas.length} pagas)
      </h4>
      <div className="space-y-2">
        {parcelas.map(parcela => (
          <div key={parcela.id} className="flex items-center justify-between gap-2 p-2 rounded border text-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Checkbox
                checked={parcela.status === 'pago'}
                onCheckedChange={(checked) => togglePago(parcela, !!checked)}
              />
              <span className={parcela.status === 'pago' ? 'line-through text-muted-foreground' : ''}>
                Parcela {parcela.numero_parcela}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-muted-foreground text-xs">
                {new Date(parcela.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
              <span className="font-medium">
                R$ {Number(parcela.valor).toFixed(2)}
              </span>
              <Badge variant={parcela.status === 'pago' ? 'default' : 'outline'} className="text-xs">
                {parcela.status === 'pago' ? 'Pago' : 'Pendente'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
