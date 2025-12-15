import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface Talhao {
  id: string;
  propriedade_id: string;
  nome: string;
  area_ha: number;
  cultura_atual?: string;
  /*status?: string*/
  ativo: boolean;
  created_at: string;
  /*updated_at: string*/
}

export function useTalhoes(propriedadeId?: string) {
  return useQuery({
    queryKey: ["talhoes", propriedadeId],
    queryFn: async () => {
      if (!propriedadeId) return [];

      const { data, error } = await supabase
        .from("talhoes")
        .select("*")
        .eq("propriedade_id", propriedadeId)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data as Talhao[];
    },
    enabled: !!propriedadeId,
  });
}
