import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UNIDADES_PRODUCAO, FORMAS_ARMAZENAMENTO, unidadePorCodigo } from "@/lib/unidadesProducao";

interface NovaCulturaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recebe o id da cultura criada para já selecioná-la */
  onCriada: (culturaId: string) => void;
}

export function NovaCulturaDialog({ open, onOpenChange, onCriada }: NovaCulturaDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("");
  const [tipoProduto, setTipoProduto] = useState("");
  const [unidade, setUnidade] = useState("");
  const [pesoPorUnidade, setPesoPorUnidade] = useState("");
  const [permitePlantas, setPermitePlantas] = useState(true);
  const [armazenamento, setArmazenamento] = useState("none");
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const reset = () => {
    setNome(""); setIcone(""); setTipoProduto(""); setUnidade("");
    setPesoPorUnidade(""); setPermitePlantas(true); setArmazenamento("none"); setErros({});
  };

  const handleUnidade = (codigo: string) => {
    setUnidade(codigo);
    const u = unidadePorCodigo(codigo);
    if (u?.pesoPorUnidade != null && !pesoPorUnidade) setPesoPorUnidade(String(u.pesoPorUnidade));
  };

  const handleSalvar = async () => {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Informe o nome da cultura";
    if (!unidade) e.unidade = "Selecione a unidade de produção";
    if (pesoPorUnidade && Number(pesoPorUnidade) < 0) e.peso = "Peso deve ser positivo";
    setErros(e);
    if (Object.keys(e).length) return;

    const uni = unidadePorCodigo(unidade);
    setSalvando(true);

    const argsCompletos = {
      p_nome_exibicao: nome.trim(),
      p_unidade_padrao: unidade,
      p_unidade_label: uni?.label || "Unidades",
      p_icone: icone.trim() || null,
      p_tipo_produto: tipoProduto.trim() || null,
      p_peso_por_unidade: pesoPorUnidade ? Number(pesoPorUnidade) : null,
      p_permite_quantidade_plantas: permitePlantas,
      p_forma_armazenamento: armazenamento === "none" ? null : armazenamento,
    };

    let { data, error } = await supabase.rpc("criar_cultura_config" as any, argsCompletos as any);

    // Compatibilidade: banco ainda com a versão antiga da função (somente nome)
    if (error && (error.code === "PGRST202" || /function .*criar_cultura_config/i.test(error.message))) {
      const legado = await supabase.rpc("criar_cultura_config" as any, {
        p_nome_exibicao: nome.trim(),
      } as any);
      data = legado.data;
      error = legado.error;
    }

    setSalvando(false);

    if (error) {
      toast({ title: "Erro ao criar cultura", description: error.message, variant: "destructive" });
      return;
    }

    const criada = Array.isArray(data) ? (data as any[])[0] : (data as any);
    queryClient.invalidateQueries({ queryKey: ["culturas-config"] });
    toast({ title: "Cultura criada com sucesso" });
    if (criada?.id) onCriada(criada.id);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
    >
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cultura</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da cultura *</Label>
            <Input
              value={nome}
              onChange={(ev) => setNome(ev.target.value)}
              placeholder="Ex: Eucalipto"
              autoFocus
              className={erros.nome ? "border-destructive" : ""}
            />
            {erros.nome && <p className="text-sm text-destructive mt-1">{erros.nome}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Ícone</Label>
              <Input value={icone} onChange={(ev) => setIcone(ev.target.value)} placeholder="🌲" maxLength={4} />
            </div>
            <div>
              <Label>Produto produzido</Label>
              <Input value={tipoProduto} onChange={(ev) => setTipoProduto(ev.target.value)} placeholder="Ex: Madeira" />
            </div>
          </div>

          <div>
            <Label>Unidade de produção *</Label>
            <Select value={unidade} onValueChange={handleUnidade}>
              <SelectTrigger className={erros.unidade ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES_PRODUCAO.map((u) => (
                  <SelectItem key={u.codigo} value={u.codigo}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erros.unidade && <p className="text-sm text-destructive mt-1">{erros.unidade}</p>}
          </div>

          <div>
            <Label>Peso por unidade (kg)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={pesoPorUnidade}
              onChange={(ev) => setPesoPorUnidade(ev.target.value)}
              placeholder="Opcional"
            />
            {erros.peso && <p className="text-sm text-destructive mt-1">{erros.peso}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="permite-plantas"
              checked={permitePlantas}
              onCheckedChange={(c) => setPermitePlantas(!!c)}
            />
            <Label htmlFor="permite-plantas" className="cursor-pointer">Permite quantidade de plantas</Label>
          </div>

          <div>
            <Label>Forma de armazenamento</Label>
            <Select value={armazenamento} onValueChange={setArmazenamento}>
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informar</SelectItem>
                {FORMAS_ARMAZENAMENTO.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
