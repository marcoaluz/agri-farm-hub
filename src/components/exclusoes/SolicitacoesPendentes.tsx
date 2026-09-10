import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Loader2, ShieldAlert } from 'lucide-react'

interface Solicitacao {
  id: string
  tipo: string
  entidade_id: string
  entidade_nome?: string | null
  solicitante_nome?: string | null
  solicitante_email?: string | null
  motivo?: string | null
  status: string
  created_at?: string
}

const LABEL_TIPO: Record<string, string> = {
  propriedade: 'Propriedade',
  maquina: 'Máquina',
  rebanho: 'Lote / Rebanho',
}

export function SolicitacoesPendentes() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [respondendo, setRespondendo] = useState<string | null>(null)

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes-exclusao-pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_exclusao' as any)
        .select('*')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
      if (error) return [] as Solicitacao[]
      return (data as any as Solicitacao[]) || []
    },
  })

  async function responder(id: string, aprovar: boolean) {
    setRespondendo(id)
    const { error } = await supabase.rpc('responder_solicitacao_exclusao' as any, {
      p_solicitacao_id: id,
      p_aprovar: aprovar,
      p_motivo_rejeicao: null,
    })
    setRespondendo(null)
    if (error) {
      toast({ title: 'Não foi possível responder', description: error.message, variant: 'destructive' })
      return
    }
    toast({
      title: aprovar ? 'Pedido aprovado. O item foi excluído.' : 'Pedido recusado.',
    })
    queryClient.invalidateQueries({ queryKey: ['solicitacoes-exclusao-pendentes'] })
    queryClient.invalidateQueries({ queryKey: ['propriedades'] })
    queryClient.invalidateQueries({ queryKey: ['maquinas'] })
    queryClient.invalidateQueries({ queryKey: ['rebanhos'] })
  }

  if (!solicitacoes.length) return null

  return (
    <Card className="border-amber-300 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Pedidos de exclusão aguardando você
          <Badge variant="secondary">{solicitacoes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {solicitacoes.map((s) => (
          <div
            key={s.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {LABEL_TIPO[s.tipo] || s.tipo}: {s.entidade_nome || '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                Pedido por {s.solicitante_nome || s.solicitante_email || 'membro da equipe'}
              </p>
              {s.motivo && <p className="text-xs text-muted-foreground">Motivo: {s.motivo}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                disabled={respondendo === s.id}
                onClick={() => responder(s.id, false)}
              >
                {respondendo === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                Recusar
              </Button>
              <Button size="sm" disabled={respondendo === s.id} onClick={() => responder(s.id, true)}>
                <Check className="h-4 w-4 mr-1" />
                Aprovar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
