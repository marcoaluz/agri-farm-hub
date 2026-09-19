import { useMemo, useState } from 'react'
import { format, parseISO, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileText, Paperclip, Loader2, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useGlobal } from '@/contexts/GlobalContext'
import { usePapelUsuario } from '@/hooks/usePapelUsuario'
import { useBalanceteMensal, useToggleFechamento, useGarantirFechamento, type BalanceteMes } from '@/hooks/useFechamentoContabil'
import { Anexos } from '@/components/Anexos'
import { exportarBalanceteGeralPDF, exportarMovimentoCaixaPDF } from '@/lib/exportTabela'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const ANO_ATUAL = new Date().getFullYear()
const ANOS_DISPONIVEIS = Array.from({ length: 6 }, (_, i) => ANO_ATUAL - i)

type FiltroStatus = 'todos' | 'aberto' | 'contabilizado'

export function FechamentoContabil() {
  const { propriedadeAtual } = useGlobal()
  const propId = propriedadeAtual?.id
  const { ehProprietarioOuGerente } = usePapelUsuario()

  const [ano, setAno] = useState(ANO_ATUAL)
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [anexoAlvo, setAnexoAlvo] = useState<{ mes: number; fechamentoId: string } | null>(null)
  const [gerandoMovimentoMes, setGerandoMovimentoMes] = useState<number | null>(null)
  const [gerandoBalancete, setGerandoBalancete] = useState(false)

  const { data: balancete = [], isLoading } = useBalanceteMensal(propId, ano)
  const toggleFechamento = useToggleFechamento(propId, ano)
  const garantirFechamento = useGarantirFechamento(propId, ano)

  const linhasFiltradas = useMemo(() => {
    if (filtroStatus === 'aberto') return balancete.filter((m) => !m.contabilizado)
    if (filtroStatus === 'contabilizado') return balancete.filter((m) => m.contabilizado)
    return balancete
  }, [balancete, filtroStatus])

  const abrirAnexos = (m: BalanceteMes) => {
    if (m.fechamento_id) {
      setAnexoAlvo({ mes: m.mes, fechamentoId: m.fechamento_id })
      return
    }
    garantirFechamento.mutate(m.mes, {
      onSuccess: (id) => setAnexoAlvo({ mes: m.mes, fechamentoId: id }),
      onError: (e: any) => toast.error(e?.message || 'Erro ao criar fechamento do mês'),
    })
  }

  const baixarBalanceteGeral = async () => {
    if (!propId || balancete.length === 0) return
    setGerandoBalancete(true)
    try {
      await exportarBalanceteGeralPDF({
        nomeArquivo: `balancete-geral-${ano}`,
        propriedadeNome: propriedadeAtual?.nome || '',
        proprietarioNome: propriedadeAtual?.responsavel || '',
        ano,
        meses: balancete.map((m) => ({ mes: m.mes, credito: m.credito, debito: m.debito, saldo: m.saldo })),
      })
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar o Balancete Geral')
    } finally {
      setGerandoBalancete(false)
    }
  }

    const baixarMovimentoCaixa = async (mes: number) => {
    if (!propId) return
    setGerandoMovimentoMes(mes)
    try {
      const inicioMes = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd')
      const fimMes = format(endOfMonth(new Date(ano, mes - 1, 1)), 'yyyy-MM-dd')

      const [{ data: doMes, error: errMes }, { data: anteriores, error: errAnt }] = await Promise.all([
        supabase
          .from('vw_movimentos_financeiros')
          .select('data_referencia, descricao, valor, tipo, numero_nf, fornecedor_cliente')
          .eq('propriedade_id', propId)
          .eq('status', 'pago')
          .gte('data_referencia', inicioMes)
          .lte('data_referencia', fimMes)
          .order('data_referencia', { ascending: true }),
        supabase
          .from('vw_movimentos_financeiros')
          .select('tipo, valor')
          .eq('propriedade_id', propId)
          .eq('status', 'pago')
          .lt('data_referencia', inicioMes),
      ])
      if (errMes) throw errMes
      if (errAnt) throw errAnt

      const saldoAnterior = (anteriores || []).reduce(
        (s: number, t: any) => s + (t.tipo === 'receita' ? Number(t.valor) : -Number(t.valor)),
        0
      )

      const linhas = (doMes || []).map((t: any) => {
        const partes = [t.descricao]
        if (t.fornecedor_cliente) partes.push(t.fornecedor_cliente)
        if (t.numero_nf) partes.push(`NF ${t.numero_nf}`)
        return {
          data: format(parseISO(t.data_referencia), 'dd/MM/yyyy'),
          historico: partes.join(' — '),
          entrada: t.tipo === 'receita' ? Number(t.valor) : 0,
          saida: t.tipo === 'despesa' ? Number(t.valor) : 0,
        }
      })

      await exportarMovimentoCaixaPDF({
        nomeArquivo: `movimento-caixa-${ano}-${String(mes).padStart(2, '0')}`,
        propriedadeNome: propriedadeAtual?.nome || '',
        proprietarioNome: propriedadeAtual?.responsavel || '',
        mesLabel: `${NOMES_MESES[mes - 1]} de ${ano}`,
        linhas,
        saldoAnterior,
      })
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar o Movimento do Caixa')
    } finally {
      setGerandoMovimentoMes(null)
    }
  }

  if (!propId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Selecione uma propriedade para ver o fechamento contábil.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[110px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border border-border">
              {ANOS_DISPONIVEIS.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as FiltroStatus)}>
            <SelectTrigger className="w-[150px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border border-border">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberto">Em aberto</SelectItem>
              <SelectItem value="contabilizado">Contabilizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline" size="sm" disabled={gerandoBalancete || balancete.length === 0}
          onClick={baixarBalanceteGeral}
        >
          {gerandoBalancete
            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando...</>
            : <><FileText className="h-4 w-4 mr-1" /> Balancete Geral (PDF)</>}
        </Button>
      </div>

      <Card>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Anexos</TableHead>
                <TableHead className="text-right">Relatório</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : linhasFiltradas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum mês encontrado para este filtro.</TableCell></TableRow>
              ) : linhasFiltradas.map((m) => (
                <TableRow key={m.mes}>
                  <TableCell className="font-medium">{NOMES_MESES[m.mes - 1]}</TableCell>
                  <TableCell className="text-right text-success">{fmt(m.credito)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmt(m.debito)}</TableCell>
                  <TableCell className={m.saldo >= 0 ? 'text-right font-medium text-success' : 'text-right font-medium text-destructive'}>{fmt(m.saldo)}</TableCell>
                  <TableCell>
                    {ehProprietarioOuGerente ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={m.contabilizado}
                          disabled={toggleFechamento.isPending}
                          onCheckedChange={(checked) =>
                            toggleFechamento.mutate(
                              { mes: m.mes, contabilizado: checked },
                              {
                                onSuccess: () => toast.success(checked ? 'Mês contabilizado' : 'Mês reaberto'),
                                onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar status'),
                              }
                            )
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {m.contabilizado ? 'Contabilizado' : 'Em aberto'}
                        </span>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className={m.contabilizado
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'}
                      >
                        {m.contabilizado ? 'Contabilizado' : 'Em aberto'}
                      </Badge>
                    )}
                    {m.contabilizado && m.contabilizado_por_nome && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        por {m.contabilizado_por_nome}
                        {m.contabilizado_em && ` em ${format(parseISO(m.contabilizado_em), 'dd/MM/yyyy')}`}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {!m.fechamento_id ? (
                      ehProprietarioOuGerente ? (
                        <Button
                          size="sm" variant="ghost" className="h-7 text-xs"
                          disabled={garantirFechamento.isPending}
                          onClick={() => abrirAnexos(m)}
                        >
                          <Paperclip className="h-3.5 w-3.5 mr-1" /> Anexar
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => abrirAnexos(m)}>
                        <Paperclip className="h-3.5 w-3.5 mr-1" /> {m.qtd_anexos || 0}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7" title="Movimento do Caixa deste mês"
                      disabled={gerandoMovimentoMes === m.mes}
                      onClick={() => baixarMovimentoCaixa(m.mes)}
                    >
                      {gerandoMovimentoMes === m.mes
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile: cards */}
        <div className="block md:hidden p-3 space-y-2">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : linhasFiltradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum mês encontrado para este filtro.</p>
          ) : linhasFiltradas.map((m) => (
            <Card key={m.mes}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{NOMES_MESES[m.mes - 1]}</span>
                  {ehProprietarioOuGerente ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{m.contabilizado ? 'Contabilizado' : 'Em aberto'}</span>
                      <Switch
                        checked={m.contabilizado}
                        disabled={toggleFechamento.isPending}
                        onCheckedChange={(checked) =>
                          toggleFechamento.mutate(
                            { mes: m.mes, contabilizado: checked },
                            {
                              onSuccess: () => toast.success(checked ? 'Mês contabilizado' : 'Mês reaberto'),
                              onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar status'),
                            }
                          )
                        }
                      />
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className={m.contabilizado
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'}
                    >
                      {m.contabilizado ? 'Contabilizado' : 'Em aberto'}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Crédito</p><p className="text-success">{fmt(m.credito)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Débito</p><p className="text-destructive">{fmt(m.debito)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Saldo</p><p className={m.saldo >= 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>{fmt(m.saldo)}</p></div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  {!m.fechamento_id ? (
                    ehProprietarioOuGerente ? (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={garantirFechamento.isPending} onClick={() => abrirAnexos(m)}>
                        <Paperclip className="h-3.5 w-3.5 mr-1" /> Anexar
                      </Button>
                    ) : <span className="text-sm text-muted-foreground">Sem anexos</span>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => abrirAnexos(m)}>
                      <Paperclip className="h-3.5 w-3.5 mr-1" /> {m.qtd_anexos || 0} anexo(s)
                    </Button>
                  )}
                  <Button
                    size="sm" variant="outline" className="h-8 text-xs"
                    disabled={gerandoMovimentoMes === m.mes}
                    onClick={() => baixarMovimentoCaixa(m.mes)}
                  >
                    {gerandoMovimentoMes === m.mes
                      ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      : <Download className="h-3.5 w-3.5 mr-1" />}
                    Movimento
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Card>

      <Dialog open={!!anexoAlvo} onOpenChange={(open) => !open && setAnexoAlvo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Anexos — {anexoAlvo ? NOMES_MESES[anexoAlvo.mes - 1] : ''} de {ano}
            </DialogTitle>
          </DialogHeader>
          {anexoAlvo && (
            <Anexos
              entidadeTipo="fechamento_contabil"
              entidadeId={anexoAlvo.fechamentoId}
              propriedadeId={propId}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
