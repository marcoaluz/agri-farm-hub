import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSafraFechada } from '@/hooks/useSafraFechada'

interface Props {
  open: boolean
  onClose: () => void
  propriedadeId: string
  safraId: string | null
  talhaoIdInicial?: string | null
  culturaIdInicial?: string | null
}

const hoje = () => new Date().toISOString().slice(0, 10)

export function NovaColheitaModal({
  open,
  onClose,
  propriedadeId,
  safraId,
  talhaoIdInicial,
  culturaIdInicial,
}: Props) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const { verificarSafra } = useSafraFechada()

  const [culturaId, setCulturaId] = useState(culturaIdInicial || '')
  const [talhaoId, setTalhaoId] = useState(talhaoIdInicial || '')
  const [dataColheita, setDataColheita] = useState(hoje())
  const [areaColhida, setAreaColhida] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [observacoes, setObservacoes] = useState('')


  const { data: culturas } = useQuery({
    queryKey: ['culturas-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('culturas_config' as any)
        .select('*')
        .eq('ativo', true)
        .order('nome_exibicao')
      return (data || []) as any[]
    },
  })

  const { data: talhoes } = useQuery({
    queryKey: ['talhoes-select', propriedadeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('talhoes' as any)
        .select('id, nome')
        .eq('propriedade_id', propriedadeId)
        .or('ativo.is.null,ativo.eq.true')
        .order('nome')
      return (data || []) as any[]
    },
    enabled: !!propriedadeId,
  })

  const prePreenchido = !!(talhaoIdInicial && culturaIdInicial)

  useEffect(() => {
    if (culturaIdInicial) setCulturaId(culturaIdInicial)
    if (talhaoIdInicial) setTalhaoId(talhaoIdInicial)
  }, [culturaIdInicial, talhaoIdInicial])

  const culturaSel = culturas?.find((c) => c.id === culturaId)
  const labelQuantidade = culturaSel?.unidade_label
    ? `Quantidade (${culturaSel.unidade_label})`
    : 'Quantidade'

  const handleSalvar = async () => {
    if (!verificarSafra('registrar colheita')) return
    if (!culturaId || !talhaoId || !quantidade || parseFloat(quantidade) <= 0) {
      toast.error('Preencha cultura, talhão e quantidade')
      return
    }
    if (!safraId) {
      toast.error('Selecione uma safra')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.rpc('registrar_colheita' as any, {
      p_propriedade_id: propriedadeId,
      p_safra_id: safraId,
      p_talhao_id: talhaoId,
      p_cultura_id: culturaId,
      p_quantidade: parseFloat(quantidade),
      p_data_colheita: dataColheita,
      p_area_colhida: areaColhida ? parseFloat(areaColhida) : 0,
      p_observacoes: observacoes || null,
    } as any)
    setLoading(false)

    if (error) {
      const isSafraFechada = error.message.includes('Safra fechada')
      if (isSafraFechada) {
        toast('Safra fechada', {
          description: 'A safra selecionada está fechada. Reabra a safra em "Safras" para continuar lançando operações nela, ou selecione outra safra ativa.',
        })
      } else {
        toast.error('Erro: ' + error.message)
      }
      return
    }

    queryClient.invalidateQueries({ queryKey: ['producao-safra'] })
    queryClient.invalidateQueries({ queryKey: ['colheitas-talhao'] })
    queryClient.invalidateQueries({ queryKey: ['talhoes-producao'] })
    queryClient.invalidateQueries({ queryKey: ['historico-producao'] })

    toast.success(
      (data as any)?.total_safra
        ? `Colheita registrada: ${(data as any).total_safra} no total da safra`
        : 'Colheita registrada'
    )
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Colheita</DialogTitle>
          <DialogDescription>Informe o que foi colhido nesta safra.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cultura *</Label>
            <Select value={culturaId} onValueChange={setCulturaId} disabled={prePreenchido}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a cultura" />
              </SelectTrigger>
              <SelectContent>
                {culturas?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_exibicao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Talhão *</Label>
            <Select value={talhaoId} onValueChange={setTalhaoId} disabled={prePreenchido}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o talhão" />
              </SelectTrigger>
              <SelectContent>
                {talhoes?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data da colheita *</Label>
              <Input type="date" value={dataColheita} onChange={(e) => setDataColheita(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Área colhida (ha)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={areaColhida}
                onChange={(e) => setAreaColhida(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{labelQuantidade} *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Colheita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
