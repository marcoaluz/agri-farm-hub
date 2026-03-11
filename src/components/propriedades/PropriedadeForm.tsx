import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Propriedade } from '@/types'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MapPin } from 'lucide-react'

const propriedadeSchema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter no mínimo 3 caracteres').max(255, 'Nome muito longo'),
  area_total: z.coerce
    .number()
    .positive('Área deve ser maior que zero')
    .nullable()
    .optional(),
  localizacao: z.string().trim().max(500, 'Localização muito longa').optional().or(z.literal('')),
  responsavel: z.string().trim().max(255, 'Nome muito longo').optional().or(z.literal('')),
  latitude: z.coerce.number().min(-90, 'Latitude inválida').max(90, 'Latitude inválida').nullable().optional(),
  longitude: z.coerce.number().min(-180, 'Longitude inválida').max(180, 'Longitude inválida').nullable().optional(),
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
  const form = useForm<PropriedadeFormValues>({
    resolver: zodResolver(propriedadeSchema),
    defaultValues: {
      nome: '',
      area_total: null,
      localizacao: '',
      responsavel: '',
      latitude: null,
      longitude: null,
    },
  })

  useEffect(() => {
    if (open) {
      if (propriedade) {
        form.reset({
          nome: propriedade.nome,
          area_total: propriedade.area_total,
          localizacao: propriedade.localizacao || '',
          responsavel: propriedade.responsavel || '',
          latitude: propriedade.latitude ?? null,
          longitude: propriedade.longitude ?? null,
        })
      } else {
        form.reset({
          nome: '',
          area_total: null,
          localizacao: '',
          responsavel: '',
          latitude: null,
          longitude: null,
        })
      }
    }
  }, [open, propriedade, form])

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
                name="responsavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome do responsável"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="localizacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Localização</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Endereço completo, cidade, estado, coordenadas GPS..."
                      rows={3}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Informe o endereço, município, estado ou coordenadas GPS
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Coordenadas GPS</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!navigator.geolocation) return
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        form.setValue('latitude', Number(pos.coords.latitude.toFixed(6)))
                        form.setValue('longitude', Number(pos.coords.longitude.toFixed(6)))
                      },
                      () => {},
                      { timeout: 8000 }
                    )
                  }}
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  Usar minha localização
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.000001"
                          placeholder="-20.537000"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.000001"
                          placeholder="-47.401000"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Necessário para exibir a previsão do tempo no Dashboard.
                Clique em "Usar minha localização" se estiver na propriedade,
                ou consulte o Google Maps: clique com botão direito no local → copie as coordenadas.
              </p>
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
