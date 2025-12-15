import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Wrench, Edit, Trash2, Search, MapPin, CheckCircle, Package } from 'lucide-react';
import { ServicoForm } from '@/components/servicos/ServicoForm';

interface Servico {
  id: string;
  propriedade_id: string;
  nome: string;
  descricao?: string;
  categoria: string;
  requer_talhao: boolean;
  ativo: boolean;
  created_at: string;
  total_itens?: number;
}

export function Servicos() {
  const { propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [servicoEditando, setServicoEditando] = useState<Servico | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  const { data: servicos, isLoading } = useQuery({
    queryKey: ['servicos', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          *,
          servicos_itens(count)
        `)
        .eq('propriedade_id', propriedadeAtual?.id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      
      return (data as any[]).map(s => ({
        ...s,
        total_itens: s.servicos_itens?.[0]?.count || 0
      })) as Servico[];
    },
    enabled: !!propriedadeAtual?.id
  });

  const categorias = Array.from(new Set(servicos?.map(s => s.categoria) || []));

  const servicosFiltrados = servicos?.filter(servico => {
    const matchBusca = servico.nome.toLowerCase().includes(busca.toLowerCase()) ||
                       servico.descricao?.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = filtroCategoria === 'todos' || servico.categoria === filtroCategoria;
    return matchBusca && matchCategoria;
  });

  const totalServicos = servicos?.length || 0;
  const comTalhao = servicos?.filter(s => s.requer_talhao).length || 0;
  const semTalhao = totalServicos - comTalhao;

  if (!propriedadeAtual) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wrench className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Selecione uma propriedade</h3>
            <p className="text-muted-foreground text-center">
              Para visualizar os serviços, selecione uma propriedade no menu superior.
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
            <Wrench className="h-8 w-8 text-blue-600" />
            Serviços
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os tipos de operações da propriedade
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setServicoEditando(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <ServicoForm
              servico={servicoEditando}
              onSuccess={() => {
                setDialogOpen(false);
                setServicoEditando(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Wrench className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Serviços</p>
                <p className="text-2xl font-bold">{totalServicos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requer Talhão</p>
                <p className="text-2xl font-bold">{comTalhao}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sem Talhão</p>
                <p className="text-2xl font-bold">{semTalhao}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Package className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Categorias</p>
                <p className="text-2xl font-bold">{categorias.length}</p>
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
            placeholder="Buscar serviço..."
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

      {/* Lista de Serviços */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : servicosFiltrados?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wrench className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {busca || filtroCategoria !== 'todos'
                ? 'Nenhum serviço encontrado'
                : 'Nenhum serviço cadastrado'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {busca || filtroCategoria !== 'todos'
                ? 'Tente ajustar os filtros de busca'
                : 'Crie seu primeiro serviço para começar a registrar operações'}
            </p>
            {!busca && filtroCategoria === 'todos' && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Serviço
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicosFiltrados?.map(servico => (
            <ServicoCard
              key={servico.id}
              servico={servico}
              onEdit={() => {
                setServicoEditando(servico);
                setDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServicoCard({ servico, onEdit }: { servico: Servico; onEdit: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('servicos')
        .update({ ativo: false })
        .eq('id', servico.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Serviço removido com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
    },
    onError: () => {
      toast({
        title: 'Erro ao remover serviço',
        variant: 'destructive'
      });
    }
  });

  return (
    <Card className="hover:shadow-lg transition-all border-2 border-blue-100">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground mb-2">
              {servico.nome}
            </h3>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {servico.categoria}
              </Badge>
              
              {servico.requer_talhao && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  Requer Talhão
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá desativar o serviço "{servico.nome}". 
                    Ele não será excluído permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Descrição */}
        {servico.descricao && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {servico.descricao}
          </p>
        )}

        {/* Itens Vinculados */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-900">
            Itens vinculados
          </span>
          <span className="text-lg font-bold text-blue-600">
            {servico.total_itens || 0}
          </span>
        </div>

        {/* Data de Criação */}
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          Criado em {new Date(servico.created_at).toLocaleDateString('pt-BR')}
        </div>
      </CardContent>
    </Card>
  );
}

export default Servicos;
