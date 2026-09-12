import { Lock } from 'lucide-react'

/**
 * Detecta o erro definitivo de permissão dos relatórios financeiros
 * (código 42501 / "Acesso negado a relatório financeiro").
 * Erros assim NUNCA devem ser repetidos automaticamente.
 */
export function ehErroPermissaoFinanceiro(erro: unknown): boolean {
  if (!erro) return false
  const e = erro as any
  const codigo = String(e?.code || e?.status || '')
  const msg = String(e?.message || e?.error_description || e || '').toLowerCase()
  return codigo === '42501' || msg.includes('acesso negado a relat')
}

/** Mensagem simples exibida quando o usuário não tem permissão financeira. */
export function AvisoSemPermissaoFinanceiro({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed py-12 px-6 text-center ${className}`}>
      <Lock className="h-10 w-10 mb-3 text-muted-foreground opacity-60" />
      <p className="font-medium text-foreground">Você não tem permissão para ver o Financeiro desta propriedade</p>
      <p className="text-sm text-muted-foreground mt-1">Fale com o proprietário se precisar desse acesso.</p>
    </div>
  )
}
