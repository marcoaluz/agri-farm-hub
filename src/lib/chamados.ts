import { supabase } from '@/lib/supabase'

// Chamados de suporte — por PROPRIEDADE (não seguem safra).
// Regras de acesso ficam no banco (RLS + triggers); aqui só tipos, rótulos e upload.

export type ChamadoStatus = 'pendente' | 'em_andamento' | 'finalizado'
export type ChamadoTipo = 'duvida' | 'erro' | 'sugestao' | 'outro'
export type ChamadoPrioridade = 'baixa' | 'normal' | 'alta'

export interface ChamadoResumo {
  id: string
  numero: number
  propriedade_id: string
  propriedade_nome: string
  assunto: string
  tipo: ChamadoTipo
  prioridade: ChamadoPrioridade
  status: ChamadoStatus
  criado_por: string | null
  criado_por_nome: string
  created_at: string
  ultima_atividade_em: string
  finalizado_em: string | null
  qtd_mensagens: number
  ultima_do_suporte: boolean | null
}

export interface ChamadoMensagem {
  id: string
  autor_id: string | null
  autor_nome: string
  do_suporte: boolean
  sistema: boolean
  texto: string
  created_at: string
}

export interface ChamadoAnexo {
  id: string
  chamado_id: string
  mensagem_id: string | null
  storage_path: string
  nome_arquivo: string
  mime_type: string | null
  tamanho_bytes: number | null
  created_at: string
}

export const STATUS_LABEL: Record<ChamadoStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
}
export const STATUS_CLASSE: Record<ChamadoStatus, string> = {
  pendente: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  em_andamento: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800',
  finalizado: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
}
export const TIPO_LABEL: Record<ChamadoTipo, string> = {
  duvida: 'Dúvida',
  erro: 'Erro',
  sugestao: 'Sugestão',
  outro: 'Outro',
}
export const PRIORIDADE_LABEL: Record<ChamadoPrioridade, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
}
export const PRIORIDADE_CLASSE: Record<ChamadoPrioridade, string> = {
  baixa: 'text-muted-foreground',
  normal: 'text-foreground',
  alta: 'text-red-700 dark:text-red-400 font-semibold',
}

export const ANEXO_MAX_BYTES = 10 * 1024 * 1024 // 10 MB (mesmo limite do banco)
export const ANEXO_ACEITOS = 'image/*,application/pdf'
const BUCKET = 'anexos'
const db = supabase as any

/** Envia um arquivo para a pasta do chamado e registra em chamado_anexos. */
export async function enviarAnexoChamado(opts: {
  file: File
  chamadoId: string
  propriedadeId: string
  mensagemId?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const { file, chamadoId, propriedadeId, mensagemId } = opts
  if (file.size > ANEXO_MAX_BYTES) return { ok: false, error: `${file.name}: passa de 10 MB` }
  const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${propriedadeId}/chamados/${chamadoId}/${Date.now()}-${nomeSeguro}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || undefined,
  })
  if (upErr) return { ok: false, error: `${file.name}: ${upErr.message}` }

  const { error: insErr } = await db.from('chamado_anexos').insert({
    chamado_id: chamadoId,
    mensagem_id: mensagemId ?? null,
    storage_path: path,
    nome_arquivo: file.name,
    mime_type: file.type || null,
    tamanho_bytes: file.size,
  })
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return { ok: false, error: `${file.name}: ${insErr.message}` }
  }
  return { ok: true }
}

export async function abrirAnexoChamado(storagePath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) throw error || new Error('Falha ao gerar link')
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

export function formatarTamanho(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
