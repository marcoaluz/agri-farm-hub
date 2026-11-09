import { Fragment, type ReactNode } from 'react'

/**
 * Renderiza o pequeno subconjunto de Markdown usado nos textos legais
 * (## e ### títulos, parágrafos, listas com "- " e **negrito**), sem
 * dependência nova. Campos a preencher "[ASSIM]" aparecem destacados.
 */
function inline(texto: string, chave: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*|\[[A-ZÀ-Ü0-9 /()ÇÃÊÍÓÚ:-]{2,}\])/g)
  return partes.filter(Boolean).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={`${chave}-${i}`}>{p.slice(2, -2)}</strong>
    if (/^\[[A-ZÀ-Ü0-9 /()ÇÃÊÍÓÚ:-]{2,}\]$/.test(p)) {
      return <mark key={`${chave}-${i}`} className="rounded bg-amber-200/70 px-0.5 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100">{p}</mark>
    }
    return <Fragment key={`${chave}-${i}`}>{p}</Fragment>
  })
}

export function TextoLegal({ markdown }: { markdown: string }) {
  const blocos = markdown.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {blocos.map((b, i) => {
        if (b.startsWith('### ')) return <h3 key={i} className="pt-3 text-base font-semibold">{inline(b.slice(4), `h3-${i}`)}</h3>
        if (b.startsWith('## ')) return <h2 key={i} className="text-xl font-bold">{inline(b.slice(3), `h2-${i}`)}</h2>
        const linhas = b.split('\n')
        if (linhas.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {linhas.map((l, j) => <li key={j}>{inline(l.slice(2), `li-${i}-${j}`)}</li>)}
            </ul>
          )
        }
        return <p key={i}>{inline(linhas.join(' '), `p-${i}`)}</p>
      })}
    </div>
  )
}
