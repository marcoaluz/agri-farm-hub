import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'


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
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [animaisSelecionados, setAnimaisSelecionados] = useState<string[]>([])
  const [statusAnimais, setStatusAnimais] = useState<Record<string, any>>({})
  const [usarEstoque, setUsarEstoque] = useState(false)
  const [produtoId, setProdutoId] = useState('')
  const [quantidadeUsada, setQuantidadeUsada] = useState('')
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

  const { data: produtosPecuarios } = useQuery({
    queryKey: ['produtos-pecuarios', propriedadeId],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('listar_produtos_usuario', {
        p_propriedade_id: propriedadeId,
      })
      return ((data || []) as any[]).filter((p: any) => p.tipo_estoque === 'pecuario')
    },
    enabled: open && !!propriedadeId,
  })


  // Apenas rebanhos que participam do controle sanitário
  const rebanhosVacinaveis = (rebanhos || []).filter((r: any) => r?.vacinavel === true)

  const { data: protocolos } = useQuery({
    queryKey: ['protocolos-sanitarios'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('protocolos_sanitarios')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      return (data || []) as any[]
    },
    enabled: open,
  })

  const protocoloAtual = protocolos?.find((p: any) => p.nome === form.descricao)

  const { data: animaisDoRebanho } = useQuery({
    queryKey: ['animais-rebanho', form.rebanho_id],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('get_animais_rebanho', {
        p_rebanho_id: form.rebanho_id,
      })
      return (data || []) as any[]
    },
    enabled: !!form.rebanho_id && open,
  })

  useEffect(() => { setAnimaisSelecionados([]) }, [form.rebanho_id])

  useEffect(() => {
    if (!animaisDoRebanho?.length || !form.descricao) { setStatusAnimais({}); return }
    let cancelado = false
    const verificar = async () => {
      const status: Record<string, any> = {}
      for (const animal of animaisDoRebanho) {
        const { data } = await (supabase as any).rpc('verificar_vacinacao_animal', {
          p_animal_id: animal.id,
          p_protocolo_nome: form.descricao,
        })
        status[animal.id] = Array.isArray(data) ? data[0] : data
      }
      if (!cancelado) setStatusAnimais(status)
    }
    verificar()
    return () => { cancelado = true }
  }, [animaisDoRebanho, form.descricao])

  const animaisLiberados = (animaisDoRebanho || []).filter(
    (a: any) => statusAnimais[a.id]?.pode_vacinar !== false
  )
  const bloqueados = Object.values(statusAnimais).filter((s: any) => s?.pode_vacinar === false).length

  async function handleSave() {
    if (!form.descricao.trim()) {
      toast.error('Descrição / Protocolo é obrigatório')
      return
    }
    setLoading(true)
    const { data: resultadoRaw, error } = await (supabase as any).rpc('registrar_vacinacao_animais', {
      p_propriedade_id: propriedadeId,
      p_rebanho_id: form.rebanho_id || null,
      p_tipo: form.tipo,
      p_descricao: form.descricao,
      p_data_aplicacao: format(form.data_aplicacao, 'yyyy-MM-dd'),
      p_data_proxima: form.data_proxima ? format(form.data_proxima, 'yyyy-MM-dd') : null,
      p_custo: form.custo ? Number(form.custo) : null,
      p_responsavel: form.responsavel || null,
      p_lote_produto: form.lote_produto || null,
      p_observacoes: form.observacoes || null,
      p_animal_ids: animaisSelecionados.length > 0 ? animaisSelecionados : null,
    })
    setLoading(false)
    if (error) {
      toast.error('Erro: ' + error.message)
      return
    }
    const resultado = (Array.isArray(resultadoRaw) ? resultadoRaw[0] : resultadoRaw) || {}
    queryClient.invalidateQueries({ queryKey: ['sanitario'] })
    queryClient.invalidateQueries({ queryKey: ['sanitario-eventos'] })
    queryClient.invalidateQueries({ queryKey: ['sanitario-contagem'] })
    queryClient.invalidateQueries({ queryKey: ['animais-rebanho'] })

    if (resultado.animais_bloqueados > 0) {
      toast.warning(
        `${resultado.animais_vacinados || 0} vacinado(s), ${resultado.animais_bloqueados} bloqueado(s) por intervalo mínimo`
      )
    } else {
      toast.success(
        `Evento registrado: ${resultado.animais_vacinados ?? animaisSelecionados.length} animais`
        + (resultado.proxima_data ? ` • Próxima: ${new Date(resultado.proxima_data).toLocaleDateString('pt-BR')}` : '')
      )
    }
    setAnimaisSelecionados([])
    setStatusAnimais({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:w-auto">
        <DialogHeader>
          <DialogTitle>Registrar Evento Sanitário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rebanho</Label>
            <Select value={form.rebanho_id} onValueChange={v => setForm(f => ({ ...f, rebanho_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
              <SelectContent>
                {rebanhosVacinaveis.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
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
            <Label>Descrição / Protocolo *</Label>
            <Select value={form.descricao} onValueChange={v => setForm(f => ({ ...f, descricao: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione o protocolo" /></SelectTrigger>
              <SelectContent>
                {(protocolos || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.nome}>
                    <span className="flex items-center gap-2">
                      <span>{p.nome}</span>
                      {p.obrigatorio && <Badge variant="destructive" className="text-xs">Obrigatória</Badge>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {protocoloAtual && (
              <p className="text-xs text-muted-foreground mt-1">
                {protocoloAtual.observacoes}
                {' • Intervalo: '}
                {protocoloAtual.intervalo_minimo_dias === 0
                  ? 'Dose única'
                  : `${protocoloAtual.intervalo_minimo_dias} dias`}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Dose (ml)</Label>
              <Input type="number" step="0.01" value={form.quantidade_dose} onChange={e => setForm(f => ({ ...f, quantidade_dose: e.target.value }))} />
            </div>
            <div>
              <Label>Custo R$</Label>
              <Input type="number" step="0.01" value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {animaisDoRebanho && animaisDoRebanho.length > 0 && form.descricao && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label>Animais</Label>
                <Button size="sm" variant="ghost" type="button" onClick={() => {
                  if (animaisSelecionados.length === animaisLiberados.length) setAnimaisSelecionados([])
                  else setAnimaisSelecionados(animaisLiberados.map((a: any) => a.id))
                }}>
                  Selecionar liberados
                </Button>
              </div>
              <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
                {animaisDoRebanho.map((animal: any) => {
                  const status = statusAnimais[animal.id]
                  const bloqueado = status?.pode_vacinar === false
                  return (
                    <label
                      key={animal.id}
                      className={cn(
                        'flex items-center gap-3 p-3',
                        bloqueado ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/50 cursor-pointer'
                      )}
                    >
                      <Checkbox
                        checked={animaisSelecionados.includes(animal.id)}
                        disabled={bloqueado}
                        onCheckedChange={(checked) => {
                          if (bloqueado) return
                          if (checked) setAnimaisSelecionados(prev => [...prev, animal.id])
                          else setAnimaisSelecionados(prev => prev.filter(id => id !== animal.id))
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {animal.nome || animal.identificador || animal.numero_brinco || 'Sem nome'}
                        </p>
                        {bloqueado ? (
                          <p className="text-xs text-destructive">{status?.mensagem}</p>
                        ) : status?.ultima_aplicacao ? (
                          <p className="text-xs text-green-600">
                            Última: {new Date(status.ultima_aplicacao).toLocaleDateString('pt-BR')}
                            {' • '}{status.dias_desde} dias atrás — Liberado
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Primeira aplicação</p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {animaisSelecionados.length} selecionado(s)
                {bloqueados > 0 && (
                  <span className="text-amber-600">
                    {' • '}{bloqueados} bloqueado(s) por intervalo
                  </span>
                )}
              </p>
            </div>
          )}

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Registrar Evento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
