import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIPOS_RACAO = [
  { value: 'racao_concentrada', label: 'Ração Concentrada' },
  { value: 'silagem', label: 'Silagem' },
  { value: 'feno', label: 'Feno' },
  { value: 'sal_mineral', label: 'Sal Mineral' },
  { value: 'suplemento', label: 'Suplemento' },
  { value: 'outro', label: 'Outro' },
]

const UNIDADES = [
  { value: 'kg', label: 'kg' },
  { value: 'sacas', label: 'Sacas' },
  { value: 'fardos', label: 'Fardos' },
  { value: 'litros', label: 'Litros' },
]

interface RacaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  safraId: string
  rebanhos: any[]
}

export function RacaoDialog({ open, onOpenChange, propriedadeId, safraId, rebanhos }: RacaoDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [modo, setModo] = useState<'simples' | 'estoque'>('simples')

  // Campos compartilhados
  const [rebanhoId, setRebanhoId] = useState('')
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [observacoes, setObservacoes] = useState('')

  // Campos modo simples
  const [tipoRacao, setTipoRacao] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState('kg')
  const [custo, setCusto] = useState('')
  const [fornecedor, setFornecedor] = useState('')

  // Campos modo estoque
  const [produtoId, setProdutoId] = useState('')
  const [quantidadeConsumo, setQuantidadeConsumo] = useState('')

  const { data: produtos } = useQuery({
    queryKey: ['produtos-racao', propriedadeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('produtos' as any)
        .select('id, nome, unidade_medida, saldo_atual')
        .eq('propriedade_id', propriedadeId)
        .gt('saldo_atual', 0)
        .eq('ativo', true)
        .order('nome')
      return (data as any[]) || []
    },
    enabled: !!propriedadeId && modo === 'estoque',
  })

  const produtoSelecionado = produtos?.find((p: any) => p.id === produtoId)

  const resetForm = () => {
    setRebanhoId('')
    setData(format(new Date(), 'yyyy-MM-dd'))
    setTipoRacao('')
    setQuantidade('')
    setUnidade('kg')
    setCusto('')
    setFornecedor('')
    setObservacoes('')
    setProdutoId('')
    setQuantidadeConsumo('')
  }

  const handleSaveSimples = async () => {
    if (!rebanhoId || !tipoRacao || !custo) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    const rebanhoNome = rebanhos.find((r: any) => r.id === rebanhoId)?.nome || ''
    const tipoLabel = TIPOS_RACAO.find(t => t.value === tipoRacao)?.label || tipoRacao

    const obsCompleta = [
      quantidade ? `${quantidade} ${unidade}` : '',
      observacoes,
    ].filter(Boolean).join(' — ')

    setSaving(true)
    try {
      const { error } = await supabase.from('transacoes' as any).insert({
        propriedade_id: propriedadeId,
        safra_id: safraId,
        tipo: 'despesa',
        categoria: 'alimentacao_animal',
        descricao: `${tipoLabel} - ${rebanhoNome}`,
        valor: parseFloat(custo),
        data_vencimento: data,
        data_pagamento: data,
        status: 'pago',
        origem: 'pecuaria_racao',
        fornecedor_cliente: fornecedor || null,
        observacoes: obsCompleta || null,
      } as any)

      if (error) throw error

      toast({ title: 'Ração registrada com sucesso!' })
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      resetForm()
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: 'Erro ao registrar ração', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEstoque = async () => {
    if (!rebanhoId || !produtoId || !quantidadeConsumo) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    const qtd = parseFloat(quantidadeConsumo)
    if (isNaN(qtd) || qtd <= 0) {
      toast({ title: 'Quantidade inválida', variant: 'destructive' })
      return
    }

    if (produtoSelecionado && qtd > produtoSelecionado.saldo_atual) {
      toast({ title: 'Quantidade maior que o estoque disponível', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      // 1. Buscar lotes FIFO
      const { data: lotes } = await supabase
        .from('lotes' as any)
        .select('id, quantidade_disponivel, custo_unitario')
        .eq('produto_id', produtoId)
        .eq('propriedade_id', propriedadeId)
        .gt('quantidade_disponivel', 0)
        .order('data_entrada', { ascending: true })

      if (!lotes?.length) {
        toast({ title: 'Sem estoque disponível nos lotes', variant: 'destructive' })
        setSaving(false)
        return
      }

      // 2. Calcular consumo FIFO
      let restante = qtd
      let custoTotal = 0
      const updates: { id: string; novaQtd: number }[] = []

      for (const lote of lotes as any[]) {
        if (restante <= 0) break
        const consumido = Math.min(restante, lote.quantidade_disponivel)
        custoTotal += consumido * (lote.custo_unitario || 0)
        updates.push({ id: lote.id, novaQtd: lote.quantidade_disponivel - consumido })
        restante -= consumido
      }

      if (restante > 0) {
        toast({ title: 'Quantidade maior que o estoque disponível nos lotes', variant: 'destructive' })
        setSaving(false)
        return
      }

      // 3. Atualizar lotes
      for (const u of updates) {
        await supabase.from('lotes' as any).update({ quantidade_disponivel: u.novaQtd } as any).eq('id', u.id)
      }

      // 4. Atualizar saldo do produto
      const novoSaldo = (produtoSelecionado?.saldo_atual || 0) - qtd
      await supabase.from('produtos' as any).update({ saldo_atual: novoSaldo } as any).eq('id', produtoId)

      // 5. Registrar despesa financeira
      const rebanhoNome = rebanhos.find((r: any) => r.id === rebanhoId)?.nome || ''
      const produtoNome = produtoSelecionado?.nome || 'Produto'

      await supabase.from('transacoes' as any).insert({
        propriedade_id: propriedadeId,
        safra_id: safraId,
        tipo: 'despesa',
        categoria: 'alimentacao_animal',
        descricao: `${produtoNome} - ${rebanhoNome}`,
        valor: custoTotal > 0 ? custoTotal : 0.01,
        data_vencimento: data,
        data_pagamento: data,
        status: 'pago',
        origem: 'pecuaria_racao_estoque',
        observacoes: `${qtd} ${produtoSelecionado?.unidade_medida || ''} consumidos (FIFO). ${observacoes || ''}`.trim(),
      } as any)

      toast({
        title: 'Baixa no estoque realizada!',
        description: `${qtd} unidades consumidas. Custo: R$ ${custoTotal.toFixed(2)}`,
      })
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-racao'] })
      resetForm()
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: 'Erro ao dar baixa no estoque', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    if (modo === 'simples') handleSaveSimples()
    else handleSaveEstoque()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Ração / Alimentação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Toggle de modo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModo('simples')}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors',
                modo === 'simples'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              💳 Consumo Simples
              <span className="text-xs">Registra custo direto</span>
            </button>
            <button
              type="button"
              onClick={() => setModo('estoque')}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors',
                modo === 'estoque'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              📦 Baixa no Estoque
              <span className="text-xs">Desconta do estoque</span>
            </button>
          </div>

          {/* Campos compartilhados */}
          <div className="space-y-2">
            <Label>Rebanho *</Label>
            <Select value={rebanhoId} onValueChange={setRebanhoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o rebanho" /></SelectTrigger>
              <SelectContent>
                {rebanhos.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>

          {/* Campos modo simples */}
          {modo === 'simples' && (
            <>
              <div className="space-y-2">
                <Label>Tipo de Ração *</Label>
                <Select value={tipoRacao} onValueChange={setTipoRacao}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_RACAO.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input type="number" min="0" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map(u => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Custo Total R$ *</Label>
                <Input type="number" min="0" step="0.01" value={custo} onChange={e => setCusto(e.target.value)} placeholder="0,00" />
              </div>

              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor (opcional)" />
              </div>
            </>
          )}

          {/* Campos modo estoque */}
          {modo === 'estoque' && (
            <>
              <div className="space-y-2">
                <Label>Produto do Estoque *</Label>
                {!produtos?.length ? (
                  <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                    Nenhum produto com saldo disponível. Faça uma entrada no módulo de Estoque primeiro.
                  </p>
                ) : (
                  <Select value={produtoId} onValueChange={setProdutoId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                    <SelectContent>
                      {produtos.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} ({p.saldo_atual} {p.unidade_medida} disponíveis)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Quantidade consumida *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantidadeConsumo}
                  onChange={e => setQuantidadeConsumo(e.target.value)}
                  placeholder="0"
                />
                {produtoSelecionado && (
                  <p className="text-xs text-muted-foreground">
                    Disponível: {produtoSelecionado.saldo_atual} {produtoSelecionado.unidade_medida}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações adicionais..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : modo === 'simples' ? 'Registrar' : 'Dar Baixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
