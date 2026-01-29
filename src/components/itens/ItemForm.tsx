import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGlobal } from '@/contexts/GlobalContext'
import { useCreateItem, useUpdateItem, useProdutosParaVincular, useMaquinasParaVincular } from '@/hooks/useItens'
import type { ItemComCusto, ItemTipo, ItemUnidade, ItemFormPayload } from '@/types/item'

const itemSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
  tipo: z.enum(['produto_estoque', 'servico', 'maquina_hora'], { required_error: 'Tipo é obrigatório' }),
  categoria: z.string().min(1, 'Categoria é obrigatória'),
  unidade_medida: z.string().min(1, 'Unidade é obrigatória'),
  descricao: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').optional(),
  produto_id: z.string().optional(),
  maquina_id: z.string().optional(),
  custo_padrao: z.number().min(0, 'Custo deve ser positivo').optional(),
})

type ItemFormData = z.infer<typeof itemSchema>

interface ItemFormProps {
  item: ItemComCusto | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const categoriasPorTipo: Record<ItemTipo, string[]> = {
  produto_estoque: ['Fertilizante', 'Defensivo', 'Semente', 'Combustível', 'Outro'],
  servico: ['Preparo de Solo', 'Plantio', 'Adubação', 'Aplicação', 'Colheita', 'Manutenção', 'Outro'],
  maquina_hora: ['Trator', 'Colheitadeira', 'Pulverizador', 'Plantadeira', 'Caminhão', 'Outro']
}

const unidadesPorTipo: Record<ItemTipo, ItemUnidade[]> = {
  produto_estoque: ['kg', 'ton', 'litro', 'ml', 'saca', 'unidade'],
  servico: ['ha', 'dia', 'diaria', 'servico', 'unidade'],
  maquina_hora: ['hora']
}

export function ItemForm({ item, open, onOpenChange }: ItemFormProps) {
  const { propriedadeAtual } = useGlobal()
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  
  const { data: produtos = [] } = useProdutosParaVincular(propriedadeAtual?.id)
  const { data: maquinas = [] } = useMaquinasParaVincular(propriedadeAtual?.id)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      nome: '',
      tipo: 'produto_estoque',
      categoria: '',
      unidade_medida: '',
      descricao: '',
      custo_padrao: undefined,
    }
  })

  const tipoSelecionado = watch('tipo') as ItemTipo
  const maquinaId = watch('maquina_id')

  // Reset form quando item muda
  useEffect(() => {
    if (item) {
      reset({
        nome: item.nome,
        tipo: item.tipo,
        categoria: item.categoria,
        unidade_medida: item.unidade_medida,
        descricao: item.descricao || '',
        produto_id: item.produto_id || undefined,
        maquina_id: item.maquina_id || undefined,
        custo_padrao: item.custo_padrao || undefined,
      })
    } else {
      reset({
        nome: '',
        tipo: 'produto_estoque',
        categoria: '',
        unidade_medida: '',
        descricao: '',
        custo_padrao: undefined,
      })
    }
  }, [item, reset])

  // Auto preencher custo quando seleciona máquina
  useEffect(() => {
    if (maquinaId && tipoSelecionado === 'maquina_hora') {
      const maquina = maquinas.find(m => m.id === maquinaId)
      if (maquina?.custo_hora) {
        setValue('custo_padrao', maquina.custo_hora)
      }
    }
  }, [maquinaId, maquinas, tipoSelecionado, setValue])

  // Reset campos dependentes quando tipo muda
  useEffect(() => {
    setValue('categoria', '')
    setValue('unidade_medida', tipoSelecionado === 'maquina_hora' ? 'hora' : '')
    setValue('produto_id', undefined)
    setValue('maquina_id', undefined)
    setValue('custo_padrao', undefined)
  }, [tipoSelecionado, setValue])

  const onSubmit = async (data: ItemFormData) => {
    if (!propriedadeAtual) return

    const payload: ItemFormPayload = {
      propriedade_id: propriedadeAtual.id,
      nome: data.nome.trim(),
      tipo: data.tipo,
      categoria: data.categoria,
      unidade_medida: data.unidade_medida,
      descricao: data.descricao?.trim() || undefined,
      produto_id: data.tipo === 'produto_estoque' ? data.produto_id : undefined,
      maquina_id: data.tipo === 'maquina_hora' ? data.maquina_id : undefined,
      custo_padrao: data.custo_padrao,
    }

    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, ...payload })
      } else {
        await createItem.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch (error) {
      // Erro já tratado nos hooks
    }
  }

  const isPending = createItem.isPending || updateItem.isPending || isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? 'Editar Item' : 'Novo Item'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              {...register('nome')}
              placeholder="Ex: Ureia 46%"
              maxLength={200}
            />
            {errors.nome && (
              <p className="text-xs text-destructive">{errors.nome.message}</p>
            )}
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={tipoSelecionado}
              onValueChange={(value) => setValue('tipo', value as ItemTipo)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="produto_estoque">📦 Produto de Estoque</SelectItem>
                <SelectItem value="servico">⚙️ Serviço</SelectItem>
                <SelectItem value="maquina_hora">🚜 Hora de Máquina</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo && (
              <p className="text-xs text-destructive">{errors.tipo.message}</p>
            )}
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select
              value={watch('categoria')}
              onValueChange={(value) => setValue('categoria', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasPorTipo[tipoSelecionado]?.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoria && (
              <p className="text-xs text-destructive">{errors.categoria.message}</p>
            )}
          </div>

          {/* Unidade de Medida */}
          <div className="space-y-1.5">
            <Label htmlFor="unidade_medida">Unidade de Medida *</Label>
            <Select
              value={watch('unidade_medida')}
              onValueChange={(value) => setValue('unidade_medida', value)}
              disabled={tipoSelecionado === 'maquina_hora'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidadesPorTipo[tipoSelecionado]?.map((unidade) => (
                  <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.unidade_medida && (
              <p className="text-xs text-destructive">{errors.unidade_medida.message}</p>
            )}
          </div>

          {/* Vínculo com Produto (apenas para produto_estoque) */}
          {tipoSelecionado === 'produto_estoque' && (
            <div className="space-y-1.5">
              <Label htmlFor="produto_id">Vincular Produto (opcional)</Label>
              <Select
                value={watch('produto_id') || ''}
                onValueChange={(value) => setValue('produto_id', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {produtos.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Vínculo com Máquina (apenas para maquina_hora) */}
          {tipoSelecionado === 'maquina_hora' && (
            <div className="space-y-1.5">
              <Label htmlFor="maquina_id">Vincular Máquina (opcional)</Label>
              <Select
                value={watch('maquina_id') || ''}
                onValueChange={(value) => setValue('maquina_id', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma máquina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {maquinas.map((maquina) => (
                    <SelectItem key={maquina.id} value={maquina.id}>
                      {maquina.nome} {maquina.custo_hora ? `(R$ ${maquina.custo_hora}/h)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custo Padrão (para serviço e máquina) */}
          {(tipoSelecionado === 'servico' || tipoSelecionado === 'maquina_hora') && (
            <div className="space-y-1.5">
              <Label htmlFor="custo_padrao">
                {tipoSelecionado === 'maquina_hora' ? 'Custo por Hora (R$)' : 'Custo Padrão (R$)'}
              </Label>
              <Input
                id="custo_padrao"
                type="number"
                step="0.01"
                min="0"
                {...register('custo_padrao', { valueAsNumber: true })}
                placeholder="0,00"
              />
              {errors.custo_padrao && (
                <p className="text-xs text-destructive">{errors.custo_padrao.message}</p>
              )}
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              {...register('descricao')}
              placeholder="Observações sobre o item..."
              maxLength={500}
              rows={3}
            />
            {errors.descricao && (
              <p className="text-xs text-destructive">{errors.descricao.message}</p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                item ? 'Salvar Alterações' : 'Cadastrar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
