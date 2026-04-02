import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Beef, Syringe, Milk, ArrowLeftRight, MapPin, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { LoteDialog } from '@/components/pecuaria/LoteDialog'
import { MovimentacaoDialog } from '@/components/pecuaria/MovimentacaoDialog'
import { EventoSanitarioDialog } from '@/components/pecuaria/EventoSanitarioDialog'
import { OrdenhaDialog } from '@/components/pecuaria/OrdenhaDialog'

const ESPECIE_EMOJI: Record<string, string> = {
  bovino_corte: '🐄', bovino_leite: '🐄', ave_postura: '🐔', ave_corte: '🐔',
  suino: '🐷', ovino: '🐑', equino: '🐎', outro: '🐾',
}
const ESPECIE_LABEL: Record<string, string> = {
  bovino_corte: 'Bovino Corte', bovino_leite: 'Bovino Leite', ave_postura: 'Ave Postura',
  ave_corte: 'Ave Corte', suino: 'Suíno', ovino: 'Ovino', equino: 'Equino', outro: 'Outro',
}
const MOV_BADGE: Record<string, string> = {
  nascimento: 'bg-green-100 text-green-800', compra: 'bg-blue-100 text-blue-800',
  venda: 'bg-yellow-100 text-yellow-800', morte: 'bg-red-100 text-red-800',
  transferencia_entrada: 'bg-gray-100 text-gray-800', transferencia_saida: 'bg-gray-100 text-gray-800',
  ajuste_entrada: 'bg-emerald-100 text-emerald-800', ajuste_saida: 'bg-orange-100 text-orange-800',
}

export default function Pecuaria() {
  const { propriedadeAtual } = useGlobal()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const propId = propriedadeAtual?.id

  // Dialogs state
  const [loteDialog, setLoteDialog] = useState(false)
  const [editLote, setEditLote] = useState<any>(null)
  const [movDialog, setMovDialog] = useState(false)
  const [movRebanhoId, setMovRebanhoId] = useState<string | undefined>()
  const [sanitarioDialog, setSanitarioDialog] = useState(false)
  const [ordenhaDialog, setOrdenhaDialog] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Filters
  const [filtroSanTipo, setFiltroSanTipo] = useState('todos')
  const [filtroSanRebanho, setFiltroSanRebanho] = useState('todos')
  const [paginaOrdenha, setPaginaOrdenha] = useState(0)

  // === QUERIES ===
  const { data: rebanhos, isLoading: loadingRebanhos } = useQuery({
    queryKey: ['rebanhos', propId],
    queryFn: async () => {
      const { data, error } = await supabase.from('rebanhos' as any).select('*').eq('propriedade_id', propId).eq('ativo', true).order('nome')
      if (error) throw error
      return data as any[]
    },
    enabled: !!propId,
  })

  const rebanhosLeite = useMemo(() => (rebanhos || []).filter((r: any) => r.especie === 'bovino_leite'), [rebanhos])

  const { data: movimentacoes, isLoading: loadingMov } = useQuery({
    queryKey: ['rebanho-movimentacoes', propId],
    queryFn: async () => {
      const { data, error } = await supabase.from('rebanho_movimentacoes' as any)
        .select('*, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .order('data_evento', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as any[]
    },
    enabled: !!propId,
  })

  const { data: eventosSanitarios, isLoading: loadingSan } = useQuery({
    queryKey: ['sanitario-eventos', propId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sanitario_eventos' as any)
        .select('*, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .order('data_aplicacao', { ascending: false })
      if (error) throw error
      return data as any[]
    },
    enabled: !!propId,
  })

  const { data: ordenhas, isLoading: loadingOrdenha } = useQuery({
    queryKey: ['ordenhas', propId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ordenhas' as any)
        .select('*, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .order('data', { ascending: false })
      if (error) throw error
      return data as any[]
    },
    enabled: !!propId,
  })

  // === DERIVED DATA ===
  const totalAnimais = (rebanhos || []).reduce((s: number, r: any) => s + (r.quantidade_atual || 0), 0)
  const totalLotes = (rebanhos || []).length

  const valorRebanho = useMemo(() => {
    if (!movimentacoes) return 0
    return movimentacoes.reduce((s: number, m: any) => {
      if (m.tipo === 'compra') return s + (m.valor_total || 0)
      if (m.tipo === 'venda') return s - (m.valor_total || 0)
      return s
    }, 0)
  }, [movimentacoes])

  const eventosProximos = useMemo(() => {
    if (!eventosSanitarios) return 0
    const limite = addDays(new Date(), 30)
    return eventosSanitarios.filter((e: any) => e.data_proxima && new Date(e.data_proxima) <= limite).length
  }, [eventosSanitarios])

  // Leite KPIs
  const mesAtual = useMemo(() => {
    const now = new Date()
    const inicio = startOfMonth(now)
    const fim = endOfMonth(now)
    const ordsMes = (ordenhas || []).filter((o: any) => {
      const d = new Date(o.data)
      return d >= inicio && d <= fim
    })
    const totalLitros = ordsMes.reduce((s: number, o: any) => s + Number(o.litros || 0), 0)
    const diasUnicos = new Set(ordsMes.map((o: any) => o.data)).size
    const receitaMes = ordsMes.reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0)
    const vacasLact = new Set(ordsMes.map((o: any) => o.rebanho_id)).size
    return { totalLitros, mediaDiaria: diasUnicos > 0 ? totalLitros / diasUnicos : 0, receitaMes, vacasLact }
  }, [ordenhas])

  // Chart data - últimos 30 dias
  const chartData = useMemo(() => {
    if (!ordenhas) return []
    const now = new Date()
    const map: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = format(addDays(now, -i), 'yyyy-MM-dd')
      map[d] = 0
    }
    ordenhas.forEach((o: any) => { if (map[o.data] !== undefined) map[o.data] += Number(o.litros || 0) })
    return Object.entries(map).map(([data, litros]) => ({ data: format(new Date(data), 'dd/MM'), litros }))
  }, [ordenhas])

  // Filtered sanitario
  const eventosFiltrados = useMemo(() => {
    let filtered = eventosSanitarios || []
    if (filtroSanTipo !== 'todos') filtered = filtered.filter((e: any) => e.tipo === filtroSanTipo)
    if (filtroSanRebanho !== 'todos') filtered = filtered.filter((e: any) => e.rebanho_id === filtroSanRebanho)
    return filtered
  }, [eventosSanitarios, filtroSanTipo, filtroSanRebanho])

  // Paginated ordenhas
  const ordenhasPaginadas = useMemo(() => (ordenhas || []).slice(paginaOrdenha * 10, (paginaOrdenha + 1) * 10), [ordenhas, paginaOrdenha])

  // Delete rebanho
  async function handleDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('rebanhos' as any).update({ ativo: false }).eq('id', deleteId)
    if (error) toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
    else {
      toast({ title: 'Lote excluído' })
      queryClient.invalidateQueries({ queryKey: ['rebanhos'] })
    }
    setDeleteId(null)
  }

  if (!propId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Beef className="h-6 w-6" /> Pecuária</h1>
        <Card className="mt-6"><CardContent className="py-12 text-center text-muted-foreground">Selecione uma propriedade para gerenciar a pecuária.</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Beef className="h-6 w-6" /> Pecuária</h1>

      <Tabs defaultValue="rebanho">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="rebanho">🐄 Rebanho</TabsTrigger>
          <TabsTrigger value="sanidade">💉 Sanidade</TabsTrigger>
          <TabsTrigger value="leite">🥛 Leite</TabsTrigger>
          <TabsTrigger value="movimentacoes">↔️ Movimentações</TabsTrigger>
        </TabsList>

        {/* ========= ABA REBANHO ========= */}
        <TabsContent value="rebanho" className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingRebanhos ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
              <>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total de Animais</p><p className="text-2xl font-bold">{totalAnimais}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Lotes Ativos</p><p className="text-2xl font-bold">{totalLotes}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Valor Estimado</p><p className="text-2xl font-bold">R$ {valorRebanho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Eventos Sanitários</p><p className="text-2xl font-bold">{eventosProximos}<span className="text-sm font-normal text-muted-foreground ml-1">próx. 30d</span></p></CardContent></Card>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => { setEditLote(null); setLoteDialog(true) }}><Plus className="h-4 w-4 mr-1" /> Novo Lote</Button>
          </div>

          {loadingRebanhos ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />) : !rebanhos?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Beef className="h-12 w-12 mx-auto mb-2 opacity-40" /><p>Nenhum lote cadastrado.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rebanhos.map((r: any) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-2xl">{ESPECIE_EMOJI[r.especie] || '🐾'}</span>
                        {r.nome}
                      </CardTitle>
                      <Badge variant="secondary">{ESPECIE_LABEL[r.especie] || r.especie}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Quantidade:</span> <strong>{r.quantidade_atual}</strong></div>
                      {r.raca && <div><span className="text-muted-foreground">Raça:</span> {r.raca}</div>}
                      {r.finalidade && <div><span className="text-muted-foreground">Finalidade:</span> {r.finalidade}</div>}
                      {r.localizacao && <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{r.localizacao}</div>}
                    </div>
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => { setMovRebanhoId(r.id); setMovDialog(true) }}>
                        <ArrowLeftRight className="h-3 w-3 mr-1" /> Movimentação
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditLote(r); setLoteDialog(true) }}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========= ABA SANIDADE ========= */}
        <TabsContent value="sanidade" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Select value={filtroSanTipo} onValueChange={setFiltroSanTipo}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="vacina">Vacina</SelectItem>
                  <SelectItem value="vermifugacao">Vermifugação</SelectItem>
                  <SelectItem value="medicamento">Medicamento</SelectItem>
                  <SelectItem value="exame">Exame</SelectItem>
                  <SelectItem value="cirurgia">Cirurgia</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroSanRebanho} onValueChange={setFiltroSanRebanho}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Rebanho" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(rebanhos || []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setSanitarioDialog(true)}><Plus className="h-4 w-4 mr-1" /> Registrar Evento</Button>
          </div>

          {loadingSan ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />) : !eventosFiltrados.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Syringe className="h-12 w-12 mx-auto mb-2 opacity-40" /><p>Nenhum evento sanitário registrado.</p></CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {eventosFiltrados.map((e: any) => {
                const isProximo = e.data_proxima && new Date(e.data_proxima) <= addDays(new Date(), 30)
                const tipoIcon = e.tipo === 'vacina' ? '💉' : e.tipo === 'exame' ? '🔬' : '💊'
                return (
                  <Card key={e.id} className={isProximo ? 'border-destructive/50' : ''}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{tipoIcon}</span>
                            <span className="font-medium capitalize">{e.tipo}</span>
                            {isProximo && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Próximo</Badge>}
                          </div>
                          <p className="text-sm">{e.descricao}</p>
                          <div className="text-xs text-muted-foreground flex gap-3">
                            <span>Aplicação: {format(new Date(e.data_aplicacao), 'dd/MM/yyyy')}</span>
                            {e.data_proxima && <span>Próxima: {format(new Date(e.data_proxima), 'dd/MM/yyyy')}</span>}
                            {e.rebanho && <span>Rebanho: {(e.rebanho as any).nome}</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ========= ABA LEITE ========= */}
        <TabsContent value="leite" className="space-y-4">
          {!rebanhosLeite.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Milk className="h-12 w-12 mx-auto mb-2 opacity-40" /><p>Nenhum rebanho leiteiro cadastrado.</p><p className="text-xs mt-1">Cadastre um lote com espécie "Bovino Leite" para habilitar esta aba.</p></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Litros no Mês</p><p className="text-2xl font-bold">{mesAtual.totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Média Diária</p><p className="text-2xl font-bold">{mesAtual.mediaDiaria.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Receita do Mês</p><p className="text-2xl font-bold">R$ {mesAtual.receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Rebanhos Leite</p><p className="text-2xl font-bold">{rebanhosLeite.length}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Produção Diária (30 dias)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="litros" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={() => setOrdenhaDialog(true)}><Plus className="h-4 w-4 mr-1" /> Registrar Ordenha</Button>
              </div>

              {loadingOrdenha ? <Skeleton className="h-48" /> : !ordenhas?.length ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma ordenha registrada.</CardContent></Card>
              ) : (
                <>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Turno</TableHead>
                          <TableHead>Litros</TableHead>
                          <TableHead>Vacas</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ordenhasPaginadas.map((o: any) => (
                          <TableRow key={o.id}>
                            <TableCell>{format(new Date(o.data), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="capitalize">{o.turno}</TableCell>
                            <TableCell>{Number(o.litros).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</TableCell>
                            <TableCell>{o.vacas_ordenhadas || '-'}</TableCell>
                            <TableCell className="capitalize">{o.destino?.replace('_', ' ') || '-'}</TableCell>
                            <TableCell className="text-right">{o.valor_total ? `R$ ${Number(o.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                  {(ordenhas?.length || 0) > 10 && (
                    <div className="flex justify-center gap-2">
                      <Button size="sm" variant="outline" disabled={paginaOrdenha === 0} onClick={() => setPaginaOrdenha(p => p - 1)}>Anterior</Button>
                      <span className="text-sm text-muted-foreground py-2">Página {paginaOrdenha + 1} de {Math.ceil((ordenhas?.length || 0) / 10)}</span>
                      <Button size="sm" variant="outline" disabled={(paginaOrdenha + 1) * 10 >= (ordenhas?.length || 0)} onClick={() => setPaginaOrdenha(p => p + 1)}>Próxima</Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* ========= ABA MOVIMENTAÇÕES ========= */}
        <TabsContent value="movimentacoes" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setMovRebanhoId(undefined); setMovDialog(true) }}><Plus className="h-4 w-4 mr-1" /> Nova Movimentação</Button>
          </div>

          {loadingMov ? <Skeleton className="h-48" /> : !movimentacoes?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><ArrowLeftRight className="h-12 w-12 mx-auto mb-2 opacity-40" /><p>Nenhuma movimentação registrada.</p></CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Rebanho</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>{format(new Date(m.data_evento), 'dd/MM/yyyy')}</TableCell>
                      <TableCell><Badge className={MOV_BADGE[m.tipo] || 'bg-muted text-foreground'} variant="secondary">{m.tipo?.replace('_', ' ')}</Badge></TableCell>
                      <TableCell>{(m.rebanho as any)?.nome || '-'}</TableCell>
                      <TableCell>{m.quantidade}</TableCell>
                      <TableCell className="text-right">{m.valor_total ? `R$ ${Number(m.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{m.observacoes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <LoteDialog open={loteDialog} onOpenChange={setLoteDialog} propriedadeId={propId} lote={editLote} />
      <MovimentacaoDialog open={movDialog} onOpenChange={setMovDialog} propriedadeId={propId} rebanhos={rebanhos || []} rebanhoIdInicial={movRebanhoId} />
      <EventoSanitarioDialog open={sanitarioDialog} onOpenChange={setSanitarioDialog} propriedadeId={propId} rebanhos={rebanhos || []} />
      <OrdenhaDialog open={ordenhaDialog} onOpenChange={setOrdenhaDialog} propriedadeId={propId} rebanhosLeite={rebanhosLeite} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote?</AlertDialogTitle>
            <AlertDialogDescription>O lote será desativado e não aparecerá mais na listagem.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
