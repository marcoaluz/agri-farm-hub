import { createClient } from '@supabase/supabase-js'

// Usar variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validar se as variáveis existem
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '⚠️ ERRO: Variáveis de ambiente do Supabase não configuradas!\n' +
    'Certifique-se de criar o arquivo .env com:\n' +
    'VITE_SUPABASE_URL=sua_url\n' +
    'VITE_SUPABASE_ANON_KEY=sua_chave'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})
