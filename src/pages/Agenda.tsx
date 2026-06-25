import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Plus, Loader2, Play, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tarefa {
  id: string
  titulo: string
  descricao: string | null
  tipo: string
  prioridade: 'baixa' | 'media' | 'alta'
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
  data_prevista: string
  data_conclusao: string | null
  atrasada: boolean
  talhao_id: string | null
  servico_id: string | null
  responsavel_id: string | null
  propriedade_id: string
}

const TIPOS = [
  { v: 'operacao', l: 'Operação' },
  { v: 'manutencao', l: 'Manutenção' },
  { v: 'sanitario', l: 'Sanitário' },
  { v: 'financeiro', l: 'Financeiro' },
  { v: 'outro', l: 'Outro' },
]

const PRIORIDADES = [
  { v: 'baixa', l: 'Baixa' },
  { v: 'media', l: 'Média' },
  { v: 'alta', l: 'Alta' },
]

function corPrioridade(p: string) {
  if (p === 'alta') return 'bg-red-500 text-white'
  if (p === 'media') return 'bg-amber-500 text-white'
  return 'bg-gray-400 text-white'
}

function corStatus(s: string) {
  const map: Record<string, string> = {
    pendente: 'bg-slate-100 text-slate-700',
    em_andamento: 'bg-blue-100 text-blue-700',
    concluida: 'bg-emerald-100 text-emerald-700',
    cancelada: 'bg-rose-100 text-rose-700',
  }
  return map[s] ?? 'bg-slate-100'
}

export default function Agenda() {
  const { propriedadeAtual } = useGlobal()
  const { user } = useAuth()
  const [mesAtual, setMesAtual] = useState(new Date())
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(false)
  const [novaOpen, setNovaOpen] = useState(false)
  const [detalhe, setDetalhe] = useState<Tarefa | null>(null)
  const [saving, setSaving] = useState(false)

  // Opções
  const [talhoes, setTalhoes] = useState<{ id: string; nome: string }[]>([])
  const [servicos, setServicos] = useState<{ id: string; nome: string }[]>([])
  const [membros, setMembros] = useState<{ id: string; nome: string }[]>([])

  // Form
  const initialForm = {
    titulo: '',
    descricao: '',
    tipo: 'operacao',
    prioridade: 'media',
    data_prevista: format(new Date(), 'yyyy-MM-dd'),
    talhao_id: 'none',
    servico_id: 'none',
    responsavel_id: 'none',
  }
  const [form, setForm] = useState(initialForm)

  const inicio = useMemo(() => startOfMonth(mesAtual), [mesAtual])
  const fim = useMemo(() => endOfMonth(mesAtual), [mesAtual])

  const dias = useMemo(() => {
    const start = startOfWeek(inicio, { weekStartsOn: 0 })
    const end = endOfWeek(fim, { weekStartsOn: 0 })
    const arr: Date[] = []
    let d = start
    while (d <= end) {
      arr.push(d)
      d = addDays(d, 1)
    }
    return arr
  }, [inicio, fim])

  const fetchTarefas = useCallback(async () => {
    if (!propriedadeAtual?.id) return
    setLoading(true)
    const { data, error } = await supabase.rpc('listar_tarefas_periodo' as any, {
      p_propriedade_id: propriedadeAtual.id,
      p_data_inicio: format(inicio, 'yyyy-MM-dd'),
      p_data_fim: format(fim, 'yyyy-MM-dd'),
    })
    setLoading(false)
    if (error) {
      console.error(error)
      toast.error('Erro ao carregar tarefas')
      setTarefas([])
      return
    }
    setTarefas((data as any) ?? [])
  }, [propriedadeAtual?.id, inicio, fim])

  useEffect(() => { fetchTarefas() }, [fetchTarefas])

  // Carrega selects auxiliares
  useEffect(() => {
    if (!propriedadeAtual?.id) return
    ;(async () => {
      const [t, s, m] = await Promise.all([
        supabase.from('talhoes').select('id,nome').eq('propriedade_id', propriedadeAtual.id).or('ativo.is.null,ativo.eq.true').order('nome'),
        supabase.from('servicos').select('id,nome').eq('propriedade_id', propriedadeAtual.id).or('ativo.is.null,ativo.eq.true').order('nome'),
        supabase.rpc('listar_membros_propriedade' as any, { p_propriedade_id: propriedadeAtual.id }),
      ])
      setTalhoes((t.data as any) ?? [])
      setServicos((s.data as any) ?? [])
      const ms = ((m.data as any) ?? []).map((x: any) => ({
        id: x.usuario_id ?? x.membro_id ?? x.id,
        nome: x.nome ?? x.email ?? 'Sem nome',
      })).filter((x: any) => x.id)
      setMembros(ms)
    })()
  }, [propriedadeAtual?.id])

  const tarefasPorDia = useMemo(() => {
    const map: Record<string, Tarefa[]> = {}
    for (const t of tarefas) {
      const key = (t.data_prevista || '').slice(0, 10)
      if (!key) continue
      ;(map[key] ||= []).push(t)
    }
    return map
  }, [tarefas])

  async function salvarNova(e: React.FormEvent) {
    e.preventDefault()
    if (!propriedadeAtual?.id || !user?.id) return
    if (!form.titulo.trim()) {
      toast.error('Informe o título')
      return
    }
    setSaving(true)
    const payload: any = {
      propriedade_id: propriedadeAtual.id,
      criado_por: user.id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      tipo: form.tipo,
      prioridade: form.prioridade,
      data_prevista: form.data_prevista,
      talhao_id: form.talhao_id !== 'none' ? form.talhao_id : null,
      servico_id: form.servico_id !== 'none' ? form.servico_id : null,
      responsavel_id: form.responsavel_id !== 'none' ? form.responsavel_id : null,
      status: 'pendente',
    }
    const { error } = await supabase.from('tarefas' as any).insert(payload)
    setSaving(false)
    if (error) {
      toast.error('Erro ao criar tarefa: ' + error.message)
      return
    }
    toast.success('Tarefa criada')
    setNovaOpen(false)
    setForm(initialForm)
    fetchTarefas()
  }

  async function atualizarStatus(novoStatus: Tarefa['status']) {
    if (!detalhe) return
    setSaving(true)
    const patch: any = { status: novoStatus }
    if (novoStatus === 'concluida') {
      patch.data_conclusao = format(new Date(), 'yyyy-MM-dd')
    }
    const { error } = await supabase.from('tarefas' as any).update(patch).eq('id', detalhe.id)
    setSaving(false)
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message)
      return
    }
    toast.success('Tarefa atualizada')
    setDetalhe(null)
    fetchTarefas()
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground">Planejamento e tarefas da propriedade</p>
        </div>
        <Button onClick={() => setNovaOpen(true)} disabled={!propriedadeAtual}>
          <Plus className="h-4 w-4 mr-1" /> Nova tarefa
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="capitalize">
            {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMesAtual(subMonths(mesAtual, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMesAtual(new Date())}>Hoje</Button>
            <Button variant="outline" size="sm" onClick={() => setMesAtual(addMonths(mesAtual, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          )}
          <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-1">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="px-2 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dias.map(dia => {
              const key = format(dia, 'yyyy-MM-dd')
              const lista = tarefasPorDia[key] ?? []
              const outroMes = !isSameMonth(dia, mesAtual)
              const hoje = isSameDay(dia, new Date())
              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[96px] border rounded-md p-1 text-left flex flex-col gap-1',
                    outroMes && 'bg-muted/30 text-muted-foreground',
                    hoje && 'border-primary',
                  )}
                >
                  <div className="text-xs font-medium">{format(dia, 'd')}</div>
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {lista.slice(0, 4).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setDetalhe(t)}
                        className={cn(
                          'truncate text-[10px] leading-tight px-1.5 py-0.5 rounded text-left',
                          corPrioridade(t.prioridade),
                          t.atrasada && 'ring-1 ring-red-600 ring-offset-1',
                          t.status === 'concluida' && 'opacity-60 line-through',
                        )}
                        title={t.titulo}
                      >
                        {t.titulo}
                      </button>
                    ))}
                    {lista.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{lista.length - 4}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Alta</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> Média</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400" /> Baixa</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border ring-1 ring-red-600" /> Atrasada</span>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Nova Tarefa */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
            <DialogDescription>Cadastre uma tarefa para o planejamento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={salvarNova} className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Data prevista *</Label>
              <Input type="date" value={form.data_prevista} onChange={e => setForm({ ...form, data_prevista: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Talhão</Label>
                <Select value={form.talhao_id} onValueChange={v => setForm({ ...form, talhao_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Serviço</Label>
                <Select value={form.servico_id} onValueChange={v => setForm({ ...form, servico_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {servicos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={form.responsavel_id} onValueChange={v => setForm({ ...form, responsavel_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setNovaOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhe */}
      <Dialog open={!!detalhe} onOpenChange={o => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detalhe.titulo}
                  <Badge className={cn('capitalize', corPrioridade(detalhe.prioridade))}>{detalhe.prioridade}</Badge>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap pt-1">
                  <Badge variant="outline" className="capitalize">{detalhe.tipo}</Badge>
                  <Badge className={cn('capitalize', corStatus(detalhe.status))}>{detalhe.status.replace('_', ' ')}</Badge>
                  {detalhe.atrasada && <Badge className="bg-red-600 text-white">Atrasada</Badge>}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                {detalhe.descricao && <p className="text-muted-foreground">{detalhe.descricao}</p>}
                <p><span className="font-medium">Data prevista:</span> {format(parseISO(detalhe.data_prevista + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                {detalhe.data_conclusao && (
                  <p><span className="font-medium">Concluída em:</span> {format(parseISO(detalhe.data_conclusao + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                )}
              </div>
              <DialogFooter className="gap-2 flex-wrap">
                {detalhe.status === 'pendente' && (
                  <Button onClick={() => atualizarStatus('em_andamento')} disabled={saving}>
                    <Play className="h-4 w-4 mr-1" /> Iniciar
                  </Button>
                )}
                {detalhe.status !== 'concluida' && detalhe.status !== 'cancelada' && (
                  <Button onClick={() => atualizarStatus('concluida')} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                    <Check className="h-4 w-4 mr-1" /> Concluir
                  </Button>
                )}
                {detalhe.status !== 'cancelada' && detalhe.status !== 'concluida' && (
                  <Button variant="destructive" onClick={() => atualizarStatus('cancelada')} disabled={saving}>
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
