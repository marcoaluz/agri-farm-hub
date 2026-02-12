import { HistoricoAuditoria } from '@/hooks/useHistorico'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  extrairInfoLancamento, 
  formatarMoeda, 
  obterCamposAlterados 
} from '@/hooks/useHistorico'

interface DetalhesAlteracaoProps {
  item: HistoricoAuditoria
}

const NOMES_CAMPOS: Record<string, string> = {
  'data_execucao': 'Data de Execução',
  'custo_total': 'Custo Total',
  'observacoes': 'Observações',
  'servico_id': 'Serviço',
  'talhao_id': 'Talhão',
  'ativo': 'Status'
}

function formatarNomeCampo(campo: string): string {
  return NOMES_CAMPOS[campo] || campo
}

function formatarValor(valor: any, campo?: string): string {
  if (valor === null || valor === undefined) return '-'
  
  if (campo === 'custo_total' && typeof valor === 'number') {
    return formatarMoeda(valor)
  }
  
  if (typeof valor === 'boolean') {
    return valor ? 'Sim' : 'Não'
  }
  
  if (typeof valor === 'string' && valor.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      return format(new Date(valor), 'dd/MM/yyyy', { locale: ptBR })
    } catch {
      return valor
    }
  }
  
  if (typeof valor === 'number') {
    return valor.toLocaleString('pt-BR')
  }
  
  return String(valor)
}

export function DetalhesAlteracao({ item }: DetalhesAlteracaoProps) {
  // DELETE: Mostrar dados do registro excluído
  if (item.tipo_alteracao === 'DELETE' && item.dados_anteriores) {
    const info = extrairInfoLancamento(item.dados_anteriores)
    
    return (
      <div className="space-y-1">
        <div>
          <span className="text-sm font-medium text-destructive">Lançamento Excluído:</span>
        </div>
        <div className="ml-2 space-y-0.5 text-sm text-muted-foreground">
          {info?.data_execucao && (
            <p>Data: {format(new Date(info.data_execucao), 'dd/MM/yyyy', { locale: ptBR })}</p>
          )}
          {info?.custo_total && (
            <p>Custo: {formatarMoeda(info.custo_total)}</p>
          )}
          {info?.observacoes && (
            <p>Obs: {info.observacoes}</p>
          )}
        </div>
      </div>
    )
  }
  
  // UPDATE: Mostrar campos alterados
  if (item.tipo_alteracao === 'UPDATE' && item.dados_anteriores && item.dados_novos) {
    const camposAlterados = obterCamposAlterados(
      item.dados_anteriores, 
      item.dados_novos
    )
    
    if (camposAlterados.length === 0) {
      return (
        <span className="text-sm text-muted-foreground">Sem alterações detectadas</span>
      )
    }
    
    return (
      <div className="space-y-1">
        <Badge variant="secondary" className="text-xs">
          {camposAlterados.length} campo{camposAlterados.length > 1 ? 's' : ''} alterado{camposAlterados.length > 1 ? 's' : ''}:
        </Badge>
        <div className="ml-2 space-y-1">
          {camposAlterados.slice(0, 3).map(campo => (
            <div key={campo} className="text-sm">
              <span className="font-medium text-foreground">
                {formatarNomeCampo(campo)}:
              </span>
              <div className="ml-2 flex flex-col gap-0.5">
                <span className="text-destructive line-through">
                  De: {formatarValor(item.dados_anteriores[campo], campo)}
                </span>
                <span className="text-primary font-medium">
                  Para: {formatarValor(item.dados_novos[campo], campo)}
                </span>
              </div>
            </div>
          ))}
          {camposAlterados.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{camposAlterados.length - 3} outro{camposAlterados.length - 3 > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    )
  }
  
  // INSERT: Apenas indicar criação
  if (item.tipo_alteracao === 'INSERT') {
    return (
      <span className="text-sm text-muted-foreground italic">Registro criado</span>
    )
  }
  
  return null
}
