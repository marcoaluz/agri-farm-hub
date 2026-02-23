import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, ExternalLink, MapPin, Leaf, Package, DollarSign } from 'lucide-react'

interface LoteConsumosCardProps {
  loteId: string
  produtoId: string
  dataEntrada: string
  onNavigate: (lancamentoId: string) => void
}

interface Consumo {
  lancamento_item_id: string
  lancamento_id: string
  data_execucao: string
  servico_nome: string
  talhao_nome: string | null
  propriedade_nome: string
  quantidade: number
  custo_unitario: number
}

export function LoteConsumosCard({ loteId, produtoId, dataEntrada, onNavigate }: LoteConsumosCardProps) {
  const { data: consumos, isLoading } = useQuery({
    queryKey: ['lote-consumos', loteId],
    queryFn: async () => {
      // Try to find lancamentos via detalhamento_lotes JSONB
      const { data, error } = await supabase
        .rpc('get_lote_consumos' as any, { p_lote_id: loteId, p_produto_id: produtoId })

      if (error) {
        // Fallback: query manually if RPC doesn't exist
        console.warn('RPC get_lote_consumos not found, using fallback query')
        return await fallbackQuery(loteId, produtoId)
      }
      return data as Consumo[]
    },
  })

  if (isLoading) {
    return <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
  }

  if (!consumos || consumos.length === 0) {
    return (
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800 text-sm">
          Lançamentos encontrados no período — verifique a partir de {new Date(dataEntrada).toLocaleDateString('pt-BR')}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-2">
      {consumos.map((c) => (
        <Card
          key={c.lancamento_item_id || c.lancamento_id}
          className="cursor-pointer hover:shadow-md transition-shadow border-orange-200 bg-orange-50/50"
          onClick={() => onNavigate(c.lancamento_id)}
        >
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm flex items-center gap-1">
                📋 {c.servico_nome}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(c.data_execucao).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {c.propriedade_nome}
            </div>
            {c.talhao_nome && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Leaf className="h-3 w-3" /> {c.talhao_nome}
              </div>
            )}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" /> {c.quantidade} consumidos
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> R$ {c.custo_unitario?.toFixed(2)}/un
              </span>
            </div>
            <div className="flex justify-end pt-1">
              <span className="text-xs text-primary flex items-center gap-1 font-medium">
                Abrir Lançamento <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function fallbackQuery(loteId: string, produtoId: string): Promise<Consumo[]> {
  // Query lancamentos_itens that reference this lote in detalhamento_lotes JSONB
  const { data, error } = await supabase
    .from('lancamentos_itens')
    .select(`
      id,
      quantidade,
      custo_unitario,
      detalhamento_lotes,
      lancamento:lancamentos(
        id,
        data_execucao,
        servico:servicos(nome),
        talhao:talhoes(nome),
        propriedade:propriedades(nome)
      )
    `)
    .eq('produto_id', produtoId)

  if (error || !data) return []

  return (data as any[])
    .filter(li => {
      if (!li.detalhamento_lotes) return false
      const lotes = Array.isArray(li.detalhamento_lotes) ? li.detalhamento_lotes : []
      return lotes.some((l: any) => l.lote_id === loteId)
    })
    .map(li => ({
      lancamento_item_id: li.id,
      lancamento_id: li.lancamento?.id,
      data_execucao: li.lancamento?.data_execucao,
      servico_nome: li.lancamento?.servico?.nome || 'Serviço',
      talhao_nome: li.lancamento?.talhao?.nome || null,
      propriedade_nome: li.lancamento?.propriedade?.nome || '',
      quantidade: li.quantidade,
      custo_unitario: li.custo_unitario,
    }))
    .filter(c => c.lancamento_id)
    .sort((a, b) => new Date(b.data_execucao).getTime() - new Date(a.data_execucao).getTime())
}
