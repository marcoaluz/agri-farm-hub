import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

interface PesagemAnimalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  animal: any
}

export function PesagemAnimalModal({ open, onOpenChange, animal }: PesagemAnimalModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [dataPesagem, setDataPesagem] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [peso, setPeso] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (open) {
      setDataPesagem(format(new Date(), 'yyyy-MM-dd'))
      setPeso('')
      setObservacoes('')
    }
  }, [open])

  async function handleSave() {
    if (!peso) {
      toast({ title: 'Informe o peso', variant: 'destructive' })
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('registrar_pesagem' as any, {
      p_animal_id: animal.id,
      p_peso_kg: parseFloat(peso),
      p_data_pesagem: dataPesagem,
      p_observacoes: observacoes || null,
    })
    setSaving(false)

    if (error) {
      toast({ title: 'Erro ao registrar pesagem', description: error.message, variant: 'destructive' })
      return
    }

    queryClient.invalidateQueries({ queryKey: ['animais-rebanho'] })
    queryClient.invalidateQueries({ queryKey: ['pesagens-animal', animal.id] })

    const ganho = (data as any)?.ganho ?? null
    toast({
      title: ganho !== null && ganho !== undefined
        ? `Pesagem registrada: ${peso}kg (${ganho > 0 ? '+' : ''}${ganho}kg desde última)`
        : `Pesagem registrada: ${peso}kg`,
    })
    onOpenChange(false)
  }

  const nomeAnimal = animal?.nome || animal?.identificador || animal?.numero_brinco || 'animal'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pesar — {nomeAnimal}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Data</Label>
            <Input type="date" value={dataPesagem} onChange={e => setDataPesagem(e.target.value)} />
          </div>
          <div>
            <Label>Peso (kg) *</Label>
            <Input type="number" step="0.1" value={peso} onChange={e => setPeso(e.target.value)} placeholder="Ex: 450.5" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} />
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
