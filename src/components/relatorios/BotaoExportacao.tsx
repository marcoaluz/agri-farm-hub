import { FileText, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onExportarPDFCompleto: () => void
  onExportarPDFSintetico: () => void
  onExportarExcel: () => void
  isLoading?: boolean
}

export function BotaoExportacao({ onExportarPDFCompleto, onExportarPDFSintetico, onExportarExcel, isLoading }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Exportar:</span>
      <Button variant="outline" size="sm" onClick={onExportarPDFCompleto} disabled={isLoading}>
        <FileText className="h-4 w-4 mr-1" /> PDF Completo
      </Button>
      <Button variant="outline" size="sm" onClick={onExportarPDFSintetico} disabled={isLoading}>
        <FileText className="h-4 w-4 mr-1" /> PDF Sintético
      </Button>
      <Button variant="outline" size="sm" onClick={onExportarExcel} disabled={isLoading} className="text-green-700 border-green-300 hover:bg-green-50">
        <Table2 className="h-4 w-4 mr-1" /> Excel
      </Button>
    </div>
  )
}
