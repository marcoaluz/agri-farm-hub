import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Upload, Download, Trash2, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export type EntidadeTipo = 'transacao' | 'lancamento' | 'sanitario' | 'maquina' | 'talhao' | 'lote'

interface AnexosProps {
  entidadeTipo: EntidadeTipo
  entidadeId: string
  propriedadeId: string
  titulo?: string
}

interface Anexo {
  id: string
  nome_arquivo: string
  storage_path: string
  mime_type: string | null
  tamanho_bytes: number | null
  created_at?: string | null
}

const db = supabase as any
const BUCKET = 'anexos'
const ACCEPT = 'image/*,application/pdf'
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function isImage(mime?: string | null) {
  return !!mime && mime.startsWith('image/')
}

export function Anexos({ entidadeTipo, entidadeId, propriedadeId, titulo = 'Anexos' }: AnexosProps) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [toDelete, setToDelete] = useState<Anexo | null>(null)

  const queryKey = ['anexos', entidadeTipo, entidadeId]

  const listQ = useQuery({
    queryKey,
    enabled: !!entidadeId,
    queryFn: async () => {
      const { data, error } = await db
        .from('anexos')
        .select('id, nome_arquivo, storage_path, mime_type, tamanho_bytes, created_at')
        .eq('entidade_tipo', entidadeTipo)
        .eq('entidade_id', entidadeId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as Anexo[]
    },
  })

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!user) { toast.error('Faça login para anexar arquivos'); return }
    if (!entidadeId || !propriedadeId) { toast.error('Salve o registro antes de anexar arquivos'); return }

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: excede 20 MB`)
          continue
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${propriedadeId}/${entidadeTipo}/${entidadeId}/${Date.now()}-${safeName}`

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type || undefined,
        })
        if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue }

        const { error: insErr } = await db.from('anexos').insert({
          propriedade_id: propriedadeId,
          entidade_tipo: entidadeTipo,
          entidade_id: entidadeId,
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type || null,
          tamanho_bytes: file.size,
          criado_por: user.id,
        })
        if (insErr) {
          await supabase.storage.from(BUCKET).remove([path])
          toast.error(`${file.name}: ${insErr.message}`)
          continue
        }
        toast.success(`${file.name} anexado`)
      }
      qc.invalidateQueries({ queryKey })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const downloadMut = useMutation({
    mutationFn: async (a: Anexo) => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 3600)
      if (error || !data?.signedUrl) throw error || new Error('Falha ao gerar link')
      return data.signedUrl
    },
    onSuccess: (url) => { window.open(url, '_blank', 'noopener,noreferrer') },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar link'),
  })

  const deleteMut = useMutation({
    mutationFn: async (a: Anexo) => {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([a.storage_path])
      if (rmErr) throw rmErr
      const { error: delErr } = await db.from('anexos').delete().eq('id', a.id)
      if (delErr) throw delErr
    },
    onSuccess: () => {
      toast.success('Anexo excluído')
      qc.invalidateQueries({ queryKey })
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao excluir'),
    onSettled: () => setToDelete(null),
  })

  const itens = listQ.data || []

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Paperclip className="h-4 w-4" /> {titulo}
          {itens.length > 0 && <span className="text-xs text-muted-foreground">({itens.length})</span>}
        </h4>
        <Button
          type="button" variant="outline" size="sm"
          disabled={uploading || !entidadeId}
          onClick={() => inputRef.current?.click()}
        >
          {uploading
            ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando...</>
            : <><Upload className="h-3.5 w-3.5 mr-1" /> Anexar</>}
        </Button>
        <input
          ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {listQ.isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed rounded-md py-4 text-center">
          Nenhum arquivo anexado
        </p>
      ) : (
        <ul className="space-y-1.5">
          {itens.map((a) => (
            <li key={a.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
              {isImage(a.mime_type)
                ? <ImageIcon className="h-4 w-4 text-blue-600 shrink-0" />
                : <FileText className="h-4 w-4 text-red-600 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{a.nome_arquivo}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(a.tamanho_bytes)}</p>
              </div>
              <Button
                type="button" variant="ghost" size="icon" className="h-8 w-8"
                disabled={downloadMut.isPending}
                onClick={() => downloadMut.mutate(a)}
                title="Baixar"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setToDelete(a)}
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo <strong>{toDelete?.nome_arquivo}</strong> será removido permanentemente.
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={() => toDelete && deleteMut.mutate(toDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Anexos
