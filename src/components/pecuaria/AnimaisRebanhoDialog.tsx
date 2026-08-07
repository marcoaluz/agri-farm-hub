import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { Plus, Scale, LineChart, Syringe, ArrowRightLeft, DollarSign } from 'lucide-react'
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
  const [showNovoAnimal, setShowNovoAnimal] = useState(false)
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
                      <p className="font-medium">
                        {animal.nome || animal.identificador || animal.numero_brinco || 'Sem identificação'}
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
                    <div className="flex gap-1">
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
                    </div>
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
