import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Sprout } from 'lucide-react'

interface EstoqueItem {
  propriedade_id: string
  propriedade_nome: string
  cultura_id: string
  cultura_nome: string
  unidade_label: string
  icone: string
  total_entradas: number
  total_saidas: number
  saldo_disponivel: number
}

export function EstoqueProducaoTabela() {
  const { data, isLoading } = useQuery({
    queryKey: ['dash-estoque-producao-consolidado'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_estoque_producao', {
        p_propriedade_id: null,
      })
      if (error) throw error
      return (data || []) as EstoqueItem[]
    },
  })

  // Group by propriedade for visual separation
  const grouped = useMemo(() => {
    if (!data?.length) return []
    const map = new Map<string, EstoqueItem[]>()
    data.forEach((item) => {
      const key = item.propriedade_nome
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    })
    return Array.from(map.entries())
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!grouped.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Sprout className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma produção registrada ainda.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Propriedade</TableHead>
            <TableHead>Cultura</TableHead>
            <TableHead className="text-right">Saldo Disponível</TableHead>
            <TableHead className="text-right">Total Entradas</TableHead>
            <TableHead className="text-right">Total Saídas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map(([propNome, items]) =>
            items.map((item, idx) => (
              <TableRow
                key={`${item.propriedade_id}-${item.cultura_id}`}
                className={Number(item.saldo_disponivel) === 0 ? 'text-muted-foreground opacity-60' : ''}
              >
                {idx === 0 ? (
                  <TableCell rowSpan={items.length} className="font-medium align-top border-r border-border">
                    {propNome}
                  </TableCell>
                ) : null}
                <TableCell>{item.cultura_nome}</TableCell>
                <TableCell className={`text-right font-medium ${Number(item.saldo_disponivel) > 0 ? 'text-success' : ''}`}>
                  {Number(item.saldo_disponivel).toLocaleString('pt-BR')} {item.unidade_label}
                </TableCell>
                <TableCell className="text-right">
                  {Number(item.total_entradas).toLocaleString('pt-BR')} {item.unidade_label}
                </TableCell>
                <TableCell className="text-right">
                  {Number(item.total_saidas).toLocaleString('pt-BR')} {item.unidade_label}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
