import { useState, useMemo } from 'react'
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
}

export function OrdenhaDialog({ open, onOpenChange, propriedadeId, rebanhosLeite }: OrdenhaDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { safraAtual } = useGlobal()
  const [loading, setLoading] = useState(false)
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

  // Litros por vaca (só usado quando o rebanho é Individual)
  const [litrosPorVaca, setLitrosPorVaca] = useState<Record<string, string>>({})

  const rebanhoSel = rebanhosLeite.find((r: any) => r.id === form.rebanho_id)
  const individual = rebanhoSel ? rebanhoSel.controle_individual !== false : true

  const { data: animaisRebanho } = useQuery({
    queryKey: ['animais-rebanho-ordenha', form.rebanho_id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_animais_rebanho' as any, { p_rebanho_id: form.rebanho_id })
      return (data || []) as any[]
    },
    enabled: open && !!form.rebanho_id && individual,
  })

  // Produtos de categoria "Leite" no Estoque desta propriedade (pode ter mais de um: Leite A, Leite B...)
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

  const [produtoEstoqueId, setProdutoEstoqueId] = useState('')
  const produtoLeite = produtosLeite?.find(p => p.id === produtoEstoqueId)

  const litrosTotal = individual
    ? Object.values(litrosPorVaca).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    : (parseFloat(form.litros) || 0)

  const vacasOrdenhadas = individual
    ? Object.values(litrosPorVaca).filter(v => (parseFloat(v) || 0) > 0).length
    : (parseInt(form.vacas_ordenhadas) || 0)

  const litrosDescartadosNum = parseFloat(form.litros_descartados) || 0
  const litrosUtil = Math.max(litrosTotal - litrosDescartadosNum, 0)

  // Se só tem um produto de Leite cadastrado, já pré-seleciona (mas o campo continua editável)
  useMemo(() => {
    if (produtosLeite?.length === 1 && !produtoEstoqueId) {
      setProdutoEstoqueId(produtosLeite[0].id)
    }
  }, [produtosLeite])

  function resetForm() {
    setForm({
      rebanho_id: '', data: new Date(), turno: 'unico', litros: '', vacas_ordenhadas: '',
      litros_descartados: '', motivo_descarte: '', qualidade: '', destino: 'venda',
      preco_litro: '', observacoes: '',
    })
    setLitrosPorVaca({})
    setProdutoEstoqueId('')
  }

  async function handleSave() {
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
        vacas_ordenhadas: vacasOrdenhadas || null,
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

    // Detalhe por vaca — só pra rebanho Individual
    if (individual) {
      const linhas = Object.entries(litrosPorVaca)
        .filter(([, v]) => (parseFloat(v) || 0) > 0)
        .map(([animal_id, v]) => ({ ordenha_id: ordenhaId, animal_id, litros: parseFloat(v) }))
      if (linhas.length > 0) {
        const { error: erroDetalhe } = await supabase.from('ordenha_animais' as any).insert(linhas)
        if (erroDetalhe) {
          toast({ title: 'Ordenha salva, mas houve erro ao salvar o detalhe por vaca', description: erroDetalhe.message, variant: 'destructive' })
        }
      }
    }

    // Leite útil (produzido - descartado) entra no Estoque como produção própria (sem despesa)
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
          : `${litrosUtil.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L de Leite adicionados ao Estoque${litrosDescartadosNum > 0 ? ` (${litrosDescartadosNum}L descartados, não entraram)` : ''}.`,
      })
    } else {
      setLoading(false)
      toast({
        title: 'Ordenha registrada!',
        description: produtoLeite
          ? undefined
          : 'Não encontrei um produto "Leite" no Estoque desta propriedade — os litros não entraram no estoque. Vá em Estoque/Insumos → Novo Produto e crie um produto com categoria "Leite" pra isso passar a acontecer automaticamente.',
      })
    }

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
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Ordenha</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rebanho (leite) *</Label>
            <Select value={form.rebanho_id} onValueChange={(v) => { setForm(f => ({ ...f, rebanho_id: v })); setLitrosPorVaca({}) }}>
              <SelectTrigger><SelectValue placeholder="Selecionar rebanho" /></SelectTrigger>
              <SelectContent>
                {rebanhosLeite.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {rebanhoSel && (
              <p className="text-xs text-muted-foreground mt-1">
                {individual ? 'Lote individual — informe o litro de cada vaca.' : 'Lote fechado — informe só o total.'}
              </p>
            )}
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
                  <Calendar mode="single" selected={form.data} onSelect={(d) => d && setForm(f => ({ ...f, data: d }))} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Turno</Label>
              <Select value={form.turno} onValueChange={(v) => setForm(f => ({ ...f, turno: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TURNOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Litros — individual ou agregado */}
          {individual && form.rebanho_id ? (
            <div className="space-y-2">
              <Label>Litros por vaca *</Label>
              {!animaisRebanho?.length ? (
                <p className="text-sm text-muted-foreground">Esse rebanho não tem animais identificados.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto rounded-md border p-2">
                  {animaisRebanho.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{a.nome || a.identificador || a.numero_brinco || 'Sem nome'}</span>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24"
                        value={litrosPorVaca[a.id] || ''}
                        onChange={(e) => setLitrosPorVaca(prev => ({ ...prev, [a.id]: e.target.value }))}
                      />
                      <span className="text-sm text-muted-foreground">L</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Total: {litrosTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L · {vacasOrdenhadas} vaca(s)
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Litros produzidos *</Label>
                <Input type="number" step="0.01" value={form.litros} onChange={(e) => setForm(f => ({ ...f, litros: e.target.value }))} />
              </div>
              <div>
                <Label>Vacas ordenhadas</Label>
                <Input type="number" value={form.vacas_ordenhadas} onChange={(e) => setForm(f => ({ ...f, vacas_ordenhadas: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Leite descartado */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Leite descartado (L)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.litros_descartados}
                  onChange={(e) => setForm(f => ({ ...f, litros_descartados: e.target.value }))}
                />
              </div>
              <div>
                <Label>Motivo do descarte</Label>
                <Select value={form.motivo_descarte} onValueChange={(v) => setForm(f => ({ ...f, motivo_descarte: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar motivo" /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DESCARTE.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {litrosDescartadosNum > 0 && (
              <p className="text-xs text-muted-foreground">
                Vai pro estoque: {litrosUtil.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}L (total menos o descarte)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Qualidade</Label>
              <Input value={form.qualidade} onChange={(e) => setForm(f => ({ ...f, qualidade: e.target.value }))} placeholder="A, B..." />
            </div>
            <div>
              <Label>Destino</Label>
              <Select value={form.destino} onValueChange={(v) => setForm(f => ({ ...f, destino: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESTINOS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Preço por litro R$ (referência — a venda de verdade é feita depois em Estoque/Insumos)</Label>
            <Input type="number" step="0.01" value={form.preco_litro} onChange={(e) => setForm(f => ({ ...f, preco_litro: e.target.value }))} />
          </div>

          {produtosLeite && produtosLeite.length > 0 ? (
            <div>
              <Label>Item do Estoque que vai receber esse leite *</Label>
              <Select value={produtoEstoqueId} onValueChange={setProdutoEstoqueId}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {produtosLeite.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!produtoEstoqueId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Sem selecionar, os litros dessa ordenha não entram no estoque.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
              Nenhum produto "Leite" encontrado no Estoque desta propriedade. Os litros dessa ordenha não vão entrar no estoque até você criar um produto com categoria "Leite" em Estoque/Insumos → Novo Produto.
            </p>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Registrar Ordenha'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
