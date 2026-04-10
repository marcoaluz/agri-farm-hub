import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Leaf, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const features = [
  { label: "FIFO", description: "Controle de estoque inteligente" },
  { label: "Multi", description: "Múltiplas propriedades" },
  { label: "Real", description: "Custos em tempo real" },
  { label: "Cloud", description: "Acesso de qualquer lugar" },
];

export function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimer, setBlockTimer] = useState(0);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // Timer de bloqueio
  useEffect(() => {
    if (!isBlocked || blockTimer <= 0) return;
    const interval = setInterval(() => {
      setBlockTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsBlocked(false);
          setLoginAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isBlocked, blockTimer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleBlock = () => {
    setIsBlocked(true);
    setBlockTimer(300);
    toast({
      title: "Conta temporariamente bloqueada",
      description: "Muitas tentativas. Aguarde 5 minutos.",
      variant: "destructive",
    });
  };

  async function onSubmit(data: LoginFormValues) {
    if (isBlocked) {
      toast({
        title: "Conta bloqueada",
        description: `Aguarde ${formatTime(blockTimer)} para tentar novamente.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      await signIn(data.email, data.password);

      if (data.rememberMe) {
        localStorage.setItem("sga_remember_me", "true");
        localStorage.setItem("sga_user_email", data.email);
      } else {
        localStorage.removeItem("sga_remember_me");
        localStorage.removeItem("sga_user_email");
      }

      // signIn do AuthContext já faz navigate e toast
    } catch {
      const attempts = loginAttempts + 1;
      setLoginAttempts(attempts);
      if (attempts >= 5) {
        handleBlock();
      }
    } finally {
      setIsLoading(false);
    }
  }

  const handleGoogleLogin = async () => {
    toast({
      title: "Login com Google",
      description: "Funcionalidade será configurada em breve.",
    });
  };

  // Carregar email salvo
  useEffect(() => {
    const saved = localStorage.getItem("sga_remember_me");
    const email = localStorage.getItem("sga_user_email");
    if (saved === "true" && email) {
      form.setValue("email", email);
      form.setValue("rememberMe", true);
    }
  }, [form]);

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/70 p-12 flex-col justify-between text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="bg-primary-foreground/10 backdrop-blur-sm p-3 rounded-xl">
            <Leaf className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">SGA</h1>
            <p className="text-primary-foreground/70 text-sm">Sistema de Gestão Agropecuária</p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-4xl font-bold mb-4">Gerencie sua fazenda com inteligência</h2>
          <p className="text-primary-foreground/70 text-lg">
            Controle completo de operações, estoque, custos e resultados em uma única plataforma.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.label} className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
                <p className="font-bold text-lg">{f.label}</p>
                <p className="text-primary-foreground/70 text-sm">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-primary-foreground/60 text-sm">
          © 2025 SGA - Sistema de Gestão Agropecuária. Todos os direitos reservados.
        </p>
      </div>

      {/* Lado Direito */}
      <div className="w-full lg:w-1/2 bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">
          {/* Logo mobile */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-primary p-3 rounded-xl">
                <Leaf className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">SGA</h1>
                <p className="text-muted-foreground text-sm">Sistema de Gestão Agropecuária</p>
              </div>
            </div>
          </div>

          {/* Card */}
          <Card className="border-border shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Entrar na sua conta</CardTitle>
              <CardDescription>Digite seu email e senha para acessar o sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Alertas */}
              {isBlocked && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Conta bloqueada. Aguarde <strong>{formatTime(blockTimer)}</strong> para tentar novamente.
                  </AlertDescription>
                </Alert>
              )}
              {!isBlocked && loginAttempts > 0 && loginAttempts < 5 && (
                <Alert className="mb-4 border-warning bg-warning/5">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-warning">Tentativa {loginAttempts} de 5</AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              className="pl-10"
                              disabled={isBlocked || isLoading}
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Senha */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="pl-10 pr-10"
                              disabled={isBlocked || isLoading}
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowPassword(!showPassword)}
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Lembrar-me e Esqueceu senha */}
                  <div className="flex items-center justify-between">
                    <FormField
                      control={form.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isBlocked || isLoading}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal cursor-pointer">Lembrar-me</FormLabel>
                        </FormItem>
                      )}
                    />
                    <Link to="/esqueci-senha" className="text-sm text-primary hover:underline font-medium">
                      Esqueceu a senha?
                    </Link>
                  </div>

                  {/* Botão Entrar */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-success hover:bg-success/90 text-success-foreground"
                    disabled={isBlocked || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>

                  {/* Separador */}
                  <div className="relative my-4">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                      ou continue com
                    </span>
                  </div>

                  {/* Google */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isBlocked || isLoading}
                    onClick={handleGoogleLogin}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Entrar com Google
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex-col gap-2 pt-0">
              <Separator />
              <p className="text-sm text-muted-foreground">
                O acesso ao SGA é feito apenas por convite. Fale com o administrador.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
