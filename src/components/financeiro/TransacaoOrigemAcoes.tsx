import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Paperclip } from 'lucide-react'
import { listarAnexos, abrirAnexoEmNovaAba, parseOrigemTransacao } from '@/lib/anexoNF'

interface Props {
  origem?: string | null
  compact?: boolean
}

/** Mostra clipe de anexo (nota fiscal) e link "Ver origem" para transações geradas por triggers. */
export function TransacaoOrigemAcoes({ origem, compact }: Props) {
  const navigate = useNavigate()
  const parsed = parseOrigemTransacao(origem)

  const { data: anexos = [] } = useQuery({
    queryKey: ['anexos', parsed?.tipo, parsed?.id],
    queryFn: () => listarAnexos(parsed!.tipo, parsed!.id),
    enabled: !!parsed,
  })

  if (!parsed) return null

  const irParaOrigem = () => {
    if (parsed.tipo === 'lote') navigate('/estoque?highlight=lote:' + parsed.id)
    else navigate('/pecuaria?highlight=' + parsed.id)
  }

  return (
    <span className="inline-flex items-center gap-1">
      {anexos.length > 0 && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title="Ver nota fiscal"
          onClick={e => { e.stopPropagation(); abrirAnexoEmNovaAba(anexos[0].storage_path) }}
        >
          <Paperclip className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="link"
        size="sm"
        className="h-7 px-1 text-xs"
        onClick={e => { e.stopPropagation(); irParaOrigem() }}
      >
        {compact ? 'Origem' : parsed.tipo === 'lote' ? 'Ver entrada' : 'Ver movimentação'}
      </Button>
    </span>
  )
}
