import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { History, Undo2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface HistoricoVendasProdutoModalProps {
  produto: { id: string; nome: string; unidade_medida: string }
}

export function HistoricoVendasProdutoModal({ produto }: HistoricoVendasProdutoModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [vendaParaCancelar, setVendaParaCancelar] = useState<any | null>(null)

  const { data: vendas, isLoading } = useQuery({
    queryKey: ['historico-vendas-produto', produto.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas_estoque' as any)
        .select('*')
        .eq('produto_id', produto.id)
        .order('data_venda', { ascending: false })
      if (error) throw error
      return (data || []) as any[]
    },
  })

  const cancelarVendaMutation = useMutation({
    mutationFn: async (vendaId: string) => {
      const { data, error } = await supabase.rpc('cancelar_venda_estoque' as any, { p_venda_id: vendaId })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast({ title: 'Venda cancelada. Quantidade devolvida ao estoque e receita removida do Financeiro.' })
      queryClient.invalidateQueries({ queryKey: ['historico-vendas-produto'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-leite'] })
      queryClient.invalidateQueries({ queryKey: ['producao-pecuaria-mes'] })
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      setVendaParaCancelar(null)
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao cancelar venda', description: err.message, variant: 'destructive' })
    },
  })

  const totalLitros = (vendas || []).reduce((s, v: any) => s + Number(v.quantidade || 0), 0)
  const totalReceita = (vendas || []).reduce((s, v: any) => s + Number(v.valor_total || 0), 0)
  const precoMedio = totalLitros > 0 ? totalReceita / totalLitros : 0

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          Histórico de Vendas — {produto.nome}
        </DialogTitle>
      </DialogHeader>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !vendas?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma venda registrada ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total vendido</p>
                <p className="text-lg font-bold">
                  {totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {produto.unidade_medida}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Receita total</p>
                <p className="text-lg font-bold text-green-600">
                  R$ {totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Preço médio</p>
                <p className="text-lg font-bold text-blue-600">
                  R$ {precoMedio.toFixed(2)}/{produto.unidade_medida}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {vendas.map((v: any) => (
              <Card key={v.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(v.data_venda + 'T12:00:00'), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.comprador || 'Comprador não informado'}{v.numero_nf ? ` · NF ${v.numero_nf}` : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setVendaParaCancelar(v)}
                      title="Cancelar venda"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">
                        {Number(v.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {produto.unidade_medida}
                      </span>
                      {' × '}
                      <span>R$ {Number(v.preco_unitario).toFixed(2)}</span>
                    </div>
                    <span className="text-base font-bold text-green-600">
                      R$ {Number(v.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={!!vendaParaCancelar} onOpenChange={(o) => { if (!o) setVendaParaCancelar(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              {vendaParaCancelar?.quantidade} {produto.unidade_medida} voltam pro estoque (como um novo lote de estorno), e a
              receita correspondente é removida do Financeiro. Não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => vendaParaCancelar && cancelarVendaMutation.mutate(vendaParaCancelar.id)}
              disabled={cancelarVendaMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelarVendaMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelando...
                </span>
              ) : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
