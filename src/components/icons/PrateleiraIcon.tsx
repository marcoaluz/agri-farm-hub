import { forwardRef } from 'react'
import type { LucideProps } from 'lucide-react'

// Ícone de prateleira de insumos (3 níveis: caixas, potes/garrafas, itens) —
// no estilo lucide (stroke, 24x24, currentColor), pra combinar com o resto dos ícones do app.
export const PrateleiraIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ color = 'currentColor', size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* laterais da estante */}
      <path d="M3 2v20" />
      <path d="M21 2v20" />
      {/* prateleiras */}
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      {/* nível de cima: duas caixas */}
      <path d="M6.5 4.5h3v3h-3z" />
      <path d="M13.5 4.5h3v3h-3z" />
      {/* nível do meio: dois potes e um copo */}
      <path d="M7 10.5c0-.6.4-1 1-1s1 .4 1 1v3h-2z" />
      <path d="M11 10.5c0-.6.4-1 1-1s1 .4 1 1v3h-2z" />
      <path d="M15.5 10.5h2v3h-2z" />
      {/* nível de baixo: duas garrafas e uma caixa */}
      <path d="M6.5 16.5h1.2v4H6.5z" />
      <path d="M9 16.5h1.2v4H9z" />
      <path d="M13 18h3.5v2.5H13z" />
    </svg>
  )
)
PrateleiraIcon.displayName = 'PrateleiraIcon'
