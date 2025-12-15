import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Package, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Lote {
  id: string;
  produto_id: string;
  nota_fiscal?: string;
  fornecedor?: string;
  quantidade_original: number;
  quantidade_disponivel: number;
  custo_unitario: number;
  data_entrada: string;
  data_validade?: string;
  created_at: string;
}

interface ProdutoComCusto {
  produto_id: string;
  nome: string;
  categoria: string;
  unidade_medida: string;
  saldo_atual: number;
  nivel_minimo: number;
  custo_medio: number;
  valor_imobilizado: number;
  total_lotes: number;
}

interface LotesDialogProps {
  produto: ProdutoComCusto;
  onClose: () => void;
}

export function LotesDialog({ produto, onClose }: LotesDialogProps) {
  const { data: lotes, isLoading } = useQuery({
    queryKey: ['lotes', produto.produto_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('produto_id', produto.produto_id)
        .order('data_entrada', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Lote[];
    },
    enabled: !!produto.produto_id
  });

  const lotesDisponiveis = lotes?.filter(l => l.quantidade_disponivel > 0) || [];
  const lotesEsgotados = lotes?.filter(l => l.quantidade_disponivel === 0) || [];
  const valorTotalImobilizado = lotesDisponiveis.reduce(
    (sum, l) => sum + (l.quantidade_disponivel * l.custo_unitario), 
    0
  );

  const hoje = new Date();
  
  const getLoteStatus = (lote: Lote) => {
    if (lote.quantidade_disponivel === 0) {
      return { label: 'ESGOTADO', color: 'bg-gray-100 text-gray-600', icon: CheckCircle };
    }
    
    if (lote.data_validade) {
      const validade = new Date(lote.data_validade);
      const diasRestantes = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes < 0) {
        return { label: 'VENCIDO', color: 'bg-red-100 text-red-700', icon: AlertTriangle };
      }
      if (diasRestantes <= 30) {
        return { label: 'VENCE EM BREVE', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle };
      }
    }
    
    return { label: 'DISPONÍVEL', color: 'bg-green-100 text-green-700', icon: Package };
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-2xl flex items-center gap-2">
          <Package className="h-6 w-6" />
          Lotes FIFO - {produto.nome}
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Lotes em ordem FIFO (primeiro a entrar, primeiro a sair)
        </p>
      </DialogHeader>

      {/* Resumo do Produto */}
      <Card className="bg-blue-50 border-2 border-blue-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-blue-700 font-medium">Categoria</p>
              <p className="text-lg font-bold text-blue-900">{produto.categoria}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Saldo Atual</p>
              <p className="text-lg font-bold text-blue-900">
                {produto.saldo_atual?.toLocaleString('pt-BR', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 3
                })} {produto.unidade_medida}
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Custo Médio</p>
              <p className="text-lg font-bold text-blue-900">
                R$ {produto.custo_medio?.toFixed(2) || '0,00'}
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Valor Imobilizado</p>
              <p className="text-lg font-bold text-blue-900">
                R$ {valorTotalImobilizado.toLocaleString('pt-BR', { 
                  minimumFractionDigits: 2 
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerta sobre FIFO */}
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          <strong>Sistema FIFO:</strong> Ao consumir este produto, os lotes mais antigos 
          (listados primeiro) serão consumidos automaticamente.
        </AlertDescription>
      </Alert>

      {/* Lista de Lotes */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : !lotes || lotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum lote cadastrado</h3>
            <p className="text-muted-foreground text-center">
              Este produto ainda não possui lotes de entrada
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Lotes Disponíveis */}
          {lotesDisponiveis.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                Lotes Disponíveis ({lotesDisponiveis.length})
              </h3>
              <div className="space-y-3">
                {lotesDisponiveis.map((lote, index) => {
                  const status = getLoteStatus(lote);
                  const StatusIcon = status.icon;
                  const percentualConsumido = ((lote.quantidade_original - lote.quantidade_disponivel) / lote.quantidade_original) * 100;

                  return (
                    <Card key={lote.id} className={cn(
                      "border-2",
                      index === 0 && "border-green-400 bg-green-50"
                    )}>
                      <CardContent className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {index === 0 && (
                                <Badge className="bg-green-600 text-white">
                                  PRÓXIMO FIFO
                                </Badge>
                              )}
                              <Badge className={status.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                            </div>
                            
                            {lote.nota_fiscal && (
                              <p className="text-sm font-semibold text-foreground">
                                NF: {lote.nota_fiscal}
                              </p>
                            )}
                            {lote.fornecedor && (
                              <p className="text-sm text-muted-foreground">
                                Fornecedor: {lote.fornecedor}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Informações do Lote */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Quantidade Original
                            </p>
                            <p className="text-lg font-bold text-foreground">
                              {lote.quantidade_original.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3
                              })} {produto.unidade_medida}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Quantidade Disponível
                            </p>
                            <p className="text-lg font-bold text-green-600">
                              {lote.quantidade_disponivel.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3
                              })} {produto.unidade_medida}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Custo Unitário
                            </p>
                            <p className="text-lg font-bold text-blue-600">
                              R$ {lote.custo_unitario.toFixed(2)}
                              <span className="text-xs font-normal ml-1">
                                / {produto.unidade_medida}
                              </span>
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Valor Total Lote
                            </p>
                            <p className="text-lg font-bold text-purple-600">
                              R$ {(lote.quantidade_disponivel * lote.custo_unitario).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Barra de Progresso */}
                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Consumo do Lote</span>
                            <span className="font-semibold">
                              {percentualConsumido.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${percentualConsumido}%` }}
                            />
                          </div>
                        </div>

                        {/* Datas */}
                        <div className="flex items-center justify-between text-sm border-t pt-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Entrada: {new Date(lote.data_entrada).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          
                          {lote.data_validade && (
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                              <span className={cn(
                                "font-medium",
                                new Date(lote.data_validade) < hoje 
                                  ? "text-red-600" 
                                  : "text-orange-600"
                              )}>
                                Validade: {new Date(lote.data_validade).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lotes Esgotados */}
          {lotesEsgotados.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-5 w-5" />
                Lotes Esgotados ({lotesEsgotados.length})
              </h3>
              <div className="space-y-2">
                {lotesEsgotados.slice(0, 5).map((lote) => (
                  <Card key={lote.id} className="opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">
                            {lote.nota_fiscal ? `NF: ${lote.nota_fiscal}` : 'Sem NF'}
                            {lote.fornecedor && ` - ${lote.fornecedor}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Entrada: {new Date(lote.data_entrada).toLocaleDateString('pt-BR')} | 
                            Original: {lote.quantidade_original} {produto.unidade_medida}
                          </p>
                        </div>
                        <Badge className="bg-gray-100 text-gray-600">
                          ESGOTADO
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {lotesEsgotados.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    ... e mais {lotesEsgotados.length - 5} lotes esgotados
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
