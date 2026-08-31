import { useEffect, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Plus, Check, X, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ParcelasList } from '@/components/financeiro/ParcelasList'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { useGlobal } from '@/contexts/GlobalContext'
import { useSafraFechada } from '@/hooks/useSafraFechada'
import { useTalhoes } from '@/hooks/useTalhoes'
import { useCreateTransacao, useUpdateTransacao, type Transacao } from '@/hooks/useTransacoes'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Anexos } from '@/components/Anexos'
import { ContatoCombobox } from '@/components/financeiro/ContatoCombobox'



const formasPagamento = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência' },
]

const schema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  descricao: z.string().min(1, 'Descrição obrigatória'),
  categoria: z.string().min(1, 'Categoria obrigatória'),
  valor: z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number({ required_error: 'Valor obrigatório' }).positive('Valor deve ser > 0')),
  data_vencimento: z.date({ required_error: 'Data obrigatória' }),
  status: z.enum(['pendente', 'pago', 'cancelado']),
  data_pagamento: z.date().nullable().optional(),
  fornecedor_cliente: z.string().optional(),
  contato_id: z.string().nullable().optional(),
  numero_nf: z.string().optional(),
  forma_pagamento: z.string().optional(),
  talhao_id: z.string().optional(),
  observacoes: z.string().optional(),
  parcelar: z.boolean().default(false),
  num_parcelas: z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().min(2).max(36).optional()),
  data_primeira_parcela: z.string().optional(),
  cultura_id: z.string().optional(),
  quantidade_produzida: z.preprocess((v) => (v === '' || v === undefined || v === null ? undefined : Number(v)), z.number().positive().optional()),
}).refine((d) => {
  if (d.status === 'pago' && !d.data_pagamento) return false
  return true
}, { message: 'Data de pagamento obrigatória quando status é Pago', path: ['data_pagamento'] })
.refine((d) => {
  if (d.parcelar && (!d.num_parcelas || d.num_parcelas < 2 || d.num_parcelas > 36)) return false
  return true
}, { message: 'Informe entre 2 e 36 parcelas', path: ['num_parcelas'] })
.refine((d) => {
  if (d.parcelar && !d.data_primeira_parcela) return false
  return true
}, { message: 'Informe a data da 1ª parcela', path: ['data_primeira_parcela'] })
.refine((d) => {
  if (d.tipo === 'receita' && d.categoria === 'venda_producao' && !d.cultura_id) return false
  return true
}, { message: 'Selecione a cultura vendida', path: ['cultura_id'] })


type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transacao?: Transacao | null
}

export function TransacaoForm({ open, onOpenChange, transacao }: Props) {
  const { propriedadeAtual, safraAtual } = useGlobal()
  const { verificarSafra } = useSafraFechada(safraAtual)
  const propId = typeof propriedadeAtual === 'object' ? propriedadeAtual?.id : propriedadeAtual
  const queryClient = useQueryClient()

  const { data: talhoes } = useTalhoes(propId || undefined)
  const createMutation = useCreateTransacao()
  const updateMutation = useUpdateTransacao()

  const [modoValor, setModoValor] = useState<'unidade' | 'total'>('unidade')
  const [precoUnitario, setPrecoUnitario] = useState<number>(0)

  const { data: categorias, refetch: refetchCategorias } = useQuery({
    queryKey: ['categorias-transacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_transacao' as any)
        .select('*')
        .eq('ativo', true)
        .order('nome_exibicao')
      if (error) throw error
      return (data || []) as unknown as { valor: string; nome_exibicao: string; id: string; usuario_id: string | null }[]
    },
  })

  const [showNovaCategoria, setShowNovaCategoria] = useState(false)
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [salvandoCategoria, setSalvandoCategoria] = useState(false)
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState<{ id: string; nome_exibicao: string; valor: string } | null>(null)

  const handleAdicionarCategoria = async () => {
    const nome = novaCategoriaNome.trim()
    if (!nome) return
    setSalvandoCategoria(true)
    const { data, error } = await supabase.rpc('criar_categoria_transacao' as any, { p_nome_exibicao: nome })
    setSalvandoCategoria(false)
    if (error) {
      toast.error('Erro ao criar categoria: ' + error.message)
      return
    }
    form.setValue('categoria', (data as any)?.valor ?? (Array.isArray(data) ? (data as any)[0]?.valor : ''))
    setNovaCategoriaNome('')
    setShowNovaCategoria(false)
    refetchCategorias()
    toast.success('Categoria criada')
  }

  const handleExcluirCategoria = async () => {
    if (!categoriaParaExcluir) return
    const { error } = await supabase
      .from('categorias_transacao' as any)
      .update({ ativo: false } as any)
      .eq('id', categoriaParaExcluir.id)
    setCategoriaParaExcluir(null)
    if (error) {
      toast.error('Erro ao remover categoria: ' + error.message)
      return
    }
    if (form.getValues('categoria') === categoriaParaExcluir.valor) form.setValue('categoria', '')
    refetchCategorias()
    toast.success('Categoria removida')
  }


  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: 'despesa',
      descricao: '',
      categoria: '',
      valor: '' as any,
      status: 'pendente',
      data_pagamento: null,
      fornecedor_cliente: '',
      contato_id: null,
      numero_nf: '',
      forma_pagamento: '',
      talhao_id: '',
      observacoes: '',
      parcelar: false,
      num_parcelas: '' as any,
      data_primeira_parcela: '',
    },
  })

  const watchStatus = form.watch('status')
  const watchParcelar = form.watch('parcelar')
  const watchTipo = form.watch('tipo')
  const watchCategoria = form.watch('categoria')
  const watchValor = form.watch('valor')
  const watchQuantidade = form.watch('quantidade_produzida')
  const watchNumParcelas = form.watch('num_parcelas')
  const watchDataPrimeira = form.watch('data_primeira_parcela')
  const isEditing = !!transacao

  const [salvandoParcelado, setSalvandoParcelado] = useState(false)
  const [unidadeLabel, setUnidadeLabel] = useState('')
  const [periodicidade, setPeriodicidade] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>('mensal')
  const [valorEntrada, setValorEntrada] = useState('')
  const MESES_POR_PERIODICIDADE: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 }



  const parcelasPreview = useMemo(() => {
    const n = Number(watchNumParcelas) || 0
    const totalBruto = Number(watchValor) || 0
    const entrada = Number(valorEntrada) || 0
    const total = totalBruto - entrada
    if (n < 2 || total <= 0 || !watchDataPrimeira) return []
    const base = Math.floor((total / n) * 100) / 100
    const passoMeses = MESES_POR_PERIODICIDADE[periodicidade] || 1
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(watchDataPrimeira + 'T12:00:00')
      d.setMonth(d.getMonth() + i * passoMeses)
      return {
        numero: i + 1,
        data: d,
        valor: i === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base,
      }
    })
  }, [watchNumParcelas, watchValor, watchDataPrimeira, periodicidade])





  const showCulturaFields = watchTipo === 'receita' && watchCategoria === 'venda_producao'

  const { data: culturasConfig } = useQuery({
    queryKey: ['culturas-com-estoque', propId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_culturas_com_estoque' as any, { p_propriedade_id: propId })
      if (error) throw error
      return (data || []).map((c: any) => ({
        id: c.cultura_id,
        nome_exibicao: c.nome_exibicao,
        unidade_label: c.unidade_label,
        estoque_disponivel: Number(c.estoque_disponivel),
      }))
    },
    enabled: showCulturaFields && !!propId,
  })

  const culturaSelStock = useMemo(() => {
    const id = form.watch('cultura_id')
    return culturasConfig?.find((c: any) => c.id === id)
  }, [culturasConfig, form.watch('cultura_id')])

  const watchCulturaId = form.watch('cultura_id')
  const nomeCultura = useMemo(() => {
    if (!culturasConfig || !watchCulturaId) return ''
    return culturasConfig.find((c: any) => c.id === watchCulturaId)?.nome_exibicao || ''
  }, [culturasConfig, watchCulturaId])

  // Auto-calculate valor in 'unidade' mode
  useEffect(() => {
    if (!showCulturaFields || modoValor !== 'unidade') return
    const qty = Number(watchQuantidade) || 0
    if (precoUnitario > 0 && qty > 0) {
      form.setValue('valor', Math.round(precoUnitario * qty * 100) / 100)
    }
  }, [modoValor, precoUnitario, watchQuantidade, showCulturaFields])

  const valorTotal = useMemo(() => {
    if (!showCulturaFields) return 0
    const qty = Number(watchQuantidade) || 0
    if (modoValor === 'unidade') return Math.round(precoUnitario * qty * 100) / 100
    return Number(watchValor) || 0
  }, [showCulturaFields, modoValor, precoUnitario, watchQuantidade, watchValor])

  const precoUnitarioCalc = useMemo(() => {
    if (modoValor !== 'total') return 0
    const qty = Number(watchQuantidade) || 0
    if (qty <= 0) return 0
    return (Number(watchValor) || 0) / qty
  }, [modoValor, watchValor, watchQuantidade])

  useEffect(() => {
    if (transacao) {
      form.reset({
        tipo: transacao.tipo,
        descricao: transacao.descricao,
        categoria: transacao.categoria,
        valor: transacao.valor,
        data_vencimento: new Date(transacao.data_vencimento + 'T12:00:00'),
        status: transacao.status === 'vencido' ? 'pendente' : transacao.status as any,
        data_pagamento: transacao.data_pagamento ? new Date(transacao.data_pagamento + 'T12:00:00') : null,
        fornecedor_cliente: transacao.fornecedor_cliente || '',
        contato_id: (transacao as any)?.contato_id || null,
        numero_nf: transacao.numero_nf || '',
        forma_pagamento: transacao.forma_pagamento || '',
        talhao_id: transacao.talhao_id || '',
        observacoes: transacao.observacoes || '',
        parcelar: false,
        num_parcelas: '' as any,
        cultura_id: (transacao as any)?.cultura_id || '',
        quantidade_produzida: (transacao as any)?.quantidade_produzida || ('' as any),
      })
      if ((transacao as any)?.cultura_id && culturasConfig) {
        const c = culturasConfig.find((x: any) => x.id === (transacao as any).cultura_id)
        if (c) setUnidadeLabel(c.unidade_label || '')
      }
      setModoValor('total')
      setPrecoUnitario(0)
    } else {
      form.reset({
        tipo: 'despesa', descricao: '', categoria: '', valor: '' as any,
        status: 'pendente', data_pagamento: null, fornecedor_cliente: '', contato_id: null,
        numero_nf: '', forma_pagamento: '', talhao_id: '', observacoes: '',
        parcelar: false, num_parcelas: '' as any,
        cultura_id: '', quantidade_produzida: '' as any,
      })
      setUnidadeLabel('')
      setModoValor('unidade')
      setPrecoUnitario(0)
    }
  }, [transacao, open])

  const onSubmit = async (data: FormData) => {
    if (!verificarSafra('criar transação')) return
    const safraId = typeof safraAtual === 'object' ? safraAtual?.id : safraAtual
    if (!propId || !safraId) { toast.error('Selecione propriedade e safra'); return }

    // In 'unidade' mode the form valor is already calculated (price * qty)
    const payload = {
      propriedade_id: propId,
      safra_id: safraId,
      tipo: data.tipo,
      descricao: data.descricao,
      categoria: data.categoria,
      valor: data.valor,
      data_vencimento: format(data.data_vencimento, 'yyyy-MM-dd'),
      status: data.status,
      data_pagamento: data.data_pagamento ? format(data.data_pagamento, 'yyyy-MM-dd') : null,
      fornecedor_cliente: data.fornecedor_cliente || null,
      contato_id: data.contato_id || null,
      numero_nf: data.numero_nf || null,
      forma_pagamento: data.forma_pagamento || null,
      talhao_id: data.talhao_id || null,
      observacoes: data.observacoes || null,
      cultura_id: showCulturaFields ? (data.cultura_id || null) : null,
      quantidade_produzida: showCulturaFields ? (data.quantidade_produzida || null) : null,
    } as any

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: transacao!.id, ...payload })
        toast.success('Transação atualizada')
      } else if (showCulturaFields && data.cultura_id) {
        // Venda de produção agrícola sempre passa pela RPC validada (mesma da tela Produção) —
        // valida estoque disponível, registra em vendas_producao e fica cancelável por lá.
        const { error } = await supabase.rpc('registrar_venda_producao' as any, {
          p_propriedade_id: propId,
          p_cultura_id: data.cultura_id,
          p_safra_id: safraId,
          p_quantidade: data.quantidade_produzida,
          p_preco_unitario: modoValor === 'unidade' ? precoUnitario : precoUnitarioCalc,
          p_comprador: data.fornecedor_cliente || null,
          p_numero_nf: data.numero_nf || null,
          p_data_venda: format(data.data_vencimento, 'yyyy-MM-dd'),
          p_observacoes: data.observacoes || null,
          p_parcelado: data.parcelar,
          p_num_parcelas: data.parcelar ? data.num_parcelas : 1,
          p_data_primeira_parcela: data.parcelar ? data.data_primeira_parcela : null,
        })
        if (error) throw error
        toast.success('Venda registrada')
        queryClient.invalidateQueries({ queryKey: ['transacoes'] })
        queryClient.invalidateQueries({ queryKey: ['producao-safra'] })
        queryClient.invalidateQueries({ queryKey: ['culturas-com-estoque'] })
      } else if (data.parcelar && data.num_parcelas && data.data_primeira_parcela) {
        setSalvandoParcelado(true)
        const { data: novaTransacao, error } = await supabase
          .from('transacoes')
          .insert({
            ...payload,
            data_vencimento: data.data_primeira_parcela,
            data_pagamento: null,
            status: 'pendente',
            parcelado: true,
            numero_parcelas: data.num_parcelas,
          } as any)
          .select()
          .single()

        if (error) throw error

        const { error: parcError } = await supabase.rpc('gerar_parcelas' as any, {
          p_transacao_id: (novaTransacao as any).id,
          p_num_parcelas: data.num_parcelas,
          p_data_primeira: data.data_primeira_parcela,
          p_periodicidade: periodicidade,
        })


        if (parcError) {
          toast.error('Transação criada, mas erro ao gerar parcelas: ' + parcError.message)
        } else {
          toast.success(`Transação criada em ${data.num_parcelas}x de R$ ${(Number(data.valor) / data.num_parcelas).toFixed(2)}`)
        }
        queryClient.invalidateQueries({ queryKey: ['transacoes'] })
        queryClient.invalidateQueries({ queryKey: ['resumo-financeiro'] })
        queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] })
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Transação criada')
      }
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar')
    } finally {
      setSalvandoParcelado(false)
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
          <DialogDescription>Preencha os dados da transação financeira.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tipo */}
            <FormField control={form.control} name="tipo" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo *</FormLabel>
                <div className="flex gap-2">
                  <Button type="button" variant={field.value === 'receita' ? 'default' : 'outline'} className={cn('flex-1', field.value === 'receita' && 'bg-success hover:bg-success/90')} onClick={() => field.onChange('receita')}>💰 Receita</Button>
                  <Button type="button" variant={field.value === 'despesa' ? 'default' : 'outline'} className={cn('flex-1', field.value === 'despesa' && 'bg-destructive hover:bg-destructive/90')} onClick={() => field.onChange('despesa')}>💸 Despesa</Button>
                </div>
              </FormItem>
            )} />

            {/* Descrição + Categoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="descricao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: Compra de fertilizante" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="categoria" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria *</FormLabel>
                  {!showNovaCategoria ? (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent className="bg-popover border border-border">
                            {categorias?.map(c => <SelectItem key={c.id} value={c.valor}>{c.nome_exibicao}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="button" variant="outline" size="icon" onClick={() => setShowNovaCategoria(true)} title="Nova categoria">
                        <Plus className="h-4 w-4" />
                      </Button>
                      {field.value && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Remover categoria"
                          onClick={() => {
                            const c = categorias?.find(x => x.valor === field.value)
                            if (c) setCategoriaParaExcluir(c)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome da categoria"
                        value={novaCategoriaNome}
                        onChange={(e) => setNovaCategoriaNome(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarCategoria() } }}
                        autoFocus
                        className="flex-1"
                      />
                      <Button type="button" size="icon" onClick={handleAdicionarCategoria} disabled={salvandoCategoria}>
                        {salvandoCategoria ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={() => { setShowNovaCategoria(false); setNovaCategoriaNome('') }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

            </div>

            {/* Cultura & Quantidade (venda_producao) */}
            {showCulturaFields && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="cultura_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cultura vendida</FormLabel>
                      <Select value={String(field.value || 'none')} onValueChange={(v) => {
                        const val = v === 'none' ? '' : v
                        field.onChange(val)
                        const c = culturasConfig?.find((x: any) => x.id === val)
                        setUnidadeLabel(c?.unidade_label || '')
                      }}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-popover border border-border">
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {culturasConfig?.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome_exibicao} — {c.estoque_disponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {c.unidade_label} disponível
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {culturasConfig?.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Nenhuma cultura com estoque disponível pra venda. Registre uma colheita em Produção primeiro.
                        </p>
                      )}
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="quantidade_produzida" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{`Quantidade vendida (${unidadeLabel || 'unidades'})`}</FormLabel>
                      <FormControl>
                        <Input
                          type="number" step="0.01" min="0"
                          max={culturaSelStock?.estoque_disponivel}
                          value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} placeholder="0"
                        />
                      </FormControl>
                      {culturaSelStock && (
                        <p className="text-xs text-muted-foreground">
                          Máximo disponível: {culturaSelStock.estoque_disponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {unidadeLabel}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Toggle modo valor */}
                <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted/50">
                  <Button
                    type="button"
                    size="sm"
                    variant={modoValor === 'unidade' ? 'default' : 'ghost'}
                    className="flex-1 text-xs"
                    onClick={() => setModoValor('unidade')}
                  >
                    💰 Por Unidade
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={modoValor === 'total' ? 'default' : 'ghost'}
                    className="flex-1 text-xs"
                    onClick={() => setModoValor('total')}
                  >
                    📦 Total
                  </Button>
                </div>

                {/* Valor field for venda_producao */}
                {modoValor === 'unidade' ? (
                  <div className="space-y-1">
                    <FormLabel>{`Preço por ${unidadeLabel || 'unidade'} (R$) *`}</FormLabel>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precoUnitario || ''}
                      onChange={e => setPrecoUnitario(Number(e.target.value) || 0)}
                      placeholder="0,00"
                    />
                    {precoUnitario > 0 && Number(watchQuantidade) > 0 && (
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        Total a receber: R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                ) : (
                  <FormField control={form.control} name="valor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor total recebido (R$) *</FormLabel>
                      <FormControl><Input type="number" step="0.01" min="0" {...field} placeholder="0,00" /></FormControl>
                      <FormMessage />
                      {Number(watchQuantidade) > 0 && Number(watchValor) > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Preço por {unidadeLabel || 'unidade'}: R$ {precoUnitarioCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </FormItem>
                  )} />
                )}

                <p className="text-xs text-muted-foreground">
                  Ao salvar, o estoque disponível do talhão será atualizado automaticamente.
                </p>
              </div>
            )}

            {/* Valor + Vencimento (non venda_producao) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!showCulturaFields && (
                <FormField control={form.control} name="valor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} placeholder="0,00" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="data_vencimento" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data Vencimento *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                          {field.value ? format(field.value, 'dd/MM/yyyy') : 'Selecione'}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Status + Data Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent className="bg-popover border border-border">
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              {watchStatus === 'pago' && (
                <FormField control={form.control} name="data_pagamento" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Pagamento *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                            {field.value ? format(field.value, 'dd/MM/yyyy') : 'Selecione'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            {/* Fornecedor + NF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="fornecedor_cliente" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor / Cliente</FormLabel>
                  <FormControl>
                    <ContatoCombobox
                      propriedadeId={propId}
                      value={field.value || ''}
                      contatoId={form.watch('contato_id') ?? null}
                      onChange={(nome, contatoId) => {
                        field.onChange(nome)
                        form.setValue('contato_id', contatoId)
                      }}
                    />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="numero_nf" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº NF</FormLabel>
                  <FormControl><Input {...field} placeholder="Número" /></FormControl>
                </FormItem>
              )} />
            </div>

            {/* Forma Pagamento + Talhão */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="forma_pagamento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento</FormLabel>
                  <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent className="bg-popover border border-border">
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {formasPagamento.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="talhao_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Talhão</FormLabel>
                  <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger></FormControl>
                    <SelectContent className="bg-popover border border-border">
                      <SelectItem value="none">Nenhum</SelectItem>
                      {talhoes?.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            {/* Observações */}
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea {...field} rows={2} /></FormControl>
              </FormItem>
            )} />

            {/* Forma de pagamento / Parcelamento */}
            {!isEditing && (
              <div className="space-y-3">
                <Label>Forma de pagamento *</Label>
                <RadioGroup
                  value={watchParcelar ? 'parcelado' : 'avista'}
                  onValueChange={(v) => {
                    const parcelado = v === 'parcelado'
                    form.setValue('parcelar', parcelado)
                    if (parcelado) {
                      if (!form.getValues('num_parcelas')) form.setValue('num_parcelas', 2 as any)
                      if (!form.getValues('data_primeira_parcela')) {
                        const base = form.getValues('data_vencimento') || new Date()
                        form.setValue('data_primeira_parcela', format(base, 'yyyy-MM-dd'))
                      }
                    }
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="avista" id="avista" />
                    <Label htmlFor="avista" className="font-normal cursor-pointer">À vista</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="parcelado" id="parcelado" />
                    <Label htmlFor="parcelado" className="font-normal cursor-pointer">Parcelado</Label>
                  </div>
                </RadioGroup>

                {watchParcelar && (
                  <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField control={form.control} name="num_parcelas" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de parcelas *</FormLabel>
                          <FormControl><Input type="number" min={2} max={36} {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="data_primeira_parcela" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data 1ª parcela *</FormLabel>
                          <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div>
                      <Label>Periodicidade</Label>
                      <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover border border-border">
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                          <SelectItem value="semestral">Semestral</SelectItem>
                          <SelectItem value="anual">Anual (ex: compra de terra em 4 anos)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>


                    {parcelasPreview.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium mb-2">
                          {parcelasPreview.length}x de R$ {(Number(watchValor) / parcelasPreview.length).toFixed(2)}
                        </p>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {parcelasPreview.map(p => (
                            <div key={p.numero} className="flex justify-between text-sm text-muted-foreground">
                              <span>Parcela {p.numero}</span>
                              <span>R$ {p.valor.toFixed(2)} — {p.data.toLocaleDateString('pt-BR')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* Resumo da venda */}
            {showCulturaFields && valorTotal > 0 && nomeCultura && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-sm">
                <p className="font-medium text-green-800 dark:text-green-300">Resumo da venda</p>
                <p className="text-green-700 dark:text-green-400">
                  {Number(watchQuantidade) || 0} {unidadeLabel || 'unidades'} de {nomeCultura}
                </p>
                <p className="text-green-700 dark:text-green-400">
                  Valor total: <strong>R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </p>
              </div>
            )}

            {isEditing && transacao && (transacao as any).parcelado && (
              <ParcelasList transacaoId={transacao.id} />
            )}

            {isEditing && transacao && propId && (
              <div className="pt-3 border-t">
                <Anexos entidadeTipo="transacao" entidadeId={transacao.id} propriedadeId={propId} />
              </div>
            )}


            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || salvandoParcelado}>
                {(createMutation.isPending || updateMutation.isPending || salvandoParcelado) ? 'Salvando...' : 'Salvar'}

              </Button>
            </DialogFooter>

          </form>
        </Form>
      </DialogContent>

      <AlertDialog open={!!categoriaParaExcluir} onOpenChange={(o) => { if (!o) setCategoriaParaExcluir(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria "{categoriaParaExcluir?.nome_exibicao}" deixará de aparecer na lista. Transações que já usam ela continuam normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirCategoria}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

