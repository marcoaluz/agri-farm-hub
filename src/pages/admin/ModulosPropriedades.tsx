import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Puzzle, ChevronDown, Search, User, MapPin,
  Beef, Wheat, DollarSign, BarChart3, ShieldCheck
} from 'lucide-react'
import { Navigate } from 'react-router-dom'

const MODULOS = [
  { key: 'pecuaria', label: 'Pecuária', icon: Beef },
  { key: 'lavoura', label: 'Lavoura', icon: Wheat },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { key: 'auditoria', label: 'Auditoria', icon: ShieldCheck },
] as const

type ModuloKey = typeof MODULOS[number]['key']

interface Modulos {
  pecuaria: boolean
  lavoura: boolean
  financeiro: boolean
  relatorios: boolean
  auditoria: boolean
}

interface Propriedade {
  id: string
  nome: string
  safra: string | null
  modulos: Modulos
}

interface Proprietario {
  id: string
  nome: string
  email: string
  propriedades: Propriedade[]
}

export default function ModulosPropriedades() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [localState, setLocalState] = useState<Record<string, Modulos>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  // Check admin
  const { data: perfil, isLoading: loadingPerfil } = useQuery({
    queryKey: ['user-profile-admin-check', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles' as any)
        .select('perfil, is_super_admin')
        .eq('id', user!.id)
        .single()
      return data as any
    },
    enabled: !!user?.id,
  })

  const isAdmin = perfil?.perfil === 'admin' || perfil?.is_super_admin === true

  const { data: lista, isLoading: loadingData } = useQuery({
    queryKey: ['admin-proprietarios-modulos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_proprietarios_e_propriedades' as any)
      if (error) throw error

      const agrupado: Record<string, Proprietario> = {}
      ;(data as any[]).forEach((row: any) => {
        if (!agrupado[row.usuario_id]) {
          agrupado[row.usuario_id] = {
            id: row.usuario_id,
            nome: row.usuario_nome || 'Sem nome',
            email: row.usuario_email || '',
            propriedades: [],
          }
        }
        if (row.propriedade_id) {
          agrupado[row.usuario_id].propriedades.push({
            id: row.propriedade_id,
            nome: row.propriedade_nome,
            safra: row.safra_ativa_nome,
            modulos: {
              pecuaria: row.mod_pecuaria ?? true,
              lavoura: row.mod_lavoura ?? true,
              financeiro: row.mod_financeiro ?? true,
              relatorios: row.mod_relatorios ?? true,
              auditoria: row.mod_auditoria ?? true,
            },
          })
        }
      })
      return Object.values(agrupado)
    },
    enabled: isAdmin === true,
  })

  const filtrado = useMemo(() => {
    if (!lista) return []
    if (!busca.trim()) return lista
    const termo = busca.toLowerCase()
    return lista
      .map((owner) => ({
        ...owner,
        propriedades: owner.propriedades.filter(
          (p) =>
            p.nome.toLowerCase().includes(termo) ||
            owner.nome.toLowerCase().includes(termo) ||
            owner.email.toLowerCase().includes(termo)
        ),
      }))
      .filter((owner) =>
        owner.propriedades.length > 0 ||
        owner.nome.toLowerCase().includes(termo) ||
        owner.email.toLowerCase().includes(termo)
      )
  }, [lista, busca])

  function getModulo(propId: string, key: ModuloKey, serverModulos: Modulos): boolean {
    if (localState[propId]) return localState[propId][key]
    return serverModulos[key]
  }

  async function handleToggle(propId: string, key: ModuloKey, value: boolean, serverModulos: Modulos) {
    const current = localState[propId] || { ...serverModulos }
    const updated = { ...current, [key]: value }
    setLocalState((prev) => ({ ...prev, [propId]: updated }))
    const savingKey = `${propId}-${key}`
    setSaving((prev) => ({ ...prev, [savingKey]: true }))

    const { error } = await supabase.from('propriedade_modulos' as any).upsert(
      {
        propriedade_id: propId,
        pecuaria: updated.pecuaria,
        lavoura: updated.lavoura,
        financeiro: updated.financeiro,
        relatorios: updated.relatorios,
        auditoria: updated.auditoria,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'propriedade_id' }
    )

    setSaving((prev) => ({ ...prev, [savingKey]: false }))

    if (error) {
      setLocalState((prev) => {
        const next = { ...prev }
        delete next[propId]
        return next
      })
      toast.error('Erro ao salvar módulo: ' + error.message)
    } else {
      toast.success(`${MODULOS.find((m) => m.key === key)?.label} ${value ? 'ativado' : 'desativado'}`)
      queryClient.invalidateQueries({ queryKey: ['propriedade-modulos'] })
      queryClient.invalidateQueries({ queryKey: ['admin-proprietarios-modulos'] })
    }
  }

  if (loadingPerfil) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (!isAdmin) return <Navigate to="/dashboard" replace />

  const isLoading = loadingData

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Puzzle className="h-6 w-6" />
          Configuração de Módulos
        </h1>
        <p className="text-muted-foreground">Ative ou desative módulos por propriedade de cada proprietário</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar proprietário ou propriedade..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !filtrado?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {busca ? 'Nenhum resultado para a busca.' : 'Nenhum proprietário com propriedades encontrado.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtrado.map((owner) => (
            <Collapsible key={owner.id} defaultOpen>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-t-lg">
                    <div className="flex items-center gap-3 text-left">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{owner.nome}</p>
                        <p className="text-xs text-muted-foreground">{owner.email}</p>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {owner.propriedades.length} propriedade{owner.propriedades.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t divide-y">
                    {owner.propriedades.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">Nenhuma propriedade cadastrada.</p>
                    ) : (
                      owner.propriedades.map((prop) => (
                        <div key={prop.id} className="p-4 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{prop.nome}</span>
                            </div>
                            {prop.safra && (
                              <Badge variant="secondary" className="text-xs">
                                Safra: {prop.safra}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4">
                            {MODULOS.map((m) => {
                              const Icon = m.icon
                              const checked = getModulo(prop.id, m.key, prop.modulos)
                              const isSaving = saving[`${prop.id}-${m.key}`]
                              return (
                                <div
                                  key={m.key}
                                  className="flex items-center gap-2 min-w-[140px]"
                                >
                                  <Icon className={`h-4 w-4 ${checked ? 'text-primary' : 'text-muted-foreground'}`} />
                                  <span className="text-sm">{m.label}</span>
                                  <Switch
                                    checked={checked}
                                    disabled={isSaving}
                                    onCheckedChange={(v) => handleToggle(prop.id, m.key, v, prop.modulos)}
                                    className={isSaving ? 'opacity-50' : ''}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Legenda</p>
        <p>🟢 Módulo ativo — aparece no menu da propriedade</p>
        <p>⚫ Módulo inativo — oculto para usuários dessa propriedade</p>
        <p className="text-xs mt-2">Estoque, Serviços, Lançamentos e Máquinas são sempre visíveis (não configuráveis).</p>
      </div>
    </div>
  )
}
