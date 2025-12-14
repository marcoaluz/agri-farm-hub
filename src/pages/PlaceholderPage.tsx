import { Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const navigate = useNavigate()
  
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center animate-fade-in">
      <div className="rounded-full bg-muted p-6 mb-6">
        <Construction className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground text-center max-w-md mb-6">{description}</p>
      <Button onClick={() => navigate('/')} variant="outline">
        Voltar ao Dashboard
      </Button>
    </div>
  )
}
