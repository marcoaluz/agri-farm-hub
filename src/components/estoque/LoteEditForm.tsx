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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { Loader2, Save, X, Lock } from 'lucide-react'
import { uploadAnexoNF, listarAnexos, removerAnexo, MAX_ANEXO_BYTES } from '@/lib/anexoNF'
import { AnexoManager } from '@/components/shared/AnexoManager'

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

  const { data: anexos = [] } = useQuery({
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
      const consumido = lote.quantidade_original - lote.quantidade_disponivel

      if (diferenca !== 0 && form.quantidade < consumido) {
        throw new Error(`Quantidade não pode ser menor que o já consumido (${consumido})`)
      }

      const payload: any = {
        nota_fiscal: form.nota_fiscal || null,
        fornecedor: form.fornecedor || null,
        custo_unitario: form.custo_unitario,
        data_entrada: form.data_entrada,
        data_validade: form.data_validade || null,
        status_pagamento: statusPagamento,
        data_vencimento: statusPagamento === 'pendente' ? dataVencimento : null,
      }
      if (diferenca !== 0) {
        payload.quantidade_original = form.quantidade
        payload.quantidade_disponivel = form.quantidade - consumido
      }

      const { error } = await supabase
        .from('lotes')
        .update(payload)
        .eq('id', lote.id)

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
      queryClient.invalidateQueries({ queryKey: ['anexo', 'lote', lote.id] })
      queryClient.invalidateQueries({ queryKey: ['transacoes-com-anexo'] })
      toast({ title: 'Lote atualizado com sucesso!' })
      onClose()
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao atualizar lote', description: err.message, variant: 'destructive' })
    },
  })

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
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Parcelas</Label>
              <Select value={numParcelas.toString()} onValueChange={v => setNumParcelas(parseInt(v))} disabled={safraFechada}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 10, 12].map(n => (
                    <SelectItem key={n} value={n.toString()}>
                      {n === 1 ? '1x (prazo único)' : `${n}x`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vencimento 1ª parcela *</Label>
              <Input disabled={safraFechada} type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
            </div>
          </div>
          {numParcelas > 1 && valorTotal > 0 && (
            <p className="text-xs text-muted-foreground">
              {numParcelas}x de R$ {(valorTotal / numParcelas).toFixed(2)}
            </p>
          )}
        </div>
      )}


      {/* Anexo */}
      <AnexoManager
        entidadeTipo="lote"
        entidadeId={lote.id}
        novoArquivo={arquivoNF}
        onArquivoNovoSelecionado={setArquivoNF}
        disabled={safraFechada}
      />

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
