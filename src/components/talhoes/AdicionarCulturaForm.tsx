import { useState, useEffect } from "react";
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
import { format } from "date-fns";

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
  culturasJaCadastradas?: Set<string>;
  onSuccess: () => void;
}

const PRODUTIVIDADE: Record<string, { por_ha: number | null; por_planta: number | null; unidade: string | null }> = {
  cafe: { por_ha: 30, por_planta: 0.003, unidade: "Sacas (60kg)" },
  abacate: { por_ha: 800, por_planta: 2.5, unidade: "Caixas (22kg)" },
  soja: { por_ha: 55, por_planta: null, unidade: "Sacas (60kg)" },
  milho: { por_ha: 100, por_planta: null, unidade: "Sacas (60kg)" },
  outras: { por_ha: null, por_planta: null, unidade: null },
};

export function AdicionarCulturaForm({ talhao, culturaExistente, culturasJaCadastradas = new Set(), onSuccess }: AdicionarCulturaFormProps) {
  const { safraAtual, propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!culturaExistente;

  const [culturaId, setCulturaId] = useState(culturaExistente?.cultura_id || "");
  const [areaHa, setAreaHa] = useState<string>(culturaExistente?.area_plantada_ha?.toString() || "");
  const [totalPlantas, setTotalPlantas] = useState<string>(culturaExistente?.total_plantas?.toString() || "");
  const [producaoEstimada, setProducaoEstimada] = useState<string>(culturaExistente?.producao_estimada?.toString() || "");
  const [observacoes, setObservacoes] = useState(culturaExistente?.observacoes || "");
  const [calculoAutomatico, setCalculoAutomatico] = useState(false);
  const [editouManualmente, setEditouManualmente] = useState(false);

  const { data: culturasConfig } = useQuery({
    queryKey: ["culturas-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("culturas_config")
        .select("id, nome, nome_exibicao, unidade_label, icone")
        .eq("ativo", true)
        .order("nome_exibicao");
      if (error) throw error;
      return data || [];
    },
  });

  const culturaSelecionada = culturasConfig?.find((c: any) => c.id === culturaId);
  const culturaNome = culturaSelecionada?.nome?.toLowerCase() || "";
  const unidadeLabel = culturaSelecionada?.unidade_label || "unidades";

  // Auto-calculate production estimate
  useEffect(() => {
    if (editouManualmente) return;
    const config = PRODUTIVIDADE[culturaNome] || PRODUTIVIDADE["outras"];
    if (!config) return;

    const area = Number(areaHa) || 0;
    const plantas = Number(totalPlantas) || 0;
    const estimativas: number[] = [];

    if (area > 0 && config.por_ha) {
      estimativas.push(area * config.por_ha);
    }
    if (plantas > 0 && config.por_planta) {
      estimativas.push(plantas * config.por_planta);
    }

    if (estimativas.length > 0) {
      const media = estimativas.reduce((a, b) => a + b, 0) / estimativas.length;
      setProducaoEstimada(Number(media.toFixed(1)).toString());
      setCalculoAutomatico(true);
    } else {
      setCalculoAutomatico(false);
    }
  }, [areaHa, totalPlantas, culturaNome, editouManualmente]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!propriedadeAtual?.id || !safraAtual?.id) {
        throw new Error("Propriedade ou safra não selecionada");
      }

      const payload = {
        propriedade_id: propriedadeAtual.id,
        safra_id: safraAtual.id,
        talhao_id: talhao.id,
        cultura_id: culturaId,
        area_plantada_ha: areaHa ? Number(areaHa) : null,
        total_plantas: totalPlantas ? Number(totalPlantas) : null,
        producao_estimada: producaoEstimada ? Number(producaoEstimada) : null,
        observacoes: observacoes || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("talhao_culturas")
          .update(payload)
          .eq("id", culturaExistente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("talhao_culturas").insert(payload);
        if (error) throw error;

        await supabase.from("producoes").upsert(
          {
            propriedade_id: propriedadeAtual.id,
            safra_id: safraAtual.id,
            talhao_id: talhao.id,
            cultura_id: culturaId,
          },
          { onConflict: "talhao_id,safra_id,cultura_id", ignoreDuplicates: true }
        );
      }
    },
    onSuccess: () => {
      toast({ title: `Cultura ${isEditing ? "atualizada" : "adicionada"} com sucesso` });
      queryClient.invalidateQueries({ queryKey: ["talhao-culturas"] });
      onSuccess();
    },
    onError: (error: Error) => {
      let mensagem = error.message;
      if (
        error.message.includes("duplicate key") ||
        error.message.includes("unique constraint") ||
        error.message.includes("talhao_culturas_talhao_id_safra_id_cultura_id_key")
      ) {
        mensagem =
          "Esta cultura já está cadastrada neste talhão para a safra atual. " +
          "Use o botão Editar para atualizar os dados existentes.";
      }
      toast({ title: "Erro ao salvar cultura", description: mensagem, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!culturaId) {
      toast({ title: "Selecione uma cultura", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  const hasProductivityData = PRODUTIVIDADE[culturaNome] && PRODUTIVIDADE[culturaNome].por_ha !== null;

  return (
    <div className="space-y-4">
      {/* Cultura */}
      <div>
        <Label>Cultura *</Label>
        {isEditing ? (
          <p className="text-sm font-medium mt-1 px-3 py-2 rounded-md bg-muted">
            {culturaSelecionada?.nome_exibicao || "Cultura"}
          </p>
        ) : (
          <Select value={culturaId} onValueChange={(v) => { setCulturaId(v); setEditouManualmente(false); }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a cultura" />
            </SelectTrigger>
            <SelectContent>
              {culturasConfig?.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome_exibicao}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Safra (read-only when editing) */}
      {isEditing && safraAtual && (
        <div>
          <Label>Safra</Label>
          <p className="text-sm font-medium mt-1 px-3 py-2 rounded-md bg-muted">
            {safraAtual.nome}
          </p>
        </div>
      )}

      {/* Área e Plantas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Área plantada (ha)</Label>
          <Input
            type="number"
            step="0.01"
            value={areaHa}
            onChange={(e) => { setAreaHa(e.target.value); setEditouManualmente(false); }}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label>Total de plantas/pés</Label>
          <Input
            type="number"
            value={totalPlantas}
            onChange={(e) => { setTotalPlantas(e.target.value); setEditouManualmente(false); }}
            placeholder="Opcional"
          />
        </div>
      </div>

      {/* Produção estimada */}
      <div>
        <Label>Produção estimada ({unidadeLabel})</Label>
        <Input
          type="number"
          step="0.1"
          value={producaoEstimada}
          onChange={(e) => {
            setProducaoEstimada(e.target.value);
            setEditouManualmente(true);
            setCalculoAutomatico(false);
          }}
          placeholder={hasProductivityData ? "Calculado automaticamente" : "Informe manualmente"}
        />
        {calculoAutomatico && !editouManualmente && (
          <p className="text-xs text-muted-foreground mt-1">
            Calculado automaticamente com base na média nacional (Embrapa/Conab). Você pode ajustar manualmente.
          </p>
        )}
        {editouManualmente && (
          <p className="text-xs text-muted-foreground mt-1">Estimativa personalizada</p>
        )}
      </div>

      {/* Observações */}
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
        <Button variant="outline" onClick={onSuccess}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={mutation.isPending || !propriedadeAtual?.id || !safraAtual?.id}>
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
