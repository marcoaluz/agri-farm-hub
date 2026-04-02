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

const TIPOS_SANITARIO = [
  { value: 'vacina', label: 'Vacina' },
  { value: 'vermifugacao', label: 'Vermifugação' },
  { value: 'medicamento', label: 'Medicamento' },
  { value: 'exame', label: 'Exame' },
  { value: 'cirurgia', label: 'Cirurgia' },
  { value: 'outro', label: 'Outro' },
]

interface EventoSanitarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanhos: any[]
}

export function EventoSanitarioDialog({ open, onOpenChange, propriedadeId, rebanhos }: EventoSanitarioDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    rebanho_id: '',
    tipo: 'vacina',
    descricao: '',
    data_aplicacao: new Date(),
    data_proxima: undefined as Date | undefined,
    quantidade_dose: '',
    custo: '',
    lote_produto: '',
    responsavel: '',
    observacoes: '',
  })

  async function handleSave() {
    if (!form.descricao.trim()) {
      toast({ title: 'Descrição é obrigatória', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { error } = await supabase.from('sanitario_eventos' as any).insert({
      rebanho_id: form.rebanho_id || null,
      propriedade_id: propriedadeId,
      tipo: form.tipo,
      descricao: form.descricao,
      data_aplicacao: format(form.data_aplicacao, 'yyyy-MM-dd'),
      data_proxima: form.data_proxima ? format(form.data_proxima, 'yyyy-MM-dd') : null,
      quantidade_dose: form.quantidade_dose ? Number(form.quantidade_dose) : null,
      custo: form.custo ? Number(form.custo) : null,
      lote_produto: form.lote_produto || null,
      responsavel: form.responsavel || null,
      observacoes: form.observacoes || null,
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Erro ao registrar evento', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Evento sanitário registrado!' })
      queryClient.invalidateQueries({ queryKey: ['sanitario-eventos'] })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Evento Sanitário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rebanho</Label>
            <Select value={form.rebanho_id} onValueChange={v => setForm(f => ({ ...f, rebanho_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
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
                {TIPOS_SANITARIO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição *</Label>
            <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Febre Aftosa, Ivermectina" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de aplicação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.data_aplicacao, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.data_aplicacao} onSelect={d => d && setForm(f => ({ ...f, data_aplicacao: d }))} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Próxima data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.data_proxima && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.data_proxima ? format(form.data_proxima, 'dd/MM/yyyy') : 'Opcional'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.data_proxima} onSelect={d => setForm(f => ({ ...f, data_proxima: d }))} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dose (ml)</Label>
              <Input type="number" step="0.01" value={form.quantidade_dose} onChange={e => setForm(f => ({ ...f, quantidade_dose: e.target.value }))} />
            </div>
            <div>
              <Label>Custo R$</Label>
              <Input type="number" step="0.01" value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Lote do produto</Label>
              <Input value={form.lote_produto} onChange={e => setForm(f => ({ ...f, lote_produto: e.target.value }))} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Registrar Evento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
