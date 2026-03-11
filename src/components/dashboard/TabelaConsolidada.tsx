import { Card, CardContent } from '@/components/ui/card'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface PropriedadeRow {
  propriedade_id: string
  propriedade_nome: string
  total_lancamentos: number
  custo_total: number
  saldo: number
}

interface TabelaConsolidadaProps {
  data: PropriedadeRow[]
  onSelectPropriedade: (id: string) => void
}

export function TabelaConsolidada({ data, onSelectPropriedade }: TabelaConsolidadaProps) {
  if (!data.length) return null

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Propriedade</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Lançamentos</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Custo Total</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.propriedade_id}
                  className="border-b border-border cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => onSelectPropriedade(row.propriedade_id)}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{row.propriedade_nome}</td>
                  <td className="px-4 py-3 text-right text-foreground">{row.total_lancamentos}</td>
                  <td className="px-4 py-3 text-right text-foreground">{fmt(Number(row.custo_total))}</td>
                  <td className={`px-4 py-3 text-right font-medium ${Number(row.saldo) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {fmt(Number(row.saldo))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
