import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface VacinacaoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanho: any
  animalIdInicial?: string
}

export function VacinacaoModal({ open, onOpenChange, propriedadeId, rebanho, animalIdInicial }: VacinacaoModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const [tipoEvento, setTipoEvento] = useState('vacina')
  const [descricao, setDescricao] = useState('')
  const [dataAplicacao, setDataAplicacao] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dataProxima, setDataProxima] = useState('')
  const [custo, setCusto] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [loteProduto, setLoteProduto] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [animaisVacinados, setAnimaisVacinados] = useState<string[]>([])

  const { data: animaisRebanho } = useQuery({
    queryKey: ['animais-rebanho-select', rebanho?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_animais_rebanho' as any, { p_rebanho_id: rebanho.id })
      return (data || []) as any[]
    },
    enabled: open && !!rebanho?.id,
  })

  useEffect(() => {
    if (open) {
      setTipoEvento('vacina')
      setDescricao('')
      setDataAplicacao(format(new Date(), 'yyyy-MM-dd'))
      setDataProxima('')
      setCusto('')
      setResponsavel('')
      setLoteProduto('')
      setObservacoes('')
      setAnimaisVacinados(animalIdInicial ? [animalIdInicial] : [])
    }
  }, [open, animalIdInicial])

  const total = animaisRebanho?.length || 0
  const todosVacinados = total > 0 && animaisVacinados.length === total

  function toggleTodos() {
    if (todosVacinados) setAnimaisVacinados([])
    else setAnimaisVacinados((animaisRebanho || []).map((a: any) => a.id))
  }

  async function handleSave() {
    if (!descricao.trim()) {
      toast({ title: 'Informe a descrição', variant: 'destructive' })
      return
    }
    setSaving(true)
    const { error } = await supabase.rpc('registrar_vacinacao_animais' as any, {
      p_propriedade_id: propriedadeId,
      p_rebanho_id: rebanho.id,
      p_tipo: tipoEvento,
      p_descricao: descricao,
      p_data_aplicacao: dataAplicacao,
      p_data_proxima: dataProxima || null,
      p_custo: custo ? parseFloat(custo) : null,
      p_responsavel: responsavel || null,
      p_lote_produto: loteProduto || null,
      p_observacoes: observacoes || null,
      p_animal_ids: animaisVacinados.length > 0 ? animaisVacinados : null,
    })
    setSaving(false)

    if (error) {
      toast({ title: 'Erro ao registrar', description: error.message, variant: 'destructive' })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['sanitario'] })
    queryClient.invalidateQueries({ queryKey: ['sanitario-eventos'] })
    queryClient.invalidateQueries({ queryKey: ['animais-rebanho'] })
    toast({ title: `Vacinação registrada: ${animaisVacinados.length} animais` })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Vacinação — {rebanho?.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipoEvento} onValueChange={setTipoEvento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacina">Vacina</SelectItem>
                  <SelectItem value="vermifugo">Vermífugo</SelectItem>
                  <SelectItem value="medicamento">Medicamento</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Aftosa" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data aplicação</Label>
              <Input type="date" value={dataAplicacao} onChange={e => setDataAplicacao(e.target.value)} />
            </div>
            <div>
              <Label>Próxima dose</Label>
              <Input type="date" value={dataProxima} onChange={e => setDataProxima(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Custo total (R$)</Label>
              <Input type="number" step="0.01" value={custo} onChange={e => setCusto(e.target.value)} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Lote do produto</Label>
            <Input value={loteProduto} onChange={e => setLoteProduto(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Animais vacinados</Label>
              <Button size="sm" variant="ghost" onClick={toggleTodos} disabled={!total}>
                {todosVacinados ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>
            {total > 0 ? (
              <>
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {(animaisRebanho || []).map((animal: any) => (
                    <label key={animal.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
                      <Checkbox
                        checked={animaisVacinados.includes(animal.id)}
                        onCheckedChange={checked => {
                          if (checked) setAnimaisVacinados(prev => [...prev, animal.id])
                          else setAnimaisVacinados(prev => prev.filter(id => id !== animal.id))
                        }}
                      />
                      <span className="text-sm">{animal.nome || animal.identificador || animal.numero_brinco || 'Sem nome'}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {animaisVacinados.length} de {total} vacinados
                  {animaisVacinados.length < total && (
                    <span className="text-amber-600 font-medium"> — {total - animaisVacinados.length} pendente(s)</span>
                  )}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum animal identificado — o registro será aplicado ao rebanho inteiro.
              </p>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
