import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { traduzirErroAuth } from "@/lib/authErrors";

const PRESERVE_STORAGE_KEYS = ["theme", "language"];

function clearClientStorage() {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (!PRESERVE_STORAGE_KEYS.includes(k)) localStorage.removeItem(k);
    });
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

type UserStatus = "pendente" | "ativo" | "inativo" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userStatus: UserStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState<UserStatus>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchUserStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase.from("user_profiles").select("status").eq("id", userId).single();

      if (error || !data) {
        setUserStatus(null);
        return;
      }
      setUserStatus((data.status as UserStatus) || "ativo");
    } catch {
      setUserStatus(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Detecta link de convite (#...&type=invite) ou recuperação de senha (type=recovery)
    // ANTES de qualquer redirect para o dashboard/login
    const hash = window.location.hash || "";
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.substring(1) : hash);
    const hashType = hashParams.get("type");
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const isInviteLink = hashType === "invite" || hashType === "signup";
    const isRecoveryLink = hashType === "recovery";

    const initializeAuth = async () => {
      // Se vieram tokens na URL (convite/recuperação), estabelece a sessão manualmente
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        // Limpa o hash da URL para não reprocessar
        window.history.replaceState(null, "", window.location.pathname + window.location.search);

        if (!mounted) return;

        if (!error && data.session) {
          setSession(data.session);
          setUser(data.session.user);
          await fetchUserStatus(data.session.user.id);
          setLoading(false);

          if (isInviteLink) {
            navigate("/definir-senha", { replace: true });
          } else if (isRecoveryLink) {
            navigate("/reset-password", { replace: true });
          }
          return;
        }
      } else if (isInviteLink && window.location.pathname !== "/definir-senha") {
        navigate("/definir-senha", { replace: true });
      } else if (isRecoveryLink && window.location.pathname !== "/reset-password") {
        navigate("/reset-password" + hash, { replace: true });
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserStatus(session.user.id);
      } else {
        setUserStatus(null);
      }

      if (mounted) {
        setLoading(false);
      }
    };


    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      // PRIMEIRO: evento de recuperação de senha tem prioridade
      if (event === "PASSWORD_RECOVERY") {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        navigate("/reset-password", { replace: true });
        return;
      }

      // Convite: usuário chegou via link de e-mail e precisa criar a senha
      if (event === "SIGNED_IN" && session) {
        const h = window.location.hash || "";
        const t = new URLSearchParams(h.startsWith("#") ? h.substring(1) : h).get("type");
        if (t === "invite" || t === "signup") {
          setSession(session);
          setUser(session.user);
          setLoading(false);
          navigate("/definir-senha", { replace: true });
          return;
        }
      }


      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        void fetchUserStatus(session.user.id);
      } else {
        setUserStatus(null);
      }
    });

    void initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  // Invalida todas as queries quando o usuário muda (evita vazamento entre sessões)
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (prevUserIdRef.current !== currentId) {
      if (prevUserIdRef.current && currentId && prevUserIdRef.current !== currentId) {
        queryClient.clear();
      }
      if (currentId) {
        void queryClient.invalidateQueries();
      }
      prevUserIdRef.current = currentId;
    }
  }, [user?.id]);

  // Retoma aceite de convite pendente (caso o e-mail precise ser confirmado antes)
  useEffect(() => {
    const tokenPendente = localStorage.getItem("convite_token_pendente");
    if (!tokenPendente || !user?.id) return;

    const nome = localStorage.getItem("convite_nome") || "";
    const propriedade = localStorage.getItem("convite_propriedade") || "";
    const tipo = localStorage.getItem("convite_tipo") || (propriedade ? "novo" : "existente");

    const rpcName = tipo === "novo" ? "aceitar_convite_novo_usuario" : "aceitar_convite";
    const params: Record<string, string> = { p_token: tokenPendente, p_nome: nome };
    if (tipo === "novo") params.p_propriedade_nome = propriedade;

    void supabase.rpc(rpcName as any, params).then(({ error }) => {
      if (!error) {
        localStorage.removeItem("convite_token_pendente");
        localStorage.removeItem("convite_tipo");
        localStorage.removeItem("convite_nome");
        localStorage.removeItem("convite_propriedade");
        void queryClient.invalidateQueries();
        toast({ title: "Convite aceito!", description: "Sua propriedade foi criada." });
      }
    });
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Login realizado com sucesso!",
        description: `Bem-vindo de volta, ${data.user.email}`,
      });

      navigate("/");
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Erro ao fazer login",
        description: traduzirErroAuth(authError),
        variant: "destructive",
      });
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      toast({
        title: "Cadastro realizado!",
        description: "Verifique seu email para confirmar a conta.",
      });

      navigate("/login");
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Erro ao criar conta",
        description: traduzirErroAuth(authError),
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    // Limpa cache e storage ANTES do signOut para evitar vazamento entre sessões
    queryClient.clear();
    clearClientStorage();

    try {
      const { error } = await supabase.auth.signOut();
      if (error && !error.message?.includes("session missing") && !error.message?.includes("Failed to fetch"))
        throw error;
    } catch (error) {
      console.warn("Erro ao sair (ignorado):", error);
    } finally {
      setUser(null);
      setSession(null);
      setUserStatus(null);

      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });

      navigate("/login");
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      });
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Erro ao enviar email",
        description: traduzirErroAuth(authError),
        variant: "destructive",
      });
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    userStatus,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
