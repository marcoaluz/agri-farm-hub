import { useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useGlobal } from '@/contexts/GlobalContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Pencil, DollarSign, TrendingUp, AlertTriangle, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmt = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

const safe = (v: any): number => {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

const categoriasLabel: Record<string, string> = {
  insumos: 'Insumos', combustivel: 'Combustível', manutencao: 'Manutenção',
  mao_de_obra: 'Mão de Obra', arrendamento: 'Arrendamento', maquinario: 'Maquinário',
  venda_producao: 'Venda Produção', servicos_terceiros: 'Serviços Terceiros',
  impostos: 'Impostos', sanidade_animal: 'Sanidade Animal', alimentacao_animal: 'Alimentação / Ração',
  compra_animais: 'Compra de Animais', venda_animais: 'Venda de Animais', outros: 'Outros',
}

interface OrcamentoRow {
  categoria: string
  valor_planejado: number
  valor_realizado: number
  diferenca: number
  percentual_exec: number
  status_orcamento: 'ok' | 'proximo' | 'acima' | 'sem_orcamento'
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

function StatusOrcamentoBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ok: { label: 'Dentro do orçamento', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' },
    proximo: { label: 'Próximo do limite', cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' },
    acima: { label: 'Acima do orçamento', cls: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
    sem_orcamento: { label: 'Sem orçamento', cls: 'bg-muted text-muted-foreground border-border' },
  }
  const s = map[status] || map.sem_orcamento
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>
}

/* ------------------------------------------------------------------ */
/*  Progress bar with colour                                           */
/* ------------------------------------------------------------------ */

function ProgressOrcamento({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100)
  const colorCls =
    pct > 100 ? '[&>div]:bg-red-500' :
    pct >= 90 ? '[&>div]:bg-amber-500' :
    '[&>div]:bg-emerald-500'

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress value={clamped} className={cn('h-2 flex-1', colorCls)} />
      <span className={cn('text-xs font-medium tabular-nums w-12 text-right',
        pct > 100 ? 'text-red-600 dark:text-red-400' :
        pct >= 90 ? 'text-amber-600 dark:text-amber-400' :
        'text-emerald-600 dark:text-emerald-400'
      )}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Edit modal                                                         */
/* ------------------------------------------------------------------ */

function EditarOrcamentoModal({
  open, onClose, rows, propId, safraId, userId,
}: {
  open: boolean
  onClose: () => void
  rows: OrcamentoRow[]
  propId: string
  safraId: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const [valores, setValores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Initialise from rows
  const categorias = useMemo(() => {
    const cats = new Set<string>()
    rows.forEach(r => cats.add(r.categoria))
    // Also add all known categories
    Object.keys(categoriasLabel).forEach(c => cats.add(c))
    return Array.from(cats).sort((a, b) =>
      (categoriasLabel[a] || a).localeCompare(categoriasLabel[b] || b)
    )
  }, [rows])

  // Reset values when opening
  useMemo(() => {
    if (open) {
      const init: Record<string, string> = {}
      rows.forEach(r => {
        if (safe(r.valor_planejado) > 0) {
          init[r.categoria] = safe(r.valor_planejado).toFixed(2)
        }
      })
      setValores(init)
    }
  }, [open, rows])

  const handleSave = async () => {
    setSaving(true)
    try {
      const upserts = Object.entries(valores)
        .filter(([_, v]) => v && parseFloat(v) > 0)
        .map(([categoria, valor]) => ({
          safra_id: safraId,
          propriedade_id: propId,
          categoria,
          valor_planejado: parseFloat(valor),
          criado_por: userId,
        }))

      if (upserts.length === 0) {
        toast.info('Nenhum valor informado')
        setSaving(false)
        return
      }

      const { error } = await supabase
        .from('orcamento_safra')
        .upsert(upserts, { onConflict: 'safra_id,propriedade_id,categoria' })

      if (error) throw error

      toast.success('Orçamento salvo com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['orcamento-vs-realizado'] })
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao salvar: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Orçamento</DialogTitle>
          <DialogDescription>
            Informe o valor planejado para cada categoria. Categorias com gasto real aparecem primeiro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {categorias.map(cat => {
            const row = rows.find(r => r.categoria === cat)
            const realizado = safe(row?.valor_realizado)
            return (
              <div key={cat} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                <div>
                  <Label className="text-sm font-medium">
                    {categoriasLabel[cat] || cat}
                  </Label>
                  {realizado > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Realizado: {fmt(realizado)}
                    </p>
                  )}
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="w-32 text-right"
                  value={valores[cat] || ''}
                  onChange={e => setValores(v => ({ ...v, [cat]: e.target.value }))}
                />
                <span className="text-xs text-muted-foreground w-6">R$</span>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Orçamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OrcamentoSafra() {
  const { propriedadeAtual, safraAtual } = useGlobal()
  const { user } = useAuth()
  const propId = propriedadeAtual?.id
  const safraId = safraAtual?.id

  const [editOpen, setEditOpen] = useState(false)

  const { data: rows = [], isLoading } = useQuery<OrcamentoRow[]>({
    queryKey: ['orcamento-vs-realizado', propId, safraId],
    queryFn: async () => {
      if (!propId || !safraId) return []
      const { data, error } = await supabase.rpc('get_orcamento_vs_realizado', {
        p_prop: propId,
        p_safra: safraId,
      })
      if (error) {
        console.error('Erro orcamento:', error.message)
        toast.error('Erro ao carregar orçamento: ' + error.message)
        return []
      }
      return (data || []).map((r: any) => ({
        categoria: r.categoria,
        valor_planejado: safe(r.valor_planejado),
        valor_realizado: safe(r.valor_realizado),
        diferenca: safe(r.diferenca),
        percentual_exec: safe(r.percentual_exec),
        status_orcamento: r.status_orcamento || 'sem_orcamento',
      }))
    },
    enabled: !!propId && !!safraId,
  })

  // Totals
  const totais = useMemo(() => {
    let planejado = 0, realizado = 0
    rows.forEach(r => {
      planejado += r.valor_planejado
      realizado += r.valor_realizado
    })
    return { planejado, realizado, diferenca: planejado - realizado }
  }, [rows])

  // Chart data
  const chartData = useMemo(() =>
    rows
      .filter(r => r.valor_planejado > 0 || r.valor_realizado > 0)
      .map(r => ({
        categoria: categoriasLabel[r.categoria] || r.categoria,
        Planejado: r.valor_planejado,
        Realizado: r.valor_realizado,
      }))
      .sort((a, b) => b.Planejado - a.Planejado),
    [rows],
  )

  // KPI cards
  const totalPctExec = totais.planejado > 0
    ? (totais.realizado / totais.planejado) * 100 : 0
  const catAcima = rows.filter(r => r.status_orcamento === 'acima').length

  if (!propId || !safraId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Selecione uma propriedade e safra para ver o orçamento.
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Orçamento da Safra</h1>
          <p className="text-muted-foreground">Planejado vs Realizado por categoria</p>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" /> Editar Orçamento
        </Button>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" /> Orçamento Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(totais.planejado)}</div>
              <p className="text-xs text-muted-foreground mt-1">{rows.filter(r => r.valor_planejado > 0).length} categorias planejadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Realizado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(totais.realizado)}</div>
              <p className="text-xs text-muted-foreground mt-1">{totalPctExec.toFixed(0)}% do orçamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Saldo Orçamentário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', totais.diferenca >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {fmt(totais.diferenca)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{totais.diferenca >= 0 ? 'Dentro do limite' : 'Acima do planejado'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Categorias Acima
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', catAcima > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {catAcima}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{catAcima === 0 ? 'Nenhuma categoria estourada' : `${catAcima} categoria(s) acima do limite`}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orçamento vs Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Nenhum dado encontrado. Clique em "Editar Orçamento" para começar.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Planejado</TableHead>
                    <TableHead className="text-right">Realizado</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead>% Executado</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.categoria}>
                      <TableCell className="font-medium">{categoriasLabel[r.categoria] || r.categoria}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.valor_planejado)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.valor_realizado)}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', r.diferenca >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {fmt(r.diferenca)}
                      </TableCell>
                      <TableCell>
                        {r.valor_planejado > 0 ? (
                          <ProgressOrcamento pct={r.percentual_exec} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell><StatusOrcamentoBadge status={r.status_orcamento} /></TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(totais.planejado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(totais.realizado)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', totais.diferenca >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {fmt(totais.diferenca)}
                    </TableCell>
                    <TableCell>
                      {totais.planejado > 0 && <ProgressOrcamento pct={totalPctExec} />}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="p-4">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-base">Comparativo por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 45)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={12} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="categoria" fontSize={11} width={110} />
                <ReTooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="Planejado" fill="hsl(199, 89%, 48%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Realizado" fill="hsl(30, 85%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Edit modal */}
      {user && (
        <EditarOrcamentoModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          rows={rows}
          propId={propId}
          safraId={safraId}
          userId={user.id}
        />
      )}
    </div>
  )
}
