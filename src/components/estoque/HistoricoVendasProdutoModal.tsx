import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { History } from 'lucide-react'
import { format } from 'date-fns'

interface HistoricoVendasProdutoModalProps {
  produto: { id: string; nome: string; unidade_medida: string }
}

export function HistoricoVendasProdutoModal({ produto }: HistoricoVendasProdutoModalProps) {
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
    </div>
  )
}
