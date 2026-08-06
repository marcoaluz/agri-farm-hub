import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

interface MovimentacaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanhos: any[]
  rebanhoIdInicial?: string
}

export function MovimentacaoDialog({ open, onOpenChange, propriedadeId, rebanhos, rebanhoIdInicial }: MovimentacaoDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const [rebanhoId, setRebanhoId] = useState(rebanhoIdInicial || '')
  const [tipo, setTipo] = useState('nascimento')
  const [quantidade, setQuantidade] = useState('1')
  const [dataEvento, setDataEvento] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [valorUnitario, setValorUnitario] = useState('')
  const [pesoMedio, setPesoMedio] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [statusPagamento, setStatusPagamento] = useState('pago')
  const [dataVencimento, setDataVencimento] = useState('')
  const [rebanhoDestinoId, setRebanhoDestinoId] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (open) {
      setRebanhoId(rebanhoIdInicial || '')
      setTipo('nascimento')
      setQuantidade('1')
      setDataEvento(format(new Date(), 'yyyy-MM-dd'))
      setValorUnitario('')
      setPesoMedio('')
      setFornecedor('')
      setNotaFiscal('')
      setStatusPagamento('pago')
      setDataVencimento('')
      setRebanhoDestinoId('')
      setObservacoes('')
    }
  }, [open, rebanhoIdInicial])

  async function handleSave() {
    if (!rebanhoId || !quantidade || Number(quantidade) < 1) {
      toast({ title: 'Preencha rebanho e quantidade', variant: 'destructive' })
      return
    }
    if (tipo === 'transferencia' && !rebanhoDestinoId) {
      toast({ title: 'Selecione o rebanho destino', variant: 'destructive' })
      return
    }
    if (tipo === 'venda' && !valorUnitario) {
      toast({ title: 'Informe o valor unitário da venda', variant: 'destructive' })
      return
    }

    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()

    const dados: any = {
      rebanho_id: rebanhoId,
      propriedade_id: propriedadeId,
      tipo,
      quantidade: parseInt(quantidade),
      data_evento: dataEvento,
      valor_unitario: valorUnitario ? parseFloat(valorUnitario) : null,
      valor_total: valorUnitario && quantidade ? parseFloat(valorUnitario) * parseInt(quantidade) : null,
      peso_medio_kg: pesoMedio ? parseFloat(pesoMedio) : null,
      fornecedor_comprador: fornecedor || null,
      numero_nota_fiscal: notaFiscal || null,
      status_pagamento: statusPagamento || 'pago',
      data_vencimento: dataVencimento || null,
      rebanho_destino_id: tipo === 'transferencia' ? rebanhoDestinoId : null,
      observacoes: observacoes || null,
      usuario_id: userData?.user?.id || null,
    }

    const { error } = await supabase.from('rebanho_movimentacoes' as any).insert(dados)
    setLoading(false)

    if (error) {
      toast({ title: 'Erro ao registrar movimentação', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Movimentação registrada!' })
    queryClient.invalidateQueries({ queryKey: ['rebanhos'] })
    queryClient.invalidateQueries({ queryKey: ['rebanho-movimentacoes'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
    onOpenChange(false)
  }

  const total = valorUnitario && quantidade ? parseFloat(valorUnitario) * parseInt(quantidade || '1') : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Movimentação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rebanho *</Label>
            <Select value={rebanhoId} onValueChange={setRebanhoId}>
              <SelectTrigger><SelectValue placeholder="Selecionar rebanho" /></SelectTrigger>
              <SelectContent>
                {rebanhos.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nascimento">Nascimento</SelectItem>
                  <SelectItem value="compra">Compra</SelectItem>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="morte">Morte</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do evento</Label>
              <Input type="date" value={dataEvento} onChange={e => setDataEvento(e.target.value)} />
            </div>
          </div>

          {/* COMPRA */}
          {tipo === 'compra' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade *</Label>
                  <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
                </div>
                <div>
                  <Label>Valor unitário (R$)</Label>
                  <Input type="number" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nota Fiscal</Label>
                  <Input value={notaFiscal} onChange={e => setNotaFiscal(e.target.value)} />
                </div>
                <div>
                  <Label>Peso médio (kg)</Label>
                  <Input type="number" value={pesoMedio} onChange={e => setPesoMedio(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status pagamento</Label>
                  <Select value={statusPagamento} onValueChange={setStatusPagamento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="pendente">A prazo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {statusPagamento === 'pendente' && (
                  <div>
                    <Label>Data vencimento</Label>
                    <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
                  </div>
                )}
              </div>
              {valorUnitario && quantidade && (
                <p className="text-sm font-medium">
                  Valor total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </>
          )}

          {/* VENDA */}
          {tipo === 'venda' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade *</Label>
                  <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
                </div>
                <div>
                  <Label>Valor unitário (R$) *</Label>
                  <Input type="number" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Comprador</Label>
                <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nota Fiscal</Label>
                  <Input value={notaFiscal} onChange={e => setNotaFiscal(e.target.value)} />
                </div>
                <div>
                  <Label>Peso médio (kg)</Label>
                  <Input type="number" value={pesoMedio} onChange={e => setPesoMedio(e.target.value)} />
                </div>
              </div>
              {valorUnitario && quantidade && (
                <p className="text-sm font-medium text-green-700">
                  Receita: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </>
          )}

          {/* NASCIMENTO */}
          {tipo === 'nascimento' && (
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
          )}

          {/* MORTE */}
          {tipo === 'morte' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade *</Label>
                  <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
                </div>
                <div>
                  <Label>Valor estimado do animal (R$)</Label>
                  <Input type="number" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} placeholder="Opcional — registra prejuízo" />
                </div>
              </div>
              {valorUnitario && (
                <p className="text-sm text-red-600">
                  Prejuízo: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — será registrado no financeiro como perda
                </p>
              )}
            </>
          )}

          {/* TRANSFERÊNCIA */}
          {tipo === 'transferencia' && (
            <>
              <div>
                <Label>Quantidade *</Label>
                <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
              </div>
              <div>
                <Label>Transferir para *</Label>
                <Select value={rebanhoDestinoId} onValueChange={setRebanhoDestinoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o rebanho destino" /></SelectTrigger>
                  <SelectContent>
                    {(rebanhos || []).filter((r: any) => r.id !== rebanhoId).map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Registrar Movimentação'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
