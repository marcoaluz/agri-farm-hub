import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Package, Search, AlertTriangle, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LotesDialog } from '@/components/estoque/LotesDialog';
import { EntradaEstoqueForm } from '@/components/estoque/EntradaEstoqueForm';
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

export default Estoque;
