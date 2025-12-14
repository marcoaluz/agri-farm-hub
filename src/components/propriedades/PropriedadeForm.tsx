import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Propriedade, ESTADOS_BR, EstadoBR } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Loader2, MapPin } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const propriedadeSchema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo'),
  area_total: z.coerce.number().positive('Área deve ser maior que zero').nullable().optional(),
  endereco: z.string().trim().max(255, 'Endereço muito longo').optional().or(z.literal('')),
  cidade: z.string().trim().min(2, 'Cidade é obrigatória').max(100, 'Cidade muito longa'),
  estado: z.string().length(2, 'Selecione um estado'),
  coordenadas_gps: z.string().trim().max(50, 'Coordenadas muito longas').optional().or(z.literal('')),
})

type PropriedadeFormValues = z.infer<typeof propriedadeSchema>

interface PropriedadeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propriedade?: Propriedade
  onSubmit: (data: PropriedadeFormValues) => void
  isLoading?: boolean
}

export function PropriedadeForm({
  open,
  onOpenChange,
  propriedade,
  onSubmit,
  isLoading,
}: PropriedadeFormProps) {
  const { toast } = useToast()
  
  const form = useForm<PropriedadeFormValues>({
    resolver: zodResolver(propriedadeSchema),
    defaultValues: {
      nome: '',
      area_total: null,
      endereco: '',
      cidade: '',
      estado: '',
      coordenadas_gps: '',
    },
  })

  // Reset form when propriedade changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      if (propriedade) {
        form.reset({
          nome: propriedade.nome,
          area_total: propriedade.area_total,
          endereco: propriedade.endereco || '',
          cidade: propriedade.cidade || '',
          estado: propriedade.estado || '',
          coordenadas_gps: propriedade.coordenadas_gps || '',
        })
      } else {
        form.reset({
          nome: '',
          area_total: null,
          endereco: '',
          cidade: '',
          estado: '',
          coordenadas_gps: '',
        })
      }
    }
  }, [open, propriedade, form])

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
          form.setValue('coordenadas_gps', coords)
          toast({
            title: 'Localização obtida!',
            description: 'Coordenadas GPS atualizadas.',
          })
        },
        (error) => {
          toast({
            title: 'Erro ao obter localização',
            description: 'Verifique as permissões de localização do navegador.',
            variant: 'destructive',
          })
        }
      )
    } else {
      toast({
        title: 'Geolocalização não suportada',
        description: 'Seu navegador não suporta geolocalização.',
        variant: 'destructive',
      })
    }
  }

  const handleSubmit = (data: PropriedadeFormValues) => {
    onSubmit(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {propriedade ? 'Editar Propriedade' : 'Nova Propriedade'}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da propriedade rural
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Propriedade *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Fazenda São João" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="area_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área Total (hectares)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value
                          field.onChange(value === '' ? null : parseFloat(value))
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="coordenadas_gps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coordenadas GPS</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="-23.550520, -46.633308"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleGetCurrentLocation}
                        title="Obter localização atual"
                      >
                        <MapPin className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormDescription className="text-xs">
                      Formato: latitude, longitude
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Rua, número, bairro"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Campinas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ESTADOS_BR).map(([sigla, nome]) => (
                          <SelectItem key={sigla} value={sigla}>
                            {sigla} - {nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Propriedade'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
