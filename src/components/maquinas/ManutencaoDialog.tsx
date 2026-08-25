import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarIcon, Wrench, Plus, Check, X, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { consumirFIFO } from '@/lib/fifoConsumo';

interface Maquina {
  id: string;
  nome: string;
  horimetro_atual: number;
  unidade_calculo?: string;
  km_atual?: number;
}

interface CategoriaManutencaoRow {
  id: string;
  nome: string;
}

interface ManutencaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maquina: Maquina | null;
  propriedadeId: string;
}

export function ManutencaoDialog({ open, onOpenChange, maquina, propriedadeId }: ManutencaoDialogProps) {
  const ehKm = maquina?.unidade_calculo === 'km';
  const medidorAtual = ehKm ? (maquina?.km_atual || 0) : (maquina?.horimetro_atual || 0);
  const labelMedidor = ehKm ? 'Km' : 'Horímetro';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState('agendada');
  const [dataPrevista, setDataPrevista] = useState<Date | undefined>(new Date());
  const [dataRealizada, setDataRealizada] = useState<Date | undefined>(new Date());
  const [horimetroManutencao, setHorimetroManutencao] = useState('');
  const [proximoHorimetro, setProximoHorimetro] = useState('');
  const [oficina, setOficina] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // ── Origem do custo: Estoque ou Livre ──
  const [origemEstoque, setOrigemEstoque] = useState(false);
  const [produtoId, setProdutoId] = useState('');
  const [quantidadeProduto, setQuantidadeProduto] = useState('1');
  const [custo, setCusto] = useState('');

  const { data: produtosEstoque = [] } = useQuery({
    queryKey: ['produtos-manutencao', propriedadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_produtos_usuario', {
        p_propriedade_id: propriedadeId,
      });
      if (error) throw error;
      return ((data as any[]) || []).filter(
        (p) => p.ativo !== false && (p.categoria || '').toLowerCase().includes('manuten')
      );
    },
    enabled: !!propriedadeId && open,
  });

  const produtoSelecionado = produtosEstoque.find((p: any) => p.id === produtoId);
  const qtdProdutoNum = parseFloat(quantidadeProduto) || 0;
  const custoEstoqueEstimado = produtoSelecionado ? qtdProdutoNum * Number(produtoSelecionado.custo_medio || 0) : 0;
  const estoqueInsuficiente = origemEstoque && produtoSelecionado && qtdProdutoNum > Number(produtoSelecionado.saldo_atual || 0);

  const custoFinalExibido = origemEstoque ? custoEstoqueEstimado : (parseFloat(custo) || 0);

  // ── Categorias dinâmicas ──
  const { data: categorias = [], refetch: refetchCategorias } = useQuery<CategoriaManutencaoRow[]>({
    queryKey: ['categorias-manutencao'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_categorias_manutencao');
      if (error) throw error;
      return (data as CategoriaManutencaoRow[]) || [];
    },
  });

  const [showNovaCategoria, setShowNovaCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState<CategoriaManutencaoRow | null>(null);

  // ── Descrições dinâmicas ──
  const { data: descricoesLista = [], refetch: refetchDescricoes } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ['descricoes-manutencao'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_descricoes_manutencao');
      if (error) throw error;
      return (data as { id: string; nome: string }[]) || [];
    },
  });

  const [showNovaDescricao, setShowNovaDescricao] = useState(false);
  const [novaDescricaoNome, setNovaDescricaoNome] = useState('');
  const [salvandoDescricao, setSalvandoDescricao] = useState(false);
  const [descricaoParaExcluir, setDescricaoParaExcluir] = useState<{ id: string; nome: string } | null>(null);

  const handleAdicionarDescricao = async () => {
    const nome = novaDescricaoNome.trim();
    if (!nome) return;
    setSalvandoDescricao(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('descricoes_manutencao').insert({
      usuario_id: userData?.user?.id,
      nome,
      ativo: true,
    } as any);
    setSalvandoDescricao(false);
    if (error) {
      toast({
        title: (error as any).code === '23505' ? 'Descrição já existe' : 'Erro ao criar descrição',
        variant: 'destructive',
      });
      return;
    }
    setDescricao(nome);
    setNovaDescricaoNome('');
    setShowNovaDescricao(false);
    refetchDescricoes();
    toast({ title: 'Descrição criada' });
  };

  const handleExcluirDescricao = async () => {
    if (!descricaoParaExcluir) return;
    const { error } = await supabase
      .from('descricoes_manutencao')
      .update({ ativo: false } as any)
      .eq('id', descricaoParaExcluir.id);
    setDescricaoParaExcluir(null);
    if (error) {
      toast({ title: 'Erro ao remover descrição', variant: 'destructive' });
      return;
    }
    setDescricao('');
    refetchDescricoes();
    toast({ title: 'Descrição removida' });
  };

  const handleAdicionarCategoria = async () => {
    const nome = novaCategoriaNome.trim();
    if (!nome) return;
    setSalvandoCategoria(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('categorias_manutencao').insert({
      usuario_id: userData?.user?.id,
      nome,
      ativo: true,
    } as any);
    setSalvandoCategoria(false);
    if (error) {
      toast({
        title: (error as any).code === '23505' ? 'Categoria já existe' : 'Erro ao criar categoria',
        variant: 'destructive',
      });
      return;
    }
    setTipo(nome);
    setNovaCategoriaNome('');
    setShowNovaCategoria(false);
    refetchCategorias();
    toast({ title: 'Categoria criada' });
  };

  const handleExcluirCategoria = async () => {
    if (!categoriaParaExcluir) return;
    const { error } = await supabase
      .from('categorias_manutencao')
      .update({ ativo: false } as any)
      .eq('id', categoriaParaExcluir.id);
    setCategoriaParaExcluir(null);
    if (error) {
      toast({ title: 'Erro ao remover categoria', variant: 'destructive' });
      return;
    }
    setTipo('');
    refetchCategorias();
    toast({ title: 'Categoria removida' });
  };

  const resetForm = () => {
    setTipo('');
    setDescricao('');
    setStatus('agendada');
    setDataPrevista(new Date());
    setDataRealizada(new Date());
    setHorimetroManutencao('');
    setProximoHorimetro('');
    setCusto('');
    setOficina('');
    setObservacoes('');
    setShowNovaCategoria(false);
    setNovaCategoriaNome('');
    setOrigemEstoque(false);
    setProdutoId('');
    setQuantidadeProduto('1');
  };

  const { safraAtual } = useGlobal();

  const handleSave = async () => {
    if (!maquina || !descricao.trim()) {
      toast({ title: 'Preencha a descrição', variant: 'destructive' });
      return;
    }
    if (!tipo) {
      toast({ title: 'Selecione o tipo de manutenção', variant: 'destructive' });
      return;
    }
    if (origemEstoque && !produtoId) {
      toast({ title: 'Selecione a peça/produto do estoque', variant: 'destructive' });
      return;
    }
    if (estoqueInsuficiente) {
      toast({ title: 'Estoque insuficiente para essa quantidade', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // A baixa de estoque (FIFO) só acontece quando a manutenção está Realizada.
      // Se for Agendada, guardamos produto/quantidade planejados e não mexemos no estoque ainda.
      let custoFinal: number | null = origemEstoque ? null : (custo ? Number(custo) : null);
      let detalhamentoLotes: any = null;
      if (origemEstoque && produtoId && status === 'realizada') {
        const resultado = await consumirFIFO(produtoId, qtdProdutoNum);
        custoFinal = resultado.custoTotal;
        detalhamentoLotes = resultado.detalhamento;
      }

      // Se marcado como Realizada com horímetro maior que o atual, bump + guarda o valor anterior
      const vaiAtualizarMedidor = status === 'realizada' && horimetroManutencao && Number(horimetroManutencao) > medidorAtual;

      const { error } = await supabase
        .from('maquina_manutencoes' as any)
        .insert({
          propriedade_id: propriedadeId,
          safra_id: safraAtual?.id || null,
          maquina_id: maquina.id,
          tipo,
          descricao: descricao.trim(),
          status,
          data_prevista: dataPrevista ? format(dataPrevista, 'yyyy-MM-dd') : null,
          data_realizada: status === 'realizada' && dataRealizada ? format(dataRealizada, 'yyyy-MM-dd') : null,
          horimetro_na_manutencao: horimetroManutencao ? Number(horimetroManutencao) : null,
          horimetro_anterior: vaiAtualizarMedidor ? medidorAtual : null,
          proximo_horimetro: proximoHorimetro ? Number(proximoHorimetro) : null,
          custo: custoFinal,
          oficina: oficina.trim() || null,
          observacoes: observacoes.trim() || null,
          produto_id: origemEstoque ? produtoId : null,
          quantidade_produto: origemEstoque ? qtdProdutoNum : null,
          detalhamento_lotes: detalhamentoLotes,
        });

      if (error) throw error;

      if (vaiAtualizarMedidor) {
        await supabase
          .from('maquinas' as any)
          .update(ehKm ? { km_atual: Number(horimetroManutencao) } : { horimetro_atual: Number(horimetroManutencao) })
          .eq('id', maquina.id);
      }

      toast({ title: 'Manutenção registrada com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['manutencoes-proximas'] });
      queryClient.invalidateQueries({ queryKey: ['manutencoes-todas'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-manutencao'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar manutenção', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Registrar Manutenção
          </DialogTitle>
        </DialogHeader>

        {maquina && (
          <p className="text-sm text-muted-foreground">
            Máquina: <strong>{maquina.nome}</strong> · {labelMedidor} atual: {medidorAtual}{ehKm ? 'km' : 'h'}
          </p>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Tipo — combobox editável */}
            <div className="space-y-2">
              <Label>Tipo *</Label>
              {!showNovaCategoria ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        {categorias.length === 0 && (
                          <div className="px-2 py-3 text-xs text-muted-foreground">
                            Nenhuma categoria. Use + para criar.
                          </div>
                        )}
                        {categorias.map(cat => (
                          <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setShowNovaCategoria(true)}
                    title="Nova categoria"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {tipo && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Excluir categoria"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        const cat = categorias.find(c => c.nome === tipo);
                        if (cat) setCategoriaParaExcluir(cat);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da nova categoria"
                    value={novaCategoriaNome}
                    onChange={e => setNovaCategoriaNome(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAdicionarCategoria();
                      }
                    }}
                    autoFocus
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleAdicionarCategoria}
                    disabled={salvandoCategoria || !novaCategoriaNome.trim()}
                  >
                    {salvandoCategoria ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setShowNovaCategoria(false);
                      setNovaCategoriaNome('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            {!showNovaDescricao ? (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={descricao} onValueChange={setDescricao}>
                    <SelectTrigger><SelectValue placeholder="Selecione a descrição" /></SelectTrigger>
                    <SelectContent>
                      {descricoesLista.length === 0 && (
                        <div className="px-2 py-3 text-xs text-muted-foreground">
                          Nenhuma descrição. Use + para criar.
                        </div>
                      )}
                      {descricoesLista.map(d => (
                        <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowNovaDescricao(true)}
                  title="Nova descrição"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {descricao && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Excluir descrição"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      const d = descricoesLista.find(x => x.nome === descricao);
                      if (d) setDescricaoParaExcluir(d);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da nova descrição (ex: Troca de óleo do motor)"
                  value={novaDescricaoNome}
                  onChange={e => setNovaDescricaoNome(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdicionarDescricao();
                    }
                  }}
                  autoFocus
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleAdicionarDescricao}
                  disabled={salvandoDescricao || !novaDescricaoNome.trim()}
                >
                  {salvandoDescricao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setShowNovaDescricao(false);
                    setNovaDescricaoNome('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Prevista</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataPrevista && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataPrevista ? format(dataPrevista, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataPrevista} onSelect={setDataPrevista} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {status === 'realizada' && (
              <div className="space-y-2">
                <Label>Data Realizada</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataRealizada && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataRealizada ? format(dataRealizada, 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataRealizada} onSelect={setDataRealizada} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{labelMedidor} na Manutenção</Label>
              <Input type="number" placeholder="Ex: 1500" value={horimetroManutencao} onChange={e => setHorimetroManutencao(e.target.value)} />
              {status === 'realizada' && horimetroManutencao && Number(horimetroManutencao) > medidorAtual && (
                <Alert className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Vai atualizar o {labelMedidor.toLowerCase()} da máquina de {medidorAtual} para {horimetroManutencao}.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="space-y-2">
              <Label>Próximo {labelMedidor}</Label>
              <Input type="number" placeholder="Ex: 1750" value={proximoHorimetro} onChange={e => setProximoHorimetro(e.target.value)} />
            </div>
          </div>

          {/* Origem do custo — Estoque ou Livre */}
          <div className="space-y-2">
            <Label>Peça / custo</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={origemEstoque ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setOrigemEstoque(true)}
              >
                Do Estoque
              </Button>
              <Button
                type="button"
                variant={!origemEstoque ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => { setOrigemEstoque(false); setProdutoId(''); }}
              >
                Livre
              </Button>
            </div>
          </div>

          {origemEstoque ? (
            <div className="space-y-4 rounded-lg border p-3 bg-muted/30">
              <div className="space-y-2">
                <Label>Peça / produto do estoque *</Label>
                <Select value={produtoId} onValueChange={setProdutoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a peça" /></SelectTrigger>
                  <SelectContent>
                    {produtosEstoque.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        Nenhum produto na categoria "Manutenção".
                      </div>
                    )}
                    {produtosEstoque.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} (saldo: {Number(p.saldo_atual || 0).toFixed(0)} {p.unidade_medida})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quantidadeProduto}
                    onChange={e => setQuantidadeProduto(e.target.value)}
                    className={estoqueInsuficiente ? 'border-destructive' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custo estimado (R$)</Label>
                  <Input type="number" step="0.01" value={custoEstoqueEstimado.toFixed(2)} disabled />
                </div>
              </div>

              {status !== 'realizada' && (
                <p className="text-xs text-muted-foreground">
                  O estoque só será baixado quando a manutenção for marcada como Realizada.
                </p>
              )}

              {estoqueInsuficiente && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Quantidade maior que o estoque disponível!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo R$</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={custo} onChange={e => setCusto(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Oficina</Label>
                <Input placeholder="Nome da oficina" value={oficina} onChange={e => setOficina(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea placeholder="Observações adicionais..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || estoqueInsuficiente}>
            {saving ? 'Salvando...' : 'Salvar Manutenção'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!categoriaParaExcluir} onOpenChange={o => { if (!o) setCategoriaParaExcluir(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria "{categoriaParaExcluir?.nome}" deixará de aparecer na lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirCategoria}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!descricaoParaExcluir} onOpenChange={o => { if (!o) setDescricaoParaExcluir(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir descrição?</AlertDialogTitle>
            <AlertDialogDescription>
              A descrição "{descricaoParaExcluir?.nome}" deixará de aparecer na lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirDescricao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
