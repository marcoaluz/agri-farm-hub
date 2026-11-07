import { Info } from 'lucide-react'
import { USO_CATEGORIA, type UsoCategoriaEstoque } from '@/lib/categoriasEstoqueUso'

const ORDEM: UsoCategoriaEstoque[] = ['combustivel', 'manutencao', 'maquina']

/**
 * Quadro fixo (cadastro de produto e entrada de estoque) explicando que a
 * categoria do produto decide em qual lançamento ele vai aparecer.
 */
export function QuadroUsoCategorias() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
      <Info className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">A categoria define onde o produto vai aparecer</p>
        <ul className="space-y-0.5">
          {ORDEM.map((uso) => (
            <li key={uso}>
              <strong>{USO_CATEGORIA[uso].categoria}</strong> → {USO_CATEGORIA[uso].ondeAparece}
            </li>
          ))}
          <li>
            <strong>Outras categorias</strong> → “+ Produto do Estoque” no lançamento
          </li>
        </ul>
        <p className="text-blue-800/80 dark:text-blue-300/80">
          Vale qualquer categoria que tenha essa palavra no nome (ex.: “Manutenção Trator”).
        </p>
      </div>
    </div>
  )
}
