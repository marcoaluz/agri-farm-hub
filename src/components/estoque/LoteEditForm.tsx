import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, X } from 'lucide-react'

interface Lote {
  id: string
  produto_id: string
  nota_fiscal?: string
  fornecedor?: string
  quantidade_original: number
  quantidade_disponivel: number
  custo_unitario: number
  data_entrada: string
  data_validade?: string
}

interface LoteEditFormProps {
  lote: Lote
  unidade: string
  onClose: () => void
}

export function LoteEditForm({ lote, unidade, onClose }: LoteEditFormProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    nota_fiscal: lote.nota_fiscal || '',
    fornecedor: lote.fornecedor || '',
    custo_unitario: lote.custo_unitario,
    data_entrada: lote.data_entrada,
    data_validade: lote.data_validade || '',
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('lotes')
        .update({
          nota_fiscal: form.nota_fiscal || null,
          fornecedor: form.fornecedor || null,
          custo_unitario: form.custo_unitario,
          data_entrada: form.data_entrada,
          data_validade: form.data_validade || null,
        })
        .eq('id', lote.id)
        .eq('quantidade_disponivel', lote.quantidade_original) // safety check

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] })
      toast({ title: 'Lote atualizado com sucesso' })
      onClose()
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao atualizar lote', description: err.message, variant: 'destructive' })
    },
  })

  return (
    <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
      <h4 className="font-semibold text-sm">Editar Lote</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nota Fiscal</Label>
          <Input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Fornecedor</Label>
          <Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Custo Unitário (R$/{unidade})</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.custo_unitario}
            onChange={e => setForm(f => ({ ...f, custo_unitario: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <Label className="text-xs">Data de Entrada</Label>
          <Input type="date" value={form.data_entrada} onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Validade (opcional)</Label>
          <Input type="date" value={form.data_validade} onChange={e => setForm(f => ({ ...f, data_validade: e.target.value }))} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Quantidade: <strong>{lote.quantidade_original} {unidade}</strong> (somente leitura)
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose} disabled={mutation.isPending}>
          <X className="h-3 w-3 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  )
}
