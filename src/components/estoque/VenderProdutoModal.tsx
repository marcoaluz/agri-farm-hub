import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useSafraFechada } from '@/hooks/useSafraFechada';

interface VenderProdutoModalProps {
  produto: {
    id: string;
    nome: string;
    unidade_medida: string;
    saldo_atual: number;
  };
  onClose: () => void;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export function VenderProdutoModal({ produto, onClose }: VenderProdutoModalProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const { verificarSafra } = useSafraFechada();

  const [quantidade, setQuantidade] = useState<number>(0);
  const [precoUnitario, setPrecoUnitario] = useState<number>(0);
  const [comprador, setComprador] = useState('');
  const [numeroNF, setNumeroNF] = useState('');
  const [dataVenda, setDataVenda] = useState(hoje());
  const [formaPagamento, setFormaPagamento] = useState<'avista' | 'parcelado'>('avista');
  const [numParcelas, setNumParcelas] = useState(2);
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(hoje());
  const [periodicidade, setPeriodicidade] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [valorEntrada, setValorEntrada] = useState('');

  const [observacoes, setObservacoes] = useState('');

  const valorTotal = (quantidade || 0) * (precoUnitario || 0);

  const handleVender = async () => {
    if (!verificarSafra('registrar venda')) return
    if (quantidade > produto.saldo_atual) {
      toast.error('Saldo insuficiente');
      return;
    }
    if (!quantidade || quantidade <= 0 || !precoUnitario || precoUnitario <= 0) {
      toast.error('Preencha quantidade e preço');
      return;
    }

    setLoading(true);
    const { error } = await supabase.rpc('registrar_venda_estoque', {
      p_produto_id: produto.id,
      p_quantidade: quantidade,
      p_preco_unitario: precoUnitario,
      p_comprador: comprador || null,
      p_numero_nf: numeroNF || null,
      p_data_venda: dataVenda,
      p_observacoes: observacoes || null,
      p_parcelado: formaPagamento === 'parcelado',
      p_num_parcelas: formaPagamento === 'parcelado' ? numParcelas : 1,
      p_data_primeira_parcela: formaPagamento === 'parcelado' ? dataPrimeiraParcela : null,
      p_periodicidade: periodicidade,
      p_valor_entrada: Number(valorEntrada) || 0,
    } as any);
    setLoading(false);

    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['produtos'] });
    queryClient.invalidateQueries({ queryKey: ['produtos-custos'] });
    queryClient.invalidateQueries({ queryKey: ['lotes'] });
    queryClient.invalidateQueries({ queryKey: ['transacoes'] });

    toast.success(
      `Venda registrada: ${quantidade} ${produto.unidade_medida} por R$ ${valorTotal.toFixed(2)}`
    );
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Vender {produto.nome}
        </DialogTitle>
        <DialogDescription>
          Saldo disponível:{' '}
          <span className="font-semibold text-foreground">
            {produto.saldo_atual?.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
            {produto.unidade_medida}
          </span>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade a vender *</Label>
            <Input
              id="quantidade"
              type="number"
              min={0}
              max={produto.saldo_atual}
              step="0.01"
              value={quantidade || ''}
              onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preco">Preço por {produto.unidade_medida} (R$) *</Label>
            <Input
              id="preco"
              type="number"
              min={0}
              step="0.01"
              value={precoUnitario || ''}
              onChange={(e) => setPrecoUnitario(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground">Valor total</span>
          <span className="text-lg font-bold text-green-700">
            R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="comprador">Comprador</Label>
            <Input
              id="comprador"
              placeholder="Opcional"
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nf">Número NF</Label>
            <Input
              id="nf"
              placeholder="Opcional"
              value={numeroNF}
              onChange={(e) => setNumeroNF(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="data">Data da venda *</Label>
            <Input
              id="data"
              type="date"
              value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select
              value={formaPagamento}
              onValueChange={(v) => setFormaPagamento(v as 'avista' | 'parcelado')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="avista">À vista</SelectItem>
                <SelectItem value="parcelado">Parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {formaPagamento === 'parcelado' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border p-3">
            <div className="space-y-2">
              <Label>Número de parcelas</Label>
              <Select value={String(numParcelas)} onValueChange={(v) => setNumParcelas(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, i) => i + 2).map(n => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de R$ {(valorTotal / n).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data1">Data da 1ª parcela</Label>
              <Input
                id="data1"
                type="date"
                value={dataPrimeiraParcela}
                onChange={(e) => setDataPrimeiraParcela(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor de entrada (opcional)</Label>
              <Input
                type="number" step="0.01" min={0} placeholder="0,00"
                value={valorEntrada}
                onChange={(e) => setValorEntrada(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Periodicidade</Label>
              <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="obs">Observações</Label>
          <Textarea
            id="obs"
            placeholder="Opcional"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <DialogFooter className="pt-4 border-t">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleVender} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Registrar Venda
        </Button>
      </DialogFooter>
    </>
  );
}
