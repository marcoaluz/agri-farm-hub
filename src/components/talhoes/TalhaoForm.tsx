import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapaDesenho, DrawResult } from "./MapaDesenho";

interface Talhao {
  id: string;
  nome: string;
  area_ha: number;
  cultura_atual?: string;
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

export function TalhaoForm({ talhao, propriedadeId, onSuccess }: TalhaoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: talhao?.nome || "",
    area_ha: talhao?.area_ha || 0,
    cultura_atual: talhao?.cultura_atual || "",
  });

  const [geo, setGeo] = useState<{
    geometria: GeoJSON.Polygon | null;
    centro_lat: number | null;
    centro_lng: number | null;
  }>({
    geometria: talhao?.geometria || null,
    centro_lat: talhao?.centro_lat || null,
    centro_lng: talhao?.centro_lng || null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: propriedade } = useQuery({
    queryKey: ["propriedade-coords", propriedadeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("propriedades")
        .select("latitude,longitude")
        .eq("id", propriedadeId)
        .maybeSingle();
      return data as { latitude: number | null; longitude: number | null } | null;
    },
  });

  const initialCenter: [number, number] | undefined =
    propriedade?.latitude && propriedade?.longitude
      ? [Number(propriedade.latitude), Number(propriedade.longitude)]
      : undefined;

  const handleDraw = (r: DrawResult | null) => {
    if (!r) {
      setGeo({ geometria: null, centro_lat: null, centro_lng: null });
      return;
    }
    setGeo({ geometria: r.geometria, centro_lat: r.centro_lat, centro_lng: r.centro_lng });
    setFormData((prev) => ({ ...prev, area_ha: r.area_ha }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nome.trim()) newErrors.nome = "Nome é obrigatório";
    if (formData.area_ha <= 0) newErrors.area_ha = "Área deve ser maior que zero";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...formData,
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
          value={formData.nome}
          onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
          placeholder="Ex: Talhão 01, Área Norte, etc."
          className={errors.nome ? "border-destructive" : ""}
        />
        {errors.nome && <p className="text-sm text-destructive mt-1">{errors.nome}</p>}
      </div>

      <div>
        <Label>Desenhar área no mapa</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Use a ferramenta de polígono (topo direito) para desenhar o contorno. A área em hectares é calculada automaticamente.
        </p>
        <MapaDesenho
          initialGeometry={geo.geometria}
          center={initialCenter}
          onChange={handleDraw}
          height={320}
        />
      </div>

      <div>
        <Label>Área (hectares) *</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={formData.area_ha || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, area_ha: parseFloat(e.target.value) || 0 }))}
          placeholder="0.00"
          className={errors.area_ha ? "border-destructive" : ""}
        />
        {errors.area_ha && <p className="text-sm text-destructive mt-1">{errors.area_ha}</p>}
      </div>

      <div>
        <Label>Cultura Atual</Label>
        <Input
          value={formData.cultura_atual}
          onChange={(e) => setFormData((prev) => ({ ...prev, cultura_atual: e.target.value }))}
          placeholder="Ex: Soja, Milho, Algodão..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onSuccess}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
