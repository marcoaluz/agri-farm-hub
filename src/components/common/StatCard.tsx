import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning'
  className?: string
}

const variantStyles = {
  default: 'bg-card border-border',
  primary: 'bg-primary/5 border-primary/20',
  accent: 'bg-accent/10 border-accent/30',
  success: 'bg-success/5 border-success/20',
  warning: 'bg-warning/10 border-warning/30',
}

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/20 text-accent-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/20 text-warning-foreground',
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'hover-lift rounded-lg border p-4 sm:p-6 shadow-[0_1px_3px_rgba(31,58,46,0.08)] min-w-0',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate" title={title}>{title}</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-display text-lg sm:text-xl 2xl:text-2xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere]">{value}</h3>
            {trend && (
              <span
                className={cn(
                  'text-xs sm:text-sm font-medium shrink-0',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2 [overflow-wrap:anywhere]" title={description}>{description}</p>
          )}
        </div>

        <div className={cn('rounded-lg p-2.5 sm:p-3 shrink-0', iconStyles[variant])}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </div>
  )
}
