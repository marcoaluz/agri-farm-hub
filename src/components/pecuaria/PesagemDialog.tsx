import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { CalendarIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

interface PesagemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanhos: any[]
}

export function PesagemDialog({ open, onOpenChange, propriedadeId, rebanhos }: PesagemDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const [rebanhoId, setRebanhoId] = useState('')
  const [dataPesagem, setDataPesagem] = useState<Date>(new Date())
  const [pesoKg, setPesoKg] = useState('')
  const [pesoAnteriorKg, setPesoAnteriorKg] = useState('')
  const [gmdKg, setGmdKg] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (open) {
      setRebanhoId('')
      setDataPesagem(new Date())
      setPesoKg('')
      setPesoAnteriorKg('')
      setGmdKg('')
      setResponsavel('')
      setObservacoes('')
    }
  }, [open])

  // Auto-calculate GMD when rebanho and peso change
  useEffect(() => {
    if (!rebanhoId || !pesoKg) {
      setGmdKg('')
      setPesoAnteriorKg('')
      return
    }

    const fetchUltimaPesagem = async () => {
      const { data: ultima } = await supabase
        .from('pesagens' as any)
        .select('data_pesagem, peso_kg')
        .eq('rebanho_id', rebanhoId)
        .order('data_pesagem', { ascending: false })
        .limit(1)
        .single()

      if (ultima) {
        const pesoAnt = Number((ultima as any).peso_kg)
        setPesoAnteriorKg(pesoAnt.toString())
        const dias = Math.max(1, (dataPesagem.getTime() - new Date((ultima as any).data_pesagem).getTime()) / 86400000)
        const gmd = (Number(pesoKg) - pesoAnt) / dias
        setGmdKg(gmd.toFixed(3))
      } else {
        setPesoAnteriorKg('')
        setGmdKg('')
      }
    }

    fetchUltimaPesagem()
  }, [rebanhoId, pesoKg, dataPesagem])

  async function handleSave() {
    if (!rebanhoId || !pesoKg) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    setSaving(true)
    const { error } = await supabase.from('pesagens' as any).insert({
      propriedade_id: propriedadeId,
      rebanho_id: rebanhoId,
      data_pesagem: format(dataPesagem, 'yyyy-MM-dd'),
      peso_kg: Number(pesoKg),
      peso_anterior_kg: pesoAnteriorKg ? Number(pesoAnteriorKg) : null,
      gmd_kg: gmdKg ? Number(gmdKg) : null,
      responsavel: responsavel || null,
      observacoes: observacoes || null,
    } as any)

    setSaving(false)

    if (error) {
      toast({ title: 'Erro ao salvar pesagem', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Pesagem registrada com sucesso!' })
      queryClient.invalidateQueries({ queryKey: ['pesagens'] })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Pesagem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
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

          <div>
            <Label>Data da pesagem *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataPesagem && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataPesagem ? format(dataPesagem, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataPesagem} onSelect={(d) => d && setDataPesagem(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Peso atual (kg) *</Label>
            <Input type="number" step="0.1" value={pesoKg} onChange={e => setPesoKg(e.target.value)} placeholder="Ex: 450.5" />
          </div>

          <div>
            <Label>Peso anterior (kg)</Label>
            <Input type="number" step="0.1" value={pesoAnteriorKg} onChange={e => setPesoAnteriorKg(e.target.value)} placeholder="Calculado automaticamente" />
            <p className="text-xs text-muted-foreground mt-1">Preenchido automaticamente pela última pesagem do rebanho</p>
          </div>

          <div>
            <Label>GMD (kg/dia)</Label>
            <Input type="number" step="0.001" value={gmdKg} onChange={e => setGmdKg(e.target.value)} placeholder="Calculado automaticamente" />
            <p className="text-xs text-muted-foreground mt-1">Ganho Médio Diário — calculado com base na pesagem anterior</p>
          </div>

          <div>
            <Label>Responsável</Label>
            <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsável" />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações adicionais" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
