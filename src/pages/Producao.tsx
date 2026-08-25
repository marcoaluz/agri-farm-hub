import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useSafraFechada } from '@/hooks/useSafraFechada'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sprout, Plus, DollarSign, History } from 'lucide-react'
import { IconeCultura } from '@/components/culturas/IconeCultura'
import { NovaColheitaModal } from '@/components/producao/NovaColheitaModal'
import { VenderProducaoModal } from '@/components/producao/VenderProducaoModal'
import { HistoricoProducaoModal } from '@/components/producao/HistoricoProducaoModal'

const fmtNum = (v: any) => Number(v || 0).toLocaleString('pt-BR')

export default function Producao() {
  const { propriedadeAtual, safraAtual } = useGlobal()
  const { isFechada, verificarSafra } = useSafraFechada(safraAtual)
  const [showNovaColheita, setShowNovaColheita] = useState(false)
  const [talhaoSelecionado, setTalhaoSelecionado] = useState<any | null>(null)
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

  const { data: talhoes, isLoading: loadTalhoes } = useQuery({
    queryKey: ['talhoes-producao', propriedadeAtual?.id, safraAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_talhoes_producao' as any, {
        p_propriedade_id: propriedadeAtual!.id,
        p_safra_id: safraAtual?.id || null,
      } as any)
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!propriedadeAtual?.id,
  })

  const abrirColheitaTalhao = (talhao: any) => {
    setTalhaoSelecionado(talhao)
    setShowNovaColheita(true)
  }

  const abrirHistoricoTalhao = (talhao: any) => {
    setCulturaHistorico({
      cultura_id: talhao.cultura_id,
      cultura_nome: talhao.cultura_nome,
      talhao_id: talhao.talhao_id,
      talhao_nome: talhao.talhao_nome,
    })
  }

  const fecharColheita = () => {
    setShowNovaColheita(false)
    setTalhaoSelecionado(null)
  }

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
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produção da Safra</h1>
          <p className="text-muted-foreground">
            Colheitas por talhão{safraAtual?.nome ? ` — ${safraAtual.nome}` : ''}
          </p>
        </div>
        <Button
          onClick={() => { if (!verificarSafra('registrar colheita')) return; setShowNovaColheita(true) }}
          disabled={isFechada}
          title={isFechada ? 'Safra fechada' : ''}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Registrar Colheita
        </Button>
      </div>

      {/* KPIs gerais por cultura */}
      {isLoading && <Skeleton className="mb-6 h-24 w-full" />}

      {culturas.map((cultura: any) => {
        const vendido = Number(cultura.vendido_safra) || 0
        const receita = Number(cultura.receita_safra) || 0
        const precoMedio = vendido > 0 ? receita / vendido : 0
        return (
          <div
            key={cultura.cultura_id}
            className="mb-4 flex flex-col gap-4 rounded-lg bg-muted/30 p-4 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-fit gap-1.5">
                <IconeCultura nome={cultura.icone} className="h-3.5 w-3.5" />
                {cultura.cultura_nome}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => setCulturaHistorico(cultura)}
              >
                <History className="h-3.5 w-3.5" />
                Histórico
              </Button>
            </div>
            <div className="grid flex-1 min-w-full sm:min-w-[280px] grid-cols-2 gap-4 md:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Total Colhido</p>
                <p className="font-bold">{fmtNum(cultura.total_colhido)} {cultura.unidade_label}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Vendido</p>
                <p className="font-bold">{fmtNum(vendido)} {cultura.unidade_label}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estoque</p>
                <p className="font-bold text-amber-700">
                  {fmtNum(cultura.estoque_disponivel)} {cultura.unidade_label}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Receita</p>
                <p className="font-bold text-green-700 break-words">
                  R$ {receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).replace(/\u00A0/g, ' ')}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Preço médio</p>
                <p className="font-bold break-words">
                  {precoMedio > 0
                    ? `R$ ${precoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).replace(/\u00A0/g, ' ')}/${cultura.unidade_label}`
                    : '—'}
                </p>
              </div>
            </div>
            {Number(cultura.estoque_disponivel) > 0 && (
              <Button
                size="sm"
                onClick={() => { if (!verificarSafra('registrar venda')) return; setCulturaVenda(cultura) }}
                disabled={isFechada}
                title={isFechada ? 'Safra fechada' : ''}
                className="w-full gap-1 sm:w-auto sm:self-center"
              >
                <DollarSign className="h-3.5 w-3.5" />
                Vender
              </Button>
            )}
          </div>
        )
      })}

      {/* Cards por talhão */}
      {loadTalhoes ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : talhoes && talhoes.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {talhoes.map((talhao: any) => {
            const colhido = Number(talhao.colhido_safra) || 0
            const estimativa = Number(talhao.estimativa_colheita) || 0
            const anterior = Number(talhao.colhido_safra_anterior) || 0
            return (
              <Card key={talhao.talhao_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{talhao.talhao_nome}</CardTitle>
                    {talhao.cultura_nome && (
                      <Badge variant="outline" className="gap-1.5">
                        <IconeCultura nome={talhao.icone} className="h-3.5 w-3.5" />
                        {talhao.cultura_nome}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Info do talhão */}
                  <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Área</span>
                      <p className="font-semibold">{talhao.area_ha} ha</p>
                    </div>
                    {Number(talhao.quantidade_pes) > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">
                          {String(talhao.cultura_nome || '').toLowerCase().includes('caf') ? 'Pés' : 'Plantas'}
                        </span>
                        <p className="font-semibold">{fmtNum(talhao.quantidade_pes)}</p>
                      </div>
                    )}
                    {estimativa > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">Estimativa</span>
                        <p className="font-semibold">
                          {fmtNum(estimativa)} {talhao.unidade_label}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Produção da safra */}
                  <div className="mb-3 rounded-lg bg-muted/30 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium">Colhido na safra</span>
                      <span className="font-bold text-green-700">
                        {fmtNum(colhido)} {talhao.unidade_label}
                      </span>
                    </div>

                    {estimativa > 0 && (
                      <div>
                        <div className="mb-1 h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-green-600 transition-all"
                            style={{ width: `${Math.min((colhido / estimativa) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {((colhido / estimativa) * 100).toFixed(0)}% da estimativa
                        </span>
                      </div>
                    )}

                    {anterior > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Safra anterior: {fmtNum(anterior)} {talhao.unidade_label}
                        {colhido > 0 && (
                          <span className={colhido >= anterior ? 'text-green-600' : 'text-red-600'}>
                            {' '}({colhido >= anterior ? '↑' : '↓'}
                            {Math.abs((colhido / anterior - 1) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => abrirColheitaTalhao(talhao)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Colheita
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => abrirHistoricoTalhao(talhao)}
                    >
                      <History className="h-3.5 w-3.5" />
                      Histórico
                    </Button>
                  </div>

                  {talhao.variedade && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Variedade: {talhao.variedade}
                      {talhao.ano_plantio && ` • Plantio: ${talhao.ano_plantio}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="mt-6 py-12 text-center">
          <Sprout className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Nenhum talhão com cultura cadastrada</h3>
          <p className="mb-4 text-muted-foreground">
            Cadastre a cultura nos talhões para acompanhar a produção
          </p>
        </Card>
      )}

      {showNovaColheita && (
        <NovaColheitaModal
          open={showNovaColheita}
          onClose={fecharColheita}
          propriedadeId={propriedadeAtual.id}
          safraId={safraAtual?.id ?? null}
          talhaoIdInicial={talhaoSelecionado?.talhao_id ?? null}
          culturaIdInicial={talhaoSelecionado?.cultura_id ?? null}
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
            talhao_id: culturaHistorico.talhao_id ?? null,
            talhao_nome: culturaHistorico.talhao_nome ?? null,
          }}
          propriedadeId={propriedadeAtual.id}
          onClose={() => setCulturaHistorico(null)}
        />
      )}
    </div>
  )
}
