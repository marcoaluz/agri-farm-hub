import { cn } from '@/lib/utils'

interface WordmarkProps {
  /** Tailwind text size class, e.g. "text-3xl" */
  className?: string
  /** Use inverted colors (over dark/primary backgrounds) */
  onDark?: boolean
  /** Show only "GFI" (sidebar colapsada) */
  compact?: boolean
}

export function Wordmark({ className, onDark = false, compact = false }: WordmarkProps) {
  return (
    <span className={cn('whitespace-nowrap', className)}>
      {!compact && (
        <>
          <span className={cn('font-sans font-semibold', onDark ? 'text-primary-foreground' : 'text-primary')}>
            Agro
          </span>{' '}
        </>
      )}
      <span className={cn('font-display font-bold', onDark ? 'text-primary-foreground/90' : 'text-accent')}>
        GFI
      </span>
    </span>
  )
}
