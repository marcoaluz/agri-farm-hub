import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface VenderProducaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producaoId: string;
  culturaNome: string;
  safraNome: string;
  unidade: string;
  disponivel: number;
  vendido: number;
}

export function VenderProducaoDialog({
  open,
  onOpenChange,
  producaoId,
  culturaNome,
  safraNome,
  unidade,
  disponivel,
  vendido,
}: VenderProducaoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hoje = new Date().toISOString().split("T")[0];

  const [quantidade, setQuantidade] = useState("");
  const [preco, setPreco] = useState("");
  const [comprador, setComprador] = useState("");
  const [numeroNF, setNumeroNF] = useState("");
  const [dataVenda, setDataVenda] = useState(hoje);
  const [formaPagamento, setFormaPagamento] = useState("vista");
  const [numParcelas, setNumParcelas] = useState("2");
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(hoje);
  const [observacoes, setObservacoes] = useState("");

  const qtd = Number(quantidade) || 0;
  const precoNum = Number(preco) || 0;
  const valorTotal = qtd * precoNum;

  const mutation = useMutation({
    mutationFn: async () => {
      if (qtd > disponivel) {
        throw new Error(`Quantidade indisponível. Disponível: ${disponivel} ${unidade}`);
      }
      const { error } = await (supabase as any).rpc("registrar_venda_producao", {
        p_producao_id: producaoId,
        p_quantidade: qtd,
        p_preco_unitario: precoNum,
        p_comprador: comprador || null,
        p_numero_nf: numeroNF || null,
        p_data_venda: dataVenda,
        p_observacoes: observacoes || null,
        p_parcelado: formaPagamento === "parcelado",
        p_num_parcelas: formaPagamento === "parcelado" ? Number(numParcelas) : 1,
        p_data_primeira_parcela: formaPagamento === "parcelado" ? dataPrimeiraParcela : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producoes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-producao"] });
      queryClient.invalidateQueries({ queryKey: ["dash-estoque-producao"] });
      queryClient.invalidateQueries({ queryKey: ["talhao-culturas"] });
      queryClient.invalidateQueries({ queryKey: ["transacoes"] });
      toast({
        title: `Venda registrada: ${qtd} ${unidade} por R$ ${valorTotal.toFixed(2)}`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao registrar venda", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Vender {culturaNome} — Safra {safraNome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
            <p>
              Disponível: <strong>{disponivel.toLocaleString("pt-BR")} {unidade}</strong>
            </p>
            <p className="text-muted-foreground">
              Já vendido: {vendido.toLocaleString("pt-BR")} {unidade}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade ({unidade}) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={disponivel}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Preço por {unidade} (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label>Valor total</Label>
            <Input readOnly value={`R$ ${valorTotal.toFixed(2)}`} className="bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Comprador</Label>
              <Input value={comprador} onChange={(e) => setComprador(e.target.value)} />
            </div>
            <div>
              <Label>Número NF</Label>
              <Input value={numeroNF} onChange={(e) => setNumeroNF(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Data da venda</Label>
            <Input type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} />
          </div>

          <div>
            <Label>Forma de pagamento</Label>
            <RadioGroup value={formaPagamento} onValueChange={setFormaPagamento} className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="vista" id="venda-vista" />
                <Label htmlFor="venda-vista" className="font-normal cursor-pointer">À vista</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="parcelado" id="venda-parcelado" />
                <Label htmlFor="venda-parcelado" className="font-normal cursor-pointer">Parcelado</Label>
              </div>
            </RadioGroup>
          </div>

          {formaPagamento === "parcelado" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nº de parcelas</Label>
                  <Input
                    type="number"
                    min="2"
                    max="48"
                    value={numParcelas}
                    onChange={(e) => setNumParcelas(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Vencimento 1ª parcela</Label>
                  <Input
                    type="date"
                    value={dataPrimeiraParcela}
                    onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                  />
                </div>
              </div>
              {Number(numParcelas) > 1 && valorTotal > 0 && (
                <p className="text-xs text-muted-foreground">
                  {numParcelas}x de R$ {(valorTotal / Number(numParcelas)).toFixed(2)}
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || qtd <= 0 || precoNum <= 0 || qtd > disponivel}
            >
              {mutation.isPending ? "Salvando..." : "Registrar Venda"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
