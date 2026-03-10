import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "@/contexts/GlobalContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RegistrarColheitaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  talhaoId: string;
  culturaItem: any;
}

export function RegistrarColheitaDialog({ open, onOpenChange, talhaoId, culturaItem }: RegistrarColheitaDialogProps) {
  const { safraAtual, propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cultura = culturaItem?.cultura;
  const producaoAtual = Array.isArray(culturaItem?.producao) ? culturaItem.producao[0] : culturaItem?.producao;
  const unidade = cultura?.unidade_label || "un";
  const colhidoAtual = producaoAtual?.quantidade_colhida || 0;

  const [quantidade, setQuantidade] = useState("");
  const [dataColheita, setDataColheita] = useState<Date | undefined>(new Date());
  const [observacoes, setObservacoes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!propriedadeAtual?.id || !safraAtual?.id) {
        throw new Error('Propriedade ou safra não selecionada');
      }

      const novaQuantidade = colhidoAtual + Number(quantidade);

      const { error } = await supabase
        .from("producoes")
        .upsert(
          {
            propriedade_id: propriedadeAtual.id,
            talhao_id: talhaoId,
            safra_id: safraAtual!.id,
            cultura_id: culturaItem.cultura_id,
            quantidade_colhida: novaQuantidade,
            data_colheita: dataColheita ? format(dataColheita, "yyyy-MM-dd") : null,
            observacoes: observacoes || null,
          },
          { onConflict: "talhao_id,safra_id,cultura_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Colheita registrada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["talhao-culturas"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao registrar colheita", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Colheita — {cultura?.nome_exibicao}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {colhidoAtual > 0 && (
            <p className="text-sm text-muted-foreground">
              Já colhido: <strong>{colhidoAtual.toLocaleString("pt-BR")} {unidade}</strong>
            </p>
          )}

          <div>
            <Label>Quantidade colhida ({unidade}) *</Label>
            <Input
              type="number"
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>Data da colheita</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !dataColheita && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataColheita ? format(dataColheita, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataColheita}
                  onSelect={setDataColheita}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações opcionais..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !quantidade || Number(quantidade) <= 0 || !propriedadeAtual?.id || !safraAtual?.id}
            >
              {mutation.isPending ? "Salvando..." : "Registrar Colheita"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
