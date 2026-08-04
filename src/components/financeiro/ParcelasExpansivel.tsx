import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CheckCheck } from 'lucide-react'
import { toast } from 'sonner'

interface Parcela {
  id: string
  numero_parcela: number
  valor: number
  data_vencimento: string
  data_pagamento: string | null
  status: string
}

export function ParcelasExpansivel({ transacaoId }: { transacaoId: string }) {
  const queryClient = useQueryClient()
  const [confirmarTodas, setConfirmarTodas] = useState(false)

  const { data: parcelas, isLoading } = useQuery({
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
    enabled: !!transacaoId,
  })

  const totalPagas = parcelas?.filter(p => p.status === 'pago').length || 0
  const totalParcelas = parcelas?.length || 0

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['parcelas', transacaoId] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
    queryClient.invalidateQueries({ queryKey: ['parcelas-calendario'] })
  }

  const marcarParcela = async (parcelaId: string, pagar: boolean) => {
    const { error } = await supabase
      .from('parcelas' as any)
      .update({
        status: pagar ? 'pago' : 'pendente',
        data_pagamento: pagar ? new Date().toISOString().split('T')[0] : null,
      })
      .eq('id', parcelaId)
    if (error) {
      toast.error('Erro ao atualizar parcela: ' + error.message)
      return
    }
    invalidar()
  }

  const pagarTodas = async () => {
    const pendentes = parcelas?.filter(p => p.status !== 'pago') || []
    const hoje = new Date().toISOString().split('T')[0]
    for (const parcela of pendentes) {
      const { error } = await supabase
        .from('parcelas' as any)
        .update({ status: 'pago', data_pagamento: hoje })
        .eq('id', parcela.id)
      if (error) {
        toast.error('Erro ao atualizar parcela: ' + error.message)
        invalidar()
        return
      }
    }
    invalidar()
    toast.success('Todas as parcelas marcadas como pagas')
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Carregando parcelas...</div>
  }

  if (!parcelas || parcelas.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">Nenhuma parcela encontrada.</div>
  }

  return (
    <div className="bg-muted/30 border-l-4 border-l-accent px-3 sm:px-4 py-3 ml-2 md:ml-8 mb-2 rounded-r-md">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-sm font-medium">
          Parcelas: {totalPagas}/{totalParcelas} pagas
        </span>
        {totalPagas < totalParcelas && (
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setConfirmarTodas(true)}>
            <CheckCheck className="h-3 w-3 mr-1" />
            Pagar todas
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {parcelas.map(parcela => (
          <div
            key={parcela.id}
            className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded text-sm ${
              parcela.status === 'pago' ? 'bg-green-50' : 'bg-background'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Checkbox
                checked={parcela.status === 'pago'}
                onCheckedChange={(checked) => marcarParcela(parcela.id, !!checked)}
              />
              <span className={parcela.status === 'pago' ? 'line-through text-muted-foreground' : ''}>
                Parcela {parcela.numero_parcela}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <span className="text-muted-foreground text-xs">
                {new Date(parcela.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
              <span className="font-medium sm:w-24 text-right">
                R$ {Number(parcela.valor).toFixed(2)}
              </span>
              <Badge
                className={
                  parcela.status === 'pago'
                    ? 'bg-green-100 text-green-800 border-green-200 text-xs hover:bg-green-100'
                    : 'bg-amber-100 text-amber-800 border-amber-200 text-xs hover:bg-amber-100'
                }
              >
                {parcela.status === 'pago' ? 'Pago' : 'Pendente'}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={confirmarTodas} onOpenChange={setConfirmarTodas}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar todas as parcelas como pagas?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as parcelas pendentes desta transação serão marcadas como pagas com a data de hoje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmarTodas(false); pagarTodas() }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
