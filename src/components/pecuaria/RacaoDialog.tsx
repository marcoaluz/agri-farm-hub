import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIPOS_RACAO = [
  { value: 'racao_concentrada', label: 'Ração Concentrada' },
  { value: 'silagem', label: 'Silagem' },
  { value: 'feno', label: 'Feno' },
  { value: 'sal_mineral', label: 'Sal Mineral' },
  { value: 'suplemento', label: 'Suplemento' },
  { value: 'outro', label: 'Outro' },
]

const UNIDADES = [
  { value: 'kg', label: 'kg' },
  { value: 'sacas', label: 'Sacas' },
  { value: 'fardos', label: 'Fardos' },
  { value: 'litros', label: 'Litros' },
]

interface RacaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  safraId: string
  rebanhos: any[]
}

export function RacaoDialog({ open, onOpenChange, propriedadeId, safraId, rebanhos }: RacaoDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const [rebanhoId, setRebanhoId] = useState('')
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [tipoRacao, setTipoRacao] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState('kg')
  const [custo, setCusto] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const resetForm = () => {
    setRebanhoId('')
    setData(format(new Date(), 'yyyy-MM-dd'))
    setTipoRacao('')
    setQuantidade('')
    setUnidade('kg')
    setCusto('')
    setFornecedor('')
    setObservacoes('')
  }

  const handleSave = async () => {
    if (!rebanhoId || !tipoRacao || !custo) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    const rebanhoNome = rebanhos.find((r: any) => r.id === rebanhoId)?.nome || ''
    const tipoLabel = TIPOS_RACAO.find(t => t.value === tipoRacao)?.label || tipoRacao

    const obsCompleta = [
      quantidade ? `${quantidade} ${unidade}` : '',
      observacoes,
    ].filter(Boolean).join(' — ')

    setSaving(true)
    try {
      const { error } = await supabase.from('transacoes' as any).insert({
        propriedade_id: propriedadeId,
        safra_id: safraId,
        tipo: 'despesa',
        categoria: 'alimentacao_animal',
        descricao: `${tipoLabel} - ${rebanhoNome}`,
        valor: parseFloat(custo),
        data_vencimento: data,
        data_pagamento: data,
        status: 'pago',
        origem: 'pecuaria_racao',
        fornecedor_cliente: fornecedor || null,
        observacoes: obsCompleta || null,
      } as any)

      if (error) throw error

      toast({ title: 'Ração registrada com sucesso!' })
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      resetForm()
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: 'Erro ao registrar ração', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Ração / Alimentação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
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

          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Ração *</Label>
            <Select value={tipoRacao} onValueChange={setTipoRacao}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {TIPOS_RACAO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" min="0" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map(u => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Custo Total R$ *</Label>
            <Input type="number" min="0" step="0.01" value={custo} onChange={e => setCusto(e.target.value)} placeholder="0,00" />
          </div>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor (opcional)" />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações adicionais..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
