import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useSafraContext } from '@/contexts/SafraContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Bot, X, Send, Mic, MicOff, Loader2, Sprout
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Mensagem {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function AssistenteIA() {
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([{
    id: '0',
    role: 'assistant',
    content: '👋 Olá! Sou o assistente do SGA. Pergunte sobre estoque, rebanho, lançamentos, financeiro ou qualquer dado da sua propriedade.',
    timestamp: new Date()
  }])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  const { propriedadeAtual } = useGlobal()
  const { safraSelecionada } = useSafraContext()

  const buscarContexto = useCallback(async () => {
    if (!propriedadeAtual?.id) return 'Nenhuma propriedade selecionada.'

    const propId = propriedadeAtual.id
    const safraId = safraSelecionada?.id

    const [
      { data: produtos },
      { data: rebanhos },
      { data: lancamentos },
      { data: transacoes },
      { data: talhoes },
      { data: maquinas },
      { data: sanitario },
    ] = await Promise.all([
      supabase.from('produtos')
        .select('nome, categoria, saldo_atual, unidade_medida, nivel_minimo')
        .eq('propriedade_id', propId).eq('ativo', true),
      supabase.from('rebanhos')
        .select('nome, especie, quantidade_atual, finalidade, localizacao')
        .eq('propriedade_id', propId).eq('ativo', true),
      supabase.from('lancamentos')
        .select('data_execucao, custo_total, servico:servicos(nome), talhao:talhoes(nome)')
        .eq('propriedade_id', propId)
        .eq('safra_id', safraId || '')
        .order('data_execucao', { ascending: false })
        .limit(20),
      supabase.from('transacoes')
        .select('tipo, categoria, descricao, valor, status, data_vencimento')
        .eq('propriedade_id', propId)
        .eq('safra_id', safraId || '')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('talhoes')
        .select('nome, area_ha, cultura_atual')
        .eq('propriedade_id', propId).eq('ativo', true),
      supabase.from('maquinas')
        .select('nome, modelo, horimetro_atual, custo_hora')
        .eq('propriedade_id', propId).eq('ativo', true),
      supabase.from('sanitario_eventos')
        .select('tipo, descricao, data_aplicacao, data_proxima, rebanho:rebanhos(nome)')
        .eq('propriedade_id', propId)
        .order('data_proxima', { ascending: true })
        .limit(10),
    ])

    return `
PROPRIEDADE ATUAL: ${propriedadeAtual.nome}
SAFRA ATUAL: ${safraSelecionada?.nome || 'Nenhuma selecionada'}

ESTOQUE DE PRODUTOS:
${(produtos || []).map((p: any) =>
  `- ${p.nome} (${p.categoria}): ${p.saldo_atual} ${p.unidade_medida}` +
  (p.nivel_minimo > 0 && p.saldo_atual <= p.nivel_minimo ? ' ⚠️ ABAIXO DO MÍNIMO' : '')
).join('\n') || 'Nenhum produto'}

REBANHO:
${(rebanhos || []).map((r: any) =>
  `- ${r.nome} (${r.especie}): ${r.quantidade_atual} animais — ${r.finalidade || ''} — ${r.localizacao || ''}`
).join('\n') || 'Nenhum rebanho'}

TALHÕES:
${(talhoes || []).map((t: any) =>
  `- ${t.nome}: ${t.area_ha} ha — Cultura: ${t.cultura_atual || 'não informada'}`
).join('\n') || 'Nenhum talhão'}

MÁQUINAS:
${(maquinas || []).map((m: any) =>
  `- ${m.nome} ${m.modelo || ''}: ${m.horimetro_atual}h — R$ ${m.custo_hora}/h`
).join('\n') || 'Nenhuma máquina'}

ÚLTIMOS LANÇAMENTOS (safra atual):
${(lancamentos || []).slice(0, 10).map((l: any) =>
  `- ${l.data_execucao}: ${l.servico?.nome || 'Serviço'} em ${l.talhao?.nome || 'sem talhão'} — R$ ${l.custo_total}`
).join('\n') || 'Nenhum lançamento'}

MOVIMENTAÇÕES FINANCEIRAS (safra atual):
Receitas pagas: R$ ${(transacoes || [])
  .filter((t: any) => t.tipo === 'receita' && t.status === 'pago')
  .reduce((s: number, t: any) => s + Number(t.valor), 0)
  .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Despesas pagas: R$ ${(transacoes || [])
  .filter((t: any) => t.tipo === 'despesa' && t.status === 'pago')
  .reduce((s: number, t: any) => s + Number(t.valor), 0)
  .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Pendentes: ${(transacoes || []).filter((t: any) => t.status === 'pendente').length} transação(ões)

EVENTOS SANITÁRIOS PRÓXIMOS:
${(sanitario || []).map((s: any) =>
  `- ${s.tipo}: ${s.descricao} (${s.rebanho?.nome || ''}) — próxima: ${s.data_proxima || 'não agendada'}`
).join('\n') || 'Nenhum evento próximo'}
    `.trim()
  }, [propriedadeAtual, safraSelecionada])

  const enviarMensagem = useCallback(async (texto: string) => {
    if (!texto.trim() || carregando) return

    const novaMensagemUsuario: Mensagem = {
      id: Date.now().toString(),
      role: 'user',
      content: texto.trim(),
      timestamp: new Date()
    }

    setMensagens(prev => [...prev, novaMensagemUsuario])
    setInput('')
    setCarregando(true)

    try {
      const contexto = await buscarContexto()

      const { data, error } = await supabase.functions.invoke('assistente-chat', {
        body: { pergunta: texto.trim(), contexto }
      })

      if (error) throw error

      const resposta = data?.resposta || '❌ Não consegui processar sua pergunta.'

      setMensagens(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: resposta,
        timestamp: new Date()
      }])
    } catch (err: any) {
      console.error('Erro assistente:', err)
      setMensagens(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Erro ao conectar com o assistente. Tente novamente.',
        timestamp: new Date()
      }])
    } finally {
      setCarregando(false)
    }
  }, [carregando, buscarContexto])

  const iniciarGravacao = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Seu navegador não suporta reconhecimento de voz. Use Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setGravando(true)
    recognition.onresult = (event: any) => {
      const texto = event.results[0][0].transcript
      setInput(texto)
      setGravando(false)
      setTimeout(() => enviarMensagem(texto), 300)
    }
    recognition.onerror = () => setGravando(false)
    recognition.onend = () => setGravando(false)

    recognitionRef.current = recognition
    recognition.start()
  }, [enviarMensagem])

  const pararGravacao = useCallback(() => {
    recognitionRef.current?.stop()
    setGravando(false)
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensagens])

  return (
    <>
      {/* Botão flutuante */}
      <Button
        onClick={() => setAberto(prev => !prev)}
        className={cn(
          'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg',
          'flex items-center justify-center transition-all duration-200',
          'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
        title="Assistente SGA"
        size="icon"
      >
        {aberto ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
      </Button>

      {/* Painel do chat */}
      {aberto && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden animate-fade-in"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary/5">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Sprout className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Assistente SGA</p>
              <p className="text-xs text-muted-foreground truncate">
                {propriedadeAtual?.nome || 'Selecione uma propriedade'}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAberto(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensagens.map(msg => (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                )}>
                  {msg.content.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < msg.content.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                  <p className={cn(
                    'text-[10px] mt-1',
                    msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                  )}>
                    {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {carregando && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sugestões rápidas */}
          {mensagens.filter(m => m.role === 'user').length === 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {[
                'Como está meu estoque?',
                'Quantos animais tenho?',
                'Resumo financeiro',
                'Próximas vacinas',
              ].map(sugestao => (
                <button
                  key={sugestao}
                  onClick={() => enviarMensagem(sugestao)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {sugestao}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-border">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviarMensagem(input)
                }
              }}
              placeholder={gravando ? '🎙️ Ouvindo...' : 'Pergunte algo...'}
              disabled={carregando || gravando}
              className="flex-1 text-sm"
            />

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={gravando ? pararGravacao : iniciarGravacao}
            >
              {gravando
                ? <MicOff className="h-4 w-4 text-destructive" />
                : <Mic className="h-4 w-4 text-muted-foreground" />}
            </Button>

            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => enviarMensagem(input)}
              disabled={!input.trim() || carregando}
            >
              {carregando
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
