import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useGlobal } from '@/contexts/GlobalContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, X, Lock } from 'lucide-react'

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
  const { safraAtual } = useGlobal()
  const safraFechada = (safraAtual as any)?.fechada === true

  const [form, setForm] = useState({
    nota_fiscal: lote.nota_fiscal || '',
    fornecedor: lote.fornecedor || '',
    custo_unitario: lote.custo_unitario,
    data_entrada: lote.data_entrada,
    data_validade: lote.data_validade || '',
    quantidade: lote.quantidade_original,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const diferenca = form.quantidade - lote.quantidade_original

      const { error } = await supabase
        .from('lotes')
        .update({
          nota_fiscal: form.nota_fiscal || null,
          fornecedor: form.fornecedor || null,
          custo_unitario: form.custo_unitario,
          data_entrada: form.data_entrada,
          data_validade: form.data_validade || null,
          quantidade_original: form.quantidade,
          quantidade_disponivel: form.quantidade,
        })
        .eq('id', lote.id)
        .eq('quantidade_disponivel', lote.quantidade_original) // safety check

      if (error) throw error

      if (diferenca !== 0) {
        const { error: updError } = await supabase.rpc('increment_saldo', {
          p_produto_id: lote.produto_id,
          p_diferenca: diferenca,
        }).then(res => {
          if (res.error) {
            // Fallback: direct update
            return supabase
              .from('produtos')
              .update({ saldo_atual: (lote.quantidade_original + diferenca) })
              .eq('id', lote.produto_id)
          }
          return res
        })

        // Fallback if RPC doesn't exist - use raw SQL via update
        if (updError) {
          const { data: prod } = await supabase
            .from('produtos')
            .select('saldo_atual')
            .eq('id', lote.produto_id)
            .single()

          if (prod) {
            await supabase
              .from('produtos')
              .update({ saldo_atual: prod.saldo_atual + diferenca })
              .eq('id', lote.produto_id)
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] })
      toast({ title: 'Lote atualizado com sucesso!' })
      onClose()
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao atualizar lote', description: err.message, variant: 'destructive' })
    },
  })

  return (
    <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
      <h4 className="font-semibold text-sm">Editar Lote</h4>

      {safraFechada && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            <strong>🔒 Safra fechada — somente leitura.</strong> Não é possível editar lotes nesta safra.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nota Fiscal</Label>
          <Input disabled={safraFechada} value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Fornecedor</Label>
          <Input disabled={safraFechada} value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Custo Unitário (R$/{unidade})</Label>
          <Input
            disabled={safraFechada}
            type="number"
            step="0.01"
            min="0"
            value={form.custo_unitario}
            onChange={e => setForm(f => ({ ...f, custo_unitario: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <Label className="text-xs">Quantidade ({unidade})</Label>
          <Input
            disabled={safraFechada}
            type="number"
            step="0.001"
            min="0.001"
            value={form.quantidade}
            onChange={e => setForm(f => ({ ...f, quantidade: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <Label className="text-xs">Data de Entrada</Label>
          <Input disabled={safraFechada} type="date" value={form.data_entrada} onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Validade (opcional)</Label>
          <Input disabled={safraFechada} type="date" value={form.data_validade} onChange={e => setForm(f => ({ ...f, data_validade: e.target.value }))} />
        </div>
      </div>

      {form.quantidade !== lote.quantidade_original && !safraFechada && (
        <p className="text-xs text-muted-foreground">
          ⚠️ Alterar a quantidade recalculará o saldo do produto automaticamente
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose} disabled={mutation.isPending}>
          <X className="h-3 w-3 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={safraFechada || mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  )
}
