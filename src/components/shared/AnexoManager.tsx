import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Paperclip, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { removerAnexo, abrirAnexoEmNovaAba, type EntidadeAnexo } from '@/lib/anexoNF'

interface AnexoManagerProps {
  entidadeTipo: EntidadeAnexo
  /** null quando a entidade ainda não foi salva */
  entidadeId: string | null
  onArquivoNovoSelecionado: (file: File | null) => void
  novoArquivo: File | null
  disabled?: boolean
}

export function AnexoManager({
  entidadeTipo,
  entidadeId,
  onArquivoNovoSelecionado,
  novoArquivo,
  disabled,
}: AnexoManagerProps) {
  const queryClient = useQueryClient()

  const { data: anexoAtual, refetch } = useQuery({
    queryKey: ['anexo', entidadeTipo, entidadeId],
    queryFn: async () => {
      if (!entidadeId) return null
      const { data } = await supabase
        .from('anexos' as any)
        .select('id, storage_path, nome_arquivo, mime_type, tamanho_bytes')
        .eq('entidade_tipo', entidadeTipo)
        .eq('entidade_id', entidadeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data as any) || null
    },
    enabled: !!entidadeId,
  })

  const handleRemover = async () => {
    if (!anexoAtual) return
    await removerAnexo(anexoAtual)
    await refetch()
    queryClient.invalidateQueries({ queryKey: ['transacoes-com-anexo'] })
    queryClient.invalidateQueries({ queryKey: ['anexos'] })
    toast.success('Anexo removido')
  }

  const inputArquivo = (
    <>
      <Input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="cursor-pointer"
        disabled={disabled}
        onChange={e => onArquivoNovoSelecionado(e.target.files?.[0] || null)}
      />
      <p className="text-xs text-muted-foreground mt-1">PDF, JPG ou PNG (máx. 5MB)</p>
    </>
  )

  // Caso 1: entidade nova (sem id ainda)
  if (!entidadeId) {
    return (
      <div>
        <Label className="text-xs">Anexar nota fiscal (opcional)</Label>
        {inputArquivo}
        {novoArquivo && <p className="text-xs mt-1">Selecionado: {novoArquivo.name}</p>}
      </div>
    )
  }

  // Caso 2: entidade existente COM anexo e sem novo arquivo
  if (anexoAtual && !novoArquivo) {
    return (
      <div>
        <Label className="text-xs">Nota fiscal anexada</Label>
        <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="truncate max-w-[180px]">{anexoAtual.nome_arquivo}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => abrirAnexoEmNovaAba(anexoAtual.storage_path)}
          >
            <Eye className="h-3 w-3 mr-1" /> Ver
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive"
            disabled={disabled}
            onClick={handleRemover}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Remover
          </Button>
        </div>
        <div className="mt-2">
          <Label className="text-xs text-muted-foreground">Ou substituir por outro arquivo</Label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="cursor-pointer mt-1"
            disabled={disabled}
            onChange={e => onArquivoNovoSelecionado(e.target.files?.[0] || null)}
          />
        </div>
      </div>
    )
  }

  // Caso 3: entidade existente sem anexo, ou novo arquivo selecionado
  return (
    <div>
      <Label className="text-xs">Anexar nota fiscal (opcional)</Label>
      {inputArquivo}
      {novoArquivo && (
        <p className="text-xs mt-1 text-muted-foreground">
          Novo arquivo: {novoArquivo.name} (substituirá o anexo anterior ao salvar)
        </p>
      )}
    </div>
  )
}
