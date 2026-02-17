import { useState, useMemo } from 'react'
import { useHistoricoGeral, useEstatisticasAuditoria } from '@/hooks/useHistorico'
import { useGlobal } from '@/contexts/GlobalContext'
import { DetalhesAlteracao } from '@/components/auditoria/DetalhesAlteracao'
import { DialogDetalhesCompletos } from '@/components/auditoria/DialogDetalhesCompletos'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, Edit, Trash2, Clock, CalendarIcon, Plus, Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function getBadgeVariant(tipo: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (tipo) {
    case 'INSERT': return 'default'
    case 'UPDATE': return 'secondary'
    case 'DELETE': return 'destructive'
    default: return 'outline'
  }
}

function getBadgeClass(tipo: string): string {
  switch (tipo) {
    case 'INSERT': return 'bg-green-600 hover:bg-green-700 text-white'
    case 'UPDATE': return 'bg-blue-600 hover:bg-blue-700 text-white'
    case 'DELETE': return 'bg-red-600 hover:bg-red-700 text-white'
    default: return ''
  }
}

function getTipoLabel(tipo: string) {
  switch (tipo) {
    case 'INSERT': return 'Criado'
    case 'UPDATE': return 'Editado'
    case 'DELETE': return 'Excluído'
    default: return tipo
  }
}

export default function Auditoria() {
  const { propriedadeAtual, safraAtual } = useGlobal()
  const { data: historico, isLoading } = useHistoricoGeral(propriedadeAtual?.id, safraAtual?.id)
  const { data: stats } = useEstatisticasAuditoria(propriedadeAtual?.id, safraAtual?.id)

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [dataFiltro, setDataFiltro] = useState<Date | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Dias que têm atividade (para marcar no calendário)
  // Dias que têm atividade de auditoria (baseado em QUANDO a ação ocorreu)
  const diasComAtividade = useMemo(() => {
    if (!historico) return []
    const dias = new Set<string>()
    historico.forEach(item => {
      // SEMPRE usar alterado_em (data/hora da ação de auditoria)
      const dataAcao = new Date(item.alterado_em)
      dias.add(format(dataAcao, 'yyyy-MM-dd'))
    })
    // Adicionar T12:00:00 para evitar problemas de fuso horário
    return Array.from(dias).map(d => new Date(d + 'T12:00:00'))
  }, [historico])

  // Filtrar histórico
  const historicoFiltrado = useMemo(() => {
    if (!historico) return []
    return historico.filter(item => {
      if (filtroTipo !== 'todos' && item.tipo_alteracao !== filtroTipo) return false
      if (dataFiltro && !isSameDay(new Date(item.alterado_em), dataFiltro)) return false
      return true
    })
  }, [historico, filtroTipo, dataFiltro])

  const temFiltrosAtivos = filtroTipo !== 'todos' || dataFiltro !== undefined

  const limparFiltros = () => {
    setFiltroTipo('todos')
    setDataFiltro(undefined)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Auditoria</h1>
        <p className="text-muted-foreground">Histórico de criações, edições e exclusões de lançamentos</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className={cn("cursor-pointer transition-all", filtroTipo === 'todos' && temFiltrosAtivos && "ring-2 ring-primary")}
          onClick={() => setFiltroTipo('todos')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Ações</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn("cursor-pointer transition-all", filtroTipo === 'INSERT' && "ring-2 ring-green-500")}
          onClick={() => setFiltroTipo(filtroTipo === 'INSERT' ? 'todos' : 'INSERT')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Criações</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.insercoes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn("cursor-pointer transition-all", filtroTipo === 'UPDATE' && "ring-2 ring-blue-500")}
          onClick={() => setFiltroTipo(filtroTipo === 'UPDATE' ? 'todos' : 'UPDATE')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Edições</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.edicoes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn("cursor-pointer transition-all", filtroTipo === 'DELETE' && "ring-2 ring-red-500")}
          onClick={() => setFiltroTipo(filtroTipo === 'DELETE' ? 'todos' : 'DELETE')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Exclusões</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold">{stats.exclusoes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filtros:
            </div>

            {/* Filtro por Tipo */}
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="INSERT">✅ Criações</SelectItem>
                <SelectItem value="UPDATE">✏️ Edições</SelectItem>
                <SelectItem value="DELETE">🗑️ Exclusões</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por Data - Calendário */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-2", dataFiltro && "text-foreground")}>
                  <CalendarIcon className="h-4 w-4" />
                  {dataFiltro
                    ? format(dataFiltro, 'dd/MM/yyyy', { locale: ptBR })
                    : 'Filtrar por data'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFiltro}
                  onSelect={(date) => {
                    setDataFiltro(date)
                    setCalendarOpen(false)
                  }}
                  locale={ptBR}
                  modifiers={{
                    hasActivity: diasComAtividade
                  }}
                  modifiersClassNames={{
                    hasActivity: 'relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full'
                  }}
                  initialFocus
                />
                {dataFiltro && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setDataFiltro(undefined)}
                    >
                      Limpar data
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Botão Limpar Filtros */}
            {temFiltrosAtivos && (
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={limparFiltros}>
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            )}

            {/* Contador de resultados */}
            <span className="text-xs text-muted-foreground ml-auto">
              {historicoFiltrado.length} registro{historicoFiltrado.length !== 1 ? 's' : ''}
              {temFiltrosAtivos && ` de ${historico?.length || 0}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            {dataFiltro
              ? `Alterações em ${format(dataFiltro, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
              : 'Últimas 100 Alterações'
            }
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Detalhes</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                </TableRow>
              ))
            ) : !historicoFiltrado.length ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {temFiltrosAtivos
                    ? 'Nenhum registro encontrado com os filtros aplicados'
                    : 'Nenhuma alteração registrada'
                  }
                </TableCell>
              </TableRow>
            ) : (
              historicoFiltrado.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(item.alterado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(item.tipo_alteracao)} className={getBadgeClass(item.tipo_alteracao)}>
                      {getTipoLabel(item.tipo_alteracao)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.usuario_nome || item.usuario_email || item.alterado_por || 'Sistema'}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <DetalhesAlteracao item={item} />
                      <DialogDetalhesCompletos item={item} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground italic max-w-[200px] truncate">
                    {item.motivo || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  )
}
