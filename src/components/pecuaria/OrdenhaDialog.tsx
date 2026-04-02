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

interface OrdenhaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanhosLeite: any[]
}

export function OrdenhaDialog({ open, onOpenChange, propriedadeId, rebanhosLeite }: OrdenhaDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    rebanho_id: '',
    data: new Date(),
    turno: 'unico',
    litros: '',
    vacas_ordenhadas: '',
    qualidade: '',
    destino: 'venda',
    preco_litro: '',
    observacoes: '',
  })

  async function handleSave() {
    if (!form.rebanho_id || !form.litros || Number(form.litros) <= 0) {
      toast({ title: 'Selecione o rebanho e informe os litros', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { error } = await supabase.from('ordenhas' as any).insert({
      rebanho_id: form.rebanho_id,
      propriedade_id: propriedadeId,
      data: format(form.data, 'yyyy-MM-dd'),
      turno: form.turno,
      litros: Number(form.litros),
      vacas_ordenhadas: form.vacas_ordenhadas ? Number(form.vacas_ordenhadas) : null,
      qualidade: form.qualidade || null,
      destino: form.destino,
      preco_litro: form.preco_litro ? Number(form.preco_litro) : null,
      observacoes: form.observacoes || null,
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Erro ao registrar ordenha', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Ordenha registrada!' })
      queryClient.invalidateQueries({ queryKey: ['ordenhas'] })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Ordenha</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rebanho (leite) *</Label>
            <Select value={form.rebanho_id} onValueChange={v => setForm(f => ({ ...f, rebanho_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar rebanho" /></SelectTrigger>
              <SelectContent>
                {rebanhosLeite.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
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
            <Label>Preço por litro R$</Label>
            <Input type="number" step="0.01" value={form.preco_litro} onChange={e => setForm(f => ({ ...f, preco_litro: e.target.value }))} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Registrar Ordenha'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
