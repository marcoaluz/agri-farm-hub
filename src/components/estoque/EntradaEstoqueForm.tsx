import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { useSafraFechada } from '@/hooks/useSafraFechada';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { uploadAnexoNF, MAX_ANEXO_BYTES } from '@/lib/anexoNF';
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
  const { propriedadeAtual, safraAtual } = useGlobal();
  const { isFechada, verificarSafra } = useSafraFechada(safraAtual);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const safraFechada = (safraAtual as any)?.fechada === true;

  const hoje = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    produto_id: '',
    nota_fiscal: '',
    fornecedor: '',
    quantidade: 0,
    custo_unitario: 0,
    data_entrada: hoje,
    data_validade: ''
  });
  const [statusPagamento, setStatusPagamento] = useState('pago');
  const [dataVencimento, setDataVencimento] = useState('');
  const [numParcelas, setNumParcelas] = useState(2);
  const [arquivoNF, setArquivoNF] = useState<File | null>(null);


  // Buscar produtos
  const {
    data: produtos = [],
    isLoading: produtosLoading,
    error: produtosError,
  } = useQuery({
    queryKey: ['produtos', propriedadeAtual?.id],
    queryFn: async () => {
      // RPC inclui produtos compartilhados (globais) de outras propriedades
      const { data, error } = await supabase.rpc('listar_produtos_usuario', {
        p_propriedade_id: propriedadeAtual!.id,
      });

      if (error) throw error;
      return ((data as any[]) || [])
        // Alguns bancos deixam `ativo` como NULL mesmo com default true.
        .filter(p => p.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '')) as Produto[];
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
      if (statusPagamento !== 'pago' && !dataVencimento) {
        throw new Error(statusPagamento === 'parcelado' ? 'Informe a data da 1ª parcela' : 'Informe a data de vencimento');
      }
      if (statusPagamento === 'parcelado' && (numParcelas < 2 || numParcelas > 36)) {
        throw new Error('Informe entre 2 e 36 parcelas');
      }
      if (arquivoNF && arquivoNF.size > MAX_ANEXO_BYTES) {
        throw new Error('Arquivo muito grande (máx. 5MB)');
      }

      // Inserir lote (o trigger cria a transação financeira automaticamente)
      const { data: novoLote, error } = await supabase
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
          data_validade: formData.data_validade || null,
          status_pagamento: statusPagamento === 'pago' ? 'pago' : 'pendente',
          data_vencimento: statusPagamento === 'pago' ? null : dataVencimento,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Parcelamento: localizar a transação criada pelo trigger e gerar parcelas
      if (statusPagamento === 'parcelado' && novoLote) {
        const { data: transacao } = await supabase
          .from('transacoes')
          .select('id')
          .eq('propriedade_id', propriedadeAtual!.id)
          .like('origem', `%${(novoLote as any).id}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (transacao) {
          await supabase.from('transacoes')
            .update({ parcelado: true, numero_parcelas: numParcelas } as any)
            .eq('id', (transacao as any).id);

          const { error: parcError } = await supabase.rpc('gerar_parcelas' as any, {
            p_transacao_id: (transacao as any).id,
            p_num_parcelas: numParcelas,
            p_data_primeira: dataVencimento,
          });
          if (parcError) {
            toast({
              title: 'Lote criado, mas erro ao gerar parcelas',
              description: parcError.message,
              variant: 'destructive',
            });
          }
        }
      }


      if (arquivoNF && novoLote) {
        const { error: erroAnexo } = await uploadAnexoNF({
          propriedadeId: propriedadeAtual!.id,
          entidadeTipo: 'lote',
          entidadeId: (novoLote as any).id,
          arquivo: arquivoNF,
        });
        if (erroAnexo) {
          toast({
            title: 'Lote criado, mas erro ao anexar arquivo',
            description: erroAnexo,
            variant: 'destructive',
          });
        }
      }

      // O trigger atualizar_saldo_produto já atualizará o saldo automaticamente
    },
    onSuccess: () => {
      toast({
        title: 'Entrada de estoque registrada com sucesso!',
        description: statusPagamento === 'pago'
          ? 'Despesa criada no Financeiro e saldo atualizado.'
          : statusPagamento === 'parcelado'
            ? `Despesa parcelada em ${numParcelas}x a partir de ${new Date(dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}.`
            : `Despesa a vencer em ${new Date(dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}.`,

      });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['anexos'] });
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
    <div className="flex flex-col max-h-[80vh]">
      <div className="overflow-y-auto flex-1 space-y-4 pr-1">
      <DialogHeader>
        <DialogTitle>Entrada de Estoque</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Registre a entrada de um novo lote no estoque
        </p>
      </DialogHeader>

      {safraFechada && (
        <Alert variant="destructive" className="py-2">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>🔒 Safra fechada — somente leitura.</strong> Não é possível registrar entradas nesta safra.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="py-2">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Cada entrada de produto cria um novo <strong>lote</strong> no sistema FIFO. O custo será calculado automaticamente ao consumir.
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

      <div className="space-y-3">
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

        {/* Pagamento */}
        <div>
          <Label>Pagamento *</Label>
          <RadioGroup value={statusPagamento} onValueChange={setStatusPagamento} className="flex flex-wrap gap-4 mt-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pago" id="pago" />
              <Label htmlFor="pago" className="font-normal cursor-pointer">À vista (pago hoje)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pendente" id="pendente" />
              <Label htmlFor="pendente" className="font-normal cursor-pointer">A prazo</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="parcelado" id="parcelado" />
              <Label htmlFor="parcelado" className="font-normal cursor-pointer">Parcelado</Label>
            </div>
          </RadioGroup>
        </div>

        {statusPagamento !== 'pago' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data_vencimento">
                {statusPagamento === 'parcelado' ? 'Data da 1ª parcela *' : 'Data de vencimento *'}
              </Label>
              <Input
                id="data_vencimento"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                min={hoje}
                required
              />
            </div>
            {statusPagamento === 'parcelado' && (
              <div>
                <Label htmlFor="num_parcelas">Número de parcelas *</Label>
                <Input
                  id="num_parcelas"
                  type="number"
                  min={2}
                  max={36}
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(Number(e.target.value))}
                />
                {valorTotal > 0 && numParcelas >= 2 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {numParcelas}x de R$ {(valorTotal / numParcelas).toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}


        {/* Anexo da nota fiscal */}
        <div>
          <Label htmlFor="anexo_nf">Anexar nota fiscal (opcional)</Label>
          <Input
            id="anexo_nf"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setArquivoNF(e.target.files?.[0] || null)}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground mt-1">PDF, JPG ou PNG (máx. 5MB)</p>
          {arquivoNF && <p className="text-xs mt-1">Arquivo selecionado: {arquivoNF.name}</p>}
        </div>

        {valorTotal > 0 && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              Ao salvar, será criada automaticamente uma despesa no Financeiro no valor de R$ {valorTotal.toFixed(2)}
            </AlertDescription>
          </Alert>
        )}
      </div>


      </div>{/* end scrollable area */}
      {/* Botões */}
      <div className="sticky bottom-0 z-10 -mb-2 mt-2 flex justify-end gap-2 border-t bg-background py-3">
        <Button variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={
            safraFechada ||
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
