import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Calendar, MoreHorizontal, Edit, Trash2, Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { ContextDebug } from '@/components/debug/ContextDebug'
import { useGlobal } from '@/contexts/GlobalContext'
import { useLancamentos, useExcluirLancamento } from '@/hooks/useLancamentos'
import { Lancamento } from '@/types/supabase-local'

export function Lancamentos() {
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const debugEnabled = useMemo(() => {
    if (!import.meta.env.DEV) return false
    return new URLSearchParams(routerLocation.search).has('debug')
  }, [routerLocation.search])

  const { safraAtual, propriedadeAtual } = useGlobal()
  const { data: lancamentos, isLoading } = useLancamentos(safraAtual?.id)
  const excluirLancamento = useExcluirLancamento()

  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; lancamento: Lancamento | null }>({
    open: false,
    lancamento: null
  })


  // Filtrar lançamentos pelo termo de busca
  const filteredLancamentos = lancamentos?.filter(lanc => {
    const searchLower = searchTerm.toLowerCase()
    return (
      lanc.servico?.nome?.toLowerCase().includes(searchLower) ||
      lanc.talhao?.nome?.toLowerCase().includes(searchLower) ||
      lanc.observacoes?.toLowerCase().includes(searchLower)
    )
  }) || []

  // Calcular estatísticas
  const stats = {
    total: filteredLancamentos.length,
    custoTotal: filteredLancamentos.reduce((acc, l) => acc + (l.custo_total || 0), 0),
    esteMes: filteredLancamentos.filter(l => {
      const dataExec = new Date(l.data_execucao)
      const hoje = new Date()
      return dataExec.getMonth() === hoje.getMonth() && dataExec.getFullYear() === hoje.getFullYear()
    }).length
  }

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
        <Button className="gap-2" onClick={handleNovoLancamento} disabled={!safraAtual}>
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      <ContextDebug
        enabled={debugEnabled}
        propriedadeAtual={propriedadeAtual}
        safraAtual={safraAtual}
        novoLancamentoDisabled={!safraAtual}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.total}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo Total
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Este Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats.esteMes}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar lançamentos..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          Período
        </Button>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      {/* Table */}
      <Card>
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
                    : searchTerm 
                      ? 'Nenhum lançamento encontrado para esta busca'
                      : 'Nenhum lançamento cadastrado nesta safra'
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredLancamentos.map((lancamento) => (
                <TableRow key={lancamento.id}>
                  <TableCell>{formatDate(lancamento.data_execucao)}</TableCell>
                  <TableCell className="font-medium">
                    {lancamento.servico?.nome || 'Serviço não encontrado'}
                  </TableCell>
                  <TableCell>
                    {lancamento.talhao ? (
                      <Badge variant="outline">{lancamento.talhao.nome}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lancamento.lancamentos_itens?.length || 0} {(lancamento.lancamentos_itens?.length || 0) === 1 ? 'item' : 'itens'}
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
                        <DropdownMenuItem onClick={() => handleEditar(lancamento.id)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeleteDialog({ open: true, lancamento })}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
    </div>
  )
}
