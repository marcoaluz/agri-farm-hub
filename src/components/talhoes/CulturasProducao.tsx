import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "@/contexts/GlobalContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Wheat, Sprout, PackageCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdicionarCulturaForm } from "./AdicionarCulturaForm";
import { RegistrarColheitaDialog } from "./RegistrarColheitaDialog";
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

interface CulturasProducaoProps {
  talhao: Talhao;
}

const CORES_CULTURA = [
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
];

export function CulturasProducao({ talhao }: CulturasProducaoProps) {
  const { safraAtual, propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCultura, setEditingCultura] = useState<any>(null);
  const [colheitaCultura, setColheitaCultura] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: culturasTalhao, isLoading } = useQuery({
    queryKey: ["talhao-culturas", talhao.id, safraAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talhao_culturas")
        .select(`*,
          cultura:culturas_config(id, nome_exibicao, unidade_label, icone),
          producao:producoes(quantidade_colhida, quantidade_vendida, quantidade_disponivel)`)
        .eq("talhao_id", talhao.id)
        .eq("safra_id", safraAtual!.id)
        .eq("ativo", true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!talhao.id && !!safraAtual?.id,
  });

  const { data: culturasDisponiveis } = useQuery({
    queryKey: ["culturas-config-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("culturas_config")
        .select("id")
        .eq("ativo", true);
      if (error) throw error;
      return data || [];
    },
  });

  const culturasJaCadastradas = useMemo(
    () => new Set((culturasTalhao || []).map((c: any) => c.cultura_id)),
    [culturasTalhao]
  );

  const todasCadastradas = useMemo(() => {
    if (!culturasDisponiveis || culturasDisponiveis.length === 0) return false;
    return culturasDisponiveis.every((c) => culturasJaCadastradas.has(c.id));
  }, [culturasDisponiveis, culturasJaCadastradas]);

  const deleteMutation = useMutation({
    mutationFn: async (culturaId: string) => {
      const { error } = await supabase
        .from("talhao_culturas")
        .update({ ativo: false })
        .eq("id", culturaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cultura removida com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["talhao-culturas"] });
    },
    onError: () => {
      toast({ title: "Erro ao remover cultura", variant: "destructive" });
    },
  });

  if (!safraAtual) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Wheat className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Selecione uma safra no cabeçalho para gerenciar culturas</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Culturas na safra {safraAtual.nome}
        </h3>
        {todasCadastradas ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            Todas as culturas disponíveis já foram cadastradas neste talhão para esta safra.
          </p>
        ) : (
          <Button size="sm" onClick={() => { setEditingCultura(null); setAddDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Cultura
          </Button>
        )}
      </div>

      {(!culturasTalhao || culturasTalhao.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Sprout className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">Nenhuma cultura cadastrada</p>
            <p className="text-sm text-muted-foreground mb-3">Adicione culturas para acompanhar a produção deste talhão</p>
            {todasCadastradas ? (
              <p className="text-sm text-muted-foreground">
                Todas as culturas disponíveis já foram cadastradas neste talhão para esta safra.
              </p>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setEditingCultura(null); setAddDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Cultura
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {culturasTalhao.map((item: any, idx: number) => {
            const cultura = item.cultura;
            const producao = Array.isArray(item.producao) ? item.producao[0] : item.producao;
            const unidade = cultura?.unidade_label || "un";
            const corIdx = idx % CORES_CULTURA.length;

            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Badge className={CORES_CULTURA[corIdx]}>
                        {cultura?.nome_exibicao || "Cultura"}
                      </Badge>
                      <span className="block text-xs text-muted-foreground">
                        {safraAtual.nome}
                      </span>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
                        {item.total_plantas && (
                          <span>{item.total_plantas.toLocaleString("pt-BR")} plantas/pés</span>
                        )}
                        {item.area_plantada_ha && (
                          <span>{item.area_plantada_ha} ha plantados</span>
                        )}
                        {item.producao_estimada && (
                          <span>Estimativa: {item.producao_estimada.toLocaleString("pt-BR")} {unidade}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCultura(item); setAddDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setColheitaCultura(item)}>
                        <PackageCheck className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {producao && (producao.quantidade_colhida > 0 || producao.quantidade_vendida > 0) && (
                    <div className="flex flex-wrap items-center gap-2 text-sm border-t pt-2">
                      <span className="text-muted-foreground">
                        Colhido: <strong>{(producao.quantidade_colhida || 0).toLocaleString("pt-BR")}</strong>
                      </span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-muted-foreground">
                        Vendido: <strong>{(producao.quantidade_vendida || 0).toLocaleString("pt-BR")}</strong>
                      </span>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200">
                        Disponível: {(producao.quantidade_disponivel || 0).toLocaleString("pt-BR")} {unidade}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Adicionar/Editar Cultura */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCultura ? "Editar" : "Adicionar"} Cultura</DialogTitle>
          </DialogHeader>
          <AdicionarCulturaForm
            talhao={talhao}
            culturaExistente={editingCultura}
            culturasJaCadastradas={culturasJaCadastradas}
            onSuccess={() => {
              setAddDialogOpen(false);
              setEditingCultura(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog Registrar Colheita */}
      {colheitaCultura && (
        <RegistrarColheitaDialog
          open={!!colheitaCultura}
          onOpenChange={(open) => { if (!open) setColheitaCultura(null); }}
          talhaoId={talhao.id}
          culturaItem={colheitaCultura}
        />
      )}

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cultura?</AlertDialogTitle>
            <AlertDialogDescription>
              A cultura <strong>"{deleteTarget?.cultura?.nome_exibicao}"</strong> será desativada deste talhão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
