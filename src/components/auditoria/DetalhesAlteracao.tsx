import { HistoricoAuditoria } from '@/hooks/useHistorico'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

function formatarValor(valor: any): string {
  if (valor === null || valor === undefined) return '-'
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR')
  if (typeof valor === 'string' && valor.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      return format(new Date(valor), 'dd/MM/yyyy', { locale: ptBR })
    } catch {
      return valor
    }
  }
  return String(valor)
}

export function DetalhesAlteracao({ item }: DetalhesAlteracaoProps) {
  // DELETE: Mostrar dados completos do lançamento excluído
  if (item.tipo_alteracao === 'DELETE' && item.dados_anteriores) {
    const dados = item.dados_anteriores

    return (
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">
          Lançamento Excluído:
        </div>
        <div className="text-xs space-y-0.5 text-muted-foreground">
          {dados.data_execucao && (
            <div>
              📅 Data: {format(new Date(dados.data_execucao), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
          )}
          {dados.custo_total && (
            <div>
              💰 Custo: {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(Number(dados.custo_total))}
            </div>
          )}
          {dados.servico_id && (
            <div className="text-xs text-muted-foreground">
              🔧 Serviço ID: {dados.servico_id.substring(0, 8)}...
            </div>
          )}
          {dados.talhao_id && (
            <div className="text-xs text-muted-foreground">
              🌾 Talhão ID: {dados.talhao_id.substring(0, 8)}...
            </div>
          )}
          {dados.observacoes && (
            <div className="truncate max-w-[250px]">
              📝 Obs: {dados.observacoes}
            </div>
          )}
        </div>
      </div>
    )
  }

  // UPDATE: Mostrar campos alterados
  if (item.tipo_alteracao === 'UPDATE' && item.dados_anteriores && item.dados_novos) {
    const campos = Object.keys(item.dados_novos).filter(key =>
      JSON.stringify(item.dados_anteriores[key]) !== JSON.stringify(item.dados_novos[key])
    )

    if (campos.length === 0) {
      return (
        <span className="text-xs text-muted-foreground italic">
          Sem alterações detectadas
        </span>
      )
    }

    return (
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">
          {campos.length} campo{campos.length > 1 ? 's' : ''} alterado{campos.length > 1 ? 's' : ''}:
        </div>
        <div className="space-y-1">
          {campos.slice(0, 3).map(campo => (
            <div key={campo} className="text-xs">
              <span className="font-medium text-foreground">
                {NOMES_CAMPOS[campo] || campo}:
              </span>
              <div className="ml-2 space-y-0.5">
                <div className="text-muted-foreground">
                  De: {formatarValor(item.dados_anteriores[campo])}
                </div>
                <div className="text-foreground">
                  Para: {formatarValor(item.dados_novos[campo])}
                </div>
              </div>
            </div>
          ))}
          {campos.length > 3 && (
            <div className="text-xs text-muted-foreground italic">
              +{campos.length - 3} outro{campos.length - 3 > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    )
  }

  // INSERT: Registro criado
  if (item.tipo_alteracao === 'INSERT') {
    return (
      <span className="text-xs text-muted-foreground italic">
        Registro criado
      </span>
    )
  }

  return null
}
