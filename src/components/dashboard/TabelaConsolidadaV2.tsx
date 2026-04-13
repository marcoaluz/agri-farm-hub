import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

interface ConsolidadoRow {
  propriedade_id: string
  propriedade_nome: string
  safra_ativa_nome: string | null
  area_ha: number
  custo_safra: number
  receita_paga: number
  resultado: number
  custo_por_ha: number
  lancamentos_mes: number
  total_alertas: number
}

interface Props {
  data: ConsolidadoRow[]
  isLoading: boolean
  onSelectPropriedade?: (id: string) => void
}

export function TabelaConsolidadaV2({ data, isLoading, onSelectPropriedade }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!data?.length) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Propriedade</TableHead>
            <TableHead>Safra Ativa</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="text-right">Resultado</TableHead>
            <TableHead className="text-center">Alertas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.propriedade_id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelectPropriedade?.(row.propriedade_id)}
            >
              <TableCell className="font-medium">{row.propriedade_nome}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{row.safra_ativa_nome || '—'}</TableCell>
              <TableCell className="text-right text-sm">{fmt(row.custo_safra)}</TableCell>
              <TableCell className="text-right text-sm">{fmt(row.receita_paga)}</TableCell>
              <TableCell className={`text-right text-sm font-medium ${(row.resultado ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {fmt(row.resultado)}
              </TableCell>
              <TableCell className="text-center">
                {(row.total_alertas ?? 0) > 0 ? (
                  <Badge variant="destructive" className="text-[10px] px-1.5">{row.total_alertas}</Badge>
                ) : (
                  <Badge variant="outline" className="text-success border-success/30 bg-success/5 text-[10px] px-1.5">0</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
