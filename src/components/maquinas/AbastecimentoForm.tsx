import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useGlobal } from '@/contexts/GlobalContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Fuel, Plus, Trash2, Check, X, Loader2, ChevronDown } from 'lucide-react';

interface AbastecimentoFormProps {
  maquina: {
    id: string;
    nome: string;
    horimetro_atual: number;
    unidade_calculo?: string;
    km_atual?: number;
  };
  onSuccess: () => void;
}

export function AbastecimentoForm({ maquina, onSuccess }: AbastecimentoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { propriedadeAtual, safraAtual } = useGlobal();
  const { user } = useAuth();

  const ehKm = maquina.unidade_calculo === 'km';
  const medidorAtual = ehKm ? (maquina.km_atual || 0) : maquina.horimetro_atual;
  const labelMedidor = ehKm ? 'Km' : 'Horímetro';

  const today = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(today);
  const [horimetro, setHorimetro] = useState('');
  const { data: tiposCombustivel = [], refetch: refetchTiposCombustivel } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ['tipos-combustivel'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_tipos_combustivel' as any);
      if (error) throw error;
      return (data as { id: string; nome: string }[]) || [];
    },
  });

  const [showNovoCombustivel, setShowNovoCombustivel] = useState(false);
  const [novoCombustivelNome, setNovoCombustivelNome] = useState('');
  const [salvandoCombustivel, setSalvandoCombustivel] = useState(false);
  const [combustivelParaExcluir, setCombustivelParaExcluir] = useState<{ id: string; nome: string } | null>(null);

  const handleAdicionarCombustivel = async () => {
    const nome = novoCombustivelNome.trim();
    if (!nome) return;
    setSalvandoCombustivel(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('tipos_combustivel' as any).insert({
      usuario_id: userData?.user?.id,
      nome,
      ativo: true,
    } as any);
    setSalvandoCombustivel(false);
    if (error) {
      toast({
        title: (error as any).code === '23505' ? 'Tipo de combustível já existe' : 'Erro ao criar tipo de combustível',
        variant: 'destructive',
      });
      return;
    }
    setCombustivel(nome);
    setNovoCombustivelNome('');
    setShowNovoCombustivel(false);
    refetchTiposCombustivel();
    toast({ title: 'Tipo de combustível criado' });
  };

  const handleExcluirCombustivel = async () => {
    if (!combustivelParaExcluir) return;
    const { error } = await supabase
      .from('tipos_combustivel' as any)
      .update({ ativo: false } as any)
      .eq('id', combustivelParaExcluir.id);
    setCombustivelParaExcluir(null);
    if (error) {
      toast({ title: 'Erro ao remover tipo de combustível', variant: 'destructive' });
      return;
    }
    setCombustivel('');
    refetchTiposCombustivel();
    toast({ title: 'Tipo de combustível removido' });
  };

  const [combustivel, setCombustivel] = useState('');
  const [litros, setLitros] = useState('');
  const [custoTotal, setCustoTotal] = useState('');
  const [posto, setPosto] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const litrosNum = parseFloat(litros) || 0;
  const custoNum = parseFloat(custoTotal) || 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const horimetroNum = parseFloat(horimetro);
      if (!data || isNaN(horimetroNum) || litrosNum <= 0 || custoNum < 0) {
        throw new Error('Preencha todos os campos obrigatórios');
      }
      if (horimetroNum < medidorAtual) {
        throw new Error(`${labelMedidor} deve ser >= ${medidorAtual}`);
      }

      // 1. Inserir abastecimento
      const { error } = await supabase
        .from('abastecimentos' as any)
        .insert({
          maquina_id: maquina.id,
          data,
          horimetro: horimetroNum,
          combustivel_tipo: combustivel,
          quantidade_litros: litrosNum,
          custo_total: custoNum,
          posto: posto || null,
          observacoes: observacoes || null,
        });
      if (error) throw error;

      // 2. Update horímetro ou km, o que for o caso, se o novo valor for maior
      if (horimetroNum > medidorAtual) {
        const { error: updateError } = await supabase
          .from('maquinas' as any)
          .update(ehKm ? { km_atual: horimetroNum } : { horimetro_atual: horimetroNum })
          .eq('id', maquina.id);
        if (updateError) console.error(`Erro ao atualizar ${labelMedidor.toLowerCase()}:`, updateError);
      }

      // O lançamento vinculado é criado automaticamente pelo trigger do banco
      // (fn_abastecimento_para_lancamento) assim que o abastecimento é inserido —
      // não deve ser criado aqui de novo, senão duplica.
    },
    onSuccess: () => {
      toast({
        title: `Abastecimento registrado! ${litrosNum.toFixed(0)}L · ${custoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      });
      queryClient.invalidateQueries({ queryKey: ['abastecimentos'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      queryClient.invalidateQueries({ queryKey: ['abastecimentos-stats'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      onSuccess();
    },
    onError: (err: any) => {
      toast({ title: err.message || 'Erro ao registrar abastecimento', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Fuel className="h-5 w-5" />
          Abastecer — {maquina.nome}
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Data *</Label>
          <Input type="date" value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{labelMedidor} *</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={`≥ ${medidorAtual}`}
            value={horimetro}
            onChange={e => setHorimetro(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Atual: {medidorAtual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{ehKm ? 'km' : 'h'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Combustível *</Label>
        {!showNovoCombustivel ? (
          <div className="flex gap-2">
            <Select value={combustivel} onValueChange={setCombustivel}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione o combustível" />
              </SelectTrigger>
              <SelectContent>
                {tiposCombustivel.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum tipo. Use + para criar.
                  </div>
                )}
                {tiposCombustivel.map(t => (
                  <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowNovoCombustivel(true)}
              title="Novo tipo"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {combustivel && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const t = tiposCombustivel.find(x => x.nome === combustivel);
                  if (t) setCombustivelParaExcluir(t);
                }}
                title="Remover tipo selecionado"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Nome do novo combustível"
              value={novoCombustivelNome}
              onChange={e => setNovoCombustivelNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarCombustivel(); } }}
              autoFocus
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              onClick={handleAdicionarCombustivel}
              disabled={salvandoCombustivel}
            >
              {salvandoCombustivel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => { setShowNovoCombustivel(false); setNovoCombustivelNome(''); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Litros *</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={litros}
            onChange={e => setLitros(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Custo Total (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={custoTotal}
            onChange={e => setCustoTotal(e.target.value)}
          />
          {litrosNum > 0 && custoNum > 0 && (
            <p className="text-xs text-muted-foreground font-medium">
              {(custoNum / litrosNum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Posto</Label>
        <Input placeholder="Nome do posto (opcional)" value={posto} onChange={e => setPosto(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea placeholder="Observações (opcional)" value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
      </div>

      <Button
        className="w-full gap-2"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        <Fuel className="h-4 w-4" />
        {mutation.isPending ? 'Salvando...' : 'Registrar Abastecimento'}
      </Button>

      <AlertDialog open={!!combustivelParaExcluir} onOpenChange={o => { if (!o) setCombustivelParaExcluir(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de combustível?</AlertDialogTitle>
            <AlertDialogDescription>
              O tipo "{combustivelParaExcluir?.nome}" deixará de aparecer na lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirCombustivel}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
