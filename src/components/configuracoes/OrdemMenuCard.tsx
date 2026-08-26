import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowUp, ArrowDown, ListOrdered, RotateCcw } from 'lucide-react'
import { routes } from '@/components/layout/Sidebar'

const ROTAS_ORDENAVEIS = routes.filter(r => r.href !== '/')

export function OrdemMenuCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [ordem, setOrdem] = useState(ROTAS_ORDENAVEIS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_profiles' as any)
      .select('menu_order')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const salvo = (data as any)?.menu_order as string[] | null
        if (salvo && salvo.length > 0) {
          const ordenado = [...ROTAS_ORDENAVEIS].sort((a, b) => {
            const ia = salvo.indexOf(a.href)
            const ib = salvo.indexOf(b.href)
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
          })
          setOrdem(ordenado)
        }
      })
  }, [user])

  async function salvar(novaOrdem: typeof ROTAS_ORDENAVEIS) {
    setOrdem(novaOrdem)
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('user_profiles' as any)
      .update({ menu_order: novaOrdem.map(r => r.href) })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao salvar ordem do menu', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Ordem do menu atualizada' })
  }

  function mover(index: number, direcao: -1 | 1) {
    const novoIndex = index + direcao
    if (novoIndex < 0 || novoIndex >= ordem.length) return
    const nova = [...ordem]
    ;[nova[index], nova[novoIndex]] = [nova[novoIndex], nova[index]]
    salvar(nova)
  }

  async function restaurarPadrao() {
    setOrdem(ROTAS_ORDENAVEIS)
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('user_profiles' as any)
      .update({ menu_order: null })
      .eq('id', user.id)
    setSaving(false)
    if (!error) toast({ title: 'Ordem do menu restaurada ao padrão' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListOrdered className="h-5 w-5" />
          Ordem do Menu
        </CardTitle>
        <CardDescription>
          Organize a ordem das telas do menu lateral do seu jeito. O Dashboard fica sempre em primeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {ordem.map((route, i) => (
          <div
            key={route.href}
            className="flex items-center gap-2 rounded-md border border-border p-2"
          >
            <route.icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">{route.label}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={saving || i === 0}
              onClick={() => mover(i, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={saving || i === ordem.length - 1}
              onClick={() => mover(i, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          disabled={saving}
          onClick={restaurarPadrao}
        >
          <RotateCcw className="h-4 w-4" />
          Restaurar ordem padrão
        </Button>
      </CardContent>
    </Card>
  )
}
