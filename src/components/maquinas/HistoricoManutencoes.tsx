import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Wrench, Trash2, Gauge, DollarSign, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';

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

  const concluidas = (manutencoes || [])
    .filter(m => m.status === 'realizada')
    .sort((a, b) => (b.data_realizada || '').localeCompare(a.data_realizada || ''));

  const agendadas = (manutencoes || [])
    .filter(m => m.status === 'agendada' || m.status === 'pendente')
    .sort((a, b) => (a.data_prevista || '').localeCompare(b.data_prevista || ''));

  const canceladas = (manutencoes || [])
    .filter(m => m.status === 'cancelada')
    .sort((a, b) => (b.data_prevista || '').localeCompare(a.data_prevista || ''));

  const totalCusto = concluidas.reduce((s, m) => s + (m.custo || 0), 0);

  const fmtData = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      realizada: { label: 'Concluída', className: 'bg-green-100 text-green-700 hover:bg-green-200', icon: <CheckCircle2 className="h-3 w-3" /> },
      pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 hover:bg-amber-200', icon: <Clock className="h-3 w-3" /> },
      agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-700 hover:bg-blue-200', icon: <Calendar className="h-3 w-3" /> },
      cancelada: { label: 'Cancelada', className: 'bg-gray-100 text-gray-500 hover:bg-gray-200', icon: <XCircle className="h-3 w-3" /> },
    };
    const cfg = map[status] || map.pendente;
    return (
      <Badge className={`text-xs flex items-center gap-1 ${cfg.className}`}>
        {cfg.icon}
        {cfg.label}
      </Badge>
    );
  };

  const renderCard = (m: Manutencao, mostrarExcluir: boolean) => (
    <Card key={m.id}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">{m.descricao}</p>
              {statusBadge(m.status)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 capitalize">{m.tipo}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              {m.data_realizada && <span>Concluída: {fmtData(m.data_realizada)}</span>}
              {m.data_prevista && !m.data_realizada && <span>Agendada para: {fmtData(m.data_prevista)}</span>}
              {m.horimetro_na_manutencao != null && (
                <span className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" /> {m.horimetro_na_manutencao}h
                </span>
              )}
              {m.proximo_horimetro != null && <span>Próxima: {m.proximo_horimetro}h</span>}
              {m.oficina && <span>{m.oficina}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {m.custo != null && m.custo > 0 && (
              <span className="font-semibold text-sm">
                R$ {m.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
            {mostrarExcluir && (
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
                      Isso também remove o lançamento vinculado, se existir. Essa ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(m.id)}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
              Total gasto (concluídas)
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
              Agendadas
            </div>
            <p className="text-lg font-bold">{agendadas.length}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : !manutencoes || manutencoes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma manutenção registrada ainda.</p>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Agendadas
              </h4>
              <Badge variant="outline">{agendadas.length}</Badge>
            </div>
            {agendadas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma manutenção agendada.</p>
            ) : (
              <div className="space-y-2">{agendadas.map(m => renderCard(m, true))}</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Concluídas
              </h4>
              <Badge variant="outline">{concluidas.length}</Badge>
            </div>
            {concluidas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma manutenção concluída ainda.</p>
            ) : (
              <div className="space-y-2">{concluidas.map(m => renderCard(m, false))}</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Canceladas
              </h4>
              <Badge variant="outline">{canceladas.length}</Badge>
            </div>
            {canceladas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma manutenção cancelada.</p>
            ) : (
              <div className="space-y-2">{canceladas.map(m => renderCard(m, true))}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
