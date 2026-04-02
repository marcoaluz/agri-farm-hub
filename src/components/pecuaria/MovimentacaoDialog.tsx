import { useState } from 'react'
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
import { useQueryClient } from '@tanstack/react-query'

const TIPOS = [
  { value: 'nascimento', label: 'Nascimento' },
  { value: 'compra', label: 'Compra' },
  { value: 'venda', label: 'Venda' },
  { value: 'morte', label: 'Morte' },
  { value: 'transferencia_entrada', label: 'Transferência Entrada' },
  { value: 'transferencia_saida', label: 'Transferência Saída' },
  { value: 'ajuste_entrada', label: 'Ajuste Entrada' },
  { value: 'ajuste_saida', label: 'Ajuste Saída' },
]

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
  const [form, setForm] = useState({
    rebanho_id: rebanhoIdInicial || '',
    tipo: 'nascimento',
    quantidade: '1',
    data_evento: new Date(),
    valor_unitario: '',
    peso_medio_kg: '',
    fornecedor_comprador: '',
    observacoes: '',
  })

  async function handleSave() {
    if (!form.rebanho_id || !form.quantidade || Number(form.quantidade) < 1) {
      toast({ title: 'Preencha rebanho e quantidade', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { error } = await supabase.from('rebanho_movimentacoes' as any).insert({
      rebanho_id: form.rebanho_id,
      propriedade_id: propriedadeId,
      tipo: form.tipo,
      quantidade: Number(form.quantidade),
      data_evento: format(form.data_evento, 'yyyy-MM-dd'),
      valor_unitario: form.valor_unitario ? Number(form.valor_unitario) : null,
      peso_medio_kg: form.peso_medio_kg ? Number(form.peso_medio_kg) : null,
      fornecedor_comprador: form.fornecedor_comprador || null,
      observacoes: form.observacoes || null,
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Erro ao registrar movimentação', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Movimentação registrada!' })
      queryClient.invalidateQueries({ queryKey: ['rebanhos'] })
      queryClient.invalidateQueries({ queryKey: ['rebanho-movimentacoes'] })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Movimentação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rebanho *</Label>
            <Select value={form.rebanho_id} onValueChange={v => setForm(f => ({ ...f, rebanho_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar rebanho" /></SelectTrigger>
              <SelectContent>
                {rebanhos.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" min="1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
            </div>
            <div>
              <Label>Data do evento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.data_evento, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.data_evento} onSelect={d => d && setForm(f => ({ ...f, data_evento: d }))} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor unitário R$</Label>
              <Input type="number" step="0.01" value={form.valor_unitario} onChange={e => setForm(f => ({ ...f, valor_unitario: e.target.value }))} />
            </div>
            <div>
              <Label>Peso médio (kg)</Label>
              <Input type="number" step="0.01" value={form.peso_medio_kg} onChange={e => setForm(f => ({ ...f, peso_medio_kg: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Fornecedor / Comprador</Label>
            <Input value={form.fornecedor_comprador} onChange={e => setForm(f => ({ ...f, fornecedor_comprador: e.target.value }))} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Registrar Movimentação'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
