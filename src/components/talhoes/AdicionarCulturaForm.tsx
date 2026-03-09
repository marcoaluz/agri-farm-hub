import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "@/contexts/GlobalContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Talhao {
  id: string;
  nome: string;
  area_ha: number;
  cultura_atual?: string;
  propriedade_id: string;
  ativo: boolean;
  created_at: string;
}

interface AdicionarCulturaFormProps {
  talhao: Talhao;
  culturaExistente?: any;
  onSuccess: () => void;
}

export function AdicionarCulturaForm({ talhao, culturaExistente, onSuccess }: AdicionarCulturaFormProps) {
  const { safraAtual, propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    cultura_id: culturaExistente?.cultura_id || "",
    area_plantada_ha: culturaExistente?.area_plantada_ha || "",
    total_plantas: culturaExistente?.total_plantas || "",
    producao_estimada: culturaExistente?.producao_estimada || "",
    preco: culturaExistente?.preco_unitario_estimado || "",
    data_plantio: culturaExistente?.data_plantio ? new Date(culturaExistente.data_plantio) : undefined as Date | undefined,
    data_colheita_estimada: culturaExistente?.data_colheita_estimada ? new Date(culturaExistente.data_colheita_estimada) : undefined as Date | undefined,
    observacoes: culturaExistente?.observacoes || "",
  });

  const { data: culturasConfig } = useQuery({
    queryKey: ["culturas-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("culturas_config")
        .select("id, nome_exibicao, unidade_label, icone")
        .eq("ativo", true)
        .order("nome_exibicao");
      if (error) throw error;
      return data || [];
    },
  });

  const culturaSelecionada = culturasConfig?.find((c: any) => c.id === form.cultura_id);
  const unidadeLabel = culturaSelecionada?.unidade_label || "unidades";

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        propriedade_id: propriedadeAtual!.id,
        safra_id: safraAtual!.id,
        talhao_id: talhao.id,
        cultura_id: form.cultura_id,
        area_plantada_ha: form.area_plantada_ha ? Number(form.area_plantada_ha) : null,
        total_plantas: form.total_plantas ? Number(form.total_plantas) : null,
        producao_estimada: form.producao_estimada ? Number(form.producao_estimada) : null,
        preco_unitario_estimado: form.preco ? Number(form.preco) : null,
        data_plantio: form.data_plantio ? format(form.data_plantio, "yyyy-MM-dd") : null,
        data_colheita_estimada: form.data_colheita_estimada ? format(form.data_colheita_estimada, "yyyy-MM-dd") : null,
        observacoes: form.observacoes || null,
      };

      if (culturaExistente) {
        const { error } = await supabase
          .from("talhao_culturas")
          .update(payload)
          .eq("id", culturaExistente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("talhao_culturas").insert(payload);
        if (error) throw error;

        // Create producao record
        await supabase.from("producoes").upsert(
          {
            propriedade_id: propriedadeAtual!.id,
            safra_id: safraAtual!.id,
            talhao_id: talhao.id,
            cultura_id: form.cultura_id,
            preco_unitario_estimado: form.preco ? Number(form.preco) : null,
          },
          { onConflict: "talhao_id,safra_id,cultura_id", ignoreDuplicates: true }
        );
      }
    },
    onSuccess: () => {
      toast({ title: `Cultura ${culturaExistente ? "atualizada" : "adicionada"} com sucesso` });
      queryClient.invalidateQueries({ queryKey: ["talhao-culturas"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar cultura", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!form.cultura_id) {
      toast({ title: "Selecione uma cultura", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Cultura *</Label>
        <Select value={form.cultura_id} onValueChange={(v) => setForm((p) => ({ ...p, cultura_id: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a cultura" />
          </SelectTrigger>
          <SelectContent>
            {culturasConfig?.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.nome_exibicao}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Área plantada (ha)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.area_plantada_ha}
            onChange={(e) => setForm((p) => ({ ...p, area_plantada_ha: e.target.value }))}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label>Total de plantas</Label>
          <Input
            type="number"
            value={form.total_plantas}
            onChange={(e) => setForm((p) => ({ ...p, total_plantas: e.target.value }))}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Produção estimada ({unidadeLabel})</Label>
          <Input
            type="number"
            step="0.01"
            value={form.producao_estimada}
            onChange={(e) => setForm((p) => ({ ...p, producao_estimada: e.target.value }))}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label>Preço por {unidadeLabel} (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.preco}
            onChange={(e) => setForm((p) => ({ ...p, preco: e.target.value }))}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data do plantio</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !form.data_plantio && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.data_plantio ? format(form.data_plantio, "dd/MM/yyyy") : "Selecionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={form.data_plantio}
                onSelect={(d) => setForm((p) => ({ ...p, data_plantio: d }))}
                locale={ptBR}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label>Previsão de colheita</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !form.data_colheita_estimada && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.data_colheita_estimada ? format(form.data_colheita_estimada, "dd/MM/yyyy") : "Selecionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={form.data_colheita_estimada}
                onSelect={(d) => setForm((p) => ({ ...p, data_colheita_estimada: d }))}
                locale={ptBR}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea
          value={form.observacoes}
          onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
          placeholder="Observações opcionais..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onSuccess}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
