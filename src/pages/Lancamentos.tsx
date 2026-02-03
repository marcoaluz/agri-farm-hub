import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Calendar, MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react'
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
import { useGlobal } from '@/contexts/GlobalContext'
import { useAuth } from '@/contexts/AuthContext'
import { useLancamentos, useSolicitarEdicao, useSolicitarExclusao } from '@/hooks/useLancamentos'
import { SolicitacaoDialog } from '@/components/lancamentos/SolicitacaoDialog'
import { Lancamento } from '@/types/supabase-local'

export function Lancamentos() {
  const navigate = useNavigate()
  const { safraAtual, propriedadeAtual } = useGlobal()
  const { user } = useAuth()
  const { data: lancamentos, isLoading } = useLancamentos(safraAtual?.id)
  const solicitarEdicao = useSolicitarEdicao()
  const solicitarExclusao = useSolicitarExclusao()

  const [searchTerm, setSearchTerm] = useState('')
  const [dialogState, setDialogState] = useState<{
    open: boolean
    tipo: 'edicao' | 'exclusao'
    lancamento: Lancamento | null
  }>({
    open: false,
    tipo: 'edicao',
    lancamento: null
  })

  // Verificar se o usuário atual é o proprietário
  const isProprietario = propriedadeAtual?.user_id === user?.id

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

  const handleSolicitarEdicao = (lancamento: Lancamento) => {
    if (isProprietario) {
      // Proprietário pode editar diretamente
      navigate(`/lancamentos/${lancamento.id}`)
    } else {
      // Outros usuários precisam solicitar aprovação
      setDialogState({ open: true, tipo: 'edicao', lancamento })
    }
  }

  const handleSolicitarExclusao = (lancamento: Lancamento) => {
    setDialogState({ open: true, tipo: 'exclusao', lancamento })
  }

  const handleConfirmSolicitacao = async (motivo: string) => {
    if (!dialogState.lancamento || !user) return

    if (dialogState.tipo === 'edicao') {
      await solicitarEdicao.mutateAsync({
        lancamentoId: dialogState.lancamento.id,
        motivo,
        usuarioId: user.id
      })
    } else {
      await solicitarExclusao.mutateAsync({
        lancamentoId: dialogState.lancamento.id,
        motivo,
        usuarioId: user.id
      })
    }

    setDialogState({ open: false, tipo: 'edicao', lancamento: null })
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
              // Loading skeletons
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
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleVerDetalhes(lancamento.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSolicitarEdicao(lancamento)}>
                          <Edit className="mr-2 h-4 w-4" />
                          {isProprietario ? 'Editar' : 'Solicitar Edição'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleSolicitarExclusao(lancamento)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isProprietario ? 'Excluir' : 'Solicitar Exclusão'}
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

      {/* Dialog de Solicitação */}
      {dialogState.lancamento && (
        <SolicitacaoDialog
          open={dialogState.open}
          onOpenChange={(open) => setDialogState(prev => ({ ...prev, open }))}
          tipo={dialogState.tipo}
          lancamentoInfo={{
            servico: dialogState.lancamento.servico?.nome || 'Serviço',
            data: formatDate(dialogState.lancamento.data_execucao),
            custo: dialogState.lancamento.custo_total || 0
          }}
          onConfirm={handleConfirmSolicitacao}
          isLoading={solicitarEdicao.isPending || solicitarExclusao.isPending}
        />
      )}
    </div>
  )
}
