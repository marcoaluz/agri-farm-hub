import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAdminUsers, useAdminStats, useCheckAdmin, usePromoteToAdmin, useDemoteFromAdmin } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Users,
  UserPlus,
  Home,
  FileText,
  Search,
  MoreVertical,
  UserCog,
  Trash2,
  Ban,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

function getPerfilBadge(perfil: string) {
  switch (perfil) {
    case "admin":
      return <Badge variant="destructive">Admin</Badge>;
    case "proprietario":
      return <Badge variant="default">Proprietário</Badge>;
    case "gerente":
      return <Badge variant="secondary">Gerente</Badge>;
    case "operador":
      return <Badge variant="outline">Operador</Badge>;
    case "consultor":
      return <Badge className="bg-transparent text-muted-foreground border-0">Consultor</Badge>;
    default:
      return <Badge variant="outline">{perfil}</Badge>;
  }
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: isAdmin, isLoading: checkingAdmin } = useCheckAdmin(user?.id);
  const { data: users = [], isLoading: loadingUsers } = useAdminUsers();
  const { data: stats, isLoading: loadingStats } = useAdminStats();
  const promoteToAdmin = usePromoteToAdmin();
  const demoteFromAdmin = useDemoteFromAdmin();

  const [busca, setBusca] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState("todos");

  // Redirecionar se não for admin
  if (!checkingAdmin && !isAdmin) {
    navigate("/");
    toast({
      title: "Acesso negado",
      description: "Você não tem permissão para acessar esta área.",
      variant: "destructive",
    });
    return null;
  }

  // Loading
  if (checkingAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Filtrar usuários
  const usuariosFiltrados = users.filter((u) => {
    const matchBusca =
      !busca.trim() ||
      u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase());
    const matchPerfil = filtroPerfil === "todos" || u.perfil === filtroPerfil;
    return matchBusca && matchPerfil;
  });

  // Dados para gráfico de cadastros últimos 30 dias
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i);
    const count = users.filter((u) => isSameDay(new Date(u.criado_em), date)).length;
    return {
      data: format(date, "dd/MM", { locale: ptBR }),
      cadastros: count,
    };
  });

  const statCards = [
    {
      title: "Total de Usuários",
      value: stats?.total_usuarios ?? users.length,
      subtitle: "usuários cadastrados",
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Novos (7 dias)",
      value: stats?.novos_7_dias ?? 0,
      subtitle: "novos esta semana",
      icon: UserPlus,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Total Propriedades",
      value: stats?.total_propriedades ?? 0,
      subtitle: "propriedades ativas",
      icon: Home,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      title: "Total Lançamentos",
      value: stats?.total_lancamentos ?? 0,
      subtitle: "operações registradas",
      icon: FileText,
      color: "text-warning",
      bg: "bg-warning/10",
    },
  ];

  return (
    <div className="w-full max-w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
          <Shield className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Painel Administrativo</h1>
            <Badge variant="destructive">ADMIN</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Gerencie usuários e monitore o sistema</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico de Cadastros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cadastros nos últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="data" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cadastros"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Usuários */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Todos os Usuários do Sistema</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="proprietario">Proprietário</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="operador">Operador</SelectItem>
                <SelectItem value="consultor">Consultor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingUsers ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !usuariosFiltrados.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                usuariosFiltrados.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{getPerfilBadge(u.perfil)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.ultimo_acesso ? format(new Date(u.ultimo_acesso), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell>
                      {u.confirmado ? (
                        <Badge variant="outline" className="text-success border-success/30 bg-success/5">
                          Confirmado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <UserCog className="h-4 w-4 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <UserCog className="h-4 w-4 mr-2" /> Editar perfil
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.perfil !== "admin" && (
                            <DropdownMenuItem onClick={() => promoteToAdmin.mutate(u.id)}>
                              <ChevronUp className="h-4 w-4 mr-2" /> Promover a admin
                            </DropdownMenuItem>
                          )}
                          {u.perfil === "admin" && u.id !== user?.id && (
                            <DropdownMenuItem
                              onClick={() => demoteFromAdmin.mutate({ userId: u.id, newPerfil: "operador" })}
                            >
                              <ChevronUp className="h-4 w-4 mr-2 rotate-180" /> Rebaixar de admin
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-warning">
                            <Ban className="h-4 w-4 mr-2" /> Suspender conta
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Deletar usuário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
