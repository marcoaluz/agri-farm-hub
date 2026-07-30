import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useGlobal } from '@/contexts/GlobalContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, Save, X, Lock, Paperclip, Trash2 } from 'lucide-react'
import { uploadAnexoNF, listarAnexos, removerAnexo, abrirAnexoEmNovaAba, MAX_ANEXO_BYTES } from '@/lib/anexoNF'

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
  status_pagamento?: string
  data_vencimento?: string
}

interface LoteEditFormProps {
  lote: Lote
  unidade: string
  onClose: () => void
}

export function LoteEditForm({ lote, unidade, onClose }: LoteEditFormProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { safraAtual, propriedadeAtual } = useGlobal()
  const safraFechada = (safraAtual as any)?.fechada === true
  const hoje = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    nota_fiscal: lote.nota_fiscal || '',
    fornecedor: lote.fornecedor || '',
    custo_unitario: lote.custo_unitario,
    data_entrada: lote.data_entrada,
    data_validade: lote.data_validade || '',
    quantidade: lote.quantidade_original,
  })
  const [statusPagamento, setStatusPagamento] = useState(lote.status_pagamento || 'pago')
  const [dataVencimento, setDataVencimento] = useState(lote.data_vencimento || '')
  const [arquivoNF, setArquivoNF] = useState<File | null>(null)
  const [substituindo, setSubstituindo] = useState(false)

  const { data: anexos = [], refetch: refetchAnexos } = useQuery({
    queryKey: ['anexos', 'lote', lote.id],
    queryFn: () => listarAnexos('lote', lote.id),
  })
  const anexoAtual = anexos[0]

  const mutation = useMutation({
    mutationFn: async () => {
      if (statusPagamento === 'pendente' && !dataVencimento) {
        throw new Error('Informe a data de vencimento')
      }
      if (arquivoNF && arquivoNF.size > MAX_ANEXO_BYTES) {
        throw new Error('Arquivo muito grande (máx. 5MB)')
      }

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
          status_pagamento: statusPagamento,
          data_vencimento: statusPagamento === 'pendente' ? dataVencimento : null,
        } as any)
        .eq('id', lote.id)
        .eq('quantidade_disponivel', lote.quantidade_original) // safety check

      if (error) throw error

      if (arquivoNF && propriedadeAtual?.id) {
        if (anexoAtual) await removerAnexo(anexoAtual)
        const { error: erroAnexo } = await uploadAnexoNF({
          propriedadeId: propriedadeAtual.id,
          entidadeTipo: 'lote',
          entidadeId: lote.id,
          arquivo: arquivoNF,
        })
        if (erroAnexo) throw new Error('Lote atualizado, mas erro ao anexar: ' + erroAnexo)
      }

      if (diferenca !== 0) {
        const { data: prod } = await supabase
          .from('produtos')
          .select('saldo_atual')
          .eq('id', lote.produto_id)
          .single()

        if (prod) {
          await supabase
            .from('produtos')
            .update({ saldo_atual: (prod as any).saldo_atual + diferenca })
            .eq('id', lote.produto_id)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] })
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      queryClient.invalidateQueries({ queryKey: ['anexos'] })
      toast({ title: 'Lote atualizado com sucesso!' })
      onClose()
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao atualizar lote', description: err.message, variant: 'destructive' })
    },
  })

  async function handleRemoverAnexo() {
    if (!anexoAtual) return
    await removerAnexo(anexoAtual)
    await refetchAnexos()
    queryClient.invalidateQueries({ queryKey: ['anexos'] })
    toast({ title: 'Anexo removido' })
  }

  const valorTotal = form.quantidade * form.custo_unitario

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

      {/* Pagamento */}
      <div>
        <Label className="text-xs">Pagamento *</Label>
        <RadioGroup value={statusPagamento} onValueChange={setStatusPagamento} className="flex gap-4 mt-2" disabled={safraFechada}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="pago" id={`pago-${lote.id}`} />
            <Label htmlFor={`pago-${lote.id}`} className="font-normal cursor-pointer text-xs">À vista (pago)</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="pendente" id={`pendente-${lote.id}`} />
            <Label htmlFor={`pendente-${lote.id}`} className="font-normal cursor-pointer text-xs">A prazo</Label>
          </div>
        </RadioGroup>
      </div>

      {statusPagamento === 'pendente' && (
        <div>
          <Label className="text-xs">Data de vencimento *</Label>
          <Input disabled={safraFechada} type="date" min={hoje} value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
        </div>
      )}

      {/* Anexo */}
      <div>
        <Label className="text-xs">Nota fiscal anexada</Label>
        {anexoAtual && !substituindo ? (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => abrirAnexoEmNovaAba(anexoAtual.storage_path)}>
              <Paperclip className="h-3 w-3 mr-1" /> Anexo atual: {anexoAtual.nome_arquivo}
            </Button>
            <Button variant="outline" size="sm" disabled={safraFechada} onClick={() => setSubstituindo(true)}>Substituir</Button>
            <Button variant="outline" size="sm" className="text-destructive" disabled={safraFechada} onClick={handleRemoverAnexo}>
              <Trash2 className="h-3 w-3 mr-1" /> Remover
            </Button>
          </div>
        ) : (
          <>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="cursor-pointer"
              disabled={safraFechada}
              onChange={e => setArquivoNF(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG ou PNG (máx. 5MB)</p>
            {substituindo && (
              <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => { setSubstituindo(false); setArquivoNF(null) }}>
                Cancelar substituição
              </Button>
            )}
          </>
        )}
      </div>

      {form.quantidade !== lote.quantidade_original && !safraFechada && (
        <p className="text-xs text-muted-foreground">
          ⚠️ Alterar a quantidade recalculará o saldo do produto automaticamente
        </p>
      )}

      <Alert className="bg-blue-50 border-blue-200 py-2">
        <AlertDescription className="text-xs text-blue-900">
          A despesa vinculada no Financeiro será atualizada automaticamente para R$ {valorTotal.toFixed(2)}
        </AlertDescription>
      </Alert>

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
