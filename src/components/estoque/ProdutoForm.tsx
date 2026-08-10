import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "@/contexts/GlobalContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Package, Plus, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";


interface ProdutoFormProps {
  onSuccess: () => void;
  produto?: {
    id: string;
    nome: string;
    categoria: string;
    unidade_medida: string;
    nivel_minimo: number;
    compartilhado?: boolean;
    vendavel?: boolean;
  } | null;
}

const CATEGORIAS = [
  "Fertilizante",
  "Defensivo",
  "Semente",
  "Adubo",
  "Herbicida",
  "Fungicida",
  "Inseticida",
  "Combustível",
  "Outros",
];

const UNIDADES = [
  { value: "kg", label: "Quilograma (kg)" },
  { value: "ton", label: "Tonelada (ton)" },
  { value: "litro", label: "Litro (L)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "saca", label: "Saca (60kg)" },
  { value: "hora", label: "Hora (h)" },
  { value: "dia", label: "Dia" },
  { value: "diaria", label: "Diária" },
  { value: "ha", label: "Hectare (ha)" },
  { value: "unidade", label: "Unidade (un)" },
  { value: "servico", label: "Serviço" },
];

export function ProdutoForm({ onSuccess, produto }: ProdutoFormProps) {
  const { propriedadeAtual } = useGlobal();
  const queryClient = useQueryClient();
  const isEditing = !!produto;

  const [formData, setFormData] = useState({
    nome: "",
    categoria: "",
    unidade_medida: "",
    nivel_minimo: 0,
  });
  const [compartilhado, setCompartilhado] = useState(false);
  const [vendavel, setVendavel] = useState(false);
  const [tipoEstoque, setTipoEstoque] = useState("agricola");

  useEffect(() => {
    if (produto) {
      setFormData({
        nome: produto.nome || "",
        categoria: produto.categoria || "",
        unidade_medida: produto.unidade_medida || "",
        nivel_minimo: produto.nivel_minimo || 0,
      });
      setCompartilhado(!!produto.compartilhado);
      setVendavel(!!produto.vendavel);
      setTipoEstoque((produto as any).tipo_estoque || "agricola");
    } else {
      setFormData({
        nome: "",
        categoria: "",
        unidade_medida: "",
        nivel_minimo: 0,
      });
      setCompartilhado(false);
      setVendavel(false);
      setTipoEstoque("agricola");
    }
  }, [produto]);


  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!propriedadeAtual?.id) {
        throw new Error("Nenhuma propriedade selecionada");
      }

      if (isEditing && produto) {
        const { error } = await supabase
          .from("produtos")
          .update({
            nome: data.nome.trim(),
            categoria: data.categoria,
            unidade_medida: data.unidade_medida,
            nivel_minimo: data.nivel_minimo,
            compartilhado,
            vendavel,
            tipo_estoque: tipoEstoque,
            ativo: true,
          } as any)
          .eq("id", produto.id);

        if (error) throw error;
      } else {
        const { data: novo, error } = await supabase.rpc("criar_produto_compartilhado", {
          p_propriedade_id: propriedadeAtual.id,
          p_nome: data.nome.trim(),
          p_categoria: data.categoria,
          p_unidade: data.unidade_medida,
          p_compartilhado: compartilhado,
          p_descricao: null,
          p_preco_estimado: null,
        });

        if (error) throw error;

        const novoId = typeof novo === "string" ? novo : (novo as any)?.id || (novo as any)?.produto_id;

        if (novoId) {
          await supabase
            .from("produtos")
            .update({ vendavel, nivel_minimo: data.nivel_minimo, tipo_estoque: tipoEstoque } as any)
            .eq("id", novoId);
        }
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      if (propriedadeAtual?.id) {
        queryClient.invalidateQueries({ queryKey: ["produtos", propriedadeAtual.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["produtos-custos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos-servico"] });
      queryClient.invalidateQueries({ queryKey: ["produtos-lancamento"] });
      toast.success(isEditing ? "Produto atualizado!" : "Produto cadastrado com sucesso!");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar produto: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error("Informe o nome do produto");
      return;
    }
    if (!formData.categoria) {
      toast.error("Selecione a categoria");
      return;
    }
    if (!formData.unidade_medida) {
      toast.error("Selecione a unidade de medida");
      return;
    }

    mutation.mutate(formData);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          {isEditing ? "Editar Produto" : "Novo Produto"}
        </DialogTitle>
        <DialogDescription>
          {isEditing ? "Atualize as informações do produto." : "Cadastre um novo produto para controlar o estoque."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-4">
        {/* Nome */}
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do Produto *</Label>
          <Input
            id="nome"
            placeholder="Ex: Ureia Granulada"
            value={formData.nome}
            onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
            autoFocus
          />
        </div>

        {/* Tipo de Estoque */}
        <div className="space-y-2">
          <Label>Tipo de Estoque *</Label>
          <Select value={tipoEstoque} onValueChange={setTipoEstoque}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agricola">🌱 Agrícola (adubo, defensivo, calcário...)</SelectItem>
              <SelectItem value="pecuario">🐄 Pecuário (ração, vacina, remédio, sal mineral...)</SelectItem>
              <SelectItem value="geral">📦 Geral (diesel, ferramentas, outros)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Categoria */}
        <div className="space-y-2">
          <Label>Categoria *</Label>

          <Select
            value={formData.categoria}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, categoria: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Compartilhado */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="compartilhado"
              checked={compartilhado}
              onCheckedChange={(v) => setCompartilhado(v === true)}
            />
            <Label htmlFor="compartilhado" className="text-sm font-normal cursor-pointer">
              Usar em todas as propriedades
            </Label>
          </div>
          {compartilhado && (
            <p className="text-xs text-muted-foreground">Este produto será disponível em todas as suas propriedades.</p>
          )}
        </div>

        {/* Unidade de Medida */}
        <div className="space-y-2">
          <Label>Unidade de Medida *</Label>
          <Select
            value={formData.unidade_medida}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, unidade_medida: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES.map((un) => (
                <SelectItem key={un.value} value={un.value}>
                  {un.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Nível Mínimo */}
        <div className="space-y-2">
          <Label htmlFor="nivel_minimo">Nível Mínimo (alerta)</Label>
          <Input
            id="nivel_minimo"
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            value={formData.nivel_minimo || ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                nivel_minimo: parseFloat(e.target.value) || 0,
              }))
            }
          />
          <p className="text-xs text-muted-foreground">Você será alertado quando o estoque ficar abaixo deste valor.</p>
        </div>

        {/* Pode ser vendido */}
        <div className="flex items-center gap-2">
          <Checkbox id="vendavel" checked={vendavel} onCheckedChange={(v) => setVendavel(v === true)} />
          <Label htmlFor="vendavel" className="text-sm font-normal cursor-pointer">
            Este item pode ser vendido (ex: silagem, ração, produção própria)
          </Label>
        </div>

        <DialogFooter className="pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar Alterações" : "Cadastrar Produto"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
