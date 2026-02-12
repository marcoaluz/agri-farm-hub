import { useHistoricoGeral, useEstatisticasAuditoria } from '@/hooks/useHistorico'
import { useGlobal } from '@/contexts/GlobalContext'
import { DetalhesAlteracao } from '@/components/auditoria/DetalhesAlteracao'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, Edit, Trash2, Clock } from 'lucide-react'

function getBadgeVariant(tipo: string): 'secondary' | 'destructive' | 'outline' {
  switch (tipo) {
    case 'UPDATE': return 'secondary'
    case 'DELETE': return 'destructive'
    default: return 'outline'
  }
}

function getTipoLabel(tipo: string) {
  switch (tipo) {
    case 'UPDATE': return 'Editado'
    case 'DELETE': return 'Excluído'
    default: return tipo
  }
}




export default function Auditoria() {
  const { propriedadeAtual } = useGlobal()
  const { data: historico, isLoading } = useHistoricoGeral(propriedadeAtual?.id)
  const { data: stats } = useEstatisticasAuditoria(propriedadeAtual?.id)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Auditoria</h1>
        <p className="text-muted-foreground">Histórico de edições e exclusões de lançamentos</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Edições</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.edicoes}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Exclusões</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.exclusoes}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Últimas 24h</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.ultimas24h}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas 100 Alterações</CardTitle>
        </CardHeader>
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
            ) : !historico?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhuma alteração registrada
                </TableCell>
              </TableRow>
            ) : (
              historico.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(item.alterado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(item.tipo_alteracao)}>
                      {getTipoLabel(item.tipo_alteracao)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.usuario_nome || item.usuario_email || item.alterado_por || 'Sistema'}
                  </TableCell>
                  <TableCell>
                    <DetalhesAlteracao item={item} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground italic max-w-[200px] truncate">
                    {item.motivo || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
