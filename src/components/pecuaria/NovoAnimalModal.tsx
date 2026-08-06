import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

interface NovoAnimalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanho: any
}

export function NovoAnimalModal({ open, onOpenChange, propriedadeId, rebanho }: NovoAnimalModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const [nome, setNome] = useState('')
  const [brinco, setBrinco] = useState('')
  const [sexo, setSexo] = useState('nao_definido')
  const [raca, setRaca] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [dataEntrada, setDataEntrada] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [pesoEntrada, setPesoEntrada] = useState('')
  const [valorCompra, setValorCompra] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (open) {
      setNome('')
      setBrinco('')
      setSexo('nao_definido')
      setRaca(rebanho?.raca || '')
      setDataNascimento('')
      setDataEntrada(format(new Date(), 'yyyy-MM-dd'))
      setPesoEntrada('')
      setValorCompra('')
      setObservacoes('')
    }
  }, [open, rebanho])

  async function handleSave() {
    if (!nome && !brinco) {
      toast({ title: 'Informe o nome ou o número do brinco', variant: 'destructive' })
      return
    }
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()

    const { error } = await supabase.from('animais' as any).insert({
      rebanho_id: rebanho.id,
      propriedade_id: propriedadeId,
      nome: nome || null,
      numero_brinco: brinco || null,
      identificador: brinco || nome || null,
      sexo: sexo || 'nao_definido',
      raca: raca || rebanho?.raca || null,
      especie: rebanho?.especie,
      data_nascimento: dataNascimento || null,
      data_entrada: dataEntrada,
      peso_inicial_kg: pesoEntrada ? parseFloat(pesoEntrada) : null,
      valor_compra: valorCompra ? parseFloat(valorCompra) : null,
      observacoes: observacoes || null,
      situacao: 'ativo',
      criado_por: userData?.user?.id || null,
    } as any)

    if (error) {
      setSaving(false)
      toast({ title: 'Erro ao identificar animal', description: error.message, variant: 'destructive' })
      return
    }

    if (pesoEntrada) {
      const { data: novoAnimal } = await supabase
        .from('animais' as any)
        .select('id')
        .eq('rebanho_id', rebanho.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (novoAnimal) {
        await supabase.rpc('registrar_pesagem' as any, {
          p_animal_id: (novoAnimal as any).id,
          p_peso_kg: parseFloat(pesoEntrada),
          p_data_pesagem: dataEntrada,
          p_observacoes: 'Peso de entrada',
        })
      }
    }

    setSaving(false)
    queryClient.invalidateQueries({ queryKey: ['animais-rebanho'] })
    toast({ title: 'Animal identificado' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Identificar Animal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder='Ex: "Mimosa", "Boi 23"' />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Número do brinco</Label>
              <Input value={brinco} onChange={e => setBrinco(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label>Sexo</Label>
              <Select value={sexo} onValueChange={setSexo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="macho">Macho</SelectItem>
                  <SelectItem value="femea">Fêmea</SelectItem>
                  <SelectItem value="nao_definido">Não definido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Raça</Label>
            <Input value={raca} onChange={e => setRaca(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de nascimento</Label>
              <Input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} />
            </div>
            <div>
              <Label>Data de entrada</Label>
              <Input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Peso de entrada (kg)</Label>
              <Input type="number" step="0.1" value={pesoEntrada} onChange={e => setPesoEntrada(e.target.value)} />
            </div>
            <div>
              <Label>Valor de compra (R$)</Label>
              <Input type="number" step="0.01" value={valorCompra} onChange={e => setValorCompra(e.target.value)} />
            </div>
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
