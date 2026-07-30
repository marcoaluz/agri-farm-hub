import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Paperclip, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { abrirAnexoEmNovaAba, parseOrigemTransacao } from '@/lib/anexoNF'
import { toast } from 'sonner'

/** Pré-carrega o conjunto "tipo:id" de entidades que possuem anexo, para busca O(1). */
export function useIdsComAnexo(propriedadeId?: string | null) {
  return useQuery({
    queryKey: ['transacoes-com-anexo', propriedadeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('anexos' as any)
        .select('entidade_tipo, entidade_id')
        .eq('propriedade_id', propriedadeId)
        .in('entidade_tipo', ['lote', 'rebanho_movimentacao'])
      return new Set((data || []).map((a: any) => `${a.entidade_tipo}:${a.entidade_id}`))
    },
    enabled: !!propriedadeId,
  })
}

export function transacaoTemAnexo(origem: string | null | undefined, idsComAnexo?: Set<string>) {
  const parsed = parseOrigemTransacao(origem)
  if (!parsed || !idsComAnexo) return false
  return idsComAnexo.has(`${parsed.tipo}:${parsed.id}`)
}

interface Props {
  origem?: string | null
  compact?: boolean
  idsComAnexo?: Set<string>
}

/** Mostra clipe de anexo (nota fiscal) e link "Ver origem" para transações geradas por triggers. */
export function TransacaoOrigemAcoes({ origem, compact, idsComAnexo }: Props) {
  const navigate = useNavigate()
  const parsed = parseOrigemTransacao(origem)

  if (!parsed) return null

  const temAnexo = transacaoTemAnexo(origem, idsComAnexo)

  const abrirAnexo = async () => {
    const { data, error } = await supabase
      .from('anexos' as any)
      .select('storage_path')
      .eq('entidade_tipo', parsed.tipo)
      .eq('entidade_id', parsed.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const anexo = (data || [])[0] as any
    if (error || !anexo) {
      toast.error('Erro ao carregar anexo')
      return
    }
    abrirAnexoEmNovaAba(anexo.storage_path)
  }

  const irParaOrigem = () => {
    if (parsed.tipo === 'lote') navigate(`/estoque?tab=lotes&highlight=${parsed.id}`)
    else navigate(`/pecuaria?tab=movimentacoes&highlight=${parsed.id}`)
  }


  return (
    <span className="inline-flex items-center gap-1">
      {temAnexo && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-info"
          title="Ver nota fiscal anexada"
          onClick={e => { e.stopPropagation(); abrirAnexo() }}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        title={parsed.tipo === 'lote' ? 'Ver entrada de estoque' : 'Ver movimentação de rebanho'}
        onClick={e => { e.stopPropagation(); irParaOrigem() }}
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
      {!compact && (
        <span className="text-xs text-muted-foreground">
          {parsed.tipo === 'lote' ? 'Entrada de estoque' : 'Movimentação de rebanho'}
        </span>
      )}
    </span>
  )
}
