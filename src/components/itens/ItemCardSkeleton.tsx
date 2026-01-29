import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function ItemCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Ícone skeleton */}
          <Skeleton className="h-11 w-11 rounded-lg shrink-0" />

          {/* Conteúdo skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-6 w-24 mt-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Botões skeleton */}
        <div className="flex gap-2 mt-4 pt-3 border-t">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-10" />
        </div>
      </CardContent>
    </Card>
  )
}
