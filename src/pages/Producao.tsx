import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sprout, Plus, DollarSign, History } from 'lucide-react'
import { NovaColheitaModal } from '@/components/producao/NovaColheitaModal'
import { VenderProducaoModal } from '@/components/producao/VenderProducaoModal'
import { HistoricoProducaoModal } from '@/components/producao/HistoricoProducaoModal'

const fmtNum = (v: any) => Number(v || 0).toLocaleString('pt-BR')

export default function Producao() {
  const { propriedadeAtual, safraAtual } = useGlobal()
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

  // Colheitas detalhadas (por talhão)
  const { data: colheitas, isLoading: loadColheitas } = useQuery({
    queryKey: ['colheitas-talhao', propriedadeAtual?.id, safraAtual?.id],
    queryFn: async () => {
      const select = `
        id, data_colheita, quantidade, area_colhida, observacoes,
        talhao:talhoes(id, nome, area_ha),
        cultura:culturas_config(id, nome_exibicao, unidade_label, icone)
      `
      const base = await (supabase as any)
        .from('colheitas')
        .select(select)
        .eq('propriedade_id', propriedadeAtual!.id)
        .eq('safra_id', safraAtual!.id)
        .order('data_colheita', { ascending: false })

      if (!base.error) return (base.data || []) as any[]

      // Fallback: base legada em "producoes"
      const alt = await (supabase as any)
        .from('producoes')
        .select(`
          id, data_colheita, quantidade_colhida, area_colhida, observacoes,
          talhao:talhoes(id, nome, area_ha),
          cultura:culturas_config(id, nome_exibicao, unidade_label, icone)
        `)
        .eq('propriedade_id', propriedadeAtual!.id)
        .eq('safra_id', safraAtual!.id)
        .order('data_colheita', { ascending: false })
      if (alt.error) throw alt.error
      return (alt.data || []).map((r: any) => ({ ...r, quantidade: r.quantidade_colhida })) as any[]
    },
    enabled: !!propriedadeAtual?.id && !!safraAtual?.id,
  })

  const talhoes = useMemo(() => {
    if (!colheitas) return []
    const map = new Map<string, any>()
    colheitas.forEach((c: any) => {
      const key = c.talhao?.id || 'sem-talhao'
      if (!map.has(key)) {
        map.set(key, {
          talhao_id: c.talhao?.id || null,
          talhao_nome: c.talhao?.nome || 'Sem talhão',
          area_ha: Number(c.talhao?.area_ha || 0),
          cultura_id: c.cultura?.id,
          cultura_nome: c.cultura?.nome_exibicao,
          unidade_label: c.cultura?.unidade_label || 'un',
          colheitas: [],
          total_colhido: 0,
          area_colhida: 0,
        })
      }
      const entry = map.get(key)
      entry.colheitas.push(c)
      entry.total_colhido += Number(c.quantidade || 0)
      entry.area_colhida += Number(c.area_colhida || 0)
    })
    return Array.from(map.values())
  }, [colheitas])

  const abrirDetalhesTalhao = (talhao: any) => {
    setTalhaoSelecionado(talhao)
    setShowNovaColheita(true)
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
        <Button onClick={() => setShowNovaColheita(true)} className="gap-2">
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
            className="mb-4 flex flex-col gap-4 rounded-lg bg-muted/30 p-4 sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-fit">{cultura.cultura_nome}</Badge>
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
            <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-5">
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
              <div>
                <p className="text-xs text-muted-foreground">Receita</p>
                <p className="font-bold text-green-700">
                  R$ {receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preço médio</p>
                <p className="font-bold">
                  {precoMedio > 0
                    ? `R$ ${precoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/${cultura.unidade_label}`
                    : '—'}
                </p>
              </div>
            </div>
            {Number(cultura.estoque_disponivel) > 0 && (
              <Button size="sm" onClick={() => setCulturaVenda(cultura)} className="gap-1 self-center">
                <DollarSign className="h-3.5 w-3.5" />
                Vender
              </Button>
            )}
          </div>
        )
      })}

      {/* Cards por talhão */}
      {loadColheitas ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : talhoes.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {talhoes.map((talhao: any) => (
            <Card
              key={talhao.talhao_id || 'sem-talhao'}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => abrirDetalhesTalhao(talhao)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{talhao.talhao_nome}</CardTitle>
                  {talhao.cultura_nome && <Badge variant="outline">{talhao.cultura_nome}</Badge>}
                </div>
                {talhao.area_ha > 0 && (
                  <p className="text-xs text-muted-foreground">{talhao.area_ha} ha</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Colhido</p>
                    <p className="text-lg font-bold text-green-700">{fmtNum(talhao.total_colhido)}</p>
                    <p className="text-xs text-muted-foreground">{talhao.unidade_label}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Área colhida</p>
                    <p className="text-lg font-bold">{talhao.area_colhida} ha</p>
                  </div>
                </div>
                {talhao.area_colhida > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Produtividade: {(talhao.total_colhido / talhao.area_colhida).toFixed(1)}{' '}
                    {talhao.unidade_label}/ha
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {talhao.colheitas.length} colheita(s)
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mt-6 py-12 text-center">
          <Sprout className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Nenhuma colheita registrada</h3>
          <p className="mb-4 text-muted-foreground">Registre a primeira colheita desta safra</p>
          <Button onClick={() => setShowNovaColheita(true)}>Registrar Primeira Colheita</Button>
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
          }}
          propriedadeId={propriedadeAtual.id}
          onClose={() => setCulturaHistorico(null)}
        />
      )}
    </div>
  )
}
