import { useState } from 'react'
import { usePropriedades } from '@/hooks/usePropriedades'
import { PropriedadeForm } from '@/components/propriedades/PropriedadeForm'
import { Propriedade } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Plus, MoreVertical, Pencil, Trash2, Home, MapPin, Loader2 } from 'lucide-react'

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

  const handleCreate = (data: Parameters<typeof createPropriedade>[0]) => {
    createPropriedade(data, {
      onSuccess: () => {
        setFormOpen(false)
      },
    })
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

  // Filter only active properties
  const activePropriedades = propriedades.filter(p => p.ativo)

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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Propriedades</h1>
          <p className="text-muted-foreground">
            Gerencie suas propriedades rurais
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
            <h3 className="text-lg font-semibold mb-2">
              Nenhuma propriedade cadastrada
            </h3>
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
        <Card>
          <CardHeader>
            <CardTitle>Propriedades Cadastradas</CardTitle>
            <CardDescription>
              Total de {activePropriedades.length}{' '}
              {activePropriedades.length === 1 ? 'propriedade ativa' : 'propriedades ativas'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Área Total</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[70px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePropriedades.map((propriedade) => (
                    <TableRow key={propriedade.id}>
                      <TableCell className="font-medium">
                        {propriedade.nome}
                      </TableCell>
                      <TableCell>
                        {propriedade.area_total
                          ? `${propriedade.area_total.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })} ha`
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {propriedade.localizacao ? (
                          <div className="flex items-center gap-1 max-w-xs truncate">
                            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate text-sm">
                              {propriedade.localizacao}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {propriedade.responsavel || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={propriedade.ativo ? 'default' : 'secondary'}>
                          {propriedade.ativo ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border border-border">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openEditForm(propriedade)}
                            >
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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
              Esta ação irá desativar a propriedade. Ela não será excluída
              permanentemente e pode ser reativada posteriormente.
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
