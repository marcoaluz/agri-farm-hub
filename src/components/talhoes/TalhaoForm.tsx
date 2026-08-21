import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseGeometria } from "./MapaDesenho";
import { NovaCulturaDialog } from "./NovaCulturaDialog";
import { Plus } from "lucide-react";


interface Talhao {
  id: string;
  nome: string;
  area_ha: number;
  cultura_atual?: string;
  cultura_id?: string | null;
  quantidade_pes?: number | null;
  estimativa_colheita?: number | null;
  ano_plantio?: number | null;
  variedade?: string | null;
  propriedade_id: string;
  ativo: boolean;
  created_at: string;
  geometria?: GeoJSON.Polygon | null;
  centro_lat?: number | null;
  centro_lng?: number | null;
}

interface TalhaoFormProps {
  talhao: Talhao | null;
  propriedadeId: string;
  onSuccess: () => void;
}

/** Rótulo da quantidade de plantas — genérico, sem regra por cultura no código */
function labelQuantidadePes() {
  return "Plantas";
}


export function TalhaoForm({ talhao, propriedadeId, onSuccess }: TalhaoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [nome, setNome] = useState(talhao?.nome || "");
  const [areaHa, setAreaHa] = useState(talhao?.area_ha ? String(talhao.area_ha) : "");
  const [culturaId, setCulturaId] = useState(talhao?.cultura_id || "");
  const [quantidadePes, setQuantidadePes] = useState(talhao?.quantidade_pes?.toString() || "");
  const [estimativa, setEstimativa] = useState(talhao?.estimativa_colheita?.toString() || "");
  const [anoPlantio, setAnoPlantio] = useState(talhao?.ano_plantio?.toString() || "");
  const [variedade, setVariedade] = useState(talhao?.variedade || "");

  const [showNovaCultura, setShowNovaCultura] = useState(false);


  const [geo, setGeo] = useState<{
    geometria: GeoJSON.Polygon | null;
    centro_lat: number | null;
    centro_lng: number | null;
  }>({
    geometria: parseGeometria(talhao?.geometria),
    centro_lat: talhao?.centro_lat ?? null,
    centro_lng: talhao?.centro_lng ?? null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: culturas } = useQuery({
    queryKey: ["culturas-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("culturas_config" as any)
        .select("*")
        .eq("ativo", true)
        .order("nome_exibicao");
      return (data || []) as any[];
    },
  });

  const culturaSel = culturas?.find((c) => c.id === culturaId);
  /** Unidade de produção vem sempre da configuração da cultura (banco) */
  const unidadeLabel: string | null = culturaSel?.unidade_label || null;
  /** Culturas antigas (sem a coluna configurada) continuam exibindo o campo Plantas */
  const permitePlantas = culturaSel ? culturaSel.permite_quantidade_plantas !== false : false;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!nome.trim()) newErrors.nome = "Nome é obrigatório";
    if (!areaHa || parseFloat(areaHa) <= 0) newErrors.area_ha = "Área deve ser maior que zero";
    if (!culturaId) newErrors.cultura_id = "Selecione a cultura";
    if (estimativa && (isNaN(Number(estimativa)) || Number(estimativa) < 0)) {
      newErrors.estimativa = "Informe um valor numérico maior ou igual a zero";
    }
    if (permitePlantas && quantidadePes && (!Number.isInteger(Number(quantidadePes)) || Number(quantidadePes) < 0)) {
      newErrors.quantidade_pes = "Informe um número inteiro positivo";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nome: nome.trim(),
        area_ha: parseFloat(areaHa),
        cultura_id: culturaId,
        cultura_atual: culturaSel?.nome_exibicao || null,
        quantidade_pes: quantidadePes ? parseInt(quantidadePes) : 0,
        estimativa_colheita: estimativa ? parseFloat(estimativa) : 0,
        ano_plantio: anoPlantio ? parseInt(anoPlantio) : null,
        variedade: variedade || null,
        geometria: geo.geometria,
        centro_lat: geo.centro_lat,
        centro_lng: geo.centro_lng,
      };
      if (talhao) {
        const { error } = await supabase.from("talhoes").update(payload).eq("id", talhao.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("talhoes").insert({
          ...payload,
          propriedade_id: propriedadeId,
          ativo: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: `Talhão ${talhao ? "atualizado" : "criado"} com sucesso` });
      queryClient.invalidateQueries({ queryKey: ["talhoes"] });
      queryClient.invalidateQueries({ queryKey: ["talhoes-producao"] });
      queryClient.invalidateQueries({ queryKey: ["mapa-talhoes"] });
      queryClient.invalidateQueries({ queryKey: ["mapa-propriedade"] });
      queryClient.invalidateQueries({ queryKey: ["talhoes-com-geometria"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar talhão", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (validateForm()) mutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Nome do Talhão *</Label>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Talhão 01, Área Norte, etc."
          className={errors.nome ? "border-destructive" : ""}
        />
        {errors.nome && <p className="text-sm text-destructive mt-1">{errors.nome}</p>}
      </div>

      <div>
        <Label>Área (hectares) *</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={areaHa}
          onChange={(e) => setAreaHa(e.target.value)}
          placeholder="0.00"
          className={errors.area_ha ? "border-destructive" : ""}
        />
        {errors.area_ha && <p className="text-sm text-destructive mt-1">{errors.area_ha}</p>}
      </div>

      <div>
        <Label>Cultura *</Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={culturaId} onValueChange={setCulturaId}>
              <SelectTrigger className={errors.cultura_id ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecione a cultura" />
              </SelectTrigger>
              <SelectContent>
                {culturas?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icone && c.icone.length <= 4 ? `${c.icone} ` : ""}{c.nome_exibicao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="icon" variant="outline" onClick={() => setShowNovaCultura(true)} title="Nova cultura">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {errors.cultura_id && <p className="text-sm text-destructive mt-1">{errors.cultura_id}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {permitePlantas && (
          <div>
            <Label>{labelQuantidadePes()}</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={quantidadePes}
              onChange={(e) => setQuantidadePes(e.target.value)}
              placeholder="Opcional"
              className={errors.quantidade_pes ? "border-destructive" : ""}
            />
            {errors.quantidade_pes && <p className="text-sm text-destructive mt-1">{errors.quantidade_pes}</p>}
          </div>
        )}

        <div>
          <Label>
            Estimativa de produção{unidadeLabel ? ` (${unidadeLabel})` : ""}
          </Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={estimativa}
            onChange={(e) => setEstimativa(e.target.value)}
            disabled={!culturaId}
            placeholder={culturaId ? "Opcional" : "Selecione uma cultura primeiro"}
            className={errors.estimativa ? "border-destructive" : ""}
          />
          {errors.estimativa && <p className="text-sm text-destructive mt-1">{errors.estimativa}</p>}
        </div>


        <div>
          <Label>Ano de plantio</Label>
          <Input
            type="number"
            min="1900"
            max="2100"
            step="1"
            value={anoPlantio}
            onChange={(e) => setAnoPlantio(e.target.value)}
            placeholder="Ex: 2020"
          />
        </div>

        <div>
          <Label>Variedade</Label>
          <Input
            value={variedade}
            onChange={(e) => setVariedade(e.target.value)}
            placeholder="Ex: Catuaí Vermelho, Mundo Novo"
          />
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mb-2 mt-2 flex justify-end gap-2 border-t bg-background py-3">
        <Button variant="outline" onClick={onSuccess}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
