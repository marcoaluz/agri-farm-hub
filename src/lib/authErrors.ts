// Tradução de mensagens de erro do Supabase Auth (e afins) para pt-BR.
// Uso: traduzirErroAuth(error) antes de exibir qualquer toast/alerta.

type Regra = {
  test: RegExp
  msg: string | ((m: RegExpMatchArray) => string)
}

const REGRAS: Regra[] = [
  // Rate limit / segurança
  {
    test: /for security purposes, you can only request this after (\d+) seconds?/i,
    msg: (m) => `Por segurança, aguarde ${m[1]} segundos antes de solicitar novamente.`,
  },
  {
    test: /email rate limit exceeded/i,
    msg: 'Limite de envio de emails atingido. Aguarde alguns minutos e tente novamente.',
  },
  {
    test: /over_?(email|sms|request)_?(send_)?rate.?limit|too many requests/i,
    msg: 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.',
  },

  // Credenciais / login
  {
    test: /invalid login credentials|invalid_credentials/i,
    msg: 'Email ou senha incorretos.',
  },
  {
    test: /email not confirmed|email_not_confirmed/i,
    msg: 'Email ainda não confirmado. Verifique sua caixa de entrada.',
  },
  {
    test: /user not found|user_not_found/i,
    msg: 'Usuário não encontrado.',
  },
  {
    test: /invalid or expired otp|otp_expired|token has expired or is invalid/i,
    msg: 'Código inválido ou expirado. Solicite um novo.',
  },
  {
    test: /user is banned|banned/i,
    msg: 'Este usuário está bloqueado. Entre em contato com o administrador.',
  },

  // Cadastro
  {
    test: /user already registered|already registered|email address already in use|user_already_exists/i,
    msg: 'Este email já está cadastrado.',
  },
  {
    test: /signups? not allowed|signup_disabled/i,
    msg: 'Cadastro desabilitado. Solicite um convite ao administrador.',
  },
  {
    test: /unable to validate email address|invalid email|email_address_invalid/i,
    msg: 'Endereço de email inválido.',
  },

  // Senha
  {
    test: /password should be at least (\d+)/i,
    msg: (m) => `A senha deve ter no mínimo ${m[1]} caracteres.`,
  },
  {
    test: /password is too weak|weak_password/i,
    msg: 'Senha muito fraca. Use letras, números e símbolos.',
  },
  {
    test: /password.*(found in|leaked|pwned|compromised)/i,
    msg: 'Esta senha aparece em vazamentos conhecidos. Escolha outra senha.',
  },
  {
    test: /new password should be different from the old password/i,
    msg: 'A nova senha deve ser diferente da senha atual.',
  },
  {
    test: /same_password/i,
    msg: 'A nova senha deve ser diferente da senha atual.',
  },

  // Sessão / token
  {
    test: /auth session missing|session missing|session_not_found/i,
    msg: 'Sua sessão expirou. Faça login novamente.',
  },
  {
    test: /invalid refresh token|refresh_token_not_found|jwt expired/i,
    msg: 'Sua sessão expirou. Faça login novamente.',
  },
  {
    test: /reauthentication|nonce/i,
    msg: 'Por segurança, faça login novamente para concluir esta ação.',
  },

  // Provedores
  {
    test: /unsupported provider|provider is not enabled/i,
    msg: 'Este método de login não está disponível.',
  },
  {
    test: /oauth|popup closed/i,
    msg: 'Não foi possível concluir o login com o provedor. Tente novamente.',
  },

  // Rede / permissões
  {
    test: /failed to fetch|network ?error|networkerror/i,
    msg: 'Falha de conexão. Verifique sua internet e tente novamente.',
  },
  {
    test: /row-level security|permission denied|not authorized|unauthorized/i,
    msg: 'Você não tem permissão para realizar esta ação.',
  },
  {
    test: /duplicate key value|already exists/i,
    msg: 'Este registro já existe.',
  },
]

export function traduzirErroAuth(erro: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  const bruta =
    typeof erro === 'string'
      ? erro
      : (erro as { message?: string; error_description?: string })?.message ||
        (erro as { error_description?: string })?.error_description ||
        ''

  if (!bruta) return fallback

  for (const regra of REGRAS) {
    const m = bruta.match(regra.test)
    if (m) return typeof regra.msg === 'function' ? regra.msg(m) : regra.msg
  }

  // Se a mensagem parece estar em inglês, não exibe o original ao usuário.
  return /^[\x20-\x7E]*$/.test(bruta) && /[a-z]{3,}/i.test(bruta) ? fallback : bruta
}

export default traduzirErroAuth
