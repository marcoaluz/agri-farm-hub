import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info } from 'lucide-react';

interface Produto {
  id: string;
  nome: string;
  categoria: string;
  unidade_medida: string;
}

interface EntradaEstoqueFormProps {
  onSuccess: () => void;
}

export function EntradaEstoqueForm({ onSuccess }: EntradaEstoqueFormProps) {
  const { propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    produto_id: '',
    nota_fiscal: '',
    fornecedor: '',
    quantidade: 0,
    custo_unitario: 0,
    data_entrada: new Date().toISOString().split('T')[0],
    data_validade: ''
  });

  // Buscar produtos
  const {
    data: produtos = [],
    isLoading: produtosLoading,
    error: produtosError,
  } = useQuery({
    queryKey: ['produtos', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('propriedade_id', propriedadeAtual?.id)
        // Alguns bancos deixam `ativo` como NULL mesmo com default true.
        // Tratar NULL como ativo para não “sumir” produto do select.
        .or('ativo.is.null,ativo.eq.true')
        .order('nome');

      if (error) throw error;
      return data as Produto[];
    },
    enabled: !!propriedadeAtual?.id
  });

  // Produto selecionado
  const produtoSelecionado = produtos.find(p => p.id === formData.produto_id);

  // Calcular valor total do lote
  const valorTotal = formData.quantidade * formData.custo_unitario;

  // Mutation para salvar
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Inserir lote
      const { error } = await supabase
        .from('lotes')
        .insert({
          propriedade_id: propriedadeAtual?.id,
          produto_id: formData.produto_id,
          nota_fiscal: formData.nota_fiscal || null,
          fornecedor: formData.fornecedor || null,
          quantidade_original: formData.quantidade,
          quantidade_disponivel: formData.quantidade,
          custo_unitario: formData.custo_unitario,
          data_entrada: formData.data_entrada,
          data_validade: formData.data_validade || null
        });

      if (error) throw error;

      // O trigger atualizar_saldo_produto já atualizará o saldo automaticamente
    },
    onSuccess: () => {
      toast({ 
        title: 'Entrada de estoque registrada com sucesso!',
        description: 'O saldo do produto foi atualizado automaticamente.'
      });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao registrar entrada',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>Entrada de Estoque</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Registre a entrada de um novo lote no estoque
        </p>
      </DialogHeader>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Cada entrada de produto cria um novo <strong>lote</strong> no sistema FIFO. 
          O custo será calculado automaticamente ao consumir.
        </AlertDescription>
      </Alert>

      {!propriedadeAtual && (
        <Alert>
          <AlertDescription>
            Selecione uma propriedade no topo para carregar os produtos.
          </AlertDescription>
        </Alert>
      )}

      {produtosError && (
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar produtos: {(produtosError as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {!produtosLoading && !produtosError && !!propriedadeAtual?.id && produtos.length === 0 && (
        <Alert>
          <AlertDescription>
            Nenhum produto encontrado para esta propriedade. Cadastre um produto para poder dar entrada no estoque.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {/* Produto */}
        <div>
          <Label>Produto *</Label>
          <Select
            value={formData.produto_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, produto_id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={produtosLoading ? 'Carregando produtos...' : 'Selecione o produto'} />
            </SelectTrigger>
            <SelectContent>
              {produtosLoading ? (
                <SelectItem value="__loading" disabled>
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </span>
                </SelectItem>
              ) : produtosError ? (
                <SelectItem value="__error" disabled>
                  Erro ao carregar produtos
                </SelectItem>
              ) : produtos.length === 0 ? (
                <SelectItem value="__empty" disabled>
                  Nenhum produto cadastrado
                </SelectItem>
              ) : (
                produtos.map(produto => (
                  <SelectItem key={produto.id} value={produto.id}>
                    {produto.nome} ({produto.categoria})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Unidade de Medida (readonly) */}
        {produtoSelecionado && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              Unidade de medida: <strong>{produtoSelecionado.unidade_medida}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Nota Fiscal */}
        <div>
          <Label>Nota Fiscal (opcional)</Label>
          <Input
            value={formData.nota_fiscal}
            onChange={(e) => setFormData(prev => ({ ...prev, nota_fiscal: e.target.value }))}
            placeholder="Ex: 12345"
            maxLength={100}
          />
        </div>

        {/* Fornecedor */}
        <div>
          <Label>Fornecedor (opcional)</Label>
          <Input
            value={formData.fornecedor}
            onChange={(e) => setFormData(prev => ({ ...prev, fornecedor: e.target.value }))}
            placeholder="Ex: AgroInsumos Ltda"
            maxLength={200}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Quantidade */}
          <div>
            <Label>Quantidade *</Label>
            <Input
              type="number"
              step="0.001"
              min="0.001"
              value={formData.quantidade || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                quantidade: parseFloat(e.target.value) || 0 
              }))}
              placeholder="0.000"
            />
            {produtoSelecionado && (
              <p className="text-xs text-muted-foreground mt-1">
                Em {produtoSelecionado.unidade_medida}
              </p>
            )}
          </div>

          {/* Custo Unitário */}
          <div>
            <Label>Custo Unitário (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.custo_unitario || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                custo_unitario: parseFloat(e.target.value) || 0 
              }))}
              placeholder="0.00"
            />
            {produtoSelecionado && (
              <p className="text-xs text-muted-foreground mt-1">
                Por {produtoSelecionado.unidade_medida}
              </p>
            )}
          </div>
        </div>

        {/* Valor Total (calculado) */}
        {valorTotal > 0 && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="flex justify-between items-center">
              <span className="font-semibold text-green-900">Valor Total do Lote:</span>
              <span className="text-xl font-bold text-green-700">
                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Data de Entrada */}
          <div>
            <Label>Data de Entrada *</Label>
            <Input
              type="date"
              value={formData.data_entrada}
              onChange={(e) => setFormData(prev => ({ ...prev, data_entrada: e.target.value }))}
            />
          </div>

          {/* Data de Validade */}
          <div>
            <Label>Data de Validade (opcional)</Label>
            <Input
              type="date"
              value={formData.data_validade}
              onChange={(e) => setFormData(prev => ({ ...prev, data_validade: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={
            saveMutation.isPending ||
            !formData.produto_id ||
            formData.quantidade <= 0 ||
            formData.custo_unitario < 0 ||
            !formData.data_entrada
          }
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Registrar Entrada'
          )}
        </Button>
      </div>
    </div>
  );
}
