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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Wrench, Edit, Trash2, Search, MapPin, CheckCircle, Package, Loader2 } from 'lucide-react';
import { ServicoForm } from '@/components/servicos/ServicoForm';

interface Servico {
  id: string;
  propriedade_id: string;
  nome: string;
  descricao?: string;
  categoria: string;
  requer_talhao: boolean;
  tipo_servico?: 'simples' | 'composto';
  custo_padrao?: number;
  unidade_medida?: string;
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
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const { data: servicos, isLoading, error } = useQuery({
    queryKey: ['servicos', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('propriedade_id', propriedadeAtual!.id)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      if (!data?.length) return [];

      // Contagem de itens em query separada (evita falha de schema)
      const { data: counts } = await supabase
        .from('servicos_itens')
        .select('servico_id')
        .in('servico_id', data.map(s => s.id));

      const countMap: Record<string, number> = {};
      (counts || []).forEach((r: any) => {
        countMap[r.servico_id] = (countMap[r.servico_id] || 0) + 1;
      });

      return data.map(s => ({ ...s, total_itens: countMap[s.id] || 0 })) as Servico[];
    },
    enabled: !!propriedadeAtual?.id,
  });

  const categorias = Array.from(new Set((servicos || []).map(s => s.categoria).filter(Boolean)));

  const servicosFiltrados = (servicos || []).filter(s => {
    const matchBusca = s.nome.toLowerCase().includes(busca.toLowerCase()) ||
      s.descricao?.toLowerCase().includes(busca.toLowerCase());
    const matchCat  = filtroCategoria === 'todos' || s.categoria === filtroCategoria;
    const matchTipo = filtroTipo === 'todos' || (s.tipo_servico || 'composto') === filtroTipo;
    return matchBusca && matchCat && matchTipo;
  });

  const stats = {
    total:    servicos?.length || 0,
    simples:  (servicos || []).filter(s => s.tipo_servico === 'simples').length,
    composto: (servicos || []).filter(s => s.tipo_servico === 'composto').length,
    talhao:   (servicos || []).filter(s => s.requer_talhao).length,
  };

  const abrirNovo = () => { setServicoEditando(null); setDialogOpen(true); };

  if (!propriedadeAtual) {
    return (
      <div className="w-full max-w-full p-6">
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
    <div className="w-full max-w-full space-y-6">
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
            <Button onClick={abrirNovo}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <ServicoForm
              servico={servicoEditando}
              onSuccess={() => { setDialogOpen(false); setServicoEditando(null); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive">
            Erro ao carregar: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',         value: stats.total,    icon: Wrench,      bg: 'bg-blue-100',   fg: 'text-blue-600' },
          { label: 'Simples',       value: stats.simples,  icon: CheckCircle, bg: 'bg-amber-100',  fg: 'text-amber-600' },
          { label: 'Compostos',     value: stats.composto, icon: Package,     bg: 'bg-purple-100', fg: 'text-purple-600' },
          { label: 'Requer Talhão', value: stats.talhao,   icon: MapPin,      bg: 'bg-green-100',  fg: 'text-green-600' },
        ].map(({ label, value, icon: Icon, bg, fg }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${bg}`}>
                  <Icon className={`h-6 w-6 ${fg}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="simples">Simples</SelectItem>
            <SelectItem value="composto">Composto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as categorias</SelectItem>
            {categorias.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : servicosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wrench className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {busca || filtroCategoria !== 'todos' || filtroTipo !== 'todos'
                ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {busca || filtroCategoria !== 'todos' || filtroTipo !== 'todos'
                ? 'Tente ajustar os filtros' : 'Crie seu primeiro serviço para começar'}
            </p>
            {!busca && filtroCategoria === 'todos' && filtroTipo === 'todos' && (
              <Button onClick={abrirNovo}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Serviço
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicosFiltrados.map(s => (
            <ServicoCard key={s.id} servico={s} onEdit={() => { setServicoEditando(s); setDialogOpen(true); }} />
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
      const { error } = await supabase.from('servicos').update({ ativo: false }).eq('id', servico.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Serviço removido com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    },
  });

  const isSimples = (servico.tipo_servico || 'composto') === 'simples';

  return (
    <Card className="hover:shadow-lg transition-all border-2 border-blue-100">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground mb-2">{servico.nome}</h3>
            <div className="flex flex-wrap gap-2">
              {servico.categoria && (
                <Badge variant="outline" className="text-xs">{servico.categoria}</Badge>
              )}
              <Badge className={
                isSimples
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs'
              }>
                {isSimples ? 'Simples' : 'Composto'}
              </Badge>
              {servico.requer_talhao && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  Talhão
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
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                  {deleteMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover serviço?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O serviço <strong>{servico.nome}</strong> será desativado.
                    Lançamentos existentes não serão afetados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {servico.descricao && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{servico.descricao}</p>
        )}

        {isSimples ? (
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
            <span className="text-sm font-medium text-amber-900">Custo padrão</span>
            <span className="text-lg font-bold text-amber-600">
              {servico.custo_padrao != null
                ? `R$ ${servico.custo_padrao.toFixed(2)}/${servico.unidade_medida || '-'}`
                : '-'}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm font-medium text-blue-900">Itens vinculados</span>
            <span className="text-lg font-bold text-blue-600">
              {servico.total_itens ?? 0}
              {(servico.total_itens ?? 0) === 0 && (
                <span className="text-xs font-normal ml-1 text-muted-foreground">(sem itens)</span>
              )}
            </span>
          </div>
        )}

        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          Criado em {new Date(servico.created_at).toLocaleDateString('pt-BR')}
        </div>
      </CardContent>
    </Card>
  );
}

export default Servicos;
