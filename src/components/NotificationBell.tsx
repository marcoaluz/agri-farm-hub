import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Eye, Home } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useGlobal } from '@/contexts/GlobalContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface Notificacao {
  id: string
  titulo: string
  mensagem: string | null
  link_acao: string | null
  lida: boolean
  created_at: string
  propriedade_id: string | null
  propriedade_nome: string | null
  dados: any
}

export function NotificationBell() {
  const { user } = useAuth()
  const { propriedadeAtual } = useGlobal()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(false)

  // null (Visão Geral) = mostra de todas as propriedades. Com propriedade selecionada = filtra.
  const propriedadeFiltro = propriedadeAtual?.id ?? null

  const fetchCount = useCallback(async () => {
    const { data, error } = await supabase.rpc('contar_notificacoes_nao_lidas' as any, {
      p_propriedade_id: propriedadeFiltro,
    })
    if (!error && data != null) setCount(Number(data) || 0)
  }, [propriedadeFiltro])

  const fetchList = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('listar_minhas_notificacoes' as any, {
      p_apenas_nao_lidas: false,
      p_limite: 30,
      p_propriedade_id: propriedadeFiltro,
    })
    if (!error && Array.isArray(data)) setItems(data as Notificacao[])
    setLoading(false)
  }, [propriedadeFiltro])

  useEffect(() => {
    if (!user) return
    fetchCount()
  }, [user, fetchCount])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${user.id}`,
        },
        (payload: any) => {
          const nova = payload.new as Notificacao
          // Só conta/avisa em tela se bater com o filtro atual (propriedade selecionada ou visão geral)
          const bateComFiltro = !propriedadeFiltro || !nova.propriedade_id || nova.propriedade_id === propriedadeFiltro
          if (!bateComFiltro) return

          setCount((c) => c + 1)
          if (nova?.titulo) {
            toast(nova.titulo, { description: nova.mensagem || undefined })
          }
          if (open) fetchList()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, open, fetchList, propriedadeFiltro])

  const handleOpenChange = async (value: boolean) => {
    setOpen(value)
    if (!value) return

    await fetchList()

    if (count > 0) {
      // Marca como lidas só as que estão sendo mostradas (respeitando o filtro atual)
      await supabase.rpc('marcar_todas_notificacoes_lidas' as any)
      setCount(0)
      setItems((prev) => prev.map((item) => ({ ...item, lida: true })))
    }
  }

  const handleClickItem = async (n: Notificacao) => {
    if (!n.lida) {
      await supabase.rpc('marcar_notificacao_lida' as any, { p_notificacao_id: n.id })
    }
    setOpen(false)
    await Promise.all([fetchCount(), fetchList()])
    if (n.link_acao) navigate(n.link_acao)
  }

  const handleMarcarTodas = async () => {
    await supabase.rpc('marcar_todas_notificacoes_lidas' as any)
    await Promise.all([fetchCount(), fetchList()])
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full p-0 flex items-center justify-center text-[10px] sm:text-xs"
            >
              {count > 99 ? '99+' : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 bg-popover border border-border z-50"
      >
        <div className="flex items-start justify-between px-3 py-2 border-b border-border">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Home className="h-3 w-3" />
              {propriedadeAtual ? propriedadeAtual.nome : 'Todas as propriedades'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 shrink-0"
            onClick={handleMarcarTodas}
            disabled={count === 0}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas como lidas
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Carregando…
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            items.map((n) => {
              const compartilhado = n.dados?.compartilhado === true
              return (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-accent transition-colors',
                    !n.lida && 'bg-blue-50 dark:bg-blue-950/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{n.titulo}</p>
                    {n.lida && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <Eye className="h-3 w-3" />
                        Visto
                      </span>
                    )}
                  </div>
                  {n.mensagem && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.mensagem}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                    {n.propriedade_nome && !compartilhado && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        {n.propriedade_nome}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
