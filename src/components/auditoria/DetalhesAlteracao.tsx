import { HistoricoAuditoria } from '@/hooks/useHistorico'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatarMoeda } from '@/hooks/useHistorico'

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

function formatarValor(valor: any, campo?: string): string {
  if (valor === null || valor === undefined) return '-'
  if (campo === 'custo_total') return formatarMoeda(Number(valor))
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (typeof valor === 'string' && valor.match(/^\d{4}-\d{2}-\d{2}/)) {
    try { return format(new Date(valor), 'dd/MM/yyyy', { locale: ptBR }) } catch { return valor }
  }
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR')
  if (typeof valor === 'string' && valor.match(/^[0-9a-f]{8}-[0-9a-f]{4}/)) return valor.substring(0, 8) + '...'
  return String(valor)
}

export function DetalhesAlteracao({ item }: DetalhesAlteracaoProps) {
  const dados = item.dados_anteriores || item.dados_novos

  // INSERT e DELETE: mostrar dados do lançamento
  if ((item.tipo_alteracao === 'INSERT' || item.tipo_alteracao === 'DELETE') && dados) {
    const titulo = item.tipo_alteracao === 'INSERT' ? 'Lançamento Criado:' : 'Lançamento Excluído:'
    const corBorda = item.tipo_alteracao === 'INSERT' ? 'border-l-green-500' : 'border-l-red-500'

    return (
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{titulo}</div>
        <div className={`text-xs space-y-0.5 text-muted-foreground border-l-2 ${corBorda} pl-2`}>
          {dados.data_execucao && (
            <div>📅 Data: {format(new Date(dados.data_execucao), 'dd/MM/yyyy', { locale: ptBR })}</div>
          )}
          {dados.custo_total && (
            <div>💰 Custo: {formatarMoeda(Number(dados.custo_total))}</div>
          )}
          {item.servico_nome && <div>🔧 Serviço: {item.servico_nome}</div>}
          {item.talhao_nome && <div>🌾 Talhão: {item.talhao_nome}</div>}
          {dados.observacoes && (
            <div className="truncate max-w-[250px]">📝 Obs: {dados.observacoes}</div>
          )}
        </div>
      </div>
    )
  }

  // UPDATE: mostrar campos alterados
  if (item.tipo_alteracao === 'UPDATE' && item.dados_anteriores && item.dados_novos) {
    const camposIgnorados = ['updated_at', 'editado_em', 'editado_por', 'created_at', 'id']
    const campos = Object.keys(item.dados_novos).filter(key => {
      if (camposIgnorados.includes(key)) return false
      return JSON.stringify(item.dados_anteriores[key]) !== JSON.stringify(item.dados_novos[key])
    })

    if (campos.length === 0) {
      return <span className="text-xs text-muted-foreground italic">Sem alterações detectadas</span>
    }

    return (
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">
          {campos.length} campo{campos.length > 1 ? 's' : ''} alterado{campos.length > 1 ? 's' : ''}:
        </div>
        <div className="space-y-1">
          {campos.slice(0, 3).map(campo => (
            <div key={campo} className="text-xs">
              <span className="font-medium text-foreground">{NOMES_CAMPOS[campo] || campo}: </span>
              <span className="text-muted-foreground line-through">
                {formatarValor(item.dados_anteriores[campo], campo)}
              </span>
              <span className="mx-1">→</span>
              <span className="text-foreground font-medium">
                {formatarValor(item.dados_novos[campo], campo)}
              </span>
            </div>
          ))}
          {campos.length > 3 && (
            <div className="text-xs text-muted-foreground italic">+{campos.length - 3} outro(s)</div>
          )}
        </div>
      </div>
    )
  }

  return null
}
