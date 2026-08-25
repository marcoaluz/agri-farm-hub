import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coffee, Wheat, Apple, Sprout, Citrus, Banana, Grape, Carrot, TreePine, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

interface NovaCulturaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (cultura: any) => void;
  /** Quando informado, o diálogo entra em modo edição. */
  culturaEditando?: any | null;
}

export const ICONES_CULTURA = [
  { valor: "Sprout", Icon: Sprout, label: "Genérico" },
  { valor: "Coffee", Icon: Coffee, label: "Café" },
  { valor: "Wheat", Icon: Wheat, label: "Grão" },
  { valor: "Apple", Icon: Apple, label: "Fruta" },
  { valor: "Citrus", Icon: Citrus, label: "Cítrico" },
  { valor: "Banana", Icon: Banana, label: "Banana" },
  { valor: "Grape", Icon: Grape, label: "Uva" },
  { valor: "Carrot", Icon: Carrot, label: "Raiz/Tubérculo" },
  { valor: "TreePine", Icon: TreePine, label: "Silvicultura" },
  { valor: "Leaf", Icon: Leaf, label: "Folha" },
];

export function NovaCulturaDialog({ open, onOpenChange, onCreated, culturaEditando }: NovaCulturaDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const editando = !!culturaEditando;

  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("Sprout");
  const [tipoProduto, setTipoProduto] = useState("");
  const [unidadeMedidaId, setUnidadeMedidaId] = useState("");
  const [pesoPorUnidade, setPesoPorUnidade] = useState("");
  const [permitePlantas, setPermitePlantas] = useState(true);
  const [formaArmazenamento, setFormaArmazenamento] = useState("");

  const { data: unidades } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades_medida" as any).select("*").eq("ativo", true).order("nome");
      return (data || []) as any[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open && culturaEditando) {
      setNome(culturaEditando.nome_exibicao || "");
      setIcone(culturaEditando.icone || "Sprout");
      setTipoProduto(culturaEditando.tipo_produto || "");
      setUnidadeMedidaId(culturaEditando.unidade_medida_id || "");
      setPesoPorUnidade(culturaEditando.peso_por_unidade != null ? String(culturaEditando.peso_por_unidade) : "");
      setPermitePlantas(culturaEditando.permite_quantidade_plantas ?? true);
      setFormaArmazenamento(culturaEditando.forma_armazenamento || "");
    } else if (open) {
      resetForm();
    }
  }, [open, culturaEditando]);

  const resetForm = () => {
    setNome("");
    setIcone("Sprout");
    setTipoProduto("");
    setUnidadeMedidaId("");
    setPesoPorUnidade("");
    setPermitePlantas(true);
    setFormaArmazenamento("");
  };

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast({ title: "Informe o nome da cultura", variant: "destructive" });
      return;
    }
    if (!unidadeMedidaId) {
      toast({ title: "Selecione a unidade de produção", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (editando) {
      const unidadeSel = unidades?.find((u) => u.id === unidadeMedidaId);
      const { data, error } = await supabase
        .from("culturas_config" as any)
        .update({
          nome_exibicao: nome.trim(),
          icone,
          tipo_produto: tipoProduto.trim() || null,
          unidade_medida_id: unidadeMedidaId,
          unidade_padrao: unidadeSel?.codigo,
          unidade_label: unidadeSel?.nome,
          peso_por_unidade: pesoPorUnidade ? Number(pesoPorUnidade) : null,
          permite_quantidade_plantas: permitePlantas,
          forma_armazenamento: formaArmazenamento.trim() || null,
        })
        .eq("id", culturaEditando.id)
        .select()
        .single();
      setSaving(false);

      if (error) {
        toast({ title: "Erro ao atualizar cultura", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Cultura atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["culturas-config"] });
      onCreated(data);
      onOpenChange(false);
      return;
    }

    const { data, error } = await supabase.rpc("criar_cultura_config" as any, {
      p_nome_exibicao: nome.trim(),
      p_unidade_medida_id: unidadeMedidaId,
      p_icone: icone,
      p_tipo_produto: tipoProduto.trim() || null,
      p_peso_por_unidade: pesoPorUnidade ? Number(pesoPorUnidade) : null,
      p_permite_quantidade_plantas: permitePlantas,
      p_forma_armazenamento: formaArmazenamento.trim() || null,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao criar cultura", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Cultura criada com sucesso" });
    queryClient.invalidateQueries({ queryKey: ["culturas-config"] });
    onCreated(data);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar Cultura" : "Nova Cultura"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da cultura *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Eucalipto" />
          </div>

          <div>
            <Label>Ícone</Label>
            <div className="flex flex-wrap gap-2">
              {ICONES_CULTURA.map(({ valor, Icon, label }) => (
                <button
                  key={valor}
                  type="button"
                  title={label}
                  onClick={() => setIcone(valor)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
                    icone === valor ? "border-primary bg-primary/10" : "border-input hover:bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Produto produzido</Label>
            <Input
              value={tipoProduto}
              onChange={(e) => setTipoProduto(e.target.value)}
              placeholder="Ex: Madeira, Fruta, Grão em casca"
            />
          </div>

          <div>
            <Label>Unidade de produção *</Label>
            <Select value={unidadeMedidaId} onValueChange={setUnidadeMedidaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
              <SelectContent>
                {unidades?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome} ({u.simbolo})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Peso por unidade (kg, opcional)</Label>
            <Input
              type="number" min="0" step="0.01"
              value={pesoPorUnidade}
              onChange={(e) => setPesoPorUnidade(e.target.value)}
              placeholder="Ex: 60 (só faz sentido pra saca/caixa)"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="cursor-pointer">Permite quantidade de plantas/pés</Label>
            <Switch checked={permitePlantas} onCheckedChange={setPermitePlantas} />
          </div>

          <div>
            <Label>Forma de armazenamento</Label>
            <Input
              value={formaArmazenamento}
              onChange={(e) => setFormaArmazenamento(e.target.value)}
              placeholder="Ex: Silo, Armazém, Galpão, Pátio"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
