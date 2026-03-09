import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "@/contexts/GlobalContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Plus, Edit, Trash2, Maximize2, AlertCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TalhaoForm } from "@/components/talhoes/TalhaoForm";
import { CulturasProducao } from "@/components/talhoes/CulturasProducao";

interface Talhao {
  id: string;
  nome: string;
  area_ha: number;
  cultura_atual?: string;
  localizacao?: string;
  propriedade_id: string;
  ativo: boolean;
  created_at: string;
}

export function Talhoes() {
  const { propriedadeAtual } = useGlobal();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detalheTalhao, setDetalheTalhao] = useState<Talhao | null>(null);
  const [busca, setBusca] = useState("");

  const { data: talhoes, isLoading } = useQuery({
    queryKey: ["talhoes", propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talhoes")
        .select("*")
        .eq("propriedade_id", propriedadeAtual?.id)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Talhao[];
    },
    enabled: !!propriedadeAtual?.id,
  });

  const talhoesFiltrados = talhoes?.filter((t) => t.nome.toLowerCase().includes(busca.toLowerCase()));
  const areaTotal = talhoes?.reduce((sum, t) => sum + (t.area_ha || 0), 0) || 0;

  if (!propriedadeAtual) {
    return (
      <div className="w-full max-w-full p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Selecione uma propriedade</h3>
            <p className="text-muted-foreground text-center">
              Selecione uma propriedade no menu superior para gerenciar os talhões
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            Talhões
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie as áreas de plantio de {propriedadeAtual.nome}</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Talhão</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Talhão</DialogTitle>
            </DialogHeader>
            <TalhaoForm
              talhao={null}
              propriedadeId={propriedadeAtual.id}
              onSuccess={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Talhões</p>
                <p className="text-2xl font-bold">{talhoes?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <Maximize2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Área Total</p>
                <p className="text-2xl font-bold">{areaTotal.toFixed(2)} ha</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/20 rounded-lg">
                <Maximize2 className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Área Média</p>
                <p className="text-2xl font-bold">
                  {talhoes?.length ? (areaTotal / talhoes.length).toFixed(2) : "0.00"} ha
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar talhão..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" />
      </div>

      {/* Lista de Talhões */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : talhoesFiltrados?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {busca ? "Nenhum talhão encontrado" : "Nenhum talhão cadastrado"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {busca ? "Tente ajustar sua busca" : "Crie seu primeiro talhão para organizar as áreas de plantio"}
            </p>
            {!busca && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Criar Primeiro Talhão
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {talhoesFiltrados?.map((talhao) => (
            <TalhaoCard
              key={talhao.id}
              talhao={talhao}
              onClick={() => setDetalheTalhao(talhao)}
            />
          ))}
        </div>
      )}

      {/* Dialog de Detalhes com Tabs */}
      <Dialog open={!!detalheTalhao} onOpenChange={(open) => { if (!open) setDetalheTalhao(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {detalheTalhao?.nome}
            </DialogTitle>
          </DialogHeader>

          {detalheTalhao && (
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="dados" className="flex-1">Dados Gerais</TabsTrigger>
                <TabsTrigger value="culturas" className="flex-1">Culturas & Produção</TabsTrigger>
              </TabsList>

              <TabsContent value="dados">
                <TalhaoForm
                  talhao={detalheTalhao}
                  propriedadeId={propriedadeAtual.id}
                  onSuccess={() => setDetalheTalhao(null)}
                />
              </TabsContent>

              <TabsContent value="culturas">
                <CulturasProducao talhao={detalheTalhao} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── TalhaoCard ── */

function TalhaoCard({ talhao, onClick }: { talhao: Talhao; onClick: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("talhoes").update({ ativo: false }).eq("id", talhao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Talhão removido com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["talhoes"] });
    },
    onError: () => {
      toast({ title: "Erro ao remover talhão", variant: "destructive" });
    },
  });

  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">{talhao.nome}</h3>
            <div className="flex items-center gap-2 text-sm">
              <Maximize2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-success text-lg">{talhao.area_ha} ha</span>
            </div>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" onClick={onClick}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {talhao.cultura_atual && (
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-muted-foreground">Cultura:</span>
            <span className="font-medium">{talhao.cultura_atual}</span>
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desativar o talhão <strong>"{talhao.nome}"</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default Talhoes;
