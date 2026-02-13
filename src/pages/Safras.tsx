import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "@/contexts/GlobalContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Plus, Edit, Trash2, Check, AlertCircle, Lock } from "lucide-react";
import { DialogFecharSafra } from "@/components/safras/DialogFecharSafra";
import { cn } from "@/lib/utils";

interface Safra {
  id: string;
  nome: string;
  ano_inicio: number;
  ano_fim: number | null;
  ativa: boolean;
  propriedade_id: string;
  created_at: string;
  fechada?: boolean;
  data_fechamento?: string;
  fechada_por?: string;
}

export default function SafrasPage() {
  const { propriedadeAtual } = useGlobal();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [safraEditando, setSafraEditando] = useState<Safra | null>(null);

  const { data: safras, isLoading } = useQuery({
    queryKey: ["safras", propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safras")
        .select("*")
        .eq("propriedade_id", propriedadeAtual?.id)
        .order("ano_inicio", { ascending: false });

      if (error) throw error;
      return data as Safra[];
    },
    enabled: !!propriedadeAtual?.id,
  });

  if (!propriedadeAtual) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Selecione uma propriedade</h3>
            <p className="text-muted-foreground text-center">
              Selecione uma propriedade no menu superior para gerenciar as safras
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8 text-primary" />
            Safras
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os períodos de produção da propriedade</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSafraEditando(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Safra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SafraForm
              safra={safraEditando}
              propriedadeId={propriedadeAtual.id}
              onSuccess={() => {
                setDialogOpen(false);
                setSafraEditando(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Safras */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : safras?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma safra cadastrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie sua primeira safra para começar a registrar operações
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Safra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {safras?.map((safra) => (
            <SafraCard
              key={safra.id}
              safra={safra}
              onEdit={() => {
                setSafraEditando(safra);
                setDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SafraCard({ safra, onEdit }: { safra: Safra; onEdit: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("safras").delete().eq("id", safra.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Safra excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["safras"] });
    },
    onError: () => {
      toast({
        title: "Erro ao excluir safra",
        variant: "destructive",
      });
    },
  });

  const ativarMutation = useMutation({
    mutationFn: async () => {
      // Desativar todas as outras safras primeiro
      await supabase.from("safras").update({ ativa: false }).eq("propriedade_id", safra.propriedade_id);

      // Ativar esta safra
      const { error } = await supabase.from("safras").update({ ativa: true }).eq("id", safra.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Safra ativada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["safras"] });
    },
    onError: () => {
      toast({
        title: "Erro ao ativar safra",
        variant: "destructive",
      });
    },
  });

  const duracao = safra.ano_fim ? safra.ano_fim - safra.ano_inicio : 1;

  return (
    <Card className={cn("transition-all", safra.ativa && "border-green-500 bg-green-50 dark:bg-green-950/20")}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold">{safra.nome}</h3>
              {safra.ativa && (
                <Badge className="bg-green-600 hover:bg-green-700">
                  <Check className="h-3 w-3 mr-1" />
                  ATIVA
                </Badge>
              )}
              {safra.fechada && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  <Lock className="h-3 w-3 mr-1" />
                  FECHADA
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm text-muted-foreground">Ano Início</p>
                <p className="font-semibold">{safra.ano_inicio}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ano Fim</p>
                <p className="font-semibold">{safra.ano_fim || "-"}</p>
              </div>
            </div>

            {/* Indicador de duração */}
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Duração: {duracao} {duracao === 1 ? "ano" : "anos"}</span>
              </div>
            </div>

            {safra.fechada && safra.data_fechamento && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <Lock className="h-4 w-4" />
                  <span>Fechada em {new Date(safra.data_fechamento).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!safra.ativa && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => ativarMutation.mutate()}
                disabled={ativarMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Ativar
              </Button>
            )}

            <DialogFecharSafra safra={safra} />

            <Button variant="outline" size="icon" onClick={onEdit} disabled={safra.fechada}>
              <Edit className="h-4 w-4" />
            </Button>

            {!safra.ativa && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (confirm("Tem certeza que deseja excluir esta safra?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending || safra.fechada}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SafraForm({
  safra,
  propriedadeId,
  onSuccess,
}: {
  safra: Safra | null;
  propriedadeId: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    nome: safra?.nome || "",
    ano_inicio: safra?.ano_inicio || currentYear,
    ano_fim: safra?.ano_fim || currentYear + 1,
    ativa: safra?.ativa ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = "Nome é obrigatório";
    }

    if (!formData.ano_inicio) {
      newErrors.ano_inicio = "Ano início é obrigatório";
    }

    if (formData.ano_fim && formData.ano_fim < formData.ano_inicio) {
      newErrors.ano_fim = "Ano fim deve ser maior ou igual ao ano início";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (formData.ativa) {
        // Desativar todas as outras safras primeiro
        await supabase.from("safras").update({ ativa: false }).eq("propriedade_id", propriedadeId);
      }

      const dataToSave = {
        nome: formData.nome,
        ano_inicio: formData.ano_inicio,
        ano_fim: formData.ano_fim || null,
        ativa: formData.ativa,
      };

      if (safra) {
        const { error } = await supabase.from("safras").update(dataToSave).eq("id", safra.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("safras").insert({
          ...dataToSave,
          propriedade_id: propriedadeId,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: `Safra ${safra ? "atualizada" : "criada"} com sucesso` });
      queryClient.invalidateQueries({ queryKey: ["safras"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar safra",
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
        <DialogTitle>{safra ? "Editar" : "Nova"} Safra</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label>Nome da Safra *</Label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
            placeholder="Ex: Safra 2024/2025"
            className={errors.nome ? "border-destructive" : ""}
          />
          {errors.nome && <p className="text-sm text-destructive mt-1">{errors.nome}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Ano Início *</Label>
            <Input
              type="number"
              min="2000"
              max="2100"
              value={formData.ano_inicio}
              onChange={(e) => setFormData((prev) => ({ ...prev, ano_inicio: parseInt(e.target.value) || currentYear }))}
              className={errors.ano_inicio ? "border-destructive" : ""}
            />
            {errors.ano_inicio && <p className="text-sm text-destructive mt-1">{errors.ano_inicio}</p>}
          </div>

          <div>
            <Label>Ano Fim</Label>
            <Input
              type="number"
              min="2000"
              max="2100"
              value={formData.ano_fim || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, ano_fim: parseInt(e.target.value) || null }))}
              className={errors.ano_fim ? "border-destructive" : ""}
            />
            {errors.ano_fim && <p className="text-sm text-destructive mt-1">{errors.ano_fim}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="ativa"
            checked={formData.ativa}
            onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, ativa: checked as boolean }))}
          />
          <Label htmlFor="ativa" className="cursor-pointer">
            Safra ativa
          </Label>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Apenas uma safra pode estar ativa por vez. Ao ativar esta safra, as demais serão desativadas
            automaticamente.
          </AlertDescription>
        </Alert>
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

export { SafrasPage };
