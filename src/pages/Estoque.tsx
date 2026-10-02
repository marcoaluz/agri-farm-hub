import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { useSomenteConsulta } from '@/hooks/useSomenteConsulta';
import { useSafraFechada } from '@/hooks/useSafraFechada';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Package, Search, AlertTriangle, DollarSign, PackagePlus, Pencil, Trash2, Loader2, EyeOff, RotateCcw } from 'lucide-react';
import { PrateleiraIcon } from '@/components/icons/PrateleiraIcon';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LotesDialog } from '@/components/estoque/LotesDialog';
import { EntradaEstoqueForm } from '@/components/estoque/EntradaEstoqueForm';
import { ProdutoForm } from '@/components/estoque/ProdutoForm';
import { VenderProdutoModal } from '@/components/estoque/VenderProdutoModal';

interface ProdutoComCusto {
  id: string;
  propriedade_id: string;
  nome: string;
  categoria: string;
  unidade_medida: string;
  saldo_atual: number;
  nivel_minimo: number;
  custo_medio: number;
  valor_imobilizado: number;
  total_lotes: number;
  compartilhado?: boolean;
  vendavel?: boolean;
}


export function Estoque() {
  const { propriedadeAtual } = useGlobal();
  const { isFechada, verificarSafra } = useSafraFechada();
  const somenteConsulta = useSomenteConsulta();
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');

  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoComCusto | null>(null);
  const [dialogLotesOpen, setDialogLotesOpen] = useState(false);
  const [dialogEntradaOpen, setDialogEntradaOpen] = useState(false);
  const [dialogProdutoOpen, setDialogProdutoOpen] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<any>(null);
  const [produtoVenda, setProdutoVenda] = useState<ProdutoComCusto | null>(null);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<ProdutoComCusto | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [produtoParaDesativar, setProdutoParaDesativar] = useState<ProdutoComCusto | null>(null);

  const invalidarProdutos = () => {
    for (const key of [
      'produtos', 'produtos-custos', 'produtos-lancamento', 'produtos-desativados', 'lotes',
      'transacoes', 'transacoes-com-anexo', 'rel-estoque', 'rel-estoque-categorias',
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  // Exclusão "de verdade" no banco (tudo ou nada): apaga lotes + despesas do
  // Financeiro e o produto. Produto já usado é recusado pela RPC com o motivo.
  const excluirProdutoMutation = useMutation({
    mutationFn: async (produto: ProdutoComCusto) => {
      const { data, error } = await supabase.rpc('excluir_produto_completo' as any, { p_produto_id: produto.id });
      if (error) throw error;
      return data as { acao: 'excluido' | 'desativado'; lotes_excluidos: number; transacoes_excluidas: number };
    },
    onSuccess: (res) => {
      invalidarProdutos();
      const detalhe = `${res?.lotes_excluidos ?? 0} entrada(s) de estoque e ${res?.transacoes_excluidas ?? 0} despesa(s) do Financeiro foram excluídas.`;
      if (res?.acao === 'desativado') {
        toast({
          title: 'Produto desativado',
          description: `Ele ainda está em modelos de serviço, por isso foi desativado em vez de excluído. ${detalhe} Veja na aba Desativados.`,
        });
      } else {
        toast({ title: 'Produto excluído', description: detalhe });
      }
      setProdutoParaExcluir(null);
    },
    onError: (err: any) => {
      toast({ title: 'Não foi possível excluir o produto', description: err?.message, variant: 'destructive' });
      setProdutoParaExcluir(null);
    },
  });

  // Desativar/reativar só muda ativo: lotes, despesas e histórico ficam intactos.
  const alterarAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from('produtos' as any)
        .update({ ativo })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data || (data as any[]).length === 0) {
        throw new Error('Produto não encontrado ou você não tem permissão para alterá-lo.');
      }
      return ativo;
    },
    onSuccess: (ativo) => {
      invalidarProdutos();
      toast({
        title: ativo ? 'Produto reativado' : 'Produto desativado',
        description: ativo
          ? 'Ele voltou para a lista do Estoque.'
          : 'Ele saiu da lista do Estoque. O histórico foi mantido e você pode reativá-lo na aba Desativados.',
      });
      setProdutoParaDesativar(null);
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao alterar produto', description: err?.message, variant: 'destructive' });
    },
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightLoteId = searchParams.get('highlight');
  const [loteDestacado, setLoteDestacado] = useState<string | null>(null);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ['produtos-custos', propriedadeAtual?.id],
    queryFn: async () => {
      // Lista via RPC (inclui produtos compartilhados entre propriedades)
      const { data: lista, error: erroLista } = await supabase.rpc('listar_produtos_usuario', {
        p_propriedade_id: propriedadeAtual?.id,
      });

      // Dados de custo/saldo continuam vindo da view FIFO
      const { data: custos, error: erroCustos } = await supabase
        .from('vw_produtos_custos')
        .select('*')
        .eq('propriedade_id', propriedadeAtual?.id)
        .order('nome');

      if (erroLista && erroCustos) throw erroLista;

      const mapaCustos = new Map<string, any>();
      (custos || []).forEach((c: any) => mapaCustos.set(c.id || c.produto_id, c));

      if (erroLista || !lista) {
        return (custos || []).map((d: any) => ({ ...d, id: d.id || d.produto_id })) as ProdutoComCusto[];
      }

      return (lista as any[])
        .map((p: any) => {
          const id = p.id || p.produto_id;
          return {
            saldo_atual: 0,
            nivel_minimo: 0,
            custo_medio: 0,
            valor_imobilizado: 0,
            total_lotes: 0,
            ...(mapaCustos.get(id) || {}),
            ...p,
            id,
          } as ProdutoComCusto;
        })
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    },
    enabled: !!propriedadeAtual?.id
  });

  const { data: produtosDesativados, isLoading: loadingDesativados } = useQuery({
    queryKey: ['produtos-desativados', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_produtos_desativados' as any, {
        p_propriedade_id: propriedadeAtual?.id,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; nome: string; categoria: string | null; unidade_medida: string;
        saldo_atual: number; compartilhado: boolean; tipo_estoque: string | null;
      }>;
    },
    enabled: !!propriedadeAtual?.id,
  });

  // Abre o produto do lote destacado quando vindo do Financeiro
  useEffect(() => {
    if (!highlightLoteId || !produtos?.length) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from('lotes')
        .select('id, produto_id')
        .eq('id', highlightLoteId)
        .maybeSingle();
      if (cancelado || !data) return;
      const produto = produtos.find(p => p.id === (data as any).produto_id);
      if (produto) {
        setProdutoSelecionado(produto);
        setLoteDestacado(highlightLoteId);
        setDialogLotesOpen(true);
      }
      setSearchParams(params => {
        params.delete('highlight');
        return params;
      }, { replace: true });
    })();
    return () => { cancelado = true };
  }, [highlightLoteId, produtos, setSearchParams]);


  const categorias = Array.from(
    new Set(
      (produtos || [])
        .filter((p: any) =>
          tipoFiltro === 'todos' || (p.tipo_estoque || 'agricola') === tipoFiltro
        )
        .map((p: any) => p.categoria)
        .filter(Boolean)
    )
  );

  const contarTipo = (tipo: string) =>
    produtos?.filter((p: any) => (p.tipo_estoque || 'agricola') === tipo).length || 0;

  const produtosFiltrados = produtos?.filter(produto => {
    const matchBusca = produto.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = filtroCategoria === 'todos' || produto.categoria === filtroCategoria;
    const matchTipo =
      tipoFiltro === 'todos' || ((produto as any).tipo_estoque || 'agricola') === tipoFiltro;
    return matchBusca && matchCategoria && matchTipo;
  });

  const abaDesativados = tipoFiltro === 'desativados';
  const desativadosFiltrados = (produtosDesativados || []).filter(p =>
    (p.nome || '').toLowerCase().includes(busca.toLowerCase())
  );


  const totalProdutos = produtos?.length || 0;
  const estoqueTotal = produtos?.reduce((sum, p) => sum + (p.valor_imobilizado || 0), 0) || 0;
  const produtosBaixos = produtos?.filter(p => p.nivel_minimo > 0 && p.saldo_atual <= p.nivel_minimo).length || 0;
  const produtosZerados = produtos?.filter(p => p.saldo_atual === 0).length || 0;

  if (!propriedadeAtual) {
    return (
      <div className="w-full max-w-full p-6">
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <PrateleiraIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Estoque/Insumos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie produtos, lotes e custos (FIFO)
          </p>
        </div>

        {!somenteConsulta && (
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => { setProdutoEditando(null); setDialogProdutoOpen(true); }}
            className="w-full sm:w-auto"
          >
            <PackagePlus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
          <Button
            onClick={() => { if (!verificarSafra('registrar entrada de estoque')) return; setDialogEntradaOpen(true) }}
            disabled={isFechada}
            title={isFechada ? 'Safra fechada' : ''}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Entrada de Estoque
          </Button>
        </div>
        )}
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Produtos</p>
                <p className="text-xl sm:text-2xl font-bold">{totalProdutos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-muted-foreground">Imobilizado</p>
                <p className="text-lg sm:text-2xl font-bold">
                  R$ {estoqueTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-muted-foreground">Baixo</p>
                <p className="text-xl sm:text-2xl font-bold">{produtosBaixos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-muted-foreground">Zerado</p>
                <p className="text-xl sm:text-2xl font-bold">{produtosZerados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abas por tipo de estoque */}
      <Tabs value={tipoFiltro} onValueChange={setTipoFiltro}>
        <TabsList className="w-full sm:w-auto overflow-x-auto flex justify-start">
          <TabsTrigger value="todos">Todos ({produtos?.length || 0})</TabsTrigger>
          <TabsTrigger value="agricola">🌱 Agrícola ({contarTipo('agricola')})</TabsTrigger>
          <TabsTrigger value="pecuario">🐄 Pecuário ({contarTipo('pecuario')})</TabsTrigger>
          <TabsTrigger value="geral">📦 Geral ({contarTipo('geral')})</TabsTrigger>
          <TabsTrigger value="desativados">Desativados ({produtosDesativados?.length || 0})</TabsTrigger>
        </TabsList>
      </Tabs>

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

        {!abaDesativados && (
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
        )}
      </div>

      {/* Lista de Produtos */}
      {abaDesativados ? (
        loadingDesativados ? (
          <Skeleton className="h-32 w-full" />
        ) : desativadosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <EyeOff className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">
                {busca ? 'Nenhum produto encontrado' : 'Nenhum produto desativado'}
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Produtos desativados saem da lista do Estoque, mas o histórico é mantido.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {desativadosFiltrados.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.nome}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {p.categoria && <Badge variant="outline" className="text-xs">{p.categoria}</Badge>}
                      {p.compartilhado && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Global</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Saldo: {Number(p.saldo_atual || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {p.unidade_medida}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 shrink-0"
                    disabled={alterarAtivoMutation.isPending}
                    onClick={() => alterarAtivoMutation.mutate({ id: p.id, ativo: true })}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reativar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtosFiltrados?.map(produto => (
            <ProdutoCard
              key={produto.id}
              produto={produto}
              onVerLotes={() => {
                setProdutoSelecionado(produto);
                setDialogLotesOpen(true);
              }}
              onVender={() => setProdutoVenda(produto)}
              onEditar={() => {
                setProdutoEditando(produto);
                setDialogProdutoOpen(true);
              }}
              onExcluir={() => setProdutoParaExcluir(produto)}
              onDesativar={() => setProdutoParaDesativar(produto)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!produtoParaExcluir} onOpenChange={(open) => { if (!open) setProdutoParaExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{produtoParaExcluir?.nome}</strong>: as entradas de estoque deste produto e as despesas
              correspondentes no Financeiro serão excluídas. Não pode ser desfeito.
              Produtos que já foram usados não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirProdutoMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Mantém o diálogo aberto até o banco responder (fecha no onSuccess/onError)
                e.preventDefault();
                if (produtoParaExcluir) excluirProdutoMutation.mutate(produtoParaExcluir);
              }}
              disabled={excluirProdutoMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirProdutoMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...</> : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!produtoParaDesativar} onOpenChange={(open) => { if (!open) setProdutoParaDesativar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{produtoParaDesativar?.nome}</strong> sai da lista do Estoque. Entradas, despesas e histórico
              são mantidos. Você pode reativá-lo a qualquer momento na aba Desativados.
              {(produtoParaDesativar?.saldo_atual ?? 0) > 0 && (
                <span className="block mt-2 font-medium text-orange-700">
                  Atenção: ainda há {produtoParaDesativar?.saldo_atual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
                  {produtoParaDesativar?.unidade_medida} em estoque. Enquanto estiver desativado, esse saldo não aparece
                  para lançamentos e consumo.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={alterarAtivoMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (produtoParaDesativar) alterarAtivoMutation.mutate({ id: produtoParaDesativar.id, ativo: false });
              }}
              disabled={alterarAtivoMutation.isPending}
            >
              {alterarAtivoMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Desativando...</> : 'Desativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Lotes */}
      <Dialog open={dialogLotesOpen} onOpenChange={(open) => { setDialogLotesOpen(open); if (!open) setLoteDestacado(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {produtoSelecionado && (
            <LotesDialog
              produto={produtoSelecionado}
              highlightLoteId={loteDestacado}
              onClose={() => { setDialogLotesOpen(false); setLoteDestacado(null); }}
            />

          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Entrada */}
      <Dialog open={dialogEntradaOpen} onOpenChange={setDialogEntradaOpen}>
        <DialogContent className="w-[95vw] sm:w-auto max-w-lg max-h-[90vh] overflow-y-auto">
          <EntradaEstoqueForm
            onSuccess={() => setDialogEntradaOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de Cadastro de Produto */}
      <Dialog open={dialogProdutoOpen} onOpenChange={(open) => { setDialogProdutoOpen(open); if (!open) setProdutoEditando(null); }}>
        <DialogContent className="w-[95vw] sm:w-auto max-w-md max-h-[90vh] overflow-y-auto">
          <ProdutoForm
            produto={produtoEditando}
            onSuccess={() => { setDialogProdutoOpen(false); setProdutoEditando(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de Venda de Produto */}
      <Dialog open={!!produtoVenda} onOpenChange={(open) => { if (!open) setProdutoVenda(null); }}>
        <DialogContent className="w-[95vw] sm:w-auto max-w-lg max-h-[90vh] overflow-y-auto">
          {produtoVenda && (
            <VenderProdutoModal
              produto={produtoVenda}
              onClose={() => setProdutoVenda(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProdutoCard({ 
  produto, 
  onVerLotes,
  onVender,
  onEditar,
  onExcluir,
  onDesativar,
}: {
  produto: ProdutoComCusto;
  onVerLotes: () => void;
  onVender: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onDesativar: () => void;
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
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-foreground">
                {produto.nome}
              </h3>
              {produto.compartilhado && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Global
                </Badge>
              )}
              {produto.vendavel && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Pode ser vendido
                </Badge>
              )}
            </div>

            
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

        <div className="mt-4 pt-4 border-t flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onVerLotes}
          >
            <Package className="h-4 w-4 mr-2" />
            Ver {produto.total_lotes} {produto.total_lotes === 1 ? 'Lote' : 'Lotes'} (FIFO)
          </Button>
          <Button size="sm" variant="outline" onClick={onEditar} className="gap-1">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={onDesativar} className="gap-1" title="Desativar">
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={onExcluir} className="gap-1 text-destructive hover:text-destructive" title="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {produto.vendavel && produto.saldo_atual > 0 && (
            <Button size="sm" variant="default" onClick={onVender} className="gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Vender
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default Estoque;
