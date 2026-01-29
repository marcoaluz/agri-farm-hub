import { useState, useMemo } from 'react'
import { Plus, Search, Package, Wrench, Tractor, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { useGlobal } from '@/contexts/GlobalContext'
import { useItens, useDeleteItem } from '@/hooks/useItens'
import { ItemCard } from '@/components/itens/ItemCard'
import { ItemForm } from '@/components/itens/ItemForm'
import { ItemCardSkeleton } from '@/components/itens/ItemCardSkeleton'
import type { ItemComCusto, ItemTipo } from '@/types/item'

export function Itens() {
  const { propriedadeAtual } = useGlobal()
  const [tipoFiltro, setTipoFiltro] = useState<ItemTipo | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [itemSelecionado, setItemSelecionado] = useState<ItemComCusto | null>(null)
  const [itemParaDeletar, setItemParaDeletar] = useState<ItemComCusto | null>(null)

  const deleteItem = useDeleteItem()
  
  const { data: itens = [], isLoading, error } = useItens(
    propriedadeAtual?.id,
    tipoFiltro === 'todos' ? undefined : tipoFiltro
  )

  // Filtrar por busca
  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return itens
    const termoBusca = busca.toLowerCase()
    return itens.filter(item => 
      item.nome.toLowerCase().includes(termoBusca) ||
      item.categoria?.toLowerCase().includes(termoBusca)
    )
  }, [itens, busca])

  // Contadores por tipo
  const contadores = useMemo(() => {
    const todos = itens.length
    const produtos = itens.filter(i => i.tipo === 'produto_estoque').length
    const servicos = itens.filter(i => i.tipo === 'servico').length
    const maquinas = itens.filter(i => i.tipo === 'maquina_hora').length
    return { todos, produtos, servicos, maquinas }
  }, [itens])

  const handleEdit = (item: ItemComCusto) => {
    setItemSelecionado(item)
    setFormOpen(true)
  }

  const handleDelete = (item: ItemComCusto) => {
    setItemParaDeletar(item)
  }

  const confirmarDelete = async () => {
    if (itemParaDeletar) {
      await deleteItem.mutateAsync(itemParaDeletar.id)
      setItemParaDeletar(null)
    }
  }

  const handleNovoItem = () => {
    setItemSelecionado(null)
    setFormOpen(true)
  }

  if (!propriedadeAtual) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Selecione uma propriedade para gerenciar os itens.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Gestão de Itens
          </h1>
          <p className="text-sm text-muted-foreground">
            Produtos, serviços e horas de máquina
          </p>
        </div>
        <Button onClick={handleNovoItem} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Novo Item
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow ${tipoFiltro === 'todos' ? 'ring-2 ring-primary' : ''}`} 
          onClick={() => setTipoFiltro('todos')}
        >
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs text-muted-foreground">Todos</p>
            <p className="text-xl sm:text-2xl font-bold">{contadores.todos}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow ${tipoFiltro === 'produto_estoque' ? 'ring-2 ring-primary' : ''}`} 
          onClick={() => setTipoFiltro('produto_estoque')}
        >
          <CardContent className="p-3 sm:p-4 text-center">
            <Package className="h-4 w-4 text-primary mx-auto mb-1 sm:hidden" />
            <p className="text-xs text-muted-foreground hidden sm:block">Produtos</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">{contadores.produtos}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow ${tipoFiltro === 'servico' ? 'ring-2 ring-primary' : ''}`} 
          onClick={() => setTipoFiltro('servico')}
        >
          <CardContent className="p-3 sm:p-4 text-center">
            <Wrench className="h-4 w-4 text-accent-foreground mx-auto mb-1 sm:hidden" />
            <p className="text-xs text-muted-foreground hidden sm:block">Serviços</p>
            <p className="text-xl sm:text-2xl font-bold text-accent-foreground">{contadores.servicos}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow ${tipoFiltro === 'maquina_hora' ? 'ring-2 ring-primary' : ''}`} 
          onClick={() => setTipoFiltro('maquina_hora')}
        >
          <CardContent className="p-3 sm:p-4 text-center">
            <Tractor className="h-4 w-4 text-secondary-foreground mx-auto mb-1 sm:hidden" />
            <p className="text-xs text-muted-foreground hidden sm:block">Máquinas</p>
            <p className="text-xl sm:text-2xl font-bold text-secondary-foreground">{contadores.maquinas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Filtro */}
      <Tabs value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as ItemTipo | 'todos')}>
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="todos" className="text-xs sm:text-sm py-2">
            Todos
          </TabsTrigger>
          <TabsTrigger value="produto_estoque" className="text-xs sm:text-sm py-2">
            <Package className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="servico" className="text-xs sm:text-sm py-2">
            <Wrench className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="maquina_hora" className="text-xs sm:text-sm py-2">
            <Tractor className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Máquinas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome ou categoria..." 
          className="pl-9"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {/* Erro */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar itens: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Lista de Itens */}
      {!isLoading && itensFiltrados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {itensFiltrados.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && itensFiltrados.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              Nenhum item encontrado
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {busca 
                ? 'Tente ajustar sua busca ou filtros.'
                : 'Comece cadastrando seu primeiro item.'}
            </p>
            {!busca && (
              <Button onClick={handleNovoItem}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Item
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <ItemForm
        item={itemSelecionado}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!itemParaDeletar} onOpenChange={() => setItemParaDeletar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o item "{itemParaDeletar?.nome}"?
              <br />
              <span className="text-muted-foreground">
                O item não será excluído permanentemente e pode ser reativado posteriormente.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteItem.isPending ? 'Desativando...' : 'Desativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
