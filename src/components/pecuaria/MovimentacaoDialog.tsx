import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface MovimentacaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanhos: any[]
  rebanhoIdInicial?: string
  tipoInicial?: string
  animalIdInicial?: string
  quantidadeInicial?: string
}

const TIPOS_COM_ANIMAIS = ['transferencia', 'venda', 'morte']

export function MovimentacaoDialog({
  open,
  onOpenChange,
  propriedadeId,
  rebanhos,
  rebanhoIdInicial,
  tipoInicial,
  animalIdInicial,
  quantidadeInicial,
}: MovimentacaoDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const [rebanhoId, setRebanhoId] = useState(rebanhoIdInicial || '')
  const [tipo, setTipo] = useState(tipoInicial || 'nascimento')
  const [quantidade, setQuantidade] = useState(quantidadeInicial || '1')
  const [dataEvento, setDataEvento] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [tipoPreco, setTipoPreco] = useState('unitario')
  const [valorUnitario, setValorUnitario] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [pesoMedio, setPesoMedio] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [statusPagamento, setStatusPagamento] = useState('pago')
  const [dataVencimento, setDataVencimento] = useState('')
  const [rebanhoDestinoId, setRebanhoDestinoId] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [animaisSelecionados, setAnimaisSelecionados] = useState<string[]>([])

  // Nascimento — identificação opcional
  const [nomeAnimal, setNomeAnimal] = useState('')
  const [brincoAnimal, setBrincoAnimal] = useState('')
  const [sexoAnimal, setSexoAnimal] = useState('nao_definido')
  const [pesoNascimento, setPesoNascimento] = useState('')

  useEffect(() => {
    if (open) {
      setRebanhoId(rebanhoIdInicial || '')
      setTipo(tipoInicial || 'nascimento')
      setQuantidade(quantidadeInicial || '1')
      setDataEvento(format(new Date(), 'yyyy-MM-dd'))
      setTipoPreco('unitario')
      setValorUnitario('')
      setValorTotal('')
      setPesoMedio('')
      setFornecedor('')
      setNotaFiscal('')
      setStatusPagamento('pago')
      setDataVencimento('')
      setRebanhoDestinoId('')
      setObservacoes('')
      setAnimaisSelecionados(animalIdInicial ? [animalIdInicial] : [])
      setNomeAnimal('')
      setBrincoAnimal('')
      setSexoAnimal('nao_definido')
      setPesoNascimento('')
    }
  }, [open, rebanhoIdInicial, tipoInicial, animalIdInicial, quantidadeInicial])

  const rebanhoAtual = (rebanhos || []).find((r: any) => r.id === rebanhoId)

  const { data: animaisRebanho } = useQuery({
    queryKey: ['animais-rebanho-select', rebanhoId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_animais_rebanho' as any, { p_rebanho_id: rebanhoId })
      return (data || []) as any[]
    },
    enabled: open && !!rebanhoId && TIPOS_COM_ANIMAIS.includes(tipo),
  })

  const qtdNum = parseInt(quantidade || '0') || 0
  const totalCalculado = tipoPreco === 'unitario'
    ? (parseFloat(valorUnitario || '0') || 0) * qtdNum
    : (parseFloat(valorTotal || '0') || 0)

  function PrecoBlock({ labelUnitario }: { labelUnitario: string }) {
    return (
      <>
        <div className="space-y-2">
          <Label>Tipo de preço</Label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setTipoPreco('unitario')}
              className={`p-2 border rounded text-sm ${tipoPreco === 'unitario' ? 'border-primary bg-primary/5 font-medium' : ''}`}>
              Preço por unidade
            </button>
            <button type="button" onClick={() => setTipoPreco('total')}
              className={`p-2 border rounded text-sm ${tipoPreco === 'total' ? 'border-primary bg-primary/5 font-medium' : ''}`}>
              Preço total do lote
            </button>
          </div>
        </div>
        {tipoPreco === 'unitario' ? (
          <div>
            <Label>{labelUnitario}</Label>
            <Input type="number" step="0.01" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} />
            {valorUnitario && qtdNum > 0 && (
              <p className="text-sm mt-1">
                Total: R$ {(parseFloat(valorUnitario) * qtdNum).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        ) : (
          <div>
            <Label>Valor total (R$)</Label>
            <Input type="number" step="0.01" value={valorTotal} onChange={e => setValorTotal(e.target.value)} />
            {valorTotal && qtdNum > 0 && (
              <p className="text-sm mt-1">
                Valor por cabeça: R$ {(parseFloat(valorTotal) / qtdNum).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        )}
      </>
    )
  }

  function SelecaoAnimais() {
    if (!TIPOS_COM_ANIMAIS.includes(tipo) || !animaisRebanho?.length) return null
    return (
      <div className="space-y-2">
        <Label>Selecionar animais (opcional)</Label>
        <p className="text-xs text-muted-foreground">
          Marque os animais específicos ou deixe em branco para movimentação genérica
        </p>
        <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
          {animaisRebanho.map((animal: any) => (
            <label key={animal.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
              <Checkbox
                checked={animaisSelecionados.includes(animal.id)}
                onCheckedChange={checked => {
                  if (checked) setAnimaisSelecionados(prev => [...prev, animal.id])
                  else setAnimaisSelecionados(prev => prev.filter(id => id !== animal.id))
                }}
              />
              <span className="text-sm font-medium">
                {animal.nome || animal.identificador || animal.numero_brinco || 'Sem nome'}
              </span>
              {animal.peso_atual && <span className="text-xs text-muted-foreground">{animal.peso_atual}kg</span>}
            </label>
          ))}
        </div>
        {animaisSelecionados.length > 0 && (
          <p className="text-xs text-muted-foreground">{animaisSelecionados.length} animal(is) selecionado(s)</p>
        )}
      </div>
    )
  }

  async function handleSave() {
    if (!rebanhoId || !quantidade || qtdNum < 1) {
      toast({ title: 'Preencha rebanho e quantidade', variant: 'destructive' })
      return
    }
    if (tipo === 'transferencia' && !rebanhoDestinoId) {
      toast({ title: 'Selecione o rebanho destino', variant: 'destructive' })
      return
    }
    if (tipo === 'venda' && !valorUnitario && !valorTotal) {
      toast({ title: 'Informe o valor da venda', variant: 'destructive' })
      return
    }

    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()

    const { error } = await supabase.rpc('registrar_movimentacao_animais' as any, {
      p_rebanho_id: rebanhoId,
      p_propriedade_id: propriedadeId,
      p_tipo: tipo,
      p_quantidade: qtdNum,
      p_data_evento: dataEvento,
      p_valor_unitario: tipoPreco === 'unitario' && valorUnitario ? parseFloat(valorUnitario) : null,
      p_valor_total: tipoPreco === 'total' && valorTotal ? parseFloat(valorTotal) : null,
      p_tipo_preco: tipoPreco,
      p_peso_medio_kg: pesoMedio ? parseFloat(pesoMedio) : null,
      p_fornecedor_comprador: fornecedor || null,
      p_numero_nota_fiscal: notaFiscal || null,
      p_status_pagamento: statusPagamento || 'pago',
      p_data_vencimento: dataVencimento || null,
      p_rebanho_destino_id: tipo === 'transferencia' ? rebanhoDestinoId : null,
      p_observacoes: observacoes || null,
      p_animal_ids: animaisSelecionados.length > 0 ? animaisSelecionados : null,
    })

    if (error) {
      setLoading(false)
      toast({ title: 'Erro ao registrar movimentação', description: error.message, variant: 'destructive' })
      return
    }

    if (tipo === 'nascimento' && (nomeAnimal || brincoAnimal)) {
      const { data: novoAnimal, error: erroAnimal } = await supabase
        .from('animais' as any)
        .insert({
          rebanho_id: rebanhoId,
          propriedade_id: propriedadeId,
          nome: nomeAnimal || null,
          numero_brinco: brincoAnimal || null,
          identificador: brincoAnimal || nomeAnimal || null,
          sexo: sexoAnimal || 'nao_definido',
          raca: rebanhoAtual?.raca || null,
          especie: rebanhoAtual?.especie,
          data_nascimento: dataEvento,
          data_entrada: dataEvento,
          peso_inicial_kg: pesoNascimento ? parseFloat(pesoNascimento) : null,
          situacao: 'ativo',
          criado_por: userData?.user?.id || null,
        } as any)
        .select('id')
        .single()

      if (!erroAnimal && pesoNascimento && novoAnimal) {
        await supabase.rpc('registrar_pesagem' as any, {
          p_animal_id: (novoAnimal as any).id,
          p_peso_kg: parseFloat(pesoNascimento),
          p_data_pesagem: dataEvento,
          p_observacoes: 'Peso ao nascer',
        })
      }
    }

    setLoading(false)
    toast({ title: 'Movimentação registrada!' })
    queryClient.invalidateQueries({ queryKey: ['rebanhos'] })
    queryClient.invalidateQueries({ queryKey: ['rebanho-movimentacoes'] })
    queryClient.invalidateQueries({ queryKey: ['animais-rebanho'] })
    queryClient.invalidateQueries({ queryKey: ['animais-rebanho-select'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
    onOpenChange(false)
  }

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
              <div>
                <Label>Quantidade *</Label>
                <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
              </div>
              <PrecoBlock labelUnitario="Valor por cabeça (R$)" />
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
            </>
          )}

          {/* VENDA */}
          {tipo === 'venda' && (
            <>
              <div>
                <Label>Quantidade *</Label>
                <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
              </div>
              <PrecoBlock labelUnitario="Valor por cabeça (R$) *" />
              <SelecaoAnimais />
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
              {totalCalculado > 0 && (
                <p className="text-sm font-medium text-green-700">
                  Receita: R$ {totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </>
          )}

          {/* NASCIMENTO */}
          {tipo === 'nascimento' && (
            <>
              <div>
                <Label>Quantidade *</Label>
                <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
              </div>
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-medium mb-2">Identificar o animal (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome</Label>
                    <Input value={nomeAnimal} onChange={e => setNomeAnimal(e.target.value)} placeholder="Ex: Estrelinha" />
                  </div>
                  <div>
                    <Label>Brinco</Label>
                    <Input value={brincoAnimal} onChange={e => setBrincoAnimal(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label>Sexo</Label>
                    <Select value={sexoAnimal} onValueChange={setSexoAnimal}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="macho">Macho</SelectItem>
                        <SelectItem value="femea">Fêmea</SelectItem>
                        <SelectItem value="nao_definido">Não definido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Peso ao nascer (kg)</Label>
                    <Input type="number" step="0.1" value={pesoNascimento} onChange={e => setPesoNascimento(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
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
                  <Input type="number" step="0.01" value={valorUnitario} onChange={e => { setTipoPreco('unitario'); setValorUnitario(e.target.value) }} placeholder="Opcional — registra prejuízo" />
                </div>
              </div>
              <SelecaoAnimais />
              {valorUnitario && (
                <p className="text-sm text-red-600">
                  Prejuízo: R$ {totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — será registrado no financeiro como perda
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
              <SelecaoAnimais />
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
