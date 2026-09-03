import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ShieldCheck, ShieldAlert } from 'lucide-react'

interface StatusVacinacaoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rebanho: { id: string; nome: string } | null
}

export function StatusVacinacaoModal({ open, onOpenChange, rebanho }: StatusVacinacaoModalProps) {
  const { data: animais, isLoading } = useQuery({
    queryKey: ['status-vacinacao', rebanho?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_status_vacinacao_rebanho' as any, {
        p_rebanho_id: rebanho!.id,
      })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: open && !!rebanho?.id,
  })

  const fmtData = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Status de Vacinação — {rebanho?.nome}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !animais?.length ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            Esse rebanho não tem animais identificados individualmente.
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {animais.map((a: any) => (
              <AccordionItem key={a.animal_id || a.id} value={String(a.animal_id || a.id)}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left w-full pr-4">
                    {a.total_aplicacoes > 0 ? (
                      <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                    ) : (
                      <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.animal_nome || a.nome || a.identificador || a.numero_brinco || 'Sem nome'}
                        {a.sexo === 'macho' && <span className="text-blue-600 ml-1">♂</span>}
                        {a.sexo === 'femea' && <span className="text-pink-600 ml-1">♀</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.total_aplicacoes > 0
                          ? `${a.ultima_descricao} — ${fmtData(a.ultima_data)}`
                          : 'Nenhuma aplicação registrada'}
                      </p>
                    </div>
                    <Badge variant={a.total_aplicacoes > 0 ? 'default' : 'secondary'}>
                      {a.total_aplicacoes}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {a.total_aplicacoes > 0 && (
                    <div className="pl-2 pr-2 pb-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Aplicação</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Próxima</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(a.aplicacoes || []).map((ap: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell>{ap.descricao}</TableCell>
                              <TableCell>{fmtData(ap.data_aplicacao)}</TableCell>
                              <TableCell>{fmtData(ap.data_proxima)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  )
}
