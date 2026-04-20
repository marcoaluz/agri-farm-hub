import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Home,
  Search,
  ChevronDown,
  LayoutDashboard,
  User,
  Wheat,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminPropriedade {
  propriedade_id: string
  propriedade_nome: string
  dono_id: string
  dono_nome: string
  area_total: number | null
  latitude?: number | null
  longitude?: number | null
  safra_ativa_id: string | null
  safra_ativa_nome: string | null
  total_talhoes: number
  total_lancamentos: number
}

interface Proprietario {
  id: string
  nome: string
  propriedades: {
    id: string
    nome: string
    safra_ativa_id: string | null
    safra_ativa_nome: string | null
    area_total: number | null
  }[]
}

interface AdminPropertyPickerProps {
  propriedadeSelecionada: { id: string; nome: string } | null
  onSelectPropriedade: (prop: {
    id: string
    nome: string
    area_total: number | null
    latitude?: number | null
    longitude?: number | null
    safra_ativa_id: string | null
    safra_ativa_nome: string | null
    dono_nome: string
  } | null) => void
  className?: string
}

export function AdminPropertyPicker({
  propriedadeSelecionada,
  onSelectPropriedade,
  className,
}: AdminPropertyPickerProps) {
  const [open, setOpen] = useState(false)
  const [adminData, setAdminData] = useState<AdminPropriedade[]>([])
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([])
  const [proprietarioSelecionado, setProprietarioSelecionado] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Encontrar dono da propriedade selecionada
  const selectedAdminProp = adminData.find(
    (ap) => ap.propriedade_id === propriedadeSelecionada?.id
  )

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.rpc('get_todas_propriedades_admin' as any)
      if (error) {
        console.error('Erro ao carregar propriedades admin:', error)
        return
      }
      const items = (data || []) as AdminPropriedade[]
      setAdminData(items)

      const groups = new Map<string, Proprietario>()
      for (const row of items) {
        if (!groups.has(row.dono_id)) {
          groups.set(row.dono_id, { id: row.dono_id, nome: row.dono_nome || 'Sem proprietário', propriedades: [] })
        }
        groups.get(row.dono_id)!.propriedades.push({
          id: row.propriedade_id,
          nome: row.propriedade_nome,
          safra_ativa_id: row.safra_ativa_id,
          safra_ativa_nome: row.safra_ativa_nome,
          area_total: row.area_total,
        })
      }
      const sorted = Array.from(groups.values()).sort((a, b) => a.nome.localeCompare(b.nome))
      setProprietarios(sorted)
      if (sorted.length > 0 && !proprietarioSelecionado) {
        setProprietarioSelecionado(sorted[0].id)
      }
    }
    fetch()
  }, [])

  // When opening, auto-select the owner of the current property
  useEffect(() => {
    if (open && selectedAdminProp) {
      setProprietarioSelecionado(selectedAdminProp.dono_id)
    }
  }, [open])

  // Auto-focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 100)
    } else {
      setBusca('')
    }
  }, [open])

  const proprietariosFiltrados = useMemo(() => {
    if (!busca.trim()) return proprietarios
    const lower = busca.toLowerCase()
    return proprietarios.filter(
      (p) =>
        p.nome.toLowerCase().includes(lower) ||
        p.propriedades.some((pr) => pr.nome.toLowerCase().includes(lower))
    )
  }, [proprietarios, busca])

  const propriedadesDoProprietario = useMemo(() => {
    if (!proprietarioSelecionado) return []
    const p = proprietarios.find((pr) => pr.id === proprietarioSelecionado)
    return p?.propriedades || []
  }, [proprietarios, proprietarioSelecionado])

  const handleSelectProp = (prop: typeof propriedadesDoProprietario[0]) => {
    const adminRow = adminData.find((a) => a.propriedade_id === prop.id)
    onSelectPropriedade({
      id: prop.id,
      nome: prop.nome,
      area_total: prop.area_total,
      latitude: adminRow?.latitude ?? null,
      longitude: adminRow?.longitude ?? null,
      safra_ativa_id: prop.safra_ativa_id,
      safra_ativa_nome: prop.safra_ativa_nome,
      dono_nome: adminRow?.dono_nome || '',
    })
    setOpen(false)
  }

  const handleVisaoGeral = () => {
    onSelectPropriedade(null)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between bg-card min-w-[180px] max-w-[300px]', className)}
        >
          <div className="flex flex-col items-start truncate">
            {propriedadeSelecionada ? (
              <>
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{propriedadeSelecionada.nome}</span>
                </div>
                {selectedAdminProp && (
                  <span className="text-[10px] text-muted-foreground truncate ml-6">
                    {selectedAdminProp.dono_nome}
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-success" />
                <span className="font-medium text-success text-sm">Visão Geral</span>
              </div>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[460px] p-0 z-[60]" align="start">
        {/* Visão Geral */}
        <button
          onClick={handleVisaoGeral}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left',
            !propriedadeSelecionada && 'bg-accent'
          )}
        >
          <LayoutDashboard className="h-3.5 w-3.5 text-success shrink-0" />
          <span className="font-medium">Visão Geral</span>
          <span className="text-xs text-muted-foreground">— todas as propriedades</span>
          {!propriedadeSelecionada && <Check className="h-3.5 w-3.5 ml-auto text-success" />}
        </button>

        <Separator />

        <div className="flex" style={{ height: 320 }}>
          {/* Left column: Owners */}
          <div className="w-[200px] border-r border-border flex flex-col">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Buscar proprietário..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {proprietariosFiltrados.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Nenhum encontrado
                </p>
              ) : (
                proprietariosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProprietarioSelecionado(p.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2',
                      proprietarioSelecionado === p.id && 'bg-accent font-medium'
                    )}
                  >
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col truncate">
                      <span className="truncate text-xs">{p.nome}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.propriedades.length} propriedade{p.propriedades.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Right column: Properties */}
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Propriedades
              </p>
            </div>
            <ScrollArea className="flex-1">
              {propriedadesDoProprietario.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Selecione um proprietário
                </p>
              ) : (
                propriedadesDoProprietario.map((prop) => {
                  const isSelected = propriedadeSelecionada?.id === prop.id
                  return (
                    <button
                      key={prop.id}
                      onClick={() => handleSelectProp(prop)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-start gap-2',
                        isSelected && 'bg-accent'
                      )}
                    >
                      <Home className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col truncate flex-1">
                        <span className="text-sm truncate">{prop.nome}</span>
                        {prop.safra_ativa_nome && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Wheat className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground truncate">
                              {prop.safra_ativa_nome}
                            </span>
                          </div>
                        )}
                        {prop.area_total && (
                          <span className="text-[10px] text-muted-foreground">
                            {prop.area_total.toLocaleString('pt-BR')} ha
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 mt-0.5 text-success shrink-0" />}
                    </button>
                  )
                })
              )}
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
