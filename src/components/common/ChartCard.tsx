import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}

export function ChartCard({ title, description, children, action, className }: ChartCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(31,58,46,0.08)]', className)}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-card-foreground">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
