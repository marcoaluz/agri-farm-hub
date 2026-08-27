import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePropriedades } from '@/hooks/usePropriedades'
import { supabase } from '@/lib/supabase'
import { PropriedadeForm } from '@/components/propriedades/PropriedadeForm'
import { Propriedade } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, MoreVertical, Pencil, Trash2, Home, MapPin, Loader2, User, MapPinned } from 'lucide-react'

export function Propriedades() {
  const {
    propriedades,
    isLoading,
    createPropriedade,
    updatePropriedade,
    deletePropriedade,
    isCreating,
    isUpdating,
    isDeleting,
  } = usePropriedades()

  const [formOpen, setFormOpen] = useState(false)
  const [selectedPropriedade, setSelectedPropriedade] = useState<Propriedade | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [propriedadeToDelete, setPropriedadeToDelete] = useState<string | null>(null)

  const propriedadesLista = Array.isArray(propriedades) ? propriedades : []
  const activePropriedades = propriedadesLista.filter((p) => p.ativo)

  const { data: talhoesPorPropriedade } = useQuery({
    queryKey: ['talhoes-count-por-propriedade', activePropriedades.map((p) => p.id).join(',')],
    queryFn: async () => {
      if (!activePropriedades.length) return {}
      const { data } = await supabase
        .from('talhoes')
        .select('propriedade_id')
        .eq('ativo', true)
        .in('propriedade_id', activePropriedades.map((p) => p.id))
      const contagem: Record<string, number> = {}
      ;(data || []).forEach((t: any) => {
        contagem[t.propriedade_id] = (contagem[t.propriedade_id] || 0) + 1
      })
      return contagem
    },
    enabled: activePropriedades.length > 0,
  })

  const handleCreate = (data: Parameters<typeof createPropriedade>[0]) => {
    createPropriedade(data, { onSuccess: () => setFormOpen(false) })
  }

  const handleUpdate = (data: Parameters<typeof createPropriedade>[0]) => {
    if (selectedPropriedade) {
      updatePropriedade(
        { id: selectedPropriedade.id, updates: data },
        {
          onSuccess: () => {
            setFormOpen(false)
            setSelectedPropriedade(undefined)
          },
        }
      )
    }
  }

  const handleDelete = () => {
    if (propriedadeToDelete) {
      deletePropriedade(propriedadeToDelete, {
        onSuccess: () => {
          setDeleteDialogOpen(false)
          setPropriedadeToDelete(null)
        },
      })
    }
  }

  const openEditForm = (propriedade: Propriedade) => {
    setSelectedPropriedade(propriedade)
    setFormOpen(true)
  }

  const openCreateForm = () => {
    setSelectedPropriedade(undefined)
    setFormOpen(true)
  }

  const openDeleteDialog = (id: string) => {
    setPropriedadeToDelete(id)
    setDeleteDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Propriedades</h1>
          <p className="text-muted-foreground">
            Total de {activePropriedades.length}{' '}
            {activePropriedades.length === 1 ? 'propriedade ativa' : 'propriedades ativas'}
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Propriedade
        </Button>
      </div>

      {activePropriedades.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <Home className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhuma propriedade cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Comece cadastrando sua primeira propriedade rural para gerenciar safras, talhões e lançamentos.
            </p>
            <Button onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeira Propriedade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activePropriedades.map((propriedade) => {
            const qtdTalhoes = talhoesPorPropriedade?.[propriedade.id] || 0
            return (
              <Card key={propriedade.id} className="overflow-hidden">
                <div className="flex items-start justify-between p-4 pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      <MapPinned className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-foreground truncate">{propriedade.nome}</h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border border-border">
                      <DropdownMenuItem onClick={() => openEditForm(propriedade)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => openDeleteDialog(propriedade.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-2 px-4 pt-3">
                  <Badge variant={propriedade.ativo ? 'default' : 'secondary'}>
                    {propriedade.ativo ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <Badge variant="outline">
                    {qtdTalhoes} talhõe{qtdTalhoes === 1 ? '' : 's'}
                  </Badge>
                </div>

                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Área total</span>
                    <span className="font-medium text-foreground">
                      {propriedade.area_total
                        ? `${propriedade.area_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ha`
                        : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Responsável
                    </span>
                    <span className="font-medium text-foreground truncate ml-2">
                      {propriedade.responsavel || '-'}
                    </span>
                  </div>

                  {propriedade.localizacao && (
                    <div className="flex items-start justify-between text-sm gap-2">
                      <span className="text-muted-foreground flex items-center gap-1 flex-shrink-0">
                        <MapPin className="h-3 w-3" />
                        Local
                      </span>
                      <span className="font-medium text-foreground text-right truncate">
                        {propriedade.localizacao}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <PropriedadeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        propriedade={selectedPropriedade}
        onSubmit={selectedPropriedade ? handleUpdate : handleCreate}
        isLoading={isCreating || isUpdating}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desativar a propriedade. Ela não será excluída permanentemente e pode ser
              reativada posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
