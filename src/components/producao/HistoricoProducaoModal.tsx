import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useSafraFechada } from '@/hooks/useSafraFechada'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, Undo2, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fmtMoedaBR } from '@/lib/formatters'

const invalidarProducao = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['historico-producao'] })
  queryClient.invalidateQueries({ queryKey: ['producao-safra'] })
  queryClient.invalidateQueries({ queryKey: ['colheitas-talhao'] })
  queryClient.invalidateQueries({ queryKey: ['talhoes-producao'] })
  queryClient.invalidateQueries({ queryKey: ['area-colhida-talhao'] })
  queryClient.invalidateQueries({ queryKey: ['estoque-producao'] })
  queryClient.invalidateQueries({ queryKey: ['dash-estoque-producao'] })
}

interface Props {
  cultura: {
    cultura_id: string
    cultura_nome: string
    talhao_id?: string | null
    talhao_nome?: string | null
  }
  propriedadeId: string
  onClose: () => void
}

export function HistoricoProducaoModal({ cultura, propriedadeId, onClose }: Props) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { verificarSafra } = useSafraFechada()
  const [vendaParaCancelar, setVendaParaCancelar] = useState<any | null>(null)

  // Edição/exclusão de colheita
  const [colheitaEditando, setColheitaEditando] = useState<any | null>(null)
  const [editData, setEditData] = useState('')
  const [editArea, setEditArea] = useState('')
  const [editQuantidade, setEditQuantidade] = useState('')
  const [editObservacoes, setEditObservacoes] = useState('')
  const [colheitaParaExcluir, setColheitaParaExcluir] = useState<any | null>(null)

  const { data: historico, isLoading } = useQuery({
    queryKey: ['historico-producao', propriedadeId, cultura.cultura_id, cultura.talhao_id ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_historico_producao' as any, {
        p_propriedade_id: propriedadeId,
        p_cultura_id: cultura.cultura_id,
        p_talhao_id: cultura.talhao_id || null,
      } as any)
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!cultura.cultura_id && !!propriedadeId,
  })

  const cancelarVendaMutation = useMutation({
    mutationFn: async (vendaId: string) => {
      const { data, error } = await supabase.rpc('cancelar_venda_producao' as any, { p_venda_id: vendaId })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast({ title: 'Venda cancelada. Quantidade devolvida ao estoque e receita removida do Financeiro.' })
      queryClient.invalidateQueries({ queryKey: ['historico-producao'] })
      queryClient.invalidateQueries({ queryKey: ['producao-safra'] })
      queryClient.invalidateQueries({ queryKey: ['transacoes'] })
      setVendaParaCancelar(null)
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao cancelar venda', description: err.message, variant: 'destructive' })
    },
  })

  const abrirEdicaoColheita = (item: any) => {
    if (!verificarSafra('editar colheita')) return
    setColheitaEditando(item)
    setEditData(item.data ? String(item.data).slice(0, 10) : '')
    setEditArea(item.area_colhida != null ? String(item.area_colhida) : '')
    setEditQuantidade(item.quantidade != null ? String(item.quantidade) : '')
    setEditObservacoes(item.observacoes || '')
  }

  const editarColheitaMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('editar_colheita' as any, {
        p_colheita_id: colheitaEditando.id,
        p_data_colheita: editData,
        p_area_colhida: editArea ? parseFloat(editArea) : 0,
        p_quantidade: parseFloat(editQuantidade),
        p_observacoes: editObservacoes || null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast({ title: 'Colheita atualizada com sucesso' })
      invalidarProducao(queryClient)
      setColheitaEditando(null)
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao editar colheita', description: err.message, variant: 'destructive' })
    },
  })

  const excluirColheitaMutation = useMutation({
    mutationFn: async (colheitaId: string) => {
      const { data, error } = await supabase.rpc('excluir_colheita' as any, { p_colheita_id: colheitaId })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast({ title: 'Colheita excluída com sucesso' })
      invalidarProducao(queryClient)
      setColheitaParaExcluir(null)
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao excluir colheita', description: err.message, variant: 'destructive' })
    },
  })

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Histórico — {cultura.cultura_nome}
              {cultura.talhao_nome && ` — ${cultura.talhao_nome}`}
            </DialogTitle>
            <DialogDescription>
              {cultura.talhao_id
                ? 'Colheitas registradas neste talhão.'
                : 'Colheitas e vendas registradas para esta cultura.'}
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}

          {!isLoading && (!historico || historico.length === 0) && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum movimento registrado ainda.
            </p>
          )}

          <div>
            {historico?.map((item: any) => (
              <div key={item.id} className="flex items-start gap-3 border-b py-3 last:border-0">
                <div
                  className={`rounded-full p-2 ${
                    item.tipo === 'colheita'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {item.tipo === 'colheita' ? (
                    <ArrowDownToLine className="h-4 w-4" />
                  ) : (
                    <ArrowUpFromLine className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {item.tipo === 'colheita' ? 'Colheita' : 'Venda'}
                      {item.talhao_nome && ` — ${item.talhao_nome}`}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {item.data ? new Date(`${String(item.data).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : ''}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <Badge variant={item.tipo === 'colheita' ? 'default' : 'secondary'}>
                      {item.tipo === 'colheita' ? '+' : '-'}
                      {item.quantidade}
                    </Badge>
                    {item.area_colhida > 0 && (
                      <span className="text-xs text-muted-foreground">{item.area_colhida} ha</span>
                    )}
                    {item.valor_total && (
                      <span className="text-xs font-medium text-green-600">
                        R$ {Number(item.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        {item.preco_unitario && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({fmtMoedaBR(Number(item.preco_unitario))}/{item.unidade_medida || 'saca'})
                          </span>
                        )}
                      </span>
                    )}
                    {item.comprador && (
                      <span className="text-xs text-muted-foreground">→ {item.comprador}</span>
                    )}
                    {item.tipo === 'venda' && item.transacao_id && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => navigate(`/financeiro?transacao=${item.transacao_id}`)}
                      >
                        Ver no Financeiro <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                    {item.tipo === 'venda' && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-destructive hover:text-destructive"
                        onClick={() => setVendaParaCancelar(item)}
                      >
                        <Undo2 className="ml-0.5 h-3 w-3" />
                        Cancelar venda
                      </Button>
                    )}
                    {item.tipo === 'colheita' && (
                      <>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => abrirEdicaoColheita(item)}
                        >
                          <Pencil className="mr-0.5 h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            if (!verificarSafra('excluir colheita')) return
                            setColheitaParaExcluir(item)
                          }}
                        >
                          <Trash2 className="ml-0.5 h-3 w-3" />
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>

                  {item.observacoes && (
                    <p className="mt-1 text-xs text-muted-foreground">{item.observacoes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!vendaParaCancelar} onOpenChange={(o) => { if (!o) setVendaParaCancelar(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              {vendaParaCancelar?.quantidade} {vendaParaCancelar?.unidade_medida || ''} voltam pro estoque disponível, e a receita
              correspondente é removida do Financeiro. Não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => vendaParaCancelar && cancelarVendaMutation.mutate(vendaParaCancelar.id)}
              disabled={cancelarVendaMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelarVendaMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelando...
                </span>
              ) : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!colheitaEditando} onOpenChange={(o) => { if (!o) setColheitaEditando(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Colheita</DialogTitle>
            <DialogDescription>Ajuste os dados desta colheita.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data da colheita *</Label>
                <Input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Área colhida (ha)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editQuantidade}
                onChange={(e) => setEditQuantidade(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={editObservacoes} onChange={(e) => setEditObservacoes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setColheitaEditando(null)} disabled={editarColheitaMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!editQuantidade || parseFloat(editQuantidade) <= 0) {
                  toast({ title: 'Informe uma quantidade válida', variant: 'destructive' })
                  return
                }
                if (!verificarSafra('editar colheita')) return
                editarColheitaMutation.mutate()
              }}
              disabled={editarColheitaMutation.isPending}
            >
              {editarColheitaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!colheitaParaExcluir} onOpenChange={(o) => { if (!o) setColheitaParaExcluir(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta colheita?</AlertDialogTitle>
            <AlertDialogDescription>
              {colheitaParaExcluir?.quantidade} {colheitaParaExcluir?.unidade_medida || ''} saem do total colhido.
              Se parte já tiver sido vendida, a exclusão será bloqueada. Não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => colheitaParaExcluir && excluirColheitaMutation.mutate(colheitaParaExcluir.id)}
              disabled={excluirColheitaMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirColheitaMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </span>
              ) : 'Confirmar exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
