import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { CalendarIcon, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useAuth } from '@/contexts/AuthContext'

interface PesagemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanhos: any[]
  /** Quando informado, o diálogo entra em modo edição. */
  pesagemEditando?: any | null
}

export function PesagemDialog({ open, onOpenChange, propriedadeId, rebanhos, pesagemEditando }: PesagemDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const editando = !!pesagemEditando

  const [rebanhoId, setRebanhoId] = useState('')
  const [animalId, setAnimalId] = useState('')
  const [dataPesagem, setDataPesagem] = useState(new Date())
  const [pesoKg, setPesoKg] = useState('')
  const [pesoAnteriorKg, setPesoAnteriorKg] = useState('')
  const [gmdKg, setGmdKg] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const rebanhoSel = rebanhos.find((r: any) => r.id === rebanhoId)
  const individual = rebanhoSel ? rebanhoSel.controle_individual !== false : false

  const { data: animaisRebanho } = useQuery({
    queryKey: ['animais-rebanho-pesagem', rebanhoId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_animais_rebanho' as any, { p_rebanho_id: rebanhoId })
      return (data || []) as any[]
    },
    enabled: open && !!rebanhoId && individual,
  })

  useEffect(() => {
    if (!open) return
    if (pesagemEditando) {
      setRebanhoId(pesagemEditando.rebanho_id || '')
      setAnimalId(pesagemEditando.animal_id || '')
      setDataPesagem(pesagemEditando.data_pesagem ? new Date(pesagemEditando.data_pesagem + 'T12:00:00') : new Date())
      setPesoKg(String(pesagemEditando.peso_kg ?? ''))
      setPesoAnteriorKg(pesagemEditando.peso_anterior_kg != null ? String(pesagemEditando.peso_anterior_kg) : '')
      setGmdKg(pesagemEditando.gmd_kg != null ? String(pesagemEditando.gmd_kg) : '')
      setResponsavel(pesagemEditando.responsavel || '')
      setObservacoes(pesagemEditando.observacoes || '')
    } else {
      setRebanhoId('')
      setAnimalId('')
      setDataPesagem(new Date())
      setPesoKg('')
      setPesoAnteriorKg('')
      setGmdKg('')
      setResponsavel('')
      setObservacoes('')
    }
  }, [open, pesagemEditando])

  useEffect(() => {
    if (!editando) setAnimalId('')
  }, [rebanhoId])

  // Auto-calcula GMD com base na última pesagem — do ANIMAL específico se for lote
  // Individual (com fallback pro peso inicial cadastrado, se nunca foi pesado antes),
  // ou do rebanho inteiro se for Fechado. Não roda em modo edição (não sobrescreve).
  useEffect(() => {
    if (editando) return
    if (!rebanhoId || !pesoKg || (individual && !animalId)) {
      setGmdKg('')
      setPesoAnteriorKg('')
      return
    }

    const fetchUltimaPesagem = async () => {
      let query = supabase
        .from('pesagens' as any)
        .select('data_pesagem, peso_kg')
        .eq('rebanho_id', rebanhoId)
        .order('data_pesagem', { ascending: false })
        .limit(1)

      query = individual ? query.eq('animal_id', animalId) : query.is('animal_id', null)

      const { data: ultima } = await query.maybeSingle()

      if (ultima) {
        const pesoAnt = Number((ultima as any).peso_kg)
        setPesoAnteriorKg(pesoAnt.toString())
        const dias = Math.max(1, (dataPesagem.getTime() - new Date((ultima as any).data_pesagem).getTime()) / 86400000)
        setGmdKg(((Number(pesoKg) - pesoAnt) / dias).toFixed(3))
        return
      }

      // Nunca foi pesado antes — usa o peso inicial cadastrado do animal (se tiver)
      if (individual) {
        const animal = animaisRebanho?.find((a: any) => a.id === animalId)
        if (animal?.peso_inicial_kg) {
          const pesoAnt = Number(animal.peso_inicial_kg)
          setPesoAnteriorKg(pesoAnt.toString())
          const dataBase = animal.data_entrada || animal.data_nascimento
          const dias = dataBase ? Math.max(1, (dataPesagem.getTime() - new Date(dataBase + 'T12:00:00').getTime()) / 86400000) : null
          setGmdKg(dias ? ((Number(pesoKg) - pesoAnt) / dias).toFixed(3) : '')
          return
        }
      }

      setPesoAnteriorKg('')
      setGmdKg('')
    }

    fetchUltimaPesagem()
  }, [rebanhoId, animalId, individual, pesoKg, dataPesagem, editando, animaisRebanho])

  async function handleSave() {
    if (!rebanhoId || !pesoKg) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }
    if (individual && !animalId) {
      toast({ title: 'Selecione o animal', description: 'Esse é um lote com controle Individual — escolha qual animal foi pesado.', variant: 'destructive' })
      return
    }

    setSaving(true)

    const payload = {
      data_pesagem: format(dataPesagem, 'yyyy-MM-dd'),
      peso_kg: Number(pesoKg),
      peso_anterior_kg: pesoAnteriorKg ? Number(pesoAnteriorKg) : null,
      gmd_kg: gmdKg ? Number(gmdKg) : null,
      responsavel: responsavel || null,
      observacoes: observacoes || null,
    }

    const { error } = editando
      ? await supabase.from('pesagens' as any).update(payload as any).eq('id', pesagemEditando.id)
      : await supabase.from('pesagens' as any).insert({
          ...payload,
          propriedade_id: propriedadeId,
          rebanho_id: rebanhoId,
          animal_id: individual ? animalId : null,
          criado_por: user?.id,
        } as any)

    setSaving(false)

    if (error) {
      toast({ title: editando ? 'Erro ao atualizar pesagem' : 'Erro ao salvar pesagem', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: editando ? 'Pesagem atualizada!' : 'Pesagem registrada com sucesso!' })
      queryClient.invalidateQueries({ queryKey: ['pesagens'] })
      queryClient.invalidateQueries({ queryKey: ['ranking-peso'] })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editando ? (
              <>
                <Pencil className="h-5 w-5" />
                Editar Pesagem
              </>
            ) : (
              'Registrar Pesagem'
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Rebanho *</Label>
            <Select value={rebanhoId} onValueChange={setRebanhoId} disabled={editando}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o rebanho" />
              </SelectTrigger>
              <SelectContent>
                {rebanhos.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editando && (
              <p className="text-xs text-muted-foreground mt-1">
                Rebanho e animal não podem ser trocados na edição.
              </p>
            )}
          </div>

          {individual && rebanhoId && (
            <div>
              <Label>Animal *</Label>
              {!animaisRebanho?.length && !editando ? (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Esse rebanho não tem animais identificados.
                </div>
              ) : (
                <Select value={animalId} onValueChange={setAnimalId} disabled={editando}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o animal" />
                  </SelectTrigger>
                  <SelectContent>
                    {animaisRebanho?.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome || a.identificador || a.numero_brinco || 'Sem nome'}
                        {a.sexo ? (a.sexo === 'macho' ? ' ♂' : ' ♀') : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div>
            <Label>Data da pesagem *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dataPesagem && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataPesagem ? format(dataPesagem, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataPesagem}
                  onSelect={(d) => d && setDataPesagem(d)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Peso atual (kg) *</Label>
            <Input
              type="number"
              step="0.1"
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              placeholder="Ex: 450.5"
            />
          </div>

          <div>
            <Label>Peso anterior (kg)</Label>
            <Input
              type="number"
              step="0.1"
              value={pesoAnteriorKg}
              onChange={(e) => setPesoAnteriorKg(e.target.value)}
              placeholder="Calculado automaticamente"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {individual
                ? 'Preenchido automaticamente pela última pesagem deste animal (ou pelo peso inicial cadastrado, se ainda não tinha sido pesado)'
                : 'Preenchido automaticamente pela última pesagem do rebanho'}
            </p>
          </div>

          <div>
            <Label>GMD (kg/dia)</Label>
            <Input
              type="number"
              step="0.001"
              value={gmdKg}
              onChange={(e) => setGmdKg(e.target.value)}
              placeholder="Calculado automaticamente"
            />
            <p className="text-xs text-muted-foreground mt-1">Ganho Médio Diário — calculado com base na pesagem anterior</p>
          </div>

          <div>
            <Label>Responsável</Label>
            <Input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome do responsável"
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
