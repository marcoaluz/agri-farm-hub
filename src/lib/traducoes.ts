// Tradução de mensagens do Supabase Auth para pt-BR (helper simples).
// Para casos mais amplos, ver src/lib/authErrors.ts

export function traduzirErroSupabase(msg: string): string {
  if (!msg) return 'Erro desconhecido'

  const traducoes: Record<string, string> = {
    'User already registered': 'Este e-mail já está cadastrado no sistema.',
    'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'Password should be at least': 'A senha deve ter pelo menos 10 caracteres.',
    'Signup requires a valid password': 'Informe uma senha válida.',
    'Unable to validate email address': 'E-mail inválido.',
    'Email not confirmed': 'Confirme seu e-mail antes de acessar.',
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Token has expired or is invalid': 'O link expirou. Solicite um novo convite.',
    'New password should be different': 'A nova senha deve ser diferente da atual.',
  }

  for (const [en, pt] of Object.entries(traducoes)) {
    if (msg.toLowerCase().includes(en.toLowerCase())) return pt
  }

  const secMatch = msg.match(/after (\d+) seconds/i)
  if (secMatch) {
    return `Por segurança, aguarde ${secMatch[1]} segundos antes de tentar novamente.`
  }

  return msg
}

export default traduzirErroSupabase
