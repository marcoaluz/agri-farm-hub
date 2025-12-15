import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Package, Search, AlertTriangle, DollarSign, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProdutoComCusto {
  produto_id: string;
  propriedade_id: string;
  nome: string;
  categoria: string;
  unidade_medida: string;
  saldo_atual: number;
  nivel_minimo: number;
  custo_medio: number;
  valor_imobilizado: number;
  total_lotes: number;
}

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

interface Produto {
  id: string;
  nome: string;
  categoria: string;
  unidade_medida: string;
}

export function Estoque() {
  const { propriedadeAtual } = useGlobal();
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoComCusto | null>(null);
  const [dialogLotesOpen, setDialogLotesOpen] = useState(false);
  const [dialogEntradaOpen, setDialogEntradaOpen] = useState(false);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ['produtos-custos', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_produtos_custos')
        .select('*')
        .eq('propriedade_id', propriedadeAtual?.id)
        .order('nome');

      if (error) throw error;
      return data as ProdutoComCusto[];
    },
    enabled: !!propriedadeAtual?.id
  });

  const categorias = Array.from(new Set(produtos?.map(p => p.categoria) || []));

  const produtosFiltrados = produtos?.filter(produto => {
    const matchBusca = produto.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = filtroCategoria === 'todos' || produto.categoria === filtroCategoria;
    return matchBusca && matchCategoria;
  });

  const totalProdutos = produtos?.length || 0;
  const estoqueTotal = produtos?.reduce((sum, p) => sum + (p.valor_imobilizado || 0), 0) || 0;
  const produtosBaixos = produtos?.filter(p => p.nivel_minimo > 0 && p.saldo_atual <= p.nivel_minimo).length || 0;
  const produtosZerados = produtos?.filter(p => p.saldo_atual === 0).length || 0;

  if (!propriedadeAtual) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Selecione uma propriedade</h3>
            <p className="text-muted-foreground text-center">
              Para visualizar o estoque, selecione uma propriedade no menu superior.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8 text-blue-600" />
            Estoque
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie produtos, lotes e custos (FIFO)
          </p>
        </div>

        <Button onClick={() => setDialogEntradaOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Entrada de Estoque
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Produtos</p>
                <p className="text-2xl font-bold">{totalProdutos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estoque Imobilizado</p>
                <p className="text-2xl font-bold">
                  R$ {estoqueTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                <p className="text-2xl font-bold">{produtosBaixos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <Package className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estoque Zerado</p>
                <p className="text-2xl font-bold">{produtosZerados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as categorias</SelectItem>
            {categorias.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Produtos */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : produtosFiltrados?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {busca || filtroCategoria !== 'todos'
                ? 'Nenhum produto encontrado'
                : 'Nenhum produto cadastrado'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {busca || filtroCategoria !== 'todos'
                ? 'Tente ajustar os filtros de busca'
                : 'Cadastre seu primeiro produto para começar a controlar o estoque'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtosFiltrados?.map(produto => (
            <ProdutoCard
              key={produto.produto_id}
              produto={produto}
              onVerLotes={() => {
                setProdutoSelecionado(produto);
                setDialogLotesOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Dialog de Lotes */}
      <Dialog open={dialogLotesOpen} onOpenChange={setDialogLotesOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {produtoSelecionado && (
            <LotesDialog
              produto={produtoSelecionado}
              onClose={() => setDialogLotesOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Entrada */}
      <Dialog open={dialogEntradaOpen} onOpenChange={setDialogEntradaOpen}>
        <DialogContent className="max-w-lg">
          <EntradaEstoqueForm
            onSuccess={() => setDialogEntradaOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProdutoCard({ 
  produto, 
  onVerLotes 
}: { 
  produto: ProdutoComCusto; 
  onVerLotes: () => void;
}) {
  const getStatusEstoque = () => {
    if (produto.saldo_atual === 0) {
      return { label: 'ZERADO', color: 'bg-red-100 text-red-700 border-red-300' };
    }
    if (produto.nivel_minimo > 0 && produto.saldo_atual <= produto.nivel_minimo) {
      return { label: 'BAIXO', color: 'bg-orange-100 text-orange-700 border-orange-300' };
    }
    return { label: 'OK', color: 'bg-green-100 text-green-700 border-green-300' };
  };

  const status = getStatusEstoque();

  return (
    <Card className={cn("hover:shadow-lg transition-all border-2", status.color)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground mb-2">
              {produto.nome}
            </h3>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {produto.categoria}
              </Badge>
              <Badge className={cn("text-xs", status.color)}>
                {status.label}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Saldo Atual:</span>
            <span className={cn(
              "text-lg font-bold",
              produto.saldo_atual === 0 ? "text-red-600" : "text-green-600"
            )}>
              {produto.saldo_atual?.toLocaleString('pt-BR', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 3
              })} {produto.unidade_medida}
            </span>
          </div>

          {produto.nivel_minimo > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Nível Mínimo:</span>
              <span className="font-medium">
                {produto.nivel_minimo} {produto.unidade_medida}
              </span>
            </div>
          )}
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-900">Custo Médio:</span>
            <span className="text-lg font-bold text-blue-700">
              R$ {produto.custo_medio?.toFixed(2) || '0,00'}
              <span className="text-xs font-normal ml-1">/ {produto.unidade_medida}</span>
            </span>
          </div>
          
          <div className="flex justify-between items-center pt-2 border-t border-blue-300">
            <span className="text-sm font-medium text-blue-900">Valor Imobilizado:</span>
            <span className="text-base font-bold text-blue-900">
              R$ {produto.valor_imobilizado?.toLocaleString('pt-BR', { 
                minimumFractionDigits: 2 
              }) || '0,00'}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={onVerLotes}
          >
            <Package className="h-4 w-4 mr-2" />
            Ver {produto.total_lotes} {produto.total_lotes === 1 ? 'Lote' : 'Lotes'} (FIFO)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LotesDialog({ produto, onClose }: { produto: ProdutoComCusto; onClose: () => void }) {
  const { data: lotes, isLoading } = useQuery({
    queryKey: ['lotes', produto.produto_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('produto_id', produto.produto_id)
        .gt('quantidade_disponivel', 0)
        .order('data_entrada', { ascending: true });

      if (error) throw error;
      return data as Lote[];
    }
  });

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Lotes FIFO - {produto.nome}
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Saldo Total</p>
          <p className="text-xl font-bold">{produto.saldo_atual} {produto.unidade_medida}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Custo Médio</p>
          <p className="text-xl font-bold">R$ {produto.custo_medio?.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Valor Total</p>
          <p className="text-xl font-bold">R$ {produto.valor_imobilizado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : lotes?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum lote disponível
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem FIFO</TableHead>
                <TableHead>Data Entrada</TableHead>
                <TableHead>Nota Fiscal</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Qtd. Disponível</TableHead>
                <TableHead className="text-right">Custo Unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotes?.map((lote, index) => (
                <TableRow key={lote.id}>
                  <TableCell>
                    <Badge variant={index === 0 ? 'default' : 'outline'}>
                      {index + 1}º
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(lote.data_entrada).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>{lote.nota_fiscal || '-'}</TableCell>
                  <TableCell>{lote.fornecedor || '-'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {lote.quantidade_disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    R$ {lote.custo_unitario.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    R$ {(lote.quantidade_disponivel * lote.custo_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

function EntradaEstoqueForm({ onSuccess }: { onSuccess: () => void }) {
  const { propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    produto_id: '',
    quantidade: 0,
    custo_unitario: 0,
    nota_fiscal: '',
    fornecedor: '',
    data_entrada: new Date().toISOString().split('T')[0]
  });

  const { data: produtos } = useQuery({
    queryKey: ['produtos', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, categoria, unidade_medida')
        .eq('propriedade_id', propriedadeAtual?.id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data as Produto[];
    },
    enabled: !!propriedadeAtual?.id
  });

  const produtoSelecionado = produtos?.find(p => p.id === formData.produto_id);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!formData.produto_id) throw new Error('Selecione um produto');
      if (formData.quantidade <= 0) throw new Error('Quantidade deve ser maior que zero');
      if (formData.custo_unitario <= 0) throw new Error('Custo deve ser maior que zero');

      const { error } = await supabase
        .from('lotes')
        .insert({
          propriedade_id: propriedadeAtual?.id,
          produto_id: formData.produto_id,
          quantidade_original: formData.quantidade,
          quantidade_disponivel: formData.quantidade,
          custo_unitario: formData.custo_unitario,
          nota_fiscal: formData.nota_fiscal || null,
          fornecedor: formData.fornecedor || null,
          data_entrada: formData.data_entrada
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Entrada de estoque registrada com sucesso' });
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
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Entrada de Estoque
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label>Produto *</Label>
          <Select 
            value={formData.produto_id} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, produto_id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um produto" />
            </SelectTrigger>
            <SelectContent>
              {produtos?.map(produto => (
                <SelectItem key={produto.id} value={produto.id}>
                  {produto.nome} ({produto.unidade_medida})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Quantidade *{produtoSelecionado && ` (${produtoSelecionado.unidade_medida})`}</Label>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={formData.quantidade || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, quantidade: parseFloat(e.target.value) || 0 }))}
              placeholder="0.000"
            />
          </div>

          <div>
            <Label>Custo Unitário (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.custo_unitario || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, custo_unitario: parseFloat(e.target.value) || 0 }))}
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <Label>Data de Entrada</Label>
          <Input
            type="date"
            value={formData.data_entrada}
            onChange={(e) => setFormData(prev => ({ ...prev, data_entrada: e.target.value }))}
          />
        </div>

        <div>
          <Label>Nota Fiscal</Label>
          <Input
            value={formData.nota_fiscal}
            onChange={(e) => setFormData(prev => ({ ...prev, nota_fiscal: e.target.value }))}
            placeholder="Número da NF (opcional)"
          />
        </div>

        <div>
          <Label>Fornecedor</Label>
          <Input
            value={formData.fornecedor}
            onChange={(e) => setFormData(prev => ({ ...prev, fornecedor: e.target.value }))}
            placeholder="Nome do fornecedor (opcional)"
          />
        </div>

        {formData.quantidade > 0 && formData.custo_unitario > 0 && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-900">Valor Total da Entrada:</span>
              <span className="text-xl font-bold text-green-700">
                R$ {(formData.quantidade * formData.custo_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
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

export default Estoque;
