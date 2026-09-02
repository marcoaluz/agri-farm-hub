import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useGlobal } from '@/contexts/GlobalContext'
import { supabase } from '@/lib/supabase'

interface CustoPorTipo {
  tipo: string
  tipo_label: string
  valor: number
}

interface CustoPorTalhao {
  talhao_id: string
  talhao_nome: string
  area_ha: number
  num_lancamentos: number
  custo_total: number
  custo_por_ha: number
}

interface CustoPorServico {
  servico_nome: string
  num_lancamentos: number
  custo_total: number
}

interface ItemDetalhamento {
  nome: string
  custo: number
  quantidade?: number
  unidade?: string | null
}

interface LancamentoCusto {
  id: string
  data: string
  servico: string
  talhao: string | null
  custo_total: number
  itens: ItemDetalhamento[]
}

interface CustosOperacionaisResponse {
  custo_total: number
  custo_por_tipo: CustoPorTipo[]
  custo_por_talhao: CustoPorTalhao[]
  custo_sem_talhao: number
  custo_por_servico: CustoPorServico[]
  lancamentos: LancamentoCusto[]
}

const fmt = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

export function CustosOperacionais() {
  const { propriedadeAtual, safraAtual } = useGlobal()
  const propId = propriedadeAtual?.id
  const safraId = safraAtual?.id

  const { data: custos, isLoading } = useQuery<CustosOperacionaisResponse | null>({
    queryKey: ['custos-operacionais', propId, safraId],
    queryFn: async () => {
      if (!propId) return null
      const { data, error } = await supabase.rpc('get_custos_operacionais', {
        p_propriedade_id: propId,
        p_safra_id: safraId || null,
      })
      if (error) throw error
      return (data as CustosOperacionaisResponse) || null
    },
    enabled: !!propId,
  })

  if (!propId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Selecione uma propriedade para ver os custos operacionais.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando custos operacionais...
      </div>
    )
  }

  if (!custos) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum dado de custo operacional encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Total */}
      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
        <CardContent className="pt-4 sm:pt-6">
          <div className="text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">Custo Total da Safra</p>
            <p className="text-2xl sm:text-3xl font-bold text-amber-800 dark:text-amber-200 break-words">
              {fmt(custos.custo_total || 0)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Custo por tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {custos.custo_por_tipo?.map((tipo) => (
          <Card key={tipo.tipo}>
            <CardContent className="pt-3 px-3 sm:pt-4 sm:px-6 flex items-center justify-between gap-2 sm:block">
              <p className="text-xs text-muted-foreground">{tipo.tipo_label}</p>
              <p className="text-lg sm:text-xl font-bold">{fmt(tipo.valor || 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>


      {/* Custo por talhão */}
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base">Custo por Talhão</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-2 sm:space-y-3">
            {custos.custo_por_talhao?.map((talhao) => (
              <div
                key={talhao.talhao_id}
                className="flex items-center justify-between gap-3 p-3 border rounded-lg"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{talhao.talhao_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {talhao.area_ha} ha • {talhao.num_lancamentos} lançamento(s)
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{fmt(talhao.custo_total || 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(talhao.custo_por_ha || 0)}/ha
                  </p>
                </div>

              </div>
            ))}
            {(custos.custo_sem_talhao || 0) > 0 && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <p className="text-muted-foreground">{propriedadeAtual?.nome || 'Custos gerais'} (não vinculados a um talhão)</p>
                <p className="font-bold">{fmt(custos.custo_sem_talhao || 0)}</p>
              </div>
            )}
            {(custos.custo_por_talhao?.length || 0) === 0 &&
              (custos.custo_sem_talhao || 0) === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhum custo por talhão encontrado.
                </p>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Custo por serviço */}
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base">Custo por Tipo de Serviço</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-2">
            {custos.custo_por_servico?.map((sv) => (
              <div
                key={sv.servico_nome}
                className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{sv.servico_nome}</p>
                  <p className="text-xs text-muted-foreground">{sv.num_lancamentos}x</p>
                </div>
                <p className="font-bold text-sm shrink-0">{fmt(sv.custo_total || 0)}</p>
              </div>
            ))}
            {(custos.custo_por_servico?.length || 0) === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                Nenhum custo por serviço encontrado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de lançamentos */}
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">

          <div className="space-y-3">
            {custos.lancamentos?.map((lc) => (
              <div key={lc.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{lc.servico}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(lc.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {lc.talhao && ` • ${lc.talhao}`}
                    </p>
                  </div>
                  <p className="font-bold shrink-0">{fmt(lc.custo_total || 0)}</p>
                </div>
                {lc.itens && lc.itens.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {lc.itens.map((item, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {item.nome}{item.quantidade && item.unidade ? ` (${item.quantidade} ${item.unidade})` : ''}: {fmt(item.custo || 0)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(custos.lancamentos?.length || 0) === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                Nenhum lançamento encontrado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
