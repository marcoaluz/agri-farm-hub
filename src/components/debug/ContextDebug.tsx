import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Entity = { id: string; nome?: string | null } | null | undefined;

interface ContextDebugProps {
  enabled: boolean;
  propriedadeAtual: Entity;
  safraAtual: Entity;
  novoLancamentoDisabled: boolean;
}

export function ContextDebug({
  enabled,
  propriedadeAtual,
  safraAtual,
  novoLancamentoDisabled,
}: ContextDebugProps) {
  if (!enabled) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm text-muted-foreground">
          Debug de Contexto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">propriedadeAtual:</span>
          <Badge variant="outline">{propriedadeAtual?.id ?? "null"}</Badge>
          {propriedadeAtual?.nome ? (
            <span className="text-muted-foreground">({propriedadeAtual.nome})</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">safraAtual:</span>
          <Badge variant="outline">{safraAtual?.id ?? "null"}</Badge>
          {safraAtual?.nome ? (
            <span className="text-muted-foreground">({safraAtual.nome})</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Botão “Novo Lançamento”:</span>
          <Badge variant={novoLancamentoDisabled ? "destructive" : "default"}>
            {novoLancamentoDisabled ? "disabled" : "enabled"}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Dica: abra <span className="font-mono">/lancamentos?debug=1</span> para ver este
          painel.
        </p>
      </CardContent>
    </Card>
  );
}
