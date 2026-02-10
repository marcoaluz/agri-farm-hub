import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Clock, User, Edit, Trash2, Plus, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface HistoricoItem {
  id: string
  tipo_alteracao: 'INSERT' | 'UPDATE' | 'DELETE'
  alterado_em: string
  usuario_email: string
  usuario_nome: string
  dados_anteriores: any
  dados_novos: any
  motivo?: string
}

interface HistoricoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lancamentoId: string
  titulo?: string
}

export function HistoricoDialog({ 
  open, 
  onOpenChange, 
  lancamentoId,
  titulo = "Histórico de Alterações"
}: HistoricoDialogProps) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && lancamentoId) {
      carregarHistorico()
    }
  }, [open, lancamentoId])

  async function carregarHistorico() {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('lancamentos_historico')
        .select('*')
        .eq('lancamento_id', lancamentoId)
        .order('alterado_em', { ascending: false })

      if (fetchError) throw fetchError

      setHistorico(data || [])
    } catch (err: any) {
      console.error('Erro ao carregar histórico:', err)
      setError(err.message || 'Erro ao carregar histórico')
    } finally {
      setLoading(false)
    }
  }

  function getIconeTipo(tipo: string) {
    switch (tipo) {
      case 'INSERT': return <Plus className="h-4 w-4" />
      case 'UPDATE': return <Edit className="h-4 w-4" />
      case 'DELETE': return <Trash2 className="h-4 w-4" />
      default: return <Edit className="h-4 w-4" />
    }
  }

  function getBadgeVariant(tipo: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (tipo) {
      case 'INSERT': return 'default'
      case 'UPDATE': return 'secondary'
      case 'DELETE': return 'destructive'
      default: return 'outline'
    }
  }

  function getTipoLabel(tipo: string) {
    switch (tipo) {
      case 'INSERT': return 'Criado'
      case 'UPDATE': return 'Editado'
      case 'DELETE': return 'Excluído'
      default: return tipo
    }
  }

  function formatarNomeCampo(campo: string): string {
    const nomes: Record<string, string> = {
      'data_execucao': 'Data de Execução',
      'servico_id': 'Serviço',
      'talhao_id': 'Talhão',
      'observacoes': 'Observações',
      'custo_total': 'Custo Total',
      'ativo': 'Status',
    }
    return nomes[campo] || campo
  }

  function formatarValor(valor: any): string {
    if (valor === null || valor === undefined) return '-'
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
    if (typeof valor === 'number') return valor.toLocaleString('pt-BR')
    if (typeof valor === 'string' && valor.match(/^\d{4}-\d{2}-\d{2}/)) {
      return format(new Date(valor), 'dd/MM/yyyy', { locale: ptBR })
    }
    return String(valor)
  }

  function renderDiferencas(item: HistoricoItem) {
    if (item.tipo_alteracao === 'INSERT') {
      return <p className="text-sm text-muted-foreground">Registro criado</p>
    }

    if (item.tipo_alteracao === 'DELETE') {
      return <p className="text-sm text-muted-foreground">Registro excluído</p>
    }

    if (item.tipo_alteracao === 'UPDATE' && item.dados_anteriores && item.dados_novos) {
      const campos = Object.keys(item.dados_novos).filter(key =>
        JSON.stringify(item.dados_anteriores[key]) !== JSON.stringify(item.dados_novos[key])
      )

      if (campos.length === 0) {
        return <p className="text-sm text-muted-foreground">Sem alterações detectadas</p>
      }

      return (
        <div className="space-y-2">
          {campos.map(campo => (
            <div key={campo} className="text-sm">
              <span className="font-medium text-foreground">{formatarNomeCampo(campo)}:</span>
              <div className="ml-4 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Antes:</span>
                  <span className="text-destructive line-through">
                    {formatarValor(item.dados_anteriores[campo])}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Depois:</span>
                  <span className="text-primary font-medium">
                    {formatarValor(item.dados_novos[campo])}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && historico.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum histórico encontrado
          </p>
        )}

        {!loading && !error && historico.length > 0 && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {historico.map((item, index) => (
                <div key={item.id}>
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getIconeTipo(item.tipo_alteracao)}
                        <Badge variant={getBadgeVariant(item.tipo_alteracao)}>
                          {getTipoLabel(item.tipo_alteracao)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(item.alterado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </div>
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{item.usuario_nome || item.usuario_email || 'Sistema'}</span>
                    </div>

                    {/* Diff */}
                    <div className="pl-6">{renderDiferencas(item)}</div>

                    {/* Motivo */}
                    {item.motivo && (
                      <div className="pl-6 text-sm">
                        <span className="font-medium">Motivo:</span>
                        <p className="text-muted-foreground italic">"{item.motivo}"</p>
                      </div>
                    )}
                  </div>

                  {index < historico.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
