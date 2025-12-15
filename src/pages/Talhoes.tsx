import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "@/contexts/GlobalContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Plus, Edit, Trash2, Maximize2, AlertCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Talhao {
  id: string;
  nome: string;
  area_ha: number;
  cultura_atual?: string;
  /*status?: string;*/
  localizacao?: string;
  /*observacoes?: string;*/
  propriedade_id: string;
  ativo: boolean;
  created_at: string;
}

export function Talhoes() {
  const { propriedadeAtual } = useGlobal();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [talhaoEditando, setTalhaoEditando] = useState<Talhao | null>(null);
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
      <div className="container mx-auto p-6">
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            Talhões
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie as áreas de plantio de {propriedadeAtual.nome}</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setTalhaoEditando(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Talhão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <TalhaoForm
              talhao={talhaoEditando}
              propriedadeId={propriedadeAtual.id}
              onSuccess={() => {
                setDialogOpen(false);
                setTalhaoEditando(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-lg">
                <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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
              <div className="p-3 bg-green-100 dark:bg-green-950 rounded-lg">
                <Maximize2 className="h-6 w-6 text-green-600 dark:text-green-400" />
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
              <div className="p-3 bg-purple-100 dark:bg-purple-950 rounded-lg">
                <Maximize2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
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
        <Input
          placeholder="Buscar talhão..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista de Talhões */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
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
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Talhão
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
              onEdit={() => {
                setTalhaoEditando(talhao);
                setDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TalhaoCard({ talhao, onEdit }: { talhao: Talhao; onEdit: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      toast({
        title: "Erro ao remover talhão",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="hover:shadow-lg transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">{talhao.nome}</h3>
            <div className="flex items-center gap-2 text-sm">
              <Maximize2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-green-600 dark:text-green-400 text-lg">{talhao.area_ha} ha</span>
            </div>
          </div>

          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm("Tem certeza que deseja remover este talhão?")) {
                  deleteMutation.mutate();
                }
              }}
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

        {talhao.status && (
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-muted-foreground">Status:</span>
            <span
              className={cn(
                "font-medium",
                talhao.status === "plantado" && "text-green-600",
                talhao.status === "colhido" && "text-blue-600",
                talhao.status === "em_preparo" && "text-yellow-600",
              )}
            >
              {talhao.status}
            </span>
          </div>
        )}

        {talhao.observacoes && <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{talhao.observacoes}</p>}
      </CardContent>
    </Card>
  );
}

function TalhaoForm({
  talhao,
  propriedadeId,
  onSuccess,
}: {
  talhao: Talhao | null;
  propriedadeId: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: talhao?.nome || "",
    area_ha: talhao?.area_ha || 0,
    cultura_atual: talhao?.cultura_atual || "",
    status: talhao?.status || "",
    observacoes: talhao?.observacoes || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = "Nome é obrigatório";
    }

    if (formData.area_ha <= 0) {
      newErrors.area_ha = "Área deve ser maior que zero";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (talhao) {
        const { error } = await supabase.from("talhoes").update(formData).eq("id", talhao.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("talhoes").insert({
          ...formData,
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
      toast({
        title: "Erro ao salvar talhão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (validateForm()) {
      mutation.mutate();
    }
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{talhao ? "Editar" : "Novo"} Talhão</DialogTitle>
      </DialogHeader>

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

        <div>
          <Label>Status</Label>
          <Input
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
            placeholder="Ex: plantado, colhido, em preparo..."
          />
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea
            value={formData.observacoes}
            onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
            placeholder="Informações adicionais sobre o talhão..."
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export default Talhoes;
