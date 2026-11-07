import { Info, AlertCircle } from 'lucide-react'
import { USO_CATEGORIA, type UsoCategoriaEstoque } from '@/lib/categoriasEstoqueUso'

interface Props {
  uso: UsoCategoriaEstoque
  /** true quando não existe nenhum produto dessa categoria no estoque */
  vazio?: boolean
  /** mostra a dica de usar "Livre" quando não houver produto (abastecimento/manutenção) */
  temLivre?: boolean
}

/**
 * Linha curta embaixo dos seletores de produto do estoque (Abastecimento, Manutenção,
 * Troca/Reposição) dizendo de qual categoria vêm os itens — e, se não houver nenhum,
 * como cadastrar para aparecer ali.
 */
export function DicaCategoriaEstoque({ uso, vazio, temLivre }: Props) {
  const { categoria } = USO_CATEGORIA[uso]

  if (vazio) {
    return (
      <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Nenhum produto com categoria <strong>{categoria}</strong> no estoque. Para aparecer aqui,
          cadastre em <strong>Estoque → Novo Produto</strong> com a categoria <strong>{categoria}</strong>
          {temLivre ? ', ou use “Livre” para lançar sem baixar do estoque.' : '.'}
        </span>
      </div>
    )
  }

  return (
    <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>
        Aparecem aqui só os produtos do estoque com categoria <strong>{categoria}</strong>.
      </span>
    </p>
  )
}
