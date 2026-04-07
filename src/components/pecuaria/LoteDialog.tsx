import { useState, useEffect } from 'react'
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

const ESPECIES = [
  { value: 'bovino_corte', label: 'Bovino Corte' },
  { value: 'bovino_leite', label: 'Bovino Leite' },
  { value: 'ave_postura', label: 'Ave Postura' },
  { value: 'ave_corte', label: 'Ave Corte' },
  { value: 'suino', label: 'Suíno' },
  { value: 'ovino', label: 'Ovino' },
  { value: 'equino', label: 'Equino' },
  { value: 'outro', label: 'Outro' },
]

interface LoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  lote?: any
}

export function LoteDialog({ open, onOpenChange, propriedadeId, lote }: LoteDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    especie: 'bovino_corte',
    raca: '',
    finalidade: '',
    localizacao: '',
    data_formacao: undefined as Date | undefined,
    observacoes: '',
    quantidade_inicial: '',
  })

  useEffect(() => {
    if (lote) {
      setForm({
        nome: lote.nome || '',
        especie: lote.especie || 'bovino_corte',
        raca: lote.raca || '',
        finalidade: lote.finalidade || '',
        localizacao: lote.localizacao || '',
        data_formacao: lote.data_formacao ? new Date(lote.data_formacao) : undefined,
        observacoes: lote.observacoes || '',
        quantidade_inicial: '',
      })
    } else {
      setForm({ nome: '', especie: 'bovino_corte', raca: '', finalidade: '', localizacao: '', data_formacao: undefined, observacoes: '', quantidade_inicial: '' })
    }
  }, [lote, open])

  async function handleSave() {
    if (!form.nome.trim()) {
      toast({ title: 'Nome do lote é obrigatório', variant: 'destructive' })
      return
    }
    setLoading(true)
    const payload = {
      nome: form.nome,
      especie: form.especie,
      raca: form.raca || null,
      finalidade: form.finalidade || null,
      localizacao: form.localizacao || null,
      data_formacao: form.data_formacao ? format(form.data_formacao, 'yyyy-MM-dd') : null,
      observacoes: form.observacoes || null,
      propriedade_id: propriedadeId,
    }

    const { error } = lote
      ? await supabase.from('rebanhos' as any).update(payload).eq('id', lote.id)
      : await supabase.from('rebanhos' as any).insert(payload)

    setLoading(false)
    if (error) {
      toast({ title: 'Erro ao salvar lote', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: lote ? 'Lote atualizado!' : 'Lote criado!' })
      queryClient.invalidateQueries({ queryKey: ['rebanhos'] })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lote ? 'Editar Lote' : 'Novo Lote'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do lote *</Label>
            <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <Label>Espécie</Label>
            <Select value={form.especie} onValueChange={v => setForm(f => ({ ...f, especie: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESPECIES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Raça</Label>
              <Input value={form.raca} onChange={e => setForm(f => ({ ...f, raca: e.target.value }))} />
            </div>
            <div>
              <Label>Finalidade</Label>
              <Input value={form.finalidade} onChange={e => setForm(f => ({ ...f, finalidade: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Localização / Pasto</Label>
            <Input value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} />
          </div>
          <div>
            <Label>Data de formação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.data_formacao && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.data_formacao ? format(form.data_formacao, 'dd/MM/yyyy') : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.data_formacao} onSelect={d => setForm(f => ({ ...f, data_formacao: d }))} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : lote ? 'Salvar Alterações' : 'Criar Lote'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
