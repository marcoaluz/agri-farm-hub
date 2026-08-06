import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
import { Loader2, Paperclip, Upload, FileText, X } from 'lucide-react'
import { toast } from 'sonner'

interface CulturaProducao {
  cultura_id: string
  cultura_nome: string
  estoque_disponivel: number
  unidade_label: string
}

interface Props {
  cultura: CulturaProducao
  propriedadeId: string
  safraId: string | null
  onClose: () => void
}

const hoje = () => new Date().toISOString().slice(0, 10)

export function VenderProducaoModal({ cultura, propriedadeId, safraId, onClose }: Props) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const [quantidade, setQuantidade] = useState('')
  const [precoUnitario, setPrecoUnitario] = useState('')
  const [comprador, setComprador] = useState('')
  const [numeroNF, setNumeroNF] = useState('')
  const [dataVenda, setDataVenda] = useState(hoje())
  const [formaPagamento, setFormaPagamento] = useState<'avista' | 'parcelado'>('avista')
  const [numParcelas, setNumParcelas] = useState('2')
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(hoje())
  const [observacoes, setObservacoes] = useState('')
  const [arquivoNota, setArquivoNota] = useState<File | null>(null)

  const valorTotal = (parseFloat(quantidade) || 0) * (parseFloat(precoUnitario) || 0)

  const handleVender = async () => {
    const qtd = parseFloat(quantidade)
    const preco = parseFloat(precoUnitario)

    if (!qtd || qtd <= 0 || !preco || preco <= 0) {
      toast.error('Preencha quantidade e preço')
      return
    }
    if (qtd > cultura.estoque_disponivel) {
      toast.error('Estoque insuficiente')
      return
    }
    if (!safraId) {
      toast.error('Selecione uma safra')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.rpc('registrar_venda_producao' as any, {
      p_propriedade_id: propriedadeId,
      p_cultura_id: cultura.cultura_id,
      p_safra_id: safraId,
      p_quantidade: qtd,
      p_preco_unitario: preco,
      p_comprador: comprador || null,
      p_numero_nf: numeroNF || null,
      p_data_venda: dataVenda,
      p_observacoes: observacoes || null,
      p_parcelado: formaPagamento === 'parcelado',
      p_num_parcelas: formaPagamento === 'parcelado' ? parseInt(numParcelas) : 1,
      p_data_primeira_parcela: formaPagamento === 'parcelado' ? dataPrimeiraParcela : null,
    } as any)

    if (error) {
      setLoading(false)
      toast.error('Erro: ' + error.message)
      return
    }

    const vendaId = (data as any)?.venda_id
    if (arquivoNota && vendaId) {
      const fileExt = arquivoNota.name.split('.').pop()
      const filePath = `${propriedadeId}/vendas/${vendaId}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('anexos')
        .upload(filePath, arquivoNota)

      if (!uploadError) {
        const { data: userData } = await supabase.auth.getUser()
        await supabase.from('anexos' as any).insert({
          propriedade_id: propriedadeId,
          entidade_tipo: 'venda_producao',
          entidade_id: vendaId,
          nome_arquivo: arquivoNota.name,
          storage_path: filePath,
          mime_type: arquivoNota.type,
          tamanho_bytes: arquivoNota.size,
          descricao: 'Nota fiscal - venda de produção',
          criado_por: userData?.user?.id ?? null,
        } as any)
      } else {
        toast.error('Venda salva, mas o anexo falhou: ' + uploadError.message)
      }
    }

    setLoading(false)
    queryClient.invalidateQueries({ queryKey: ['producao-safra'] })
    queryClient.invalidateQueries({ queryKey: ['colheitas-talhao'] })
    queryClient.invalidateQueries({ queryKey: ['historico-producao'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })


    toast.success(
      `Venda: ${qtd} ${cultura.unidade_label} por R$ ${((data as any)?.valor_total ?? valorTotal).toFixed(2)}`
    )
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vender {cultura.cultura_nome}</DialogTitle>
          <DialogDescription>
            Estoque disponível: {cultura.estoque_disponivel} {cultura.unidade_label}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantidade a vender *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={cultura.estoque_disponivel}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Preço por unidade (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={precoUnitario}
                onChange={(e) => setPrecoUnitario(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            Valor total:{' '}
            <span className="font-semibold">
              R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Comprador</Label>
              <Input value={comprador} onChange={(e) => setComprador(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Número NF</Label>
              <Input value={numeroNF} onChange={(e) => setNumeroNF(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data da venda</Label>
              <Input type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formaPagamento === 'parcelado' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Número de parcelas</Label>
                <Input
                  type="number"
                  min="2"
                  max="48"
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data da 1ª parcela</Label>
                <Input
                  type="date"
                  value={dataPrimeiraParcela}
                  onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>

          {/* Seção Anexar Nota */}
          <div className="space-y-2 border-t pt-4">
            <Label className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Anexar Nota Fiscal / Comprovante
            </Label>

            {!arquivoNota ? (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors hover:border-primary/50 hover:bg-primary/5">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para selecionar arquivo (PDF, imagem)
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setArquivoNota(e.target.files?.[0] || null)}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{arquivoNota.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(arquivoNota.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setArquivoNota(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleVender} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
