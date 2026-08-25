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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Fuel, Plus, Trash2, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { consumirFIFO } from '@/lib/fifoConsumo';

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

  // ── Origem: Estoque ou Livre ──
  const [origemEstoque, setOrigemEstoque] = useState(false);
  const [produtoId, setProdutoId] = useState('');

  const { data: produtosEstoque = [] } = useQuery({
    queryKey: ['produtos-combustivel', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_produtos_usuario', {
        p_propriedade_id: propriedadeAtual!.id,
      });
      if (error) throw error;
      return ((data as any[]) || []).filter(
        (p) => p.ativo !== false && (p.categoria || '').toLowerCase().includes('combust')
      );
    },
    enabled: !!propriedadeAtual?.id,
  });

  const produtoSelecionado = produtosEstoque.find((p) => p.id === produtoId);

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
  const custoNum = origemEstoque
    ? (produtoSelecionado ? litrosNum * Number(produtoSelecionado.custo_medio || 0) : 0)
    : (parseFloat(custoTotal) || 0);

  const estoqueInsuficiente = origemEstoque && produtoSelecionado && litrosNum > Number(produtoSelecionado.saldo_atual || 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const horimetroNum = parseFloat(horimetro);
      if (!data || isNaN(horimetroNum) || litrosNum <= 0 || custoNum < 0) {
        throw new Error('Preencha todos os campos obrigatórios');
      }
      if (horimetroNum < medidorAtual) {
        throw new Error(`${labelMedidor} deve ser >= ${medidorAtual}`);
      }
      if (origemEstoque && !produtoId) {
        throw new Error('Selecione o combustível do estoque');
      }
      if (estoqueInsuficiente) {
        throw new Error('Estoque insuficiente para essa quantidade de litros');
      }

      // 0. Se vier do estoque, consome FIFO primeiro (garante saldo antes de registrar)
      let custoFinal = custoNum;
      let detalhamentoLotes: any = null;
      if (origemEstoque && produtoId) {
        const resultado = await consumirFIFO(produtoId, litrosNum);
        custoFinal = resultado.custoTotal;
        detalhamentoLotes = resultado.detalhamento;
      }

      // 1. Inserir abastecimento
      const { data: abastecimentoData, error } = await supabase
        .from('abastecimentos' as any)
        .insert({
          maquina_id: maquina.id,
          data,
          horimetro: horimetroNum,
          combustivel_tipo: origemEstoque ? (produtoSelecionado?.nome || combustivel) : combustivel,
          quantidade_litros: litrosNum,
          custo_total: custoFinal,
          posto: posto || null,
          observacoes: observacoes || null,
          produto_id: origemEstoque ? produtoId : null,
          detalhamento_lotes: detalhamentoLotes,
        })
        .select('id')
        .single();
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
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-combustivel'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
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

      {/* Origem: Estoque ou Livre */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOrigemEstoque(true)}
          className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors ${
            origemEstoque
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Do Estoque
        </button>
        <button
          type="button"
          onClick={() => { setOrigemEstoque(false); setProdutoId(''); }}
          className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors ${
            !origemEstoque
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Livre
        </button>
      </div>

      {origemEstoque ? (
        <div className="space-y-1.5">
          <Label>Combustível (do estoque) *</Label>
          <Select value={produtoId} onValueChange={setProdutoId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o combustível" />
            </SelectTrigger>
            <SelectContent>
              {produtosEstoque.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhum produto de combustível no estoque.
                </div>
              )}
              {produtosEstoque.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} — {Number(p.saldo_atual || 0).toFixed(0)} {p.unidade_medida}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {produtoSelecionado && (
            <p className="text-xs text-muted-foreground">
              Preço médio: R$ {Number(produtoSelecionado.custo_medio || 0).toFixed(2)}/{produtoSelecionado.unidade_medida} · Saldo: {Number(produtoSelecionado.saldo_atual || 0).toFixed(0)} {produtoSelecionado.unidade_medida}
            </p>
          )}
          {estoqueInsuficiente && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Quantidade maior que o estoque disponível!
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
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
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Litros *</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={litros}
            onChange={e => setLitros(e.target.value)}
            className={estoqueInsuficiente ? 'border-destructive' : ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Custo Total (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={origemEstoque ? (custoNum || '') : custoTotal}
            onChange={e => setCustoTotal(e.target.value)}
            disabled={origemEstoque}
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
        <Input placeholder="Nome do posto (opcional)" value={posto} onChange={e => setPosto(e.target.value)} disabled={origemEstoque} />
      </div>

      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea placeholder="Observações (opcional)" value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
      </div>

      <Button
        className="w-full gap-2"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || estoqueInsuficiente}
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
