import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Valida o JWT do chamador
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verifica se o chamador é admin
    const { data: callerProfile } = await adminClient
      .from('user_profiles')
      .select('perfil')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.perfil !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem excluir usuários' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Valida o body
    const body = await req.json().catch(() => null)
    const usuarioId = body?.usuario_id
    if (!usuarioId || typeof usuarioId !== 'string') {
      return new Response(JSON.stringify({ error: 'usuario_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Não permite autoexclusão
    if (usuarioId === caller.id) {
      return new Response(JSON.stringify({ error: 'Você não pode excluir a própria conta por aqui' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Não permite excluir super admin
    const { data: alvoProfile } = await adminClient
      .from('user_profiles')
      .select('is_super_admin')
      .eq('id', usuarioId)
      .single()
    if ((alvoProfile as any)?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Não é possível excluir o administrador principal' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(usuarioId)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
