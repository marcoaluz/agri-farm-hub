import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { useToast } from '@/hooks/use-toast';

import { SheetHeader, SheetTitle } from '@/components/ui/sheet';

import { Card, CardContent } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

import { Wrench, Trash2, Gauge, DollarSign, Calendar } from 'lucide-react';



interface HistoricoManutencoesProps {

  maquina: { id: string; nome: string };

}



interface Manutencao {

  id: string;

  tipo: string;

  descricao: string;

  data_realizada: string | null;

  data_prevista: string | null;

  horimetro_na_manutencao: number | null;

  proximo_horimetro: number | null;

  custo: number | null;

  oficina: string | null;

  status: string;

}



export function HistoricoManutencoes({ maquina }: HistoricoManutencoesProps) {

  const { toast } = useToast();

  const queryClient = useQueryClient();



  const { data: manutencoes, isLoading } = useQuery({

    queryKey: ['manutencoes', maquina.id],

    queryFn: async () => {

      const { data, error } = await supabase

        .from('maquina_manutencoes' as any)

        .select('*')

        .eq('maquina_id', maquina.id)

        .order('data_prevista', { ascending: false, nullsFirst: false })

        .order('data_realizada', { ascending: false, nullsFirst: false });

      if (error) throw error;

      return data as unknown as Manutencao[];

    },

  });



  const deleteMutation = useMutation({

    mutationFn: async (id: string) => {

      const { error } = await supabase.from('maquina_manutencoes' as any).delete().eq('id', id);

      if (error) throw error;

    },

    onSuccess: () => {

      toast({ title: 'Manutenção excluída' });

      queryClient.invalidateQueries({ queryKey: ['manutencoes'] });

      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });

      queryClient.invalidateQueries({ queryKey: ['transacoes'] });

    },

    onError: () => toast({ title: 'Erro ao excluir', variant: 'destructive' }),

  });



  const realizadas = manutencoes?.filter(m => m.status === 'realizada') || [];

  const totalCusto = realizadas.reduce((s, m) => s + (m.custo || 0), 0);

  const pendentes = manutencoes?.filter(m => m.status === 'pendente' || m.status === 'agendada') || [];



  const statusBadge = (status: string) => {

    const map: Record<string, { label: string; className: string }> = {

      realizada: { label: 'Realizada', className: 'bg-green-100 text-green-700 hover:bg-green-200' },

      pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },

      agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },

      cancelada: { label: 'Cancelada', className: 'bg-gray-100 text-gray-500 hover:bg-gray-200' },

    };

    const cfg = map[status] || map.pendente;

    return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;

  };



  return (

    <div className="space-y-4">

      <SheetHeader>

        <SheetTitle className="flex items-center gap-2">

          <Wrench className="h-5 w-5" />

          Histórico — {maquina.nome}

        </SheetTitle>

      </SheetHeader>



      <div className="grid grid-cols-2 gap-3">

        <Card>

          <CardContent className="pt-4 pb-3">

            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">

              <DollarSign className="h-3.5 w-3.5" />

              Total gasto

            </div>

            <p className="text-lg font-bold">

              R$ {totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

            </p>

          </CardContent>

        </Card>

        <Card>

          <CardContent className="pt-4 pb-3">

            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">

              <Calendar className="h-3.5 w-3.5" />

              Pendentes/Agendadas

            </div>

            <p className="text-lg font-bold">{pendentes.length}</p>

          </CardContent>

        </Card>

      </div>



      {isLoading ? (

        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>

      ) : !manutencoes || manutencoes.length === 0 ? (

        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma manutenção registrada ainda.</p>

      ) : (

        <div className="space-y-2">

          {manutencoes.map(m => (

            <Card key={m.id}>

              <CardContent className="pt-4 pb-3">

                <div className="flex items-start justify-between gap-2">

                  <div className="min-w-0 flex-1">

                    <div className="flex items-center gap-2 flex-wrap">

                      <p className="font-medium text-sm truncate">{m.descricao}</p>

                      {statusBadge(m.status)}

                    </div>

                    <p className="text-xs text-muted-foreground mt-1 capitalize">{m.tipo}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">

                      {m.data_realizada && <span>Realizada: {new Date(m.data_realizada + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}

                      {m.data_prevista && !m.data_realizada && <span>Prevista: {new Date(m.data_prevista + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}

                      {m.horimetro_na_manutencao != null && <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> {m.horimetro_na_manutencao}h</span>}

                      {m.proximo_horimetro != null && <span>Próxima: {m.proximo_horimetro}h</span>}

                      {m.oficina && <span>{m.oficina}</span>}

                    </div>

                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">

                    {m.custo != null && m.custo > 0 && (

                      <span className="font-semibold text-sm">R$ {m.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>

                    )}

                    <AlertDialog>

                      <AlertDialogTrigger asChild>

                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">

                          <Trash2 className="h-3.5 w-3.5" />

                        </Button>

                      </AlertDialogTrigger>

                      <AlertDialogContent>

                        <AlertDialogHeader>

                          <AlertDialogTitle>Excluir manutenção?</AlertDialogTitle>

                          <AlertDialogDescription>

                            Isso também remove o lançamento e a despesa financeira vinculados, se existirem. Essa ação não pode ser desfeita.

                          </AlertDialogDescription>

                        </AlertDialogHeader>

                        <AlertDialogFooter>

                          <AlertDialogCancel>Cancelar</AlertDialogCancel>

                          <AlertDialogAction onClick={() => deleteMutation.mutate(m.id)}>Excluir</AlertDialogAction>

                        </AlertDialogFooter>

                      </AlertDialogContent>

                    </AlertDialog>

                  </div>

                </div>

              </CardContent>

            </Card>

          ))}

        </div>

      )}

    </div>

  );

}
