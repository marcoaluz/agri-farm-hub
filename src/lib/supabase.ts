import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kivnjwkomrkvdpvklakw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpdm5qd2tvbXJrdmRwdmtsYWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTMyNzQsImV4cCI6MjA4MDUyOTI3NH0.6eXJidpu9RBc8v9Kyl6Z_GdQsk3RmVMzsjAKXF_vovU'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})
