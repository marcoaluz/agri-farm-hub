import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
      {/* Painel esquerdo — fundo claro com a arte da marca */}
      <div className="hidden lg:flex lg:w-1/2 bg-background flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="flex flex-col items-center max-w-xl">
          <img
            src="/og-image.png"
            alt="Agro GFI — Um sistema de gestão de fazendas inteligente"
            className="w-full max-w-[520px] h-auto"
          />

          <h2 className="text-xl font-display font-bold text-foreground text-center mt-8 mb-3">
            Toda a gestão da sua fazenda em um único lugar.
          </h2>

          <p className="text-muted-foreground text-center text-sm leading-relaxed">
            Controle a lavoura, a pecuária, o financeiro, o estoque, as máquinas
            e tenha uma assistente de IA para apoiar suas decisões.
          </p>
        </div>

        {/* Rodapé do painel esquerdo */}
        <div className="absolute bottom-6 text-muted-foreground text-xs">
          © 2026 Agro GFI — Gestão de Fazenda Inteligente
        </div>
      </div>

      {/* Painel direito — formulário de login sobre fundo verde */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-primary">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl p-6 md:p-8">
          {/* Logo mobile (só aparece em telas sem painel esquerdo) */}
          <div className="flex justify-center mb-8 lg:hidden">
            <img
              src="/logo-full.png"
              alt="Agro GFI"
              className="w-full max-w-[220px] h-auto"
            />
          </div>


          <div className="space-y-2 mb-8">
            <h1 className="text-2xl font-display font-bold text-foreground">
              Entrar na sua conta
            </h1>
            <p className="text-sm text-muted-foreground">
              Digite seu email e senha para acessar o sistema
            </p>
          </div>

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


            </form>
          </Form>

          {/* Rodapé do formulário */}
          <div className="mt-8 text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              O acesso ao Agro GFI é feito apenas por convite. Fale com o administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
