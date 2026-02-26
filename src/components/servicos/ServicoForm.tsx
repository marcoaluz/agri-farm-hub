import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, Info, Package, Truck } from 'lucide-react';

interface ItemVinculado {
  tipo_ref: 'produto' | 'maquina';
  produto_id?: string;
  maquina_id?: string;
  nome: string;
  unidade: string;
  custo_info?: number;
  obrigatorio: boolean;
  quantidade_sugerida?: number;
  ordem: number;
}

const CATEGORIAS = [
  'Preparo do Solo','Plantio','Adubação','Aplicação',
  'Irrigação','Colheita','Transporte','Manutenção','Outros',
];
const UNIDADES_SIMPLES = [
  { value: 'hora', label: 'Hora' },
  { value: 'dia', label: 'Dia' },
  { value: 'diaria', label: 'Diária' },
  { value: 'servico', label: 'Serviço' },
  { value: 'ha', label: 'Hectare (ha)' },
];

export function ServicoForm({ servico, onSuccess }: { servico: any; onSuccess: () => void }) {
  const { propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const propriedadeId = propriedadeAtual?.id;

  const [nome, setNome] = useState(servico?.nome || '');
  const [descricao, setDescricao] = useState(servico?.descricao || '');
  const [categoria, setCategoria] = useState(servico?.categoria || '');
  const [requerTalhao, setRequerTalhao] = useState(servico?.requer_talhao ?? true);
  const [tipoServico, setTipoServico] = useState<'simples' | 'composto'>(servico?.tipo_servico || 'composto');
  const [custoPadrao, setCustoPadrao] = useState(servico?.custo_padrao?.toString() || '');
  const [unidadeMedida, setUnidadeMedida] = useState(servico?.unidade_medida || '');
  const [itens, setItens] = useState<ItemVinculado[]>([]);
  const [addingType, setAddingType] = useState<'produto' | 'maquina' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Busca DIRETO em produtos
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', propriedadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, unidade_medida')
        .eq('propriedade_id', propriedadeId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!propriedadeId && tipoServico === 'composto',
  });

  // Busca DIRETO em maquinas
  const { data: maquinas = [] } = useQuery({
    queryKey: ['maquinas', propriedadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maquinas')
        .select('id, nome, custo_hora')
        .eq('propriedade_id', propriedadeId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!propriedadeId && tipoServico === 'composto',
  });

  // Carrega itens ao editar
  useEffect(() => {
    if (!servico?.id) return;
    supabase
      .from('servicos_itens')
      .select(`
        tipo_ref, produto_id, maquina_id, obrigatorio, quantidade_sugerida, ordem,
        produto:produtos(id, nome, unidade_medida),
        maquina:maquinas(id, nome, custo_hora)
      `)
      .eq('servico_id', servico.id)
      .order('ordem')
      .then(({ data }) => {
        if (!data) return;
        setItens(data.map((si: any) => si.tipo_ref === 'produto' ? {
          tipo_ref: 'produto',
          produto_id: si.produto_id,
          nome: si.produto?.nome || '',
          unidade: si.produto?.unidade_medida || '',
          obrigatorio: si.obrigatorio,
          quantidade_sugerida: si.quantidade_sugerida,
          ordem: si.ordem,
        } : {
          tipo_ref: 'maquina',
          maquina_id: si.maquina_id,
          nome: si.maquina?.nome || '',
          unidade: 'hora',
          custo_info: si.maquina?.custo_hora,
          obrigatorio: si.obrigatorio,
          quantidade_sugerida: si.quantidade_sugerida,
          ordem: si.ordem,
        }));
      });
  }, [servico?.id]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = 'Nome é obrigatório';
    if (!categoria) errs.categoria = 'Categoria é obrigatória';
    if (tipoServico === 'simples') {
      if (!custoPadrao || parseFloat(custoPadrao) < 0) errs.custo = 'Custo é obrigatório';
      if (!unidadeMedida) errs.unidade = 'Unidade é obrigatória';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Verifique os campos obrigatórios');
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        categoria,
        requer_talhao: requerTalhao,
        tipo_servico: tipoServico,
        custo_padrao: tipoServico === 'simples' ? parseFloat(custoPadrao) : null,
        unidade_medida: tipoServico === 'simples' ? unidadeMedida : null,
      };

      let servicoId = servico?.id;
      if (servico?.id) {
        const { error } = await supabase.from('servicos').update(payload).eq('id', servico.id);
        if (error) throw error;
        await supabase.from('servicos_itens').delete().eq('servico_id', servico.id);
      } else {
        const { data, error } = await supabase
          .from('servicos')
          .insert({ ...payload, propriedade_id: propriedadeId, ativo: true })
          .select().single();
        if (error) throw error;
        servicoId = data.id;
      }

      if (tipoServico === 'composto' && itens.length > 0) {
        const { error } = await supabase.from('servicos_itens').insert(
          itens.map((iv, i) => ({
            servico_id: servicoId,
            tipo_ref: iv.tipo_ref,
            produto_id: iv.tipo_ref === 'produto' ? iv.produto_id : null,
            maquina_id: iv.tipo_ref === 'maquina' ? iv.maquina_id : null,
            obrigatorio: iv.obrigatorio,
            quantidade_sugerida: iv.quantidade_sugerida || null,
            ordem: i,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: `Serviço ${servico ? 'atualizado' : 'criado'} com sucesso` });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  const adicionadosProdutos = new Set(itens.filter(i => i.tipo_ref === 'produto').map(i => i.produto_id));
  const adicionadosMaquinas = new Set(itens.filter(i => i.tipo_ref === 'maquina').map(i => i.maquina_id));
  const produtosDisp = produtos.filter(p => !adicionadosProdutos.has(p.id));
  const maquinasDisp = maquinas.filter(m => !adicionadosMaquinas.has(m.id));

  const adicionarProduto = (id: string) => {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    setItens(prev => [...prev, {
      tipo_ref: 'produto', produto_id: id,
      nome: p.nome, unidade: p.unidade_medida || '',
      obrigatorio: false, ordem: prev.length,
    }]);
    setAddingType(null);
  };

  const adicionarMaquina = (id: string) => {
    const m = maquinas.find(x => x.id === id);
    if (!m) return;
    setItens(prev => [...prev, {
      tipo_ref: 'maquina', maquina_id: id,
      nome: m.nome, unidade: 'hora', custo_info: m.custo_hora ?? undefined,
      obrigatorio: false, ordem: prev.length,
    }]);
    setAddingType(null);
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>{servico ? 'Editar' : 'Novo'} Serviço</DialogTitle>
      </DialogHeader>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Informações Básicas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Adubação de Cobertura" className={errors.nome ? 'border-destructive' : ''} />
            {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
          </div>
          <div>
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className={errors.categoria ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.categoria && <p className="text-xs text-destructive mt-1">{errors.categoria}</p>}
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={tipoServico} onValueChange={v => setTipoServico(v as 'simples' | 'composto')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples — custo fixo por unidade</SelectItem>
                <SelectItem value="composto">Composto — usa produtos e máquinas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Descrição opcional..." rows={2} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Requer seleção de talhão</p>
              <p className="text-xs text-muted-foreground">Obrigatório informar talhão nos lançamentos</p>
            </div>
            <Switch checked={requerTalhao} onCheckedChange={setRequerTalhao} />
          </div>
        </CardContent>
      </Card>

      {tipoServico === 'simples' && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Custo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Custo Padrão (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={custoPadrao}
                onChange={e => setCustoPadrao(e.target.value)}
                placeholder="Ex: 150.00" className={errors.custo ? 'border-destructive' : ''} />
              {errors.custo && <p className="text-xs text-destructive mt-1">{errors.custo}</p>}
            </div>
            <div>
              <Label>Unidade *</Label>
              <Select value={unidadeMedida} onValueChange={setUnidadeMedida}>
                <SelectTrigger className={errors.unidade ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_SIMPLES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.unidade && <p className="text-xs text-destructive mt-1">{errors.unidade}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {tipoServico === 'composto' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Itens do Serviço</CardTitle>
            <p className="text-xs text-muted-foreground">Produtos e máquinas usados nesta operação</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {itens.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>Nenhum item vinculado. Adicione abaixo.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {itens.map((iv, index) => (
                  <Card key={index} className="border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {iv.tipo_ref === 'produto'
                            ? <Package className="h-4 w-4 text-blue-600" />
                            : <Truck className="h-4 w-4 text-orange-600" />}
                          <span className="font-medium text-sm">{iv.nome}</span>
                          <Badge variant="outline" className="text-xs">
                            {iv.tipo_ref === 'produto' ? 'Produto' : 'Máquina'}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setItens(p => p.filter((_, i) => i !== index))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {iv.custo_info != null && (
                        <p className="text-xs text-muted-foreground">R$ {iv.custo_info.toFixed(2)}/{iv.unidade}</p>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label className="text-xs">Qtd. Sugerida ({iv.unidade})</Label>
                          <Input type="number" step="0.001" min="0"
                            value={iv.quantidade_sugerida || ''}
                            onChange={e => setItens(p => {
                              const n = [...p];
                              n[index] = { ...n[index], quantidade_sugerida: parseFloat(e.target.value) || undefined };
                              return n;
                            })}
                            placeholder="Opcional" className="h-8 text-sm" />
                        </div>
                        <div className="flex items-center gap-2 pt-5">
                          <Switch checked={iv.obrigatorio}
                            onCheckedChange={v => setItens(p => {
                              const n = [...p];
                              n[index] = { ...n[index], obrigatorio: v };
                              return n;
                            })} />
                          <Label className="text-xs">Obrigatório</Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm"
                onClick={() => setAddingType(addingType === 'produto' ? null : 'produto')}
                className={addingType === 'produto' ? 'ring-2 ring-ring' : ''}>
                <Package className="h-4 w-4 mr-1" />
                + Produto do Estoque
                {produtosDisp.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{produtosDisp.length}</Badge>
                )}
              </Button>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setAddingType(addingType === 'maquina' ? null : 'maquina')}
                className={addingType === 'maquina' ? 'ring-2 ring-ring' : ''}>
                <Truck className="h-4 w-4 mr-1" />
                + Máquina
                {maquinasDisp.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{maquinasDisp.length}</Badge>
                )}
              </Button>
            </div>

            {addingType === 'produto' && (
              produtosDisp.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>Nenhum produto disponível. Cadastre na tela de <strong>Estoque</strong>.</AlertDescription>
                </Alert>
              ) : (
                <Select onValueChange={adicionarProduto} value="">
                  <SelectTrigger><SelectValue placeholder="Selecione um produto..." /></SelectTrigger>
                  <SelectContent>
                    {produtosDisp.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} <span className="text-xs text-muted-foreground ml-1">({p.unidade_medida})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            )}

            {addingType === 'maquina' && (
              maquinasDisp.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>Nenhuma máquina disponível. Cadastre na tela de <strong>Máquinas</strong>.</AlertDescription>
                </Alert>
              ) : (
                <Select onValueChange={adicionarMaquina} value="">
                  <SelectTrigger><SelectValue placeholder="Selecione uma máquina..." /></SelectTrigger>
                  <SelectContent>
                    {maquinasDisp.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                        {m.custo_hora && <span className="text-xs text-muted-foreground ml-1">(R$ {m.custo_hora}/h)</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3 border-t pt-4 mt-2">
        <Button variant="outline" onClick={onSuccess}>Cancelar</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
            : 'Salvar Serviço'}
        </Button>
      </div>
    </div>
  );
}
