import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kivnjwkomrkvdpvklakw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpdm5qd2tvbXJrdmRwdmtsYWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0MjMwMTYsImV4cCI6MjA0ODk5OTAxNn0.hFTramB5T1HBg1dOHmHJOPZI_fNPOBM5VJCHKf6vHuQ';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sga-auth-token',
    flowType: 'pkce',
  },
});
