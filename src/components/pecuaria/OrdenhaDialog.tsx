import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useGlobal } from '@/contexts/GlobalContext'

const TURNOS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'unico', label: 'Único' },
]

const DESTINOS = [
  { value: 'venda', label: 'Venda' },
  { value: 'consumo_proprio', label: 'Consumo Próprio' },
  { value: 'descarte', label: 'Descarte' },
  { value: 'queijo', label: 'Queijo' },
  { value: 'outros', label: 'Outros' },
]

const MOTIVOS_DESCARTE = [
  { value: 'tratamento', label: 'Animal em tratamento' },
  { value: 'mastite', label: 'Mastite' },
  { value: 'antibiotico', label: 'Antibiótico' },
  { value: 'qualidade', label: 'Problema de qualidade' },
  { value: 'outro', label: 'Outro' },
]

interface OrdenhaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanhosLeite: any[]
  /** Quando informado, o diálogo entra em modo edição. */
  ordenhaEditando?: any | null
}

// Ajusta o lote de estoque gerado por uma ordenha. novoLitrosUtil=null -> exclusão.
// Se parte do leite já foi consumida/vendida, preserva o que já saiu (não dá pra "desvender").
async function ajustarLoteOrdenha(loteId: string | null, novoLitrosUtil: number | null): Promise<{ avisoConsumido: boolean }> {
  if (!loteId) return { avisoConsumido: false }

  const { data: lote } = await supabase
    .from('lotes' as any)
    .select('quantidade_original, quantidade_disponivel')
    .eq('id', loteId)
    .maybeSingle()

  if (!lote) return { avisoConsumido: false }

  const consumido = Math.max(Number((lote as any).quantidade_original) - Number((lote as any).quantidade_disponivel), 0)
  const alvo = novoLitrosUtil ?? 0

  if (alvo <= 0) {
    if (consumido <= 0) {
      await supabase.from('lotes' as any).delete().eq('id', loteId)
      return { avisoConsumido: false }
    }
    await supabase.from('lotes' as any).update({ quantidade_original: consumido, quantidade_disponivel: 0 } as any).eq('id', loteId)
    return { avisoConsumido: true }
  }

  const novoDisponivel = Math.max(alvo - consumido, 0)
  await supabase.from('lotes' as any).update({ quantidade_original: alvo, quantidade_disponivel: novoDisponivel } as any).eq('id', loteId)
  return { avisoConsumido: novoDisponivel < (alvo - consumido) }
}

export function OrdenhaDialog({ open, onOpenChange, propriedadeId, rebanhosLeite, ordenhaEditando }: OrdenhaDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { safraAtual } = useGlobal()
  const [loading, setLoading] = useState(false)
  const editando = !!ordenhaEditando

  const [form, setForm] = useState({
    rebanho_id: '',
    data: new Date(),
    turno: 'unico',
    litros: '',
    vacas_ordenhadas: '',
    litros_descartados: '',
    motivo_descarte: '',
    qualidade: '',
    destino: 'venda',
    preco_litro: '',
    observacoes: '',
  })
  const [litrosPorVaca, setLitrosPorVaca] = useState<Record<string, string>>({})
  const [produtoEstoqueId, setProdutoEstoqueId] = useState('')

  useEffect(() => {
    if (open && ordenhaEditando) {
      setForm({
        rebanho_id: ordenhaEditando.rebanho_id || '',
        data: ordenhaEditando.data ? new Date(ordenhaEditando.data + 'T12:00:00') : new Date(),
        turno: ordenhaEditando.turno || 'unico',
        litros: String(ordenhaEditando.litros ?? ''),
        vacas_ordenhadas: String(ordenhaEditando.vacas_ordenhadas ?? ''),
        litros_descartados: String(ordenhaEditando.litros_descartados ?? ''),
        motivo_descarte: ordenhaEditando.motivo_descarte || '',
        qualidade: ordenhaEditando.qualidade || '',
        destino: ordenhaEditando.destino || 'venda',
        preco_litro: String(ordenhaEditando.preco_litro ?? ''),
        observacoes: ordenhaEditando.observacoes || '',
      })
    } else if (open) {
      resetForm()
    }
  }, [open, ordenhaEditando])

  const rebanhoSel = rebanhosLeite.find((r: any) => r.id === form.rebanho_id)
  const individual = rebanhoSel ? rebanhoSel.controle_individual !== false : true

  const { data: animaisRebanho } = useQuery({
    queryKey: ['animais-rebanho-ordenha', form.rebanho_id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_animais_rebanho' as any, { p_rebanho_id: form.rebanho_id })
      return (data || []) as any[]
    },
    enabled: open && !!form.rebanho_id && individual && !editando,
  })

  const { data: produtosLeite } = useQuery({
    queryKey: ['produtos-leite', propriedadeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('produtos' as any)
        .select('id, nome, categoria, unidade_medida')
        .eq('propriedade_id', propriedadeId)
        .eq('ativo', true)
        .ilike('categoria', '%leite%')
        .order('nome')
      return (data || []) as any[]
    },
    enabled: open && !!propriedadeId,
  })
  const produtoLeite = produtosLeite?.find(p => p.id === produtoEstoqueId)

  useMemo(() => {
    if (!editando && produtosLeite?.length === 1 && !produtoEstoqueId) {
      setProdutoEstoqueId(produtosLeite[0].id)
    }
  }, [produtosLeite, editando])

  const litrosTotal = (!editando && individual)
    ? Object.values(litrosPorVaca).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    : (parseFloat(form.litros) || 0)

  const litrosDescartadosNum = parseFloat(form.litros_descartados) || 0
  const litrosUtil = Math.max(litrosTotal - litrosDescartadosNum, 0)

  function resetForm() {
    setForm({
      rebanho_id: '', data: new Date(), turno: 'unico', litros: '', vacas_ordenhadas: '',
      litros_descartados: '', motivo_descarte: '', qualidade: '', destino: 'venda',
      preco_litro: '', observacoes: '',
    })
    setLitrosPorVaca({})
    setProdutoEstoqueId('')
  }

  async function handleSalvarNovo() {
    if (!form.rebanho_id) {
      toast({ title: 'Selecione o rebanho', variant: 'destructive' })
      return
    }
    if (litrosTotal <= 0) {
      toast({ title: individual ? 'Informe o litro de pelo menos uma vaca' : 'Informe os litros', variant: 'destructive' })
      return
    }
    if (litrosDescartadosNum > 0 && !form.motivo_descarte) {
      toast({ title: 'Informe o motivo do descarte', variant: 'destructive' })
      return
    }

    setLoading(true)

    const { data: novaOrdenha, error } = await supabase
      .from('ordenhas' as any)
      .insert({
        rebanho_id: form.rebanho_id,
        propriedade_id: propriedadeId,
        data: format(form.data, 'yyyy-MM-dd'),
        turno: form.turno,
        litros: litrosTotal,
        vacas_ordenhadas: individual ? Object.values(litrosPorVaca).filter(v => (parseFloat(v) || 0) > 0).length : (parseInt(form.vacas_ordenhadas) || null),
        litros_descartados: litrosDescartadosNum,
        motivo_descarte: litrosDescartadosNum > 0 ? form.motivo_descarte : null,
        qualidade: form.qualidade || null,
        destino: form.destino,
        preco_litro: form.preco_litro ? Number(form.preco_litro) : null,
        observacoes: form.observacoes || null,
      })
      .select('id')
      .single()

    if (error) {
      setLoading(false)
      toast({ title: 'Erro ao registrar ordenha', description: error.message, variant: 'destructive' })
      return
    }

    const ordenhaId = (novaOrdenha as any).id

    if (individual) {
      const linhas = Object.entries(litrosPorVaca)
        .filter(([, v]) => (parseFloat(v) || 0) > 0)
        .map(([animal_id, v]) => ({ ordenha_id: ordenhaId, animal_id, litros: parseFloat(v) }))
      if (linhas.length > 0) {
        await supabase.from('ordenha_animais' as any).insert(linhas)
      }
    }

    if (produtoLeite && safraAtual?.id && litrosUtil > 0) {
      const { data: novoLote, error: erroLote } = await supabase.rpc('registrar_entrada_estoque' as any, {
        p_propriedade_id: propriedadeId,
        p_produto_id: produtoLeite.id,
        p_safra_id: safraAtual.id,
        p_quantidade: litrosUtil,
        p_custo_unitario: 0,
        p_data_entrada: format(form.data, 'yyyy-MM-dd'),
        p_tipo_entrada: 'producao_propria',
      })

      if (!erroLote && novoLote) {
        await supabase.from('ordenhas' as any).update({ lote_id: (novoLote as any).id }).eq('id', ordenhaId)
      }

      setLoading(false)
      toast({
        title: 'Ordenha registrada!',
        description: erroLote
          ? `Litros não entraram no Estoque: ${erroLote.message}`
          : `${litrosUtil.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L de ${produtoLeite.nome} adicionados ao Estoque.`,
      })
    } else {
      setLoading(false)
      toast({
        title: 'Ordenha registrada!',
        description: produtosLeite && produtosLeite.length > 0
          ? undefined
          : 'Nenhum produto "Leite" no Estoque desta propriedade — os litros não entraram no estoque.',
      })
    }

    finalizarESair()
  }

  async function handleSalvarEdicao() {
    if (!ordenhaEditando) return
    if (litrosTotal <= 0) {
      toast({ title: 'Informe os litros', variant: 'destructive' })
      return
    }
    if (litrosDescartadosNum > 0 && !form.motivo_descarte) {
      toast({ title: 'Informe o motivo do descarte', variant: 'destructive' })
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('ordenhas' as any)
      .update({
        data: format(form.data, 'yyyy-MM-dd'),
        turno: form.turno,
        litros: litrosTotal,
        vacas_ordenhadas: form.vacas_ordenhadas ? parseInt(form.vacas_ordenhadas) : null,
        litros_descartados: litrosDescartadosNum,
        motivo_descarte: litrosDescartadosNum > 0 ? form.motivo_descarte : null,
        qualidade: form.qualidade || null,
        destino: form.destino,
        preco_litro: form.preco_litro ? Number(form.preco_litro) : null,
        observacoes: form.observacoes || null,
      } as any)
      .eq('id', ordenhaEditando.id)

    if (error) {
      setLoading(false)
      toast({ title: 'Erro ao atualizar ordenha', description: error.message, variant: 'destructive' })
      return
    }

    const { avisoConsumido } = await ajustarLoteOrdenha(ordenhaEditando.lote_id, litrosUtil > 0 ? litrosUtil : null)

    setLoading(false)
    toast({
      title: 'Ordenha atualizada!',
      description: avisoConsumido
        ? 'Atenção: parte desse leite já tinha sido vendida/consumida — o estoque foi ajustado no que ainda era possível.'
        : 'Estoque ajustado para o novo valor.',
    })
    finalizarESair()
  }

  function finalizarESair() {
    queryClient.invalidateQueries({ queryKey: ['ordenhas'] })
    queryClient.invalidateQueries({ queryKey: ['ranking-leite'] })
    queryClient.invalidateQueries({ queryKey: ['produtos-leite'] })
    queryClient.invalidateQueries({ queryKey: ['produtos'] })
    queryClient.invalidateQueries({ queryKey: ['produtos-custos'] })
    queryClient.invalidateQueries({ queryKey: ['lotes'] })
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) resetForm() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar Ordenha' : 'Registrar Ordenha'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rebanho (leite) *</Label>
            <Select value={form.rebanho_id} onValueChange={v => { setForm(f => ({ ...f, rebanho_id: v })); setLitrosPorVaca({}) }} disabled={editando}>
              <SelectTrigger><SelectValue placeholder="Selecionar rebanho" /></SelectTrigger>
              <SelectContent>
                {rebanhosLeite.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {editando && <p className="text-xs text-muted-foreground mt-1">Rebanho não pode ser trocado na edição.</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.data, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.data} onSelect={d => d && setForm(f => ({ ...f, data: d }))} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Turno</Label>
              <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TURNOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!editando && individual && form.rebanho_id ? (
            <div className="space-y-2">
              <Label>Litros por vaca *</Label>
              {!animaisRebanho?.length ? (
                <p className="text-sm text-muted-foreground">Esse rebanho não tem animais identificados.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {animaisRebanho.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 p-1">
                      <span className="text-sm flex-1 truncate">{a.nome || a.identificador || a.numero_brinco || 'Sem nome'}</span>
                      <Input
                        type="number" step="0.01" placeholder="0,00" className="w-24 h-8"
                        value={litrosPorVaca[a.id] || ''}
                        onChange={e => setLitrosPorVaca(prev => ({ ...prev, [a.id]: e.target.value }))}
                      />
                      <span className="text-xs text-muted-foreground w-4">L</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm font-medium">Total: {litrosTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Litros produzidos *</Label>
                <Input type="number" step="0.01" value={form.litros} onChange={e => setForm(f => ({ ...f, litros: e.target.value }))} />
              </div>
              <div>
                <Label>Vacas ordenhadas</Label>
                <Input type="number" value={form.vacas_ordenhadas} onChange={e => setForm(f => ({ ...f, vacas_ordenhadas: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 bg-muted/20">
            <div>
              <Label>Leite descartado (L)</Label>
              <Input type="number" step="0.01" placeholder="0" value={form.litros_descartados} onChange={e => setForm(f => ({ ...f, litros_descartados: e.target.value }))} />
            </div>
            <div>
              <Label>Motivo do descarte</Label>
              <Select value={form.motivo_descarte} onValueChange={v => setForm(f => ({ ...f, motivo_descarte: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS_DESCARTE.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {litrosDescartadosNum > 0 && (
              <p className="col-span-2 text-xs text-muted-foreground">
                Vai pro estoque: {litrosUtil.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Qualidade</Label>
              <Input value={form.qualidade} onChange={e => setForm(f => ({ ...f, qualidade: e.target.value }))} placeholder="A, B..." />
            </div>
            <div>
              <Label>Destino</Label>
              <Select value={form.destino} onValueChange={v => setForm(f => ({ ...f, destino: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESTINOS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Preço por litro R$ <span className="text-xs text-muted-foreground font-normal">(referência)</span></Label>
            <Input type="number" step="0.01" value={form.preco_litro} onChange={e => setForm(f => ({ ...f, preco_litro: e.target.value }))} />
          </div>

          {!editando && (
            produtosLeite && produtosLeite.length > 0 ? (
              <div>
                <Label>Item do Estoque que vai receber esse leite *</Label>
                <Select value={produtoEstoqueId} onValueChange={setProdutoEstoqueId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {produtosLeite.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Nenhum produto "Leite" no Estoque — os litros não vão entrar no estoque até você criar um produto categoria "Leite".
              </p>
            )
          )}
          {editando && (
            <p className="text-xs text-muted-foreground">
              Editar os litros ajusta automaticamente o lote de estoque gerado por essa ordenha.
            </p>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <Button onClick={editando ? handleSalvarEdicao : handleSalvarNovo} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Registrar Ordenha'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
