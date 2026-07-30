import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { uploadAnexoNF, MAX_ANEXO_BYTES } from '@/lib/anexoNF'

interface CompraAnimaisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanho: { id: string; nome: string } | null
}

export function CompraAnimaisDialog({ open, onOpenChange, propriedadeId, rebanho }: CompraAnimaisDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const hoje = new Date().toISOString().split('T')[0]

  const [quantidade, setQuantidade] = useState('')
  const [valorUnitario, setValorUnitario] = useState('')
  const [dataCompra, setDataCompra] = useState(hoje)
  const [pesoMedio, setPesoMedio] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [numeroNF, setNumeroNF] = useState('')
  const [statusPagamento, setStatusPagamento] = useState('pago')
  const [dataVencimento, setDataVencimento] = useState('')
  const [arquivoNF, setArquivoNF] = useState<File | null>(null)
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (open) {
      setQuantidade(''); setValorUnitario(''); setDataCompra(hoje); setPesoMedio('')
      setFornecedor(''); setNumeroNF(''); setStatusPagamento('pago'); setDataVencimento('')
      setArquivoNF(null); setObservacoes('')
    }
  }, [open])

  const valorTotal = (Number(quantidade) || 0) * (Number(valorUnitario) || 0)

  async function handleSave() {
    if (!rebanho) return
    if (!quantidade || Number(quantidade) < 1) {
      toast({ title: 'Informe a quantidade de animais', variant: 'destructive' }); return
    }
    if (!valorUnitario || Number(valorUnitario) <= 0) {
      toast({ title: 'Informe o valor unitário', variant: 'destructive' }); return
    }
    if (statusPagamento === 'pendente' && !dataVencimento) {
      toast({ title: 'Informe a data de vencimento', variant: 'destructive' }); return
    }
    if (arquivoNF && arquivoNF.size > MAX_ANEXO_BYTES) {
      toast({ title: 'Arquivo muito grande (máx. 5MB)', variant: 'destructive' }); return
    }

    setLoading(true)
    const { data: movimentacao, error } = await supabase
      .from('rebanho_movimentacoes' as any)
      .insert({
        rebanho_id: rebanho.id,
        propriedade_id: propriedadeId,
        tipo: 'compra',
        quantidade: Number(quantidade),
        valor_unitario: Number(valorUnitario),
        data_evento: dataCompra,
        peso_medio_kg: pesoMedio ? Number(pesoMedio) : null,
        fornecedor_comprador: fornecedor || null,
        numero_nota_fiscal: numeroNF || null,
        status_pagamento: statusPagamento,
        data_vencimento: statusPagamento === 'pendente' ? dataVencimento : null,
        observacoes: observacoes || null,
      })
      .select()
      .single()

    if (error) {
      setLoading(false)
      toast({ title: 'Erro ao registrar compra', description: error.message, variant: 'destructive' })
      return
    }

    if (arquivoNF && movimentacao) {
      const { error: erroAnexo } = await uploadAnexoNF({
        propriedadeId,
        entidadeTipo: 'rebanho_movimentacao',
        entidadeId: (movimentacao as any).id,
        arquivo: arquivoNF,
        pasta: 'compra_animal',
      })
      if (erroAnexo) {
        toast({ title: 'Compra registrada, mas erro ao anexar arquivo', description: erroAnexo, variant: 'destructive' })
      }
    }

    setLoading(false)
    queryClient.invalidateQueries({ queryKey: ['rebanhos'] })
    queryClient.invalidateQueries({ queryKey: ['rebanho-movimentacoes'] })
    queryClient.invalidateQueries({ queryKey: ['rebanho_movimentacoes'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
    queryClient.invalidateQueries({ queryKey: ['anexos'] })
    toast({ title: 'Compra registrada e despesa criada no Financeiro' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar compra de animais</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {rebanho && <p className="text-sm text-muted-foreground">Lote: <strong>{rebanho.nome}</strong></p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="qtd_animais">Quantidade de animais *</Label>
              <Input id="qtd_animais" type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="valor_unit">Valor unitário (R$) *</Label>
              <Input id="valor_unit" type="number" step="0.01" min="0" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Valor total</Label>
            <Input readOnly value={`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} className="bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data_compra">Data da compra *</Label>
              <Input id="data_compra" type="date" value={dataCompra} onChange={e => setDataCompra(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="peso_medio">Peso médio (kg)</Label>
              <Input id="peso_medio" type="number" step="0.01" value={pesoMedio} onChange={e => setPesoMedio(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fornecedor_animal">Fornecedor</Label>
              <Input id="fornecedor_animal" value={fornecedor} onChange={e => setFornecedor(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="nf_animal">Número da nota fiscal</Label>
              <Input id="nf_animal" value={numeroNF} onChange={e => setNumeroNF(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Pagamento *</Label>
            <RadioGroup value={statusPagamento} onValueChange={setStatusPagamento} className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pago" id="animal_pago" />
                <Label htmlFor="animal_pago" className="font-normal cursor-pointer">À vista (pago hoje)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pendente" id="animal_pendente" />
                <Label htmlFor="animal_pendente" className="font-normal cursor-pointer">A prazo</Label>
              </div>
            </RadioGroup>
          </div>

          {statusPagamento === 'pendente' && (
            <div>
              <Label htmlFor="venc_animal">Data de vencimento *</Label>
              <Input id="venc_animal" type="date" min={hoje} value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} required />
            </div>
          )}

          <div>
            <Label htmlFor="anexo_nf_animal">Anexar nota fiscal (opcional)</Label>
            <Input id="anexo_nf_animal" type="file" accept=".pdf,.jpg,.jpeg,.png" className="cursor-pointer"
              onChange={e => setArquivoNF(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG ou PNG (máx. 5MB)</p>
            {arquivoNF && <p className="text-xs mt-1">Arquivo selecionado: {arquivoNF.name}</p>}
          </div>

          <div>
            <Label htmlFor="obs_animal">Observações</Label>
            <Textarea id="obs_animal" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>

          {valorTotal > 0 && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900">
                Ao salvar, será criada automaticamente uma despesa no Financeiro no valor de R$ {valorTotal.toFixed(2)}
              </AlertDescription>
            </Alert>
          )}

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : 'Registrar compra'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
