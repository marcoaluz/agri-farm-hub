import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useTalhoes } from '@/hooks/useTalhoes'
import { useCreateTransacao, useUpdateTransacao, type Transacao } from '@/hooks/useTransacoes'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const categorias = [
  { value: 'insumos', label: 'Insumos' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'mao_de_obra', label: 'Mão de Obra' },
  { value: 'arrendamento', label: 'Arrendamento' },
  { value: 'maquinario', label: 'Maquinário' },
  { value: 'venda_producao', label: 'Venda de Produção' },
  { value: 'servicos_terceiros', label: 'Serviços de Terceiros' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'outros', label: 'Outros' },
]

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
  numero_nf: z.string().optional(),
  forma_pagamento: z.string().optional(),
  talhao_id: z.string().optional(),
  observacoes: z.string().optional(),
  parcelar: z.boolean().default(false),
  num_parcelas: z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().min(2).max(48).optional()),
}).refine((d) => {
  if (d.status === 'pago' && !d.data_pagamento) return false
  return true
}, { message: 'Data de pagamento obrigatória quando status é Pago', path: ['data_pagamento'] })
.refine((d) => {
  if (d.parcelar && (!d.num_parcelas || d.num_parcelas < 2)) return false
  return true
}, { message: 'Informe entre 2 e 48 parcelas', path: ['num_parcelas'] })

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transacao?: Transacao | null
}

export function TransacaoForm({ open, onOpenChange, transacao }: Props) {
  const { propriedadeAtual, safraAtual } = useGlobal()
  const propId = typeof propriedadeAtual === 'object' ? propriedadeAtual?.id : propriedadeAtual
  const { data: talhoes } = useTalhoes(propId || undefined)
  const createMutation = useCreateTransacao()
  const updateMutation = useUpdateTransacao()

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
      numero_nf: '',
      forma_pagamento: '',
      talhao_id: '',
      observacoes: '',
      parcelar: false,
      num_parcelas: '' as any,
    },
  })

  const watchStatus = form.watch('status')
  const watchParcelar = form.watch('parcelar')
  const watchTipo = form.watch('tipo')
  const watchCategoria = form.watch('categoria')
  const isEditing = !!transacao

  const [unidadeLabel, setUnidadeLabel] = useState('')

  const showCulturaFields = watchTipo === 'receita' && watchCategoria === 'venda_producao'

  const { data: culturasConfig } = useQuery({
    queryKey: ['culturas-config'],
    queryFn: async () => {
      const { data } = await supabase.from('culturas_config')
        .select('id, nome_exibicao, unidade_label').eq('ativo', true)
      return data || []
    },
    enabled: showCulturaFields,
  })

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
    } else {
      form.reset({
        tipo: 'despesa', descricao: '', categoria: '', valor: '' as any,
        status: 'pendente', data_pagamento: null, fornecedor_cliente: '',
        numero_nf: '', forma_pagamento: '', talhao_id: '', observacoes: '',
        parcelar: false, num_parcelas: '' as any,
        cultura_id: '', quantidade_produzida: '' as any,
      })
      setUnidadeLabel('')
    }
  }, [transacao, open])

  const onSubmit = async (data: FormData) => {
    const safraId = typeof safraAtual === 'object' ? safraAtual?.id : safraAtual
    if (!propId || !safraId) { toast.error('Selecione propriedade e safra'); return }

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
      } else {
        await createMutation.mutateAsync({
          ...payload,
          parcelas: data.parcelar ? data.num_parcelas : undefined,
        })
        toast.success(data.parcelar ? `${data.num_parcelas} parcelas criadas` : 'Transação criada')
      }
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent className="bg-popover border border-border">
                      {categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Valor + Vencimento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="valor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} placeholder="0,00" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
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

            {/* Cultura & Quantidade (venda_producao) */}
            {showCulturaFields && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="cultura_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cultura vendida</FormLabel>
                      <Select value={field.value || 'none'} onValueChange={(v) => {
                        const val = v === 'none' ? '' : v
                        field.onChange(val)
                        const c = culturasConfig?.find((x: any) => x.id === val)
                        setUnidadeLabel(c?.unidade_label || '')
                      }}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-popover border border-border">
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {culturasConfig?.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome_exibicao}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="quantidade_produzida" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{`Quantidade vendida (${unidadeLabel || 'unidades'})`}</FormLabel>
                      <FormControl><Input type="number" step="0.01" min="0" {...field} placeholder="0" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ao salvar, o estoque disponível do talhão será atualizado automaticamente.
                </p>
              </div>
            )}

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
                  <FormControl><Input {...field} placeholder="Nome" /></FormControl>
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

            {/* Parcelamento */}
            {!isEditing && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <FormField control={form.control} name="parcelar" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Parcelar em várias vezes</FormLabel>
                  </FormItem>
                )} />
                {watchParcelar && (
                  <FormField control={form.control} name="num_parcelas" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de parcelas (2-48)</FormLabel>
                      <FormControl><Input type="number" min={2} max={48} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
