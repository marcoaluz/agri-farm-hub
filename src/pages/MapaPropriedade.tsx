import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "@/contexts/GlobalContext";
import { MapaTalhoesView } from "@/components/talhoes/MapaDesenho";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export default function MapaPropriedade() {
  const { propriedadeAtual } = useGlobal();

  const { data, isLoading } = useQuery({
    queryKey: ["mapa-talhoes", propriedadeAtual?.id],
    enabled: !!propriedadeAtual?.id,
    queryFn: async () => {
      const { data: talhoes, error } = await supabase
        .from("talhoes")
        .select("id,nome,area_ha,cultura_atual,geometria,centro_lat,centro_lng")
        .eq("propriedade_id", propriedadeAtual!.id)
        .eq("ativo", true)
        .not("geometria", "is", null);
      if (error) throw error;

      const { data: prop } = await supabase
        .from("propriedades")
        .select("latitude,longitude,nome")
        .eq("id", propriedadeAtual!.id)
        .maybeSingle();

      return { talhoes: talhoes || [], propriedade: prop };
    },
  });

  if (!propriedadeAtual) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Selecione uma propriedade para visualizar o mapa.
          </CardContent>
        </Card>
      </div>
    );
  }

  const fallback: [number, number] | undefined =
    data?.propriedade?.latitude && data?.propriedade?.longitude
      ? [Number(data.propriedade.latitude), Number(data.propriedade.longitude)]
      : undefined;

  return (
    <div className="p-4 md:p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Mapa da Propriedade</h1>
      </div>

      <Card className="flex-1 flex flex-col min-h-[500px]">
        <CardHeader>
          <CardTitle className="text-base">
            {data?.propriedade?.nome || propriedadeAtual.nome} —{" "}
            {data?.talhoes.length || 0} talhão(ões) mapeado(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-[400px]">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Carregando mapa...
            </div>
          ) : !data || data.talhoes.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-center">
              <div>
                <p>Nenhum talhão com geometria cadastrada.</p>
                <p className="text-sm mt-2">
                  Edite um talhão em <strong>Talhões</strong> e desenhe a área no mapa.
                </p>
              </div>
            </div>
          ) : (
            <MapaTalhoesView
              talhoes={data.talhoes as any}
              fallbackCenter={fallback}
              height="100%"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
