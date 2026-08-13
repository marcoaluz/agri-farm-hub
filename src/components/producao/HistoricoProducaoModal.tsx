import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  cultura: {
    cultura_id: string
    cultura_nome: string
    talhao_id?: string | null
    talhao_nome?: string | null
  }
  propriedadeId: string
  onClose: () => void
}

export function HistoricoProducaoModal({ cultura, propriedadeId, onClose }: Props) {
  const navigate = useNavigate()
  const { data: historico, isLoading } = useQuery({
    queryKey: ['historico-producao', propriedadeId, cultura.cultura_id, cultura.talhao_id ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_historico_producao' as any, {
        p_propriedade_id: propriedadeId,
        p_cultura_id: cultura.cultura_id,
        p_talhao_id: cultura.talhao_id || null,
      } as any)
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!cultura.cultura_id && !!propriedadeId,
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Histórico — {cultura.cultura_nome}
            {cultura.talhao_nome && ` — ${cultura.talhao_nome}`}
          </DialogTitle>
          <DialogDescription>
            {cultura.talhao_id
              ? 'Colheitas registradas neste talhão.'
              : 'Colheitas e vendas registradas para esta cultura.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {!isLoading && (!historico || historico.length === 0) && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum movimento registrado ainda.
          </p>
        )}

        <div>
          {historico?.map((item: any) => (
            <div key={item.id} className="flex items-start gap-3 border-b py-3 last:border-0">
              <div
                className={`rounded-full p-2 ${
                  item.tipo === 'colheita'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {item.tipo === 'colheita' ? (
                  <ArrowDownToLine className="h-4 w-4" />
                ) : (
                  <ArrowUpFromLine className="h-4 w-4" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {item.tipo === 'colheita' ? 'Colheita' : 'Venda'}
                    {item.talhao_nome && ` — ${item.talhao_nome}`}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {item.data ? new Date(`${String(item.data).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : ''}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Badge variant={item.tipo === 'colheita' ? 'default' : 'secondary'}>
                    {item.tipo === 'colheita' ? '+' : '-'}
                    {item.quantidade}
                  </Badge>
                  {item.area_colhida > 0 && (
                    <span className="text-xs text-muted-foreground">{item.area_colhida} ha</span>
                  )}
                  {item.valor_total && (
                    <span className="text-xs font-medium text-green-600">
                      R$ {Number(item.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {item.comprador && (
                    <span className="text-xs text-muted-foreground">→ {item.comprador}</span>
                  )}
                  {item.tipo === 'venda' && item.transacao_id && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => navigate(`/financeiro?transacao=${item.transacao_id}`)}
                    >
                      Ver no Financeiro <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </div>

                {item.observacoes && (
                  <p className="mt-1 text-xs text-muted-foreground">{item.observacoes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
