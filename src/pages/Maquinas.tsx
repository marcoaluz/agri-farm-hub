import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Tractor, Edit, Trash2, Search, Clock, DollarSign, Gauge } from 'lucide-react';
import { MaquinaForm } from '@/components/maquinas/MaquinaForm';

interface Maquina {
  id: string;
  propriedade_id: string;
  nome: string;
  modelo?: string;
  ano_fabricacao?: number;
  horimetro_inicial: number;
  horimetro_atual: number;
  custo_hora?: number;
  ativo: boolean;
  created_at: string;
}

export function Maquinas() {
  const { propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [maquinaEditando, setMaquinaEditando] = useState<Maquina | null>(null);
  const [busca, setBusca] = useState('');

  const { data: maquinas, isLoading } = useQuery({
    queryKey: ['maquinas', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maquinas')
        .select('*')
        .eq('propriedade_id', propriedadeAtual?.id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data as Maquina[];
    },
    enabled: !!propriedadeAtual?.id
  });

  const maquinasFiltradas = maquinas?.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    m.modelo?.toLowerCase().includes(busca.toLowerCase())
  );

  const totalMaquinas = maquinas?.length || 0;
  const maquinasComCusto = maquinas?.filter(m => m.custo_hora != null) || [];
  const custoMedioHora = maquinasComCusto.length 
    ? maquinasComCusto.reduce((sum, m) => sum + (m.custo_hora || 0), 0) / maquinasComCusto.length
    : 0;
  const horimetroTotal = maquinas?.reduce((sum, m) => sum + m.horimetro_atual, 0) || 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maquinas')
        .update({ ativo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Máquina removida com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
    },
    onError: () => {
      toast({ title: 'Erro ao remover máquina', variant: 'destructive' });
    }
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Máquinas</h1>
          <p className="text-muted-foreground">
            Gerencie equipamentos, horímetro e custos
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setMaquinaEditando(null)}>
              <Plus className="h-4 w-4" />
              Nova Máquina
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <MaquinaForm
              maquina={maquinaEditando}
              onSuccess={() => {
                setDialogOpen(false);
                setMaquinaEditando(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Tractor className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Máquinas</p>
                <p className="text-2xl font-bold">{totalMaquinas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Gauge className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horímetro Total</p>
                <p className="text-2xl font-bold">
                  {horimetroTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <DollarSign className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo Médio/Hora</p>
                <p className="text-2xl font-bold">R$ {custoMedioHora.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Clock className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horas Disponíveis</p>
                <p className="text-2xl font-bold">∞</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou modelo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : maquinasFiltradas?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tractor className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {busca ? 'Nenhuma máquina encontrada' : 'Nenhuma máquina cadastrada'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {busca ? 'Tente ajustar sua busca' : 'Cadastre sua primeira máquina para controlar horas e custos'}
            </p>
            {!busca && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeira Máquina
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {maquinasFiltradas?.map(maquina => (
            <Card key={maquina.id} className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                      <Tractor className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{maquina.nome}</h3>
                      {maquina.modelo && (
                        <p className="text-sm text-muted-foreground">{maquina.modelo}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="default" className="bg-success">Ativo</Badge>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {maquina.ano_fabricacao && (
                    <Badge variant="outline">{maquina.ano_fabricacao}</Badge>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Gauge className="h-3 w-3" /> Horímetro
                    </span>
                    <span className="font-medium">
                      {maquina.horimetro_atual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h
                    </span>
                  </div>
                  {maquina.horimetro_inicial > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Horímetro Inicial</span>
                      <span className="font-medium">{maquina.horimetro_inicial.toLocaleString('pt-BR')}h</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo/Hora</span>
                    <span className="font-medium">
                      {maquina.custo_hora != null ? `R$ ${maquina.custo_hora.toFixed(2)}` : 'Não definido'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setMaquinaEditando(maquina);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação irá desativar a máquina "{maquina.nome}".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(maquina.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
