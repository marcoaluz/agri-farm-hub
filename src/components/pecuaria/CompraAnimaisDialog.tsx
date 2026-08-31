import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { uploadAnexoNF, listarAnexos, removerAnexo, MAX_ANEXO_BYTES } from '@/lib/anexoNF'
import { AnexoManager } from '@/components/shared/AnexoManager'

interface CompraAnimaisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanho: { id: string; nome: string; especie?: string; raca?: string; controle_individual?: boolean } | null
  /** Quando informado, o diálogo entra em modo edição. */
  movimentacao?: any | null
}

export function CompraAnimaisDialog({ open, onOpenChange, propriedadeId, rebanho, movimentacao }: CompraAnimaisDialogProps) {
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
  const [numParcelas, setNumParcelas] = useState(2)
  const [periodicidade, setPeriodicidade] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>('mensal')
  const [valorEntrada, setValorEntrada] = useState('')


  const [arquivoNF, setArquivoNF] = useState<File | null>(null)
  const [observacoes, setObservacoes] = useState('')

  const editando = !!movimentacao

  useEffect(() => {
    if (!open) return
    if (movimentacao) {
      setQuantidade(String(movimentacao.quantidade ?? ''))
      setValorUnitario(movimentacao.valor_unitario != null ? String(movimentacao.valor_unitario) : '')
      setDataCompra(movimentacao.data_evento || hoje)
      setPesoMedio(movimentacao.peso_medio_kg != null ? String(movimentacao.peso_medio_kg) : '')
      setFornecedor(movimentacao.fornecedor_comprador || '')
      setNumeroNF(movimentacao.numero_nota_fiscal || '')
      setStatusPagamento(movimentacao.status_pagamento || 'pago')
      setDataVencimento(movimentacao.data_vencimento || '')
      setArquivoNF(null)
      setObservacoes(movimentacao.observacoes || '')
    } else {
      setQuantidade(''); setValorUnitario(''); setDataCompra(hoje); setPesoMedio('')
      setFornecedor(''); setNumeroNF(''); setStatusPagamento('pago'); setDataVencimento('')
      setArquivoNF(null); setObservacoes('')
    }
  }, [open, movimentacao])

  const valorTotal = (Number(quantidade) || 0) * (Number(valorUnitario) || 0)

  async function handleSave() {
    if (!rebanho && !editando) return
    if (!quantidade || Number(quantidade) < 1) {
      toast({ title: 'Informe a quantidade de animais', variant: 'destructive' }); return
    }
    if (!valorUnitario || Number(valorUnitario) <= 0) {
      toast({ title: 'Informe o valor unitário', variant: 'destructive' }); return
    }
    if (statusPagamento !== 'pago' && !dataVencimento) {
      toast({ title: statusPagamento === 'parcelado' ? 'Informe a data da 1ª parcela' : 'Informe a data de vencimento', variant: 'destructive' }); return
    }
    if (statusPagamento === 'parcelado' && (numParcelas < 2 || numParcelas > 36)) {
      toast({ title: 'Informe entre 2 e 36 parcelas', variant: 'destructive' }); return
    }
    if (arquivoNF && arquivoNF.size > MAX_ANEXO_BYTES) {
      toast({ title: 'Arquivo muito grande (máx. 5MB)', variant: 'destructive' }); return
    }

    setLoading(true)
    const dados: any = {
        quantidade: Number(quantidade),
        valor_unitario: Number(valorUnitario),
        data_evento: dataCompra,
        peso_medio_kg: pesoMedio ? Number(pesoMedio) : null,
        fornecedor_comprador: fornecedor || null,
        numero_nota_fiscal: numeroNF || null,
        status_pagamento: statusPagamento === 'pago' ? 'pago' : 'pendente',
        data_vencimento: statusPagamento === 'pago' ? null : dataVencimento,
        observacoes: observacoes || null,
    }


    let registroId = movimentacao?.id as string | undefined
    let error: any = null
    if (editando) {
      const res = await supabase.from('rebanho_movimentacoes' as any).update(dados).eq('id', movimentacao.id)
      error = res.error
    } else {
      const res = await supabase
        .from('rebanho_movimentacoes' as any)
        .insert({ ...dados, rebanho_id: rebanho!.id, propriedade_id: propriedadeId, tipo: 'compra' })
        .select()
        .single()
      error = res.error
      registroId = (res.data as any)?.id
    }

    if (error) {
      setLoading(false)
      toast({ title: editando ? 'Erro ao atualizar' : 'Erro ao registrar compra', description: error.message, variant: 'destructive' })
      return
    }

    // Cria os animais "placeholder" do lote, aguardando identificação individual depois
    // — só para lotes com controle Individual. Lote Fechado só soma a quantidade agregada.
    if (!editando && rebanho && rebanho.controle_individual !== false) {
      const { data: userData } = await supabase.auth.getUser()
      const { count: quantidadeExistente } = await supabase
        .from('animais' as any)
        .select('id', { count: 'exact', head: true })
        .eq('rebanho_id', rebanho.id)

      const baseNumero = quantidadeExistente || 0
      const novosAnimais = Array.from({ length: Number(quantidade) }).map((_, i) => ({
        rebanho_id: rebanho.id,
        propriedade_id: propriedadeId,
        identificador: `Novo #${baseNumero + i + 1}`,
        especie: rebanho.especie,
        raca: rebanho.raca || null,
        peso_inicial_kg: pesoMedio ? Number(pesoMedio) : null,
        valor_compra: Number(valorUnitario),
        data_entrada: dataCompra,
        identificado: false,
        situacao: 'ativo',
        criado_por: userData?.user?.id || null,
      }))

      const { error: erroAnimais } = await supabase.from('animais' as any).insert(novosAnimais)
      if (erroAnimais) {
        toast({ title: 'Compra registrada, mas houve erro ao criar os animais do lote', description: erroAnimais.message, variant: 'destructive' })
      }
    }

    // Parcelamento: localiza a transação gerada pelo trigger e cria as parcelas
    if (!editando && statusPagamento === 'parcelado' && registroId) {
      const { data: transacao } = await supabase
        .from('transacoes')
        .select('id')
        .eq('propriedade_id', propriedadeId)
        .like('origem', `%${registroId}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (transacao) {
        await supabase.from('transacoes')
          .update({ parcelado: true, numero_parcelas: numParcelas } as any)
          .eq('id', (transacao as any).id)

        const { error: parcError } = await supabase.rpc('gerar_parcelas' as any, {
          p_transacao_id: (transacao as any).id,
          p_num_parcelas: numParcelas,
          p_data_primeira: dataVencimento,
        p_periodicidade: periodicidade,
        p_valor_entrada: Number(valorEntrada) || 0,
      })

        if (parcError) {
          toast({ title: 'Compra registrada, mas erro ao gerar parcelas', description: parcError.message, variant: 'destructive' })
        }
      }
    }



    if (arquivoNF && registroId) {
      const anteriores = await listarAnexos('rebanho_movimentacao', registroId)
      for (const a of anteriores) await removerAnexo(a)
      const { error: erroAnexo } = await uploadAnexoNF({
        propriedadeId,
        entidadeTipo: 'rebanho_movimentacao',
        entidadeId: registroId,
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
    queryClient.invalidateQueries({ queryKey: ['transacoes-com-anexo'] })
    queryClient.invalidateQueries({ queryKey: ['anexo', 'rebanho_movimentacao', registroId] })
    queryClient.invalidateQueries({ queryKey: ['animais-rebanho'] })
    queryClient.invalidateQueries({ queryKey: ['alertas-identificacao-pecuaria'] })
    toast({
      title: editando
        ? 'Movimentação atualizada. Financeiro sincronizado automaticamente.'
        : (rebanho && rebanho.controle_individual === false)
          ? 'Compra registrada no lote.'
          : `Compra registrada. ${quantidade} ${Number(quantidade) === 1 ? 'animal aguardando identificação' : 'animais aguardando identificação'}.`
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar movimentação' : 'Registrar compra de animais'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {rebanho && !editando && <p className="text-sm text-muted-foreground">Lote: <strong>{rebanho.nome}</strong></p>}

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
            <RadioGroup value={statusPagamento} onValueChange={setStatusPagamento} className="flex flex-wrap gap-4 mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pago" id="animal_pago" />
                <Label htmlFor="animal_pago" className="font-normal cursor-pointer">À vista (pago hoje)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pendente" id="animal_pendente" />
                <Label htmlFor="animal_pendente" className="font-normal cursor-pointer">A prazo</Label>
              </div>
              {!editando && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="parcelado" id="animal_parcelado" />
                  <Label htmlFor="animal_parcelado" className="font-normal cursor-pointer">Parcelado</Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {statusPagamento !== 'pago' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="venc_animal">
                  {statusPagamento === 'parcelado' ? 'Data da 1ª parcela *' : 'Data de vencimento *'}
                </Label>
                <Input id="venc_animal" type="date" min={hoje} value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} required />
              </div>
              {statusPagamento === 'parcelado' && (
                <div>
                  <Label htmlFor="parcelas_animal">Número de parcelas *</Label>
                  <Input id="parcelas_animal" type="number" min={2} max={36} value={numParcelas} onChange={e => setNumParcelas(Number(e.target.value))} />
                  {valorTotal > 0 && numParcelas >= 2 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {numParcelas}x de R$ {(valorTotal / numParcelas).toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {statusPagamento === 'parcelado' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor de entrada (opcional)</Label>
                <Input
                  type="number" step="0.01" min={0} placeholder="0,00"
                  value={valorEntrada}
                  onChange={(e) => setValorEntrada(e.target.value)}
                />
              </div>
              <div>
                <Label>Periodicidade</Label>
                <Select value={periodicidade} onValueChange={(v: any) => setPeriodicidade(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}



          <AnexoManager
            entidadeTipo="rebanho_movimentacao"
            entidadeId={movimentacao?.id ?? null}
            novoArquivo={arquivoNF}
            onArquivoNovoSelecionado={setArquivoNF}
          />

          <div>
            <Label htmlFor="obs_animal">Observações</Label>
            <Textarea id="obs_animal" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>

          {valorTotal > 0 && !editando && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900">
                Ao salvar, será criada automaticamente uma despesa no Financeiro no valor de R$ {valorTotal.toFixed(2)}
              </AlertDescription>
            </Alert>
          )}

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : editando ? 'Salvar alterações' : 'Registrar compra'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
