import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Fuel } from 'lucide-react';

interface AbastecimentoFormProps {
  maquina: {
    id: string;
    nome: string;
    horimetro_atual: number;
  };
  onSuccess: () => void;
}

export function AbastecimentoForm({ maquina, onSuccess }: AbastecimentoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { propriedadeAtual, safraAtual } = useGlobal();
  const { user } = useAuth();

  const today = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(today);
  const [horimetro, setHorimetro] = useState('');
  const [combustivel, setCombustivel] = useState('Diesel S10');
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
      if (horimetroNum < maquina.horimetro_atual) {
        throw new Error(`Horímetro deve ser >= ${maquina.horimetro_atual}`);
      }

      // 1. Inserir abastecimento
      const { data: abastecimentoData, error } = await supabase
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
        })
        .select('id')
        .single();
      if (error) throw error;

      const abastecimentoId = (abastecimentoData as any).id;

      // 2. Update horimetro if new value is higher
      if (horimetroNum > maquina.horimetro_atual) {
        const { error: updateError } = await supabase
          .from('maquinas' as any)
          .update({ horimetro_atual: horimetroNum })
          .eq('id', maquina.id);
        if (updateError) console.error('Erro ao atualizar horímetro:', updateError);
      }

      // 3. Criar lançamento vinculado (se houver safra ativa)
      if (!propriedadeAtual?.id) return;

      const { data: safraAtiva } = await supabase
        .from('safras')
        .select('id')
        .eq('propriedade_id', propriedadeAtual.id)
        .eq('ativa', true)
        .maybeSingle();

      if (!safraAtiva) {
        toast({
          title: 'Abastecimento registrado!',
          description: 'Atenção: Sem safra ativa. O lançamento não foi criado.',
        });
        return;
      }

      // 4. Buscar ou criar serviço "Abastecimento - [nome da máquina]"
      const { data: servicoId, error: servicoError } = await supabase
        .rpc('get_or_create_servico_abastecimento', {
          p_propriedade_id: propriedadeAtual.id,
          p_maquina_nome: maquina.nome
        });

      if (servicoError) throw servicoError;

      // 5. Criar lançamento vinculado
      const obsLancamento = `Abastecimento: ${litrosNum}L ${combustivel} - Horímetro: ${horimetroNum}h${posto ? ` - Posto: ${posto}` : ''}${observacoes ? `\n${observacoes}` : ''}`;

      const { error: lancError } = await supabase
        .from('lancamentos')
        .insert({
          propriedade_id: propriedadeAtual.id,
          safra_id: safraAtiva.id,
          servico_id: servicoId,
          talhao_id: null,
          data_execucao: data,
          custo_total: custoNum,
          observacoes: obsLancamento,
          abastecimento_id: abastecimentoId,
          criado_por: user?.id || null,
        } as any);

      if (lancError) throw lancError;
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
          <Label>Horímetro *</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={`≥ ${maquina.horimetro_atual}`}
            value={horimetro}
            onChange={e => setHorimetro(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Atual: {maquina.horimetro_atual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Combustível *</Label>
        <Select value={combustivel} onValueChange={setCombustivel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Diesel S10">Diesel S10</SelectItem>
            <SelectItem value="Diesel S500">Diesel S500</SelectItem>
            <SelectItem value="Gasolina">Gasolina</SelectItem>
            <SelectItem value="Etanol">Etanol</SelectItem>
            <SelectItem value="Arla 32">Arla 32</SelectItem>
          </SelectContent>
        </Select>
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
    </div>
  );
}
