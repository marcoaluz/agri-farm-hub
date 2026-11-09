import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LEGAL_PUBLICADO, TERMOS_VERSAO, PRIVACIDADE_VERSAO } from '@/lib/legal'

/**
 * Janela de aceite: aparece para quem ainda não aceitou a versão atual dos
 * Termos de Uso e da Política de Privacidade. Só continua depois de aceitar.
 * Cada aceite fica gravado em termos_aceites (versão, data/hora, navegador).
 * Desligada enquanto LEGAL_PUBLICADO = false.
 */
export function AceiteTermosGate() {
  const { user, signOut } = useAuth() as any
  const qc = useQueryClient()
  const [marcado, setMarcado] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const { data: aceitou, isLoading } = useQuery({
    queryKey: ['termos-aceite', user?.id, TERMOS_VERSAO, PRIVACIDADE_VERSAO],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('termos_aceites').select('id')
        .eq('usuario_id', user!.id).eq('versao_termos', TERMOS_VERSAO).eq('versao_privacidade', PRIVACIDADE_VERSAO)
        .limit(1)
      if (error) return true // erro de leitura não pode travar o sistema
      return (data || []).length > 0
    },
    enabled: LEGAL_PUBLICADO && !!user?.id,
    staleTime: 60 * 60 * 1000,
  })

  if (!LEGAL_PUBLICADO || !user?.id || isLoading || aceitou !== false) return null

  const aceitar = async () => {
    setSalvando(true)
    const { error } = await (supabase as any).from('termos_aceites').insert({
      usuario_id: user.id,
      versao_termos: TERMOS_VERSAO,
      versao_privacidade: PRIVACIDADE_VERSAO,
      user_agent: navigator.userAgent.slice(0, 300),
    })
    setSalvando(false)
    if (error) { toast.error('Não foi possível registrar o aceite. Tente de novo.'); return }
    qc.setQueryData(['termos-aceite', user.id, TERMOS_VERSAO, PRIVACIDADE_VERSAO], true)
  }

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Termos de Uso e Privacidade</DialogTitle>
          <DialogDescription>
            Para continuar usando o Agro GFI, leia e aceite os documentos abaixo (versão {TERMOS_VERSAO}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-col gap-1">
            <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Ler os Termos de Uso</a>
            <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Ler a Política de Privacidade</a>
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={marcado} onCheckedChange={(v) => setMarcado(v === true)} className="mt-0.5" />
            <span>Li e aceito os Termos de Uso e a Política de Privacidade do Agro GFI.</span>
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => signOut?.()} disabled={salvando}>Sair</Button>
          <Button onClick={() => void aceitar()} disabled={!marcado || salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Aceitar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
