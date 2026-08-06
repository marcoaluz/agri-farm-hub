import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sprout, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VenderProducaoModal } from '@/components/producao/VenderProducaoModal'

interface Props {
  propriedadeId: string | null
  safraId: string | null
}

export function CardProducao({ propriedadeId, safraId }: Props) {
  const navigate = useNavigate()
  const [culturaVenda, setCulturaVenda] = useState<any | null>(null)

  const { data: producaoData, isLoading } = useQuery({
    queryKey: ['producao-safra', propriedadeId, safraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_producao_safra', {
        p_propriedade_id: propriedadeId,
        p_safra_id: safraId || null,
      })
      if (error) throw error
      return data as any
    },
    enabled: !!propriedadeId,
  })

  const producoes: any[] = producaoData?.culturas || []

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5" />
              Produção
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate('/producao')}>
              Ver Detalhes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          ) : producoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma produção registrada nesta safra
            </p>
          ) : (
            producoes.map((cultura: any) => {
              const colhido = Number(cultura.total_colhido) || 0
              const vendido = Number(cultura.vendido_safra) || 0
              const estoque = Number(cultura.estoque_disponivel) || 0
              const pct = colhido > 0 ? Math.min((vendido / colhido) * 100, 100) : 0
              return (
                <div key={cultura.cultura_id} className="mb-4 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{cultura.cultura_nome}</Badge>
                    <span className="text-xs text-muted-foreground">{cultura.unidade_label}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Colhido</p>
                      <p className="font-bold text-green-700">{colhido.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Vendido</p>
                      <p className="font-bold text-blue-700">{vendido.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Estoque</p>
                      <p className="font-bold text-amber-700">{estoque.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>

                  {colhido > 0 && (
                    <div className="w-full bg-muted rounded-full h-2 mb-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}

                  {estoque > 0 && (
                    <Button size="sm" className="w-full gap-1" onClick={() => setCulturaVenda(cultura)}>
                      <DollarSign className="h-3.5 w-3.5" />
                      Vender {cultura.cultura_nome}
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {culturaVenda && propriedadeId && (
        <VenderProducaoModal
          cultura={{
            cultura_id: culturaVenda.cultura_id,
            cultura_nome: culturaVenda.cultura_nome,
            estoque_disponivel: Number(culturaVenda.estoque_disponivel) || 0,
            unidade_label: culturaVenda.unidade_label,
          }}
          propriedadeId={propriedadeId}
          safraId={safraId}
          onClose={() => setCulturaVenda(null)}
        />
      )}
    </>
  )
}
