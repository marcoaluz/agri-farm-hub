import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sprout, Plus, DollarSign, History } from 'lucide-react'
import { NovaColheitaModal } from '@/components/producao/NovaColheitaModal'
import { VenderProducaoModal } from '@/components/producao/VenderProducaoModal'
import { HistoricoProducaoModal } from '@/components/producao/HistoricoProducaoModal'

export default function Producao() {
  const { propriedadeAtual, safraAtual } = useGlobal()
  const [showNovaColheita, setShowNovaColheita] = useState(false)
  const [culturaVenda, setCulturaVenda] = useState<any | null>(null)
  const [culturaHistorico, setCulturaHistorico] = useState<any | null>(null)

  const { data: producaoData, isLoading } = useQuery({
    queryKey: ['producao-safra', propriedadeAtual?.id, safraAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_producao_safra' as any, {
        p_propriedade_id: propriedadeAtual!.id,
        p_safra_id: safraAtual?.id || null,
      } as any)
      if (error) throw error
      return data as any
    },
    enabled: !!propriedadeAtual?.id,
  })

  const culturas: any[] = producaoData?.culturas || []

  if (!propriedadeAtual) {
    return (
      <div className="p-6">
        <Card className="py-12 text-center">
          <Sprout className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Selecione uma propriedade</h3>
          <p className="text-muted-foreground">
            Escolha uma propriedade no topo para ver a produção da safra
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produção da Safra</h1>
          <p className="text-muted-foreground">
            Controle de colheitas, estoque e vendas
            {producaoData?.safra_nome ? ` — ${producaoData.safra_nome}` : ''}
          </p>
        </div>
        <Button onClick={() => setShowNovaColheita(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Colheita
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {culturas.length === 0 && !isLoading && (
        <Card className="py-12 text-center">
          <Sprout className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Nenhuma produção registrada</h3>
          <p className="mb-4 text-muted-foreground">Registre sua primeira colheita para começar</p>
          <Button onClick={() => setShowNovaColheita(true)}>Registrar Primeira Colheita</Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {culturas.map((cultura) => {
          const colhido = Number(cultura.total_colhido) || 0
          const vendido = Number(cultura.vendido_safra) || 0
          const areaColhida = Number(cultura.area_colhida) || 0
          const pct = colhido > 0 ? Math.min((vendido / colhido) * 100, 100) : 0

          return (
            <Card key={cultura.cultura_id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{cultura.cultura_nome}</Badge>
                    <span className="text-sm text-muted-foreground">{cultura.unidade_label}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCulturaHistorico(cultura)}
                      className="gap-1"
                    >
                      <History className="h-3.5 w-3.5" />
                      Histórico
                    </Button>
                    {Number(cultura.estoque_disponivel) > 0 && (
                      <Button size="sm" onClick={() => setCulturaVenda(cultura)} className="gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        Vender
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Colhido</p>
                    <p className="text-lg font-bold text-green-700">{cultura.total_colhido}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Vendido</p>
                    <p className="text-lg font-bold text-blue-700">{cultura.vendido_safra}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Estoque</p>
                    <p className="text-lg font-bold text-amber-700">{cultura.estoque_disponivel}</p>
                  </div>
                </div>

                {colhido > 0 && (
                  <div className="mb-3">
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>Vendido: {pct.toFixed(0)}%</span>
                      <span>
                        Receita: R${' '}
                        {Number(cultura.receita_safra || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                )}

                {areaColhida > 0 && (
                  <div className="flex flex-wrap gap-4 border-t pt-2 text-xs text-muted-foreground">
                    <span>Área colhida: {areaColhida} ha</span>
                    {colhido > 0 && (
                      <span>
                        Produtividade: {(colhido / areaColhida).toFixed(1)} {cultura.unidade_label}/ha
                      </span>
                    )}
                    <span>{cultura.num_colheitas} colheita(s)</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {showNovaColheita && (
        <NovaColheitaModal
          open={showNovaColheita}
          onClose={() => setShowNovaColheita(false)}
          propriedadeId={propriedadeAtual.id}
          safraId={safraAtual?.id ?? null}
        />
      )}

      {culturaVenda && (
        <VenderProducaoModal
          cultura={{
            cultura_id: culturaVenda.cultura_id,
            cultura_nome: culturaVenda.cultura_nome,
            estoque_disponivel: Number(culturaVenda.estoque_disponivel) || 0,
            unidade_label: culturaVenda.unidade_label,
          }}
          propriedadeId={propriedadeAtual.id}
          safraId={safraAtual?.id ?? null}
          onClose={() => setCulturaVenda(null)}
        />
      )}

      {culturaHistorico && (
        <HistoricoProducaoModal
          cultura={{
            cultura_id: culturaHistorico.cultura_id,
            cultura_nome: culturaHistorico.cultura_nome,
          }}
          propriedadeId={propriedadeAtual.id}
          onClose={() => setCulturaHistorico(null)}
        />
      )}
    </div>
  )
}
