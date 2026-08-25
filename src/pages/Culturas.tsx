import { useState } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";

import { Skeleton } from "@/components/ui/skeleton";

import {

  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,

  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,

} from "@/components/ui/alert-dialog";

import { Sprout, Plus, Edit, EyeOff, Eye, Search, ArrowLeft } from "lucide-react";

import { Link } from "react-router-dom";

import { NovaCulturaDialog, ICONES_CULTURA } from "@/components/talhoes/NovaCulturaDialog";



function IconeCultura({ nome }: { nome?: string }) {

  const found = ICONES_CULTURA.find((i) => i.valor === nome);

  const Icon = found?.Icon || Sprout;

  return <Icon className="h-5 w-5" />;

}



export default function Culturas() {

  const { toast } = useToast();

  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);

  const [culturaEditando, setCulturaEditando] = useState<any | null>(null);

  const [culturaParaAlternar, setCulturaParaAlternar] = useState<any | null>(null);



  const { data: culturas, isLoading } = useQuery({

    queryKey: ["culturas-config-todas"],

    queryFn: async () => {

      const { data, error } = await supabase

        .from("culturas_config" as any)

        .select("*")

        .order("nome_exibicao");

      if (error) throw error;

      return (data || []) as any[];

    },

  });



  const culturasFiltradas = culturas?.filter((c) =>

    (c.nome_exibicao || "").toLowerCase().includes(busca.toLowerCase())

  );



  const toggleAtivoMutation = useMutation({

    mutationFn: async (cultura: any) => {

      const { error } = await supabase

        .from("culturas_config" as any)

        .update({ ativo: !cultura.ativo })

        .eq("id", cultura.id);

      if (error) throw error;

    },

    onSuccess: (_v, cultura) => {

      toast({ title: cultura.ativo ? "Cultura desativada" : "Cultura reativada" });

      queryClient.invalidateQueries({ queryKey: ["culturas-config-todas"] });

      queryClient.invalidateQueries({ queryKey: ["culturas-config"] });

    },

    onError: (error: Error) => {

      toast({ title: "Erro ao atualizar cultura", description: error.message, variant: "destructive" });

    },

  });



  return (

    <div className="w-full max-w-full space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div>

          <Link to="/talhoes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">

            <ArrowLeft className="h-3.5 w-3.5" /> Voltar pra Talhões

          </Link>

          <h1 className="text-3xl font-bold flex items-center gap-2">

            <Sprout className="h-8 w-8 text-primary" />

            Culturas

          </h1>

          <p className="text-muted-foreground mt-1">

            Cadastre culturas e defina a unidade de produção de cada uma

          </p>

        </div>

        <Button onClick={() => { setCulturaEditando(null); setDialogOpen(true); }}>

          <Plus className="h-4 w-4 mr-2" />

          Nova Cultura

        </Button>

      </div>



      <div className="relative">

        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Input placeholder="Buscar cultura..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" />

      </div>



      {isLoading ? (

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32 w-full" />)}

        </div>

      ) : culturasFiltradas?.length === 0 ? (

        <Card>

          <CardContent className="flex flex-col items-center justify-center py-12">

            <Sprout className="h-16 w-16 text-muted-foreground mb-4" />

            <h3 className="text-xl font-semibold mb-2">Nenhuma cultura encontrada</h3>

          </CardContent>

        </Card>

      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {culturasFiltradas?.map((cultura) => (

            <Card key={cultura.id} className={!cultura.ativo ? "opacity-50" : ""}>

              <CardContent className="p-4">

                <div className="flex items-start justify-between mb-2">

                  <div className="flex items-center gap-2">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">

                      <IconeCultura nome={cultura.icone} />

                    </div>

                    <div>

                      <h3 className="font-semibold leading-tight">{cultura.nome_exibicao}</h3>

                      {!cultura.usuario_id && (

                        <Badge variant="outline" className="mt-0.5 text-[10px] px-1.5 py-0">Padrão</Badge>

                      )}

                    </div>

                  </div>

                  <div className="flex gap-1">

                    <Button

                      variant="ghost" size="icon" className="h-8 w-8"

                      onClick={() => { setCulturaEditando(cultura); setDialogOpen(true); }}

                    >

                      <Edit className="h-4 w-4" />

                    </Button>

                    <Button

                      variant="ghost" size="icon" className="h-8 w-8"

                      onClick={() => setCulturaParaAlternar(cultura)}

                      title={cultura.ativo ? "Desativar" : "Reativar"}

                    >

                      {cultura.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}

                    </Button>

                  </div>

                </div>



                <div className="space-y-1 text-sm">

                  <div className="flex justify-between">

                    <span className="text-muted-foreground">Unidade</span>

                    <span className="font-medium">{cultura.unidade_label}</span>

                  </div>

                  {cultura.tipo_produto && (

                    <div className="flex justify-between">

                      <span className="text-muted-foreground">Produto</span>

                      <span className="font-medium">{cultura.tipo_produto}</span>

                    </div>

                  )}

                  {cultura.peso_por_unidade && (

                    <div className="flex justify-between">

                      <span className="text-muted-foreground">Peso/unidade</span>

                      <span className="font-medium">{cultura.peso_por_unidade} kg</span>

                    </div>

                  )}

                  <div className="flex justify-between">

                    <span className="text-muted-foreground">Plantas/pés</span>

                    <span className="font-medium">{cultura.permite_quantidade_plantas ? "Sim" : "Não"}</span>

                  </div>

                  {cultura.forma_armazenamento && (

                    <div className="flex justify-between">

                      <span className="text-muted-foreground">Armazenamento</span>

                      <span className="font-medium">{cultura.forma_armazenamento}</span>

                    </div>

                  )}

                </div>

              </CardContent>

            </Card>

          ))}

        </div>

      )}



      <NovaCulturaDialog

        open={dialogOpen}

        onOpenChange={setDialogOpen}

        culturaEditando={culturaEditando}

        onCreated={() => setCulturaEditando(null)}

      />



      <AlertDialog open={!!culturaParaAlternar} onOpenChange={(o) => { if (!o) setCulturaParaAlternar(null); }}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>

              {culturaParaAlternar?.ativo ? "Desativar cultura?" : "Reativar cultura?"}

            </AlertDialogTitle>

            <AlertDialogDescription>

              {culturaParaAlternar?.ativo

                ? `"${culturaParaAlternar?.nome_exibicao}" vai deixar de aparecer no dropdown de Talhão. Talhões que já usam essa cultura não são afetados.`

                : `"${culturaParaAlternar?.nome_exibicao}" volta a aparecer no dropdown de Talhão.`}

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancelar</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => { toggleAtivoMutation.mutate(culturaParaAlternar); setCulturaParaAlternar(null); }}

            >

              Confirmar

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </div>

  );

}

