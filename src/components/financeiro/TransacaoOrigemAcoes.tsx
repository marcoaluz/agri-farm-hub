import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Paperclip, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { abrirAnexoEmNovaAba, parseOrigemTransacao } from '@/lib/anexoNF'
import { toast } from 'sonner'

/**
 * Pré-carrega a lista "tipo:id" de entidades que possuem anexo. O queryFn
 * retorna um array (não um Set): o cache do react-query é persistido em
 * localStorage via JSON.stringify/parse (ver src/lib/queryClient.ts e o
 * shouldDehydrateQuery em src/App.tsx, que também exclui essa chave por
 * segurança), e um Set vira "{}" nesse round-trip — {}.has não é função, e
 * {} é truthy, então o guard "!idsComAnexo" não pegava esse caso. Quem
 * consome (Financeiro.tsx) reconstrói o Set com useMemo a partir do array.
 */
export function useIdsComAnexo(propriedadeId?: string | null) {
  return useQuery({
    queryKey: ['transacoes-com-anexo', propriedadeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('anexos' as any)
        .select('entidade_tipo, entidade_id')
        .eq('propriedade_id', propriedadeId)
        .in('entidade_tipo', ['lote', 'rebanho_movimentacao', 'transacao', 'venda_producao'])
      return (data || []).map((a: any) => `${a.entidade_tipo}:${a.entidade_id}`)
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
  transacaoId: string
  compact?: boolean
  idsComAnexo?: Set<string>
}

/** Mostra clipe de anexo (nota fiscal) e link "Ver origem" para transações geradas por
 * triggers (Estoque/Pecuária). Para transações manuais ou editadas direto no Financeiro,
 * sem origem reconhecida, ainda assim mostra o clipe se houver anexo na própria transação. */
export function TransacaoOrigemAcoes({ origem, transacaoId, compact, idsComAnexo }: Props) {
  const navigate = useNavigate()
  const parsed = parseOrigemTransacao(origem)
  const temAnexoDireto = !parsed && !!idsComAnexo?.has(`transacao:${transacaoId}`)

  if (!parsed && !temAnexoDireto) return null

  const temAnexo = parsed ? transacaoTemAnexo(origem, idsComAnexo) : temAnexoDireto

  const abrirAnexo = async () => {
    const alvo = parsed || { tipo: 'transacao' as const, id: transacaoId }
    const { data, error } = await supabase
      .from('anexos' as any)
      .select('storage_path')
      .eq('entidade_tipo', alvo.tipo)
      .eq('entidade_id', alvo.id)
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
    if (!parsed) return
    if (parsed.tipo === 'lote') navigate(`/estoque?tab=lotes&highlight=${parsed.id}`)
    else if (parsed.tipo === 'venda_producao') navigate('/producao')
    else navigate(`/pecuaria?tab=movimentacoes&highlight=${parsed.id}`)
  }

  const labelOrigem = (tipo: NonNullable<typeof parsed>['tipo']) => {
    if (tipo === 'lote') return 'Entrada de estoque'
    if (tipo === 'venda_producao') return 'Venda de produção'
    return 'Movimentação de rebanho'
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
      {parsed && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title={`Ver ${labelOrigem(parsed.tipo).toLowerCase()}`}
          onClick={e => { e.stopPropagation(); irParaOrigem() }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      )}
      {!compact && parsed && (
        <span className="text-xs text-muted-foreground">
          {labelOrigem(parsed.tipo)}
        </span>
      )}
    </span>
  )
}
