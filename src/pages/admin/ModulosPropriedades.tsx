import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Puzzle } from 'lucide-react'

const MODULOS = [
  { key: 'lavoura', label: 'Lavoura' },
  { key: 'pecuaria', label: 'Pecuária' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'auditoria', label: 'Auditoria' },
] as const

type ModuloKey = typeof MODULOS[number]['key']

interface PropModulos {
  propriedade_id: string
  lavoura: boolean
  pecuaria: boolean
  financeiro: boolean
  relatorios: boolean
  auditoria: boolean
}

export default function ModulosPropriedades() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [localState, setLocalState] = useState<Record<string, PropModulos>>({})

  const { data: propriedades, isLoading: loadingProps } = useQuery({
    queryKey: ['admin-propriedades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propriedades' as any)
        .select('id, nome, localizacao, ativo')
        .order('nome')
      if (error) throw error
      return data as any[]
    },
  })

  const { data: modulosData, isLoading: loadingMod } = useQuery({
    queryKey: ['admin-modulos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propriedade_modulos' as any)
        .select('*')
      if (error) throw error
      const map: Record<string, PropModulos> = {}
      ;(data as any[]).forEach((m: any) => {
        map[m.propriedade_id] = {
          propriedade_id: m.propriedade_id,
          lavoura: m.lavoura ?? true,
          pecuaria: m.pecuaria ?? true,
          financeiro: m.financeiro ?? m.financei ?? true,
          relatorios: m.relatorios ?? true,
          auditoria: m.auditoria ?? true,
        }
      })
      return map
    },
  })

  const isLoading = loadingProps || loadingMod

  function getModulo(propId: string, key: ModuloKey): boolean {
    if (localState[propId]) return localState[propId][key]
    if (modulosData?.[propId]) return modulosData[propId][key]
    return true // default
  }

  async function handleToggle(propId: string, key: ModuloKey, value: boolean) {
    // Optimistic update
    const current = localState[propId] || modulosData?.[propId] || {
      propriedade_id: propId,
      lavoura: true, pecuaria: true, financeiro: true, relatorios: true, auditoria: true,
    }
    const updated = { ...current, [key]: value }
    setLocalState(prev => ({ ...prev, [propId]: updated }))

    const payload = {
      propriedade_id: propId,
      lavoura: updated.lavoura,
      pecuaria: updated.pecuaria,
      financei: updated.financeiro,
      relatorios: updated.relatorios,
      auditoria: updated.auditoria,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('propriedade_modulos' as any).upsert(payload as any, { onConflict: 'propriedade_id' })

    if (error) {
      // Revert
      setLocalState(prev => {
        const next = { ...prev }
        delete next[propId]
        return next
      })
      toast({ title: 'Erro ao atualizar módulo', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: `${MODULOS.find(m => m.key === key)?.label} ${value ? 'ativado' : 'desativado'}` })
      queryClient.invalidateQueries({ queryKey: ['propriedade-modulos'] })
      queryClient.invalidateQueries({ queryKey: ['admin-modulos'] })
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Puzzle className="h-6 w-6" />
          Configuração de Módulos
        </h1>
        <p className="text-muted-foreground">Ative ou desative módulos por propriedade</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulos por Propriedade</CardTitle>
          <CardDescription>Cada toggle controla a visibilidade do módulo na sidebar da propriedade</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !propriedades?.length ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma propriedade cadastrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Propriedade</TableHead>
                    {MODULOS.map(m => (
                      <TableHead key={m.key} className="text-center">{m.label}</TableHead>
                    ))}
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propriedades.map((prop: any) => (
                    <TableRow key={prop.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{prop.nome}</span>
                          {prop.localizacao && (
                            <span className="block text-xs text-muted-foreground">{prop.localizacao}</span>
                          )}
                        </div>
                      </TableCell>
                      {MODULOS.map(m => (
                        <TableCell key={m.key} className="text-center">
                          <Switch
                            checked={getModulo(prop.id, m.key)}
                            onCheckedChange={(v) => handleToggle(prop.id, m.key, v)}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Badge variant={prop.ativo !== false ? 'default' : 'secondary'}>
                          {prop.ativo !== false ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Legenda</p>
        <p>🟢 Módulo ativo — aparece no menu da propriedade</p>
        <p>⚫ Módulo inativo — oculto para usuários dessa propriedade</p>
        <p className="text-xs mt-2">Estoque, Serviços, Lançamentos e Máquinas são sempre visíveis (não configuráveis).</p>
      </div>
    </div>
  )
}
