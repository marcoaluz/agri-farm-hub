import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Scale, LineChart, Syringe, ArrowRightLeft, DollarSign, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { NovoAnimalModal } from './NovoAnimalModal'
import { PesagemAnimalModal } from './PesagemAnimalModal'
import { HistoricoPesoModal } from './HistoricoPesoModal'
import { VacinacaoModal } from './VacinacaoModal'
import { MovimentacaoDialog } from './MovimentacaoDialog'

interface AnimaisRebanhoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedadeId: string
  rebanho: any
  rebanhos?: any[]
}

export function AnimaisRebanhoDialog({ open, onOpenChange, propriedadeId, rebanho, rebanhos }: AnimaisRebanhoDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showNovoAnimal, setShowNovoAnimal] = useState(false)
  const [animalParaIdentificar, setAnimalParaIdentificar] = useState<any>(null)
  const [animalPesagem, setAnimalPesagem] = useState<any>(null)
  const [animalHistorico, setAnimalHistorico] = useState<any>(null)
  const [animalVacina, setAnimalVacina] = useState<any>(null)
  const [movAnimal, setMovAnimal] = useState<{ animal: any; tipo: string } | null>(null)

  const { data: animais, isLoading } = useQuery({
    queryKey: ['animais-rebanho', rebanho?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_animais_rebanho' as any, { p_rebanho_id: rebanho.id })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: open && !!rebanho?.id,
  })

  const semIdentificacao = (animais || []).filter((a: any) => a.identificado === false)

  async function handleRemoverIdentificacao(animal: any) {
    if (!confirm(`Remover a identificação de "${animal.nome || animal.numero_brinco}"? Ele volta a aparecer como não identificado (peso e valor de compra são mantidos).`)) return
    const { error } = await supabase.from('animais' as any).update({
      identificado: false,
      nome: null,
      numero_brinco: null,
      identificador: 'Aguardando identificação',
      sexo: 'nao_definido',
      data_nascimento: null,
      observacoes: null,
    }).eq('id', animal.id)
    if (error) {
      toast({ title: 'Erro ao remover identificação', description: error.message, variant: 'destructive' })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['animais-rebanho'] })
    queryClient.invalidateQueries({ queryKey: ['alertas-identificacao-pecuaria'] })
    toast({ title: 'Identificação removida — animal voltou pra fila de identificação' })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Animais do Rebanho</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">
              Animais — {rebanho?.nome} ({animais?.length || 0})
            </h3>
            <Button size="sm" onClick={() => setShowNovoAnimal(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Identificar Animal
            </Button>
          </div>

          {semIdentificacao.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              {semIdentificacao.length} {semIdentificacao.length === 1 ? 'animal aguardando identificação' : 'animais aguardando identificação'} — clique em "Identificar" no card do animal.
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : animais && animais.length > 0 ? (
            <div className="space-y-2">
              {animais.map((animal: any) => (
                <div key={animal.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <span className="text-sm font-bold">
                        {animal.sexo === 'macho' ? '♂' : animal.sexo === 'femea' ? '♀' : '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2 flex-wrap">
                        {animal.nome || animal.numero_brinco || animal.identificador}
                        {animal.identificado === false && (
                          <span className="text-[10px] font-medium uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                            Sem identificação
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {animal.numero_brinco && <span>Brinco: {animal.numero_brinco}</span>}
                        {animal.raca && <span>• {animal.raca}</span>}
                        {animal.data_nascimento && (
                          <span>• Nasc: {new Date(animal.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {animal.identificado === false ? (
                      <Button size="sm" onClick={() => setAnimalParaIdentificar(animal)}>
                        Identificar
                      </Button>
                    ) : (
                    <div className="text-right">
                      {animal.peso_atual ? (
                        <>
                          <p className="font-bold">{animal.peso_atual} kg</p>
                          {animal.ganho_peso_dia !== null && animal.ganho_peso_dia !== undefined && (
                            <p className={`text-xs ${animal.ganho_peso_dia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {animal.ganho_peso_dia > 0 ? '+' : ''}{animal.ganho_peso_dia} kg/dia
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem pesagem</p>
                      )}
                    </div>
                    )}
                    {animal.identificado !== false && (
                    <div className="hidden gap-1 sm:flex">
                      <Button size="icon" variant="ghost" onClick={() => setAnimalPesagem(animal)} title="Pesar">
                        <Scale className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setAnimalVacina(animal)} title="Vacinar">
                        <Syringe className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setMovAnimal({ animal, tipo: 'transferencia' })} title="Transferir">
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setMovAnimal({ animal, tipo: 'venda' })} title="Vender">
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setAnimalHistorico(animal)} title="Histórico de peso">
                        <LineChart className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setAnimalParaIdentificar(animal)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleRemoverIdentificacao(animal)} title="Excluir identificação">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    )}
                    {animal.identificado !== false && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild className="sm:hidden">
                        <Button size="icon" variant="ghost" aria-label="Ações do animal">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setAnimalPesagem(animal)}>
                          <Scale className="mr-2 h-4 w-4" /> Pesar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAnimalVacina(animal)}>
                          <Syringe className="mr-2 h-4 w-4" /> Vacinar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMovAnimal({ animal, tipo: 'transferencia' })}>
                          <ArrowRightLeft className="mr-2 h-4 w-4" /> Transferir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMovAnimal({ animal, tipo: 'venda' })}>
                          <DollarSign className="mr-2 h-4 w-4" /> Vender
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAnimalHistorico(animal)}>
                          <LineChart className="mr-2 h-4 w-4" /> Histórico de peso
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAnimalParaIdentificar(animal)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRemoverIdentificacao(animal)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir identificação
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">Nenhum animal identificado</p>
              <p className="text-xs text-muted-foreground mb-4">
                Identifique os animais individualmente para controlar peso e evolução
              </p>
              <Button size="sm" variant="outline" onClick={() => setShowNovoAnimal(true)}>
                Identificar Primeiro Animal
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NovoAnimalModal open={showNovoAnimal} onOpenChange={setShowNovoAnimal} propriedadeId={propriedadeId} rebanho={rebanho} />
      {animalParaIdentificar && (
        <NovoAnimalModal
          open={!!animalParaIdentificar}
          onOpenChange={(o) => { if (!o) setAnimalParaIdentificar(null) }}
          propriedadeId={propriedadeId}
          rebanho={rebanho}
          animalParaIdentificar={animalParaIdentificar}
        />
      )}
      {animalPesagem && (
        <PesagemAnimalModal open={!!animalPesagem} onOpenChange={o => { if (!o) setAnimalPesagem(null) }} animal={animalPesagem} />
      )}
      {animalHistorico && (
        <HistoricoPesoModal open={!!animalHistorico} onOpenChange={o => { if (!o) setAnimalHistorico(null) }} animal={animalHistorico} />
      )}
      {animalVacina && (
        <VacinacaoModal
          open={!!animalVacina}
          onOpenChange={o => { if (!o) setAnimalVacina(null) }}
          propriedadeId={propriedadeId}
          rebanho={rebanho}
          animalIdInicial={animalVacina.id}
        />
      )}
      {movAnimal && (
        <MovimentacaoDialog
          open={!!movAnimal}
          onOpenChange={o => { if (!o) setMovAnimal(null) }}
          propriedadeId={propriedadeId}
          rebanhos={rebanhos && rebanhos.length ? rebanhos : [rebanho]}
          rebanhoIdInicial={rebanho?.id}
          tipoInicial={movAnimal.tipo}
          quantidadeInicial="1"
          animalIdInicial={movAnimal.animal.id}
        />
      )}
    </>
  )
}
