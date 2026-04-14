import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Calendar as CalendarIcon, MoreHorizontal, Edit, Trash2, Eye, Loader2, History, Lock, ChevronLeft, ChevronRight, X, Fuel, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { HistoricoDialog } from '@/components/auditoria/HistoricoDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useExcluirLancamento } from '@/hooks/useLancamentos'
import { useSafraFechada } from '@/hooks/useSafraFechamento'
import { useTalhoes } from '@/hooks/useTalhoes'
import { format, addDays, subDays, isToday, parseISO, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function Lancamentos() {
  const navigate = useNavigate()
  const routerLocation = useLocation()

  const { safraAtual, propriedadeAtual } = useGlobal()
  const { data: lancamentos, isLoading } = useQuery({
    queryKey: ['lancamentos', safraAtual?.id],
    queryFn: async () => {
      if (!safraAtual?.id) return []

      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          *,
          servico:servicos(id, nome),
          talhao:talhoes(id, nome),
          lancamentos_itens(
            id,
            produto_id,
            maquina_id,
            quantidade,
            custo_unitario,
            custo_total
          ),
          abastecimento:abastecimentos(
            id,
            data,
            horimetro,
            combustivel_tipo,
            quantidade_litros,
            posto,
            observacoes,
            maquina:maquinas(nome, modelo)
          )
        `)
        .eq('safra_id', safraAtual.id)
        .order('data_execucao', { ascending: false })

      if (error) throw error
      return data as any[]
    },
    enabled: !!safraAtual?.id
  })
  const { data: safraFechada } = useSafraFechada(safraAtual?.id)
  const { data: talhoes } = useTalhoes(propriedadeAtual?.id)
  const excluirLancamento = useExcluirLancamento()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [filterTalhaoId, setFilterTalhaoId] = useState<string>('all')
  const [showAllDates, setShowAllDates] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; lancamento: any | null }>({
    open: false,
    lancamento: null
  })
  const [historicoDialog, setHistoricoDialog] = useState<{ open: boolean; lancamentoId: string }>({
    open: false,
    lancamentoId: ''
  })

  // Filtrar lançamentos
  const filteredLancamentos = useMemo(() => {
    if (!lancamentos) return []

    return lancamentos.filter(lanc => {
      // Filtro por data
      if (!showAllDates) {
        const dataExec = parseISO(lanc.data_execucao)
        if (!isSameDay(dataExec, selectedDate)) return false
      }

      // Filtro por talhão
      if (filterTalhaoId !== 'all' && lanc.talhao_id !== filterTalhaoId) return false

      // Filtro por texto
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchTexto =
          lanc.servico?.nome?.toLowerCase().includes(searchLower) ||
          lanc.talhao?.nome?.toLowerCase().includes(searchLower) ||
          lanc.observacoes?.toLowerCase().includes(searchLower)
        const matchValor = lanc.custo_total?.toString().includes(searchTerm)
        if (!matchTexto && !matchValor) return false
      }

      return true
    })
  }, [lancamentos, selectedDate, filterTalhaoId, searchTerm, showAllDates])

  // Calcular estatísticas dos lançamentos filtrados
  const stats = {
    total: filteredLancamentos.length,
    custoTotal: filteredLancamentos.reduce((acc, l) => acc + (l.custo_total || 0), 0),
    totalSafra: lancamentos?.length || 0
  }

  const handlePrevDay = () => { setSelectedDate(prev => subDays(prev, 1)); setShowAllDates(false) }
  const handleNextDay = () => { setSelectedDate(prev => addDays(prev, 1)); setShowAllDates(false) }
  const handleToday = () => { setSelectedDate(new Date()); setShowAllDates(false) }

  // Dias que possuem lançamentos (para destacar no calendário)
  const diasComLancamento = useMemo(() => {
    if (!lancamentos) return new Set<string>()
    const dias = new Set<string>()
    lancamentos.forEach(l => {
      dias.add(format(parseISO(l.data_execucao), 'yyyy-MM-dd'))
    })
    return dias
  }, [lancamentos])

  const handleNovoLancamento = () => {
    navigate('/lancamentos/novo')
  }

  const handleVerDetalhes = (id: string) => {
    navigate(`/lancamentos/${id}`)
  }

  const handleEditar = (id: string) => {
    navigate(`/lancamentos/${id}`)
  }

  const handleExcluir = async () => {
    if (!deleteDialog.lancamento) return
    await excluirLancamento.mutateAsync(deleteDialog.lancamento.id)
    setDeleteDialog({ open: false, lancamento: null })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Lançamentos</h1>
          <p className="text-muted-foreground">
            {safraAtual 
              ? `Lançamentos da ${safraAtual.nome}`
              : 'Selecione uma safra para ver os lançamentos'
            }
          </p>
        </div>
        <Button className="gap-2" onClick={handleNovoLancamento} disabled={!safraAtual || safraFechada}>
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      {safraFechada && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Esta safra está fechada. Não é possível criar, editar ou excluir lançamentos.
          </AlertDescription>
        </Alert>
      )}


      {/* Navegação por Data (Período) */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevDay} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2 h-auto py-1">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm sm:text-base capitalize">
                      {showAllDates 
                        ? 'Todos os dias'
                        : format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      }
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date)
                        setShowAllDates(false)
                      }
                    }}
                    initialFocus
                    locale={ptBR}
                    modifiers={{
                      hasLancamento: (date) => diasComLancamento.has(format(date, 'yyyy-MM-dd'))
                    }}
                    modifiersClassNames={{
                      hasLancamento: 'ring-2 ring-primary ring-offset-1'
                    }}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" onClick={handleNextDay} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {!isToday(selectedDate) && !showAllDates && (
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Hoje
                </Button>
              )}
              <Button
                variant={showAllDates ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAllDates(!showAllDates)}
              >
                {showAllDates ? 'Filtrando todos' : 'Ver todos'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats resumidos */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {showAllDates ? 'Total de Lançamentos' : 'Lançamentos do Dia'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {stats.total}
                {!showAllDates && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    / {stats.totalSafra} na safra
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {showAllDates ? 'Custo Total' : 'Custo do Dia'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.custoTotal)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo por Hectare
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {propriedadeAtual?.area_total 
                  ? formatCurrency(stats.custoTotal / propriedadeAtual.area_total)
                  : 'N/A'
                }
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros: Busca + Talhão */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por serviço, talhão, observação ou valor..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-8 w-8"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select value={filterTalhaoId} onValueChange={setFilterTalhaoId}>
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Todos os talhões" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os talhões</SelectItem>
            {talhoes?.map((talhao) => (
              <SelectItem key={talhao.id} value={talhao.id}>
                {talhao.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Talhão</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="text-right">Custo Total</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : filteredLancamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {!safraAtual 
                    ? 'Selecione uma safra para ver os lançamentos'
                    : searchTerm || filterTalhaoId !== 'all'
                      ? 'Nenhum lançamento encontrado com os filtros aplicados'
                      : !showAllDates
                        ? `Nenhum lançamento em ${format(selectedDate, "dd/MM/yyyy")}`
                        : 'Nenhum lançamento cadastrado nesta safra'
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredLancamentos.map((lancamento) => (
                <TableRow key={lancamento.id}>
                  <TableCell>{formatDate(lancamento.data_execucao)}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      {lancamento.servico?.nome || 'Serviço não encontrado'}
                      {lancamento.abastecimento && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Fuel className="h-3 w-3" />
                          Abastecimento
                        </Badge>
                      )}
                      {lancamento.lancamentos_itens?.some((li: any) => li.item?.tipo === 'maquina_hora') && (
                        <Badge variant="outline" className="gap-1 text-xs border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400">
                          <Gauge className="h-3 w-3" />
                          Horímetro
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {lancamento.talhao ? (
                      <Badge variant="outline">{lancamento.talhao.nome}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lancamento.abastecimento
                      ? `${lancamento.abastecimento?.quantidade_litros || 0}L ${lancamento.abastecimento?.combustivel_tipo || ''}`
                      : `${lancamento.lancamentos_itens?.length || 0} ${(lancamento.lancamentos_itens?.length || 0) === 1 ? 'item' : 'itens'}`
                    }
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(lancamento.custo_total || 0)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => handleVerDetalhes(lancamento.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditar(lancamento.id)} disabled={safraFechada || !!lancamento.abastecimento}>
                          <Edit className="mr-2 h-4 w-4" />
                          {lancamento.abastecimento ? 'Edição bloqueada' : 'Editar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoricoDialog({ open: true, lancamentoId: lancamento.id })}>
                          <History className="mr-2 h-4 w-4" />
                          Histórico
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeleteDialog({ open: true, lancamento })}
                          className="text-destructive focus:text-destructive"
                          disabled={safraFechada || !!lancamento.abastecimento}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {lancamento.abastecimento ? 'Excluir via Máquinas' : 'Excluir'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, lancamento: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tem certeza que deseja excluir o lançamento{' '}
                  <strong>"{deleteDialog.lancamento?.servico?.nome}"</strong>
                  {deleteDialog.lancamento?.data_execucao
                    ? ` de ${formatDate(deleteDialog.lancamento.data_execucao)}`
                    : ''}?
                </p>
                <p className="font-medium text-foreground">⚠️ Esta ação irá:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Excluir permanentemente o lançamento</li>
                  <li>Restaurar o estoque dos produtos consumidos</li>
                  <li>Não pode ser desfeita</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirLancamento.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleExcluir}
              disabled={excluirLancamento.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirLancamento.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Sim, Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HistoricoDialog
        open={historicoDialog.open}
        onOpenChange={(open) => setHistoricoDialog({ open, lancamentoId: '' })}
        lancamentoId={historicoDialog.lancamentoId}
      />
    </div>
  )
}
