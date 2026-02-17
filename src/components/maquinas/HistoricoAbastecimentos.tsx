import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Fuel, Trash2, Droplets, DollarSign, Gauge } from 'lucide-react';

interface HistoricoAbastecimentosProps {
  maquina: {
    id: string;
    nome: string;
  };
}

interface Abastecimento {
  id: string;
  data: string;
  horimetro: number;
  combustivel_tipo: string;
  quantidade_litros: number;
  custo_total: number;
  posto?: string;
  observacoes?: string;
}

export function HistoricoAbastecimentos({ maquina }: HistoricoAbastecimentosProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: abastecimentos, isLoading } = useQuery({
    queryKey: ['abastecimentos', maquina.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('abastecimentos' as any)
        .select('*')
        .eq('maquina_id', maquina.id)
        .order('data', { ascending: false });
      if (error) throw error;
      return data as unknown as Abastecimento[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Excluir lançamento vinculado primeiro (abastecimento_id = SET NULL, então deletar manualmente)
      const { error: lancError } = await supabase
        .from('lancamentos')
        .delete()
        .eq('abastecimento_id', id as any);
      if (lancError) console.error('Erro ao excluir lançamento vinculado:', lancError);

      const { error } = await supabase.from('abastecimentos' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Abastecimento excluído' });
      queryClient.invalidateQueries({ queryKey: ['abastecimentos'] });
      queryClient.invalidateQueries({ queryKey: ['abastecimentos-stats'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    },
  });

  const totalLitros = abastecimentos?.reduce((s, a) => s + a.quantidade_litros, 0) || 0;
  const totalCusto = abastecimentos?.reduce((s, a) => s + a.custo_total, 0) || 0;

  // Consumo médio: total_litros / horas entre primeiro e último horímetro
  const consumoMedio = (() => {
    if (!abastecimentos || abastecimentos.length < 2) return null;
    const horimetros = abastecimentos.map(a => a.horimetro);
    const max = Math.max(...horimetros);
    const min = Math.min(...horimetros);
    const diff = max - min;
    return diff > 0 ? totalLitros / diff : null;
  })();

  const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Fuel className="h-5 w-5" />
          Abastecimentos — {maquina.nome}
        </SheetTitle>
      </SheetHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <Droplets className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-bold text-sm">{totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Custo</p>
            <p className="font-bold text-sm">{fmtCurrency(totalCusto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Gauge className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Média</p>
            <p className="font-bold text-sm">
              {consumoMedio != null ? `${consumoMedio.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L/h` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !abastecimentos?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Fuel className="h-12 w-12 mb-3" />
          <p className="font-medium">Nenhum abastecimento registrado</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {abastecimentos.map(a => (
            <Card key={a.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{fmtDate(a.data)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {a.horimetro.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir abastecimento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {fmtDate(a.data)} — {a.quantidade_litros}L de {a.combustivel_tipo}. O lançamento vinculado também será excluído.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(a.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {a.combustivel_tipo} · {a.quantidade_litros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
                  </span>
                  <span className="text-sm font-bold">{fmtCurrency(a.custo_total)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fmtCurrency(a.custo_total / a.quantidade_litros)}/L</span>
                  {a.posto && <span>{a.posto}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
