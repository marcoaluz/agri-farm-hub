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
import { Loader2 } from 'lucide-react'

const propriedadeSchema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter no mínimo 3 caracteres').max(255, 'Nome muito longo'),
  area_total: z.coerce
    .number()
    .positive('Área deve ser maior que zero')
    .nullable()
    .optional(),
  localizacao: z.string().trim().max(500, 'Localização muito longa').optional().or(z.literal('')),
  responsavel: z.string().trim().max(255, 'Nome muito longo').optional().or(z.literal('')),
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
    },
  })

  // Reset form when propriedade changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      if (propriedade) {
        form.reset({
          nome: propriedade.nome,
          area_total: propriedade.area_total,
          localizacao: propriedade.localizacao || '',
          responsavel: propriedade.responsavel || '',
        })
      } else {
        form.reset({
          nome: '',
          area_total: null,
          localizacao: '',
          responsavel: '',
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
