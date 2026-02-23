import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Package, Calendar, AlertTriangle, CheckCircle, Pencil, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoteEditForm } from './LoteEditForm'
import { LoteConsumosCard } from './LoteConsumosCard'

interface Lote {
  id: string
  produto_id: string
  nota_fiscal?: string
  fornecedor?: string
  quantidade_original: number
  quantidade_disponivel: number
  custo_unitario: number
  data_entrada: string
  data_validade?: string
  created_at: string
}

interface ProdutoComCusto {
  id: string
  nome: string
  categoria: string
  unidade_medida: string
  saldo_atual: number
  nivel_minimo: number
  custo_medio: number
  valor_imobilizado: number
  total_lotes: number
}

interface LotesDialogProps {
  produto: ProdutoComCusto
  onClose: () => void
}

type LoteStatus = 'disponivel' | 'parcial' | 'esgotado'

function getLoteConsumoStatus(lote: Lote): { status: LoteStatus; label: string; className: string } {
  if (lote.quantidade_disponivel === 0) {
    return { status: 'esgotado', label: 'Esgotado', className: 'bg-red-100 text-red-700 border-red-300' }
  }
  if (lote.quantidade_disponivel < lote.quantidade_original) {
    return { status: 'parcial', label: 'Parcialmente usado', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' }
  }
  return { status: 'disponivel', label: 'Disponível', className: 'bg-green-100 text-green-700 border-green-300' }
}

export function LotesDialog({ produto, onClose }: LotesDialogProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [editingLoteId, setEditingLoteId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; lote: Lote | null }>({ open: false, lote: null })

  const { data: lotes, isLoading } = useQuery({
    queryKey: ['lotes', produto.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('produto_id', produto.id)
        .order('data_entrada', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Lote[]
    },
    enabled: !!produto.id,
  })

  const deleteMutation = useMutation({
    mutationFn: async (lote: Lote) => {
      // Delete lote (only if fully available)
      const { error: delError } = await supabase
        .from('lotes')
        .delete()
        .eq('id', lote.id)
        .eq('quantidade_disponivel', lote.quantidade_original)

      if (delError) throw delError

      // Update produto saldo
      const { error: updError } = await supabase
        .from('produtos')
        .update({ saldo_atual: produto.saldo_atual - lote.quantidade_original })
        .eq('id', produto.id)

      if (updError) throw updError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] })
      toast({ title: 'Lote excluído com sucesso' })
      setDeleteDialog({ open: false, lote: null })
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao excluir lote', description: err.message, variant: 'destructive' })
    },
  })

  const handleNavigateToLancamento = (lancamentoId: string) => {
    onClose()
    navigate(`/lancamentos/${lancamentoId}`, {
      state: { openEdit: true, fromEstoque: true },
    })
  }

  const lotesDisponiveis = lotes?.filter(l => l.quantidade_disponivel > 0) || []
  const lotesEsgotados = lotes?.filter(l => l.quantidade_disponivel === 0) || []
  const valorTotalImobilizado = lotesDisponiveis.reduce(
    (sum, l) => sum + l.quantidade_disponivel * l.custo_unitario, 0
  )

  const hoje = new Date()

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-2xl flex items-center gap-2">
          <Package className="h-6 w-6" />
          Lotes FIFO - {produto.nome}
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Lotes em ordem FIFO (primeiro a entrar, primeiro a sair)
        </p>
      </DialogHeader>

      {/* Resumo do Produto */}
      <Card className="bg-blue-50 border-2 border-blue-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-blue-700 font-medium">Categoria</p>
              <p className="text-lg font-bold text-blue-900">{produto.categoria}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Saldo Atual</p>
              <p className="text-lg font-bold text-blue-900">
                {produto.saldo_atual?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} {produto.unidade_medida}
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Custo Médio</p>
              <p className="text-lg font-bold text-blue-900">R$ {produto.custo_medio?.toFixed(2) || '0,00'}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Valor Imobilizado</p>
              <p className="text-lg font-bold text-blue-900">
                R$ {valorTotalImobilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerta FIFO */}
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          <strong>Sistema FIFO:</strong> Ao consumir este produto, os lotes mais antigos serão consumidos automaticamente.
        </AlertDescription>
      </Alert>

      {/* Lista de Lotes */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}</div>
      ) : !lotes || lotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum lote cadastrado</h3>
            <p className="text-muted-foreground text-center">Este produto ainda não possui lotes de entrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Lotes Disponíveis */}
          {lotesDisponiveis.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                Lotes Disponíveis ({lotesDisponiveis.length})
              </h3>
              <div className="space-y-3">
                {lotesDisponiveis.map((lote, index) => (
                  <LoteCard
                    key={lote.id}
                    lote={lote}
                    index={index}
                    produto={produto}
                    hoje={hoje}
                    isEditing={editingLoteId === lote.id}
                    onEdit={() => setEditingLoteId(lote.id)}
                    onCancelEdit={() => setEditingLoteId(null)}
                    onDelete={() => setDeleteDialog({ open: true, lote })}
                    onNavigate={handleNavigateToLancamento}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Lotes Esgotados */}
          {lotesEsgotados.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-5 w-5" />
                Lotes Esgotados ({lotesEsgotados.length})
              </h3>
              <div className="space-y-3">
                {lotesEsgotados.map((lote) => (
                  <LoteCard
                    key={lote.id}
                    lote={lote}
                    index={-1}
                    produto={produto}
                    hoje={hoje}
                    isEditing={false}
                    onEdit={() => {}}
                    onCancelEdit={() => {}}
                    onDelete={() => {}}
                    onNavigate={handleNavigateToLancamento}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, lote: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmar Exclusão de Lote</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Tem certeza que deseja excluir a entrada de{' '}
                  <strong>{deleteDialog.lote?.quantidade_original} {produto.unidade_medida}</strong> de{' '}
                  <strong>{produto.nome}</strong>
                  {deleteDialog.lote?.nota_fiscal && <> (NF: {deleteDialog.lote.nota_fiscal})</>}?
                </p>
                <p className="text-sm font-medium text-foreground">Esta ação irá:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Remover permanentemente este lote</li>
                  <li>Reduzir o saldo do produto em {deleteDialog.lote?.quantidade_original} {produto.unidade_medida}</li>
                  <li>Não pode ser desfeita</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.lote && deleteMutation.mutate(deleteDialog.lote)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...</> : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --- Sub-component for individual lote ---

function LoteCard({
  lote,
  index,
  produto,
  hoje,
  isEditing,
  onEdit,
  onCancelEdit,
  onDelete,
  onNavigate,
}: {
  lote: Lote
  index: number // -1 for esgotado section
  produto: ProdutoComCusto
  hoje: Date
  isEditing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onNavigate: (lancamentoId: string) => void
}) {
  const consumoStatus = getLoteConsumoStatus(lote)
  const percentualConsumido = ((lote.quantidade_original - lote.quantidade_disponivel) / lote.quantidade_original) * 100

  // Validade check
  let validadeStatus: { label: string; className: string } | null = null
  if (lote.data_validade) {
    const validade = new Date(lote.data_validade)
    const diasRestantes = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    if (diasRestantes < 0) validadeStatus = { label: 'VENCIDO', className: 'bg-red-100 text-red-700' }
    else if (diasRestantes <= 30) validadeStatus = { label: 'VENCE EM BREVE', className: 'bg-orange-100 text-orange-700' }
  }

  const isDisponivel = consumoStatus.status === 'disponivel'
  const isConsumed = consumoStatus.status === 'parcial' || consumoStatus.status === 'esgotado'

  return (
    <Card className={cn(
      'border-2',
      consumoStatus.status === 'esgotado' && 'opacity-70',
      index === 0 && consumoStatus.status !== 'esgotado' && 'border-green-400 bg-green-50',
    )}>
      <CardContent className="p-6 space-y-4">
        {/* Header badges */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {index === 0 && consumoStatus.status !== 'esgotado' && (
              <Badge className="bg-green-600 text-white">PRÓXIMO FIFO</Badge>
            )}
            <Badge className={consumoStatus.className}>{consumoStatus.label}</Badge>
            {validadeStatus && <Badge className={validadeStatus.className}>{validadeStatus.label}</Badge>}
          </div>

          {/* Action buttons for disponivel */}
          {isDisponivel && !isEditing && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3 w-3 mr-1" /> Excluir
              </Button>
            </div>
          )}
        </div>

        {/* NF / Fornecedor */}
        {lote.nota_fiscal && <p className="text-sm font-semibold">NF: {lote.nota_fiscal}</p>}
        {lote.fornecedor && <p className="text-sm text-muted-foreground">Fornecedor: {lote.fornecedor}</p>}

        {/* Grid info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Quantidade Original</p>
            <p className="text-lg font-bold">
              {lote.quantidade_original.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} {produto.unidade_medida}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Quantidade Disponível</p>
            <p className={cn('text-lg font-bold', lote.quantidade_disponivel > 0 ? 'text-green-600' : 'text-red-500')}>
              {lote.quantidade_disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} {produto.unidade_medida}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Custo Unitário</p>
            <p className="text-lg font-bold text-blue-600">
              R$ {lote.custo_unitario.toFixed(2)}
              <span className="text-xs font-normal ml-1">/ {produto.unidade_medida}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Valor Total Lote</p>
            <p className="text-lg font-bold text-purple-600">
              R$ {(lote.quantidade_disponivel * lote.custo_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Consumo do Lote</span>
            <span className="font-semibold">{percentualConsumido.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn('h-2 rounded-full transition-all', percentualConsumido === 100 ? 'bg-red-500' : 'bg-blue-600')}
              style={{ width: `${percentualConsumido}%` }}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="flex items-center justify-between text-sm border-t pt-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Entrada: {new Date(lote.data_entrada).toLocaleDateString('pt-BR')}</span>
          </div>
          {lote.data_validade && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className={cn('font-medium', new Date(lote.data_validade) < hoje ? 'text-red-600' : 'text-orange-600')}>
                Validade: {new Date(lote.data_validade).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>

        {/* Edit form (inline) */}
        {isEditing && (
          <LoteEditForm lote={lote} unidade={produto.unidade_medida} onClose={onCancelEdit} />
        )}

        {/* Consumption tracking for consumed lots */}
        {isConsumed && (
          <div className="border-t pt-4 space-y-3">
            <Alert className="bg-orange-50 border-orange-200">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 text-sm">
                Este lote foi consumido — para corrigir esta entrada, exclua primeiro os lançamentos abaixo:
              </AlertDescription>
            </Alert>
            <LoteConsumosCard
              loteId={lote.id}
              produtoId={lote.produto_id}
              dataEntrada={lote.data_entrada}
              onNavigate={onNavigate}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
