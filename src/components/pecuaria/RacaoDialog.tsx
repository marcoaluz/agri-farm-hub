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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Check, X, Trash2, Loader2 } from 'lucide-react'

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

  // Tipos de ração — editável
  const { data: tiposRacao, refetch: refetchTiposRacao } = useQuery({
    queryKey: ['tipos-racao'],
    queryFn: async () => {
      const { data } = await supabase.from('tipos_racao' as any).select('*').eq('ativo', true).order('nome')
      return (data as any[]) || []
    },
  })
  const [showNovoTipo, setShowNovoTipo] = useState(false)
  const [novoTipoNome, setNovoTipoNome] = useState('')
  const [salvandoTipo, setSalvandoTipo] = useState(false)
  const [tipoParaExcluir, setTipoParaExcluir] = useState<{ id: string; nome: string } | null>(null)

  const handleAdicionarTipo = async () => {
    const nome = novoTipoNome.trim()
    if (!nome) return
    setSalvandoTipo(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('tipos_racao' as any).insert({ usuario_id: userData?.user?.id, nome, ativo: true } as any)
    setSalvandoTipo(false)
    if (error) {
      toast({ title: (error as any).code === '23505' ? 'Tipo já existe' : 'Erro ao criar tipo', variant: 'destructive' })
      return
    }
    setTipoRacao(nome)
    setNovoTipoNome('')
    setShowNovoTipo(false)
    refetchTiposRacao()
  }

  const handleExcluirTipo = async () => {
    if (!tipoParaExcluir) return
    const { error } = await supabase.from('tipos_racao' as any).update({ ativo: false } as any).eq('id', tipoParaExcluir.id)
    setTipoParaExcluir(null)
    if (error) {
      toast({ title: 'Erro ao remover tipo', variant: 'destructive' })
      return
    }
    if (tipoRacao === tipoParaExcluir.nome) setTipoRacao('')
    refetchTiposRacao()
  }

  // Produtos do estoque — só categoria de alimentação/ração (não mostra Diesel, Vacina, etc)
  const { data: produtos } = useQuery({
    queryKey: ['produtos-racao', propriedadeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('produtos' as any)
        .select('id, nome, categoria, unidade_medida, saldo_atual')
        .eq('propriedade_id', propriedadeId)
        .gt('saldo_atual', 0)
        .eq('ativo', true)
        .order('nome')
      return ((data as any[]) || []).filter((p: any) =>
        /racao|alimenta|feno|silagem|sal.?mineral|suplemento/i.test(p.categoria || '')
      )
    },
    enabled: !!propriedadeId && open && modo === 'estoque',
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
        descricao: `${tipoRacao} - ${rebanhoNome}`,
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

      // 5. Registrar em Lançamentos (NÃO em Financeiro — o custo já foi pago na entrada do
      //    insumo no estoque; gerar despesa nova aqui duplicaria o custo).
      const rebanhoNome = rebanhos.find((r: any) => r.id === rebanhoId)?.nome || ''
      const produtoNome = produtoSelecionado?.nome || 'Produto'

      const { data: servicoId, error: servicoError } = await supabase.rpc('get_or_create_servico_racao' as any, {
        p_propriedade_id: propriedadeId,
        p_rebanho_nome: rebanhoNome,
      })
      if (servicoError) throw servicoError

      const { error: lancError } = await supabase.from('lancamentos' as any).insert({
        propriedade_id: propriedadeId,
        safra_id: safraId,
        servico_id: servicoId,
        talhao_id: null,
        data_execucao: data,
        custo_total: custoTotal,
        observacoes: `${produtoNome}: ${qtd} ${produtoSelecionado?.unidade_medida || ''} consumidos (FIFO) — ${rebanhoNome}. ${observacoes || ''}`.trim(),
      } as any)
      if (lancError) throw lancError

      toast({
        title: 'Baixa no estoque realizada!',
        description: `${qtd} unidades consumidas. Custo: R$ ${custoTotal.toFixed(2)} (já registrado em Lançamentos)`,
      })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] })
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-racao'] })
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      queryClient.invalidateQueries({ queryKey: ['rel-custos-detalhado'] })
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
                {!showNovoTipo ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select value={tipoRacao} onValueChange={setTipoRacao}>
                        <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                        <SelectContent>
                          {tiposRacao?.length === 0 && (
                            <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum tipo. Use + pra criar.</div>
                          )}
                          {tiposRacao?.map((t: any) => (
                            <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" size="icon" variant="outline" onClick={() => setShowNovoTipo(true)} title="Novo tipo">
                      <Plus className="h-4 w-4" />
                    </Button>
                    {tipoRacao && (
                      <Button
                        type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive"
                        title="Excluir tipo"
                        onClick={() => {
                          const t = tiposRacao?.find((x: any) => x.nome === tipoRacao)
                          if (t) setTipoParaExcluir(t)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome do novo tipo"
                      value={novoTipoNome}
                      onChange={(e) => setNovoTipoNome(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarTipo() } }}
                      autoFocus
                      className="flex-1"
                    />
                    <Button type="button" size="icon" onClick={handleAdicionarTipo} disabled={salvandoTipo || !novoTipoNome.trim()}>
                      {salvandoTipo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => { setShowNovoTipo(false); setNovoTipoNome('') }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
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
                <Label>Produto do Estoque (Alimentação/Ração) *</Label>
                {!produtos?.length ? (
                  <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                    Nenhum produto de categoria Ração/Alimentação com saldo disponível. Cadastre em Estoque/Insumos primeiro.
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
              <p className="text-xs text-muted-foreground">
                O custo desse produto vai aparecer em Lançamentos (já foi pago na compra do insumo), não gera nova despesa no Financeiro.
              </p>
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

      <AlertDialog open={!!tipoParaExcluir} onOpenChange={(o) => { if (!o) setTipoParaExcluir(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de ração?</AlertDialogTitle>
            <AlertDialogDescription>
              "{tipoParaExcluir?.nome}" deixará de aparecer na lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirTipo}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
