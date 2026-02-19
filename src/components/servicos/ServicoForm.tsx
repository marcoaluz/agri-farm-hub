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
import { Loader2, Trash2, Info, Package, Wrench, Truck, Plus } from 'lucide-react';

interface ServicoData {
  id?: string;
  nome: string;
  descricao?: string;
  categoria: string;
  requer_talhao: boolean;
  tipo_servico: 'simples' | 'composto';
  custo_padrao?: number;
  unidade_medida?: string;
}

interface ItemVinculado {
  tipo_ref: 'produto' | 'maquina' | 'servico_simples';
  produto_id?: string;
  maquina_id?: string;
  servico_ref_id?: string;
  nome: string;
  unidade: string;
  custo_info?: number;
  obrigatorio: boolean;
  quantidade_sugerida?: number;
  ordem: number;
}

interface ServicoFormProps {
  servico: any | null;
  onSuccess: () => void;
}

const CATEGORIAS_SERVICO = [
  'Preparo do Solo', 'Plantio', 'Adubação', 'Aplicação',
  'Irrigação', 'Colheita', 'Transporte', 'Manutenção', 'Outros'
];

const UNIDADES_SIMPLES = [
  { value: 'hora', label: 'Hora' },
  { value: 'dia', label: 'Dia' },
  { value: 'diaria', label: 'Diária' },
  { value: 'servico', label: 'Serviço' },
  { value: 'ha', label: 'Hectare (ha)' },
  { value: 'km', label: 'Quilômetro (km)' },
];

export function ServicoForm({ servico, onSuccess }: ServicoFormProps) {
  const { propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<ServicoData>({
    nome: servico?.nome || '',
    descricao: servico?.descricao || '',
    categoria: servico?.categoria || '',
    requer_talhao: servico?.requer_talhao ?? true,
    tipo_servico: servico?.tipo_servico || 'composto',
    custo_padrao: servico?.custo_padrao || undefined,
    unidade_medida: servico?.unidade_medida || '',
  });

  const [itensVinculados, setItensVinculados] = useState<ItemVinculado[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addingType, setAddingType] = useState<'produto' | 'maquina' | 'servico_simples' | null>(null);

  const propriedadeId = propriedadeAtual?.id;

  // Buscar produtos
  const { data: produtos } = useQuery({
    queryKey: ['produtos-para-servico', propriedadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, unidade')
        .eq('propriedade_id', propriedadeId)
        .or('ativo.is.null,ativo.eq.true')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!propriedadeId && formData.tipo_servico === 'composto',
  });

  // Buscar máquinas
  const { data: maquinas } = useQuery({
    queryKey: ['maquinas-para-servico', propriedadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maquinas')
        .select('id, nome, custo_hora')
        .eq('propriedade_id', propriedadeId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!propriedadeId && formData.tipo_servico === 'composto',
  });

  // Buscar serviços simples
  const { data: servicosSimples } = useQuery({
    queryKey: ['servicos-simples-para-servico', propriedadeId, servico?.id],
    queryFn: async () => {
      let query = supabase
        .from('servicos')
        .select('id, nome, custo_padrao, unidade_medida')
        .eq('propriedade_id', propriedadeId)
        .eq('tipo_servico', 'simples')
        .eq('ativo', true)
        .order('nome');

      // Excluir o próprio serviço se editando
      if (servico?.id) {
        query = query.neq('id', servico.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!propriedadeId && formData.tipo_servico === 'composto',
  });

  // Carregar itens vinculados ao editar
  useEffect(() => {
    if (servico?.id) {
      const fetchItens = async () => {
        const { data, error } = await supabase
          .from('servicos_itens')
          .select(`
            tipo_ref, produto_id, maquina_id, servico_ref_id,
            obrigatorio, quantidade_sugerida, ordem,
            produto:produtos(id, nome, unidade),
            maquina:maquinas(id, nome, custo_hora),
            servico_ref:servicos(id, nome, custo_padrao, unidade_medida)
          `)
          .eq('servico_id', servico.id)
          .order('ordem');

        if (!error && data) {
          setItensVinculados(data.map((si: any) => {
            let nome = '';
            let unidade = '';
            let custo_info: number | undefined;

            if (si.tipo_ref === 'produto' && si.produto) {
              nome = si.produto.nome;
              unidade = si.produto.unidade || '';
            } else if (si.tipo_ref === 'maquina' && si.maquina) {
              nome = si.maquina.nome;
              unidade = 'hora';
              custo_info = si.maquina.custo_hora;
            } else if (si.tipo_ref === 'servico_simples' && si.servico_ref) {
              nome = si.servico_ref.nome;
              unidade = si.servico_ref.unidade_medida || '';
              custo_info = si.servico_ref.custo_padrao;
            }

            return {
              tipo_ref: si.tipo_ref || 'produto',
              produto_id: si.produto_id,
              maquina_id: si.maquina_id,
              servico_ref_id: si.servico_ref_id,
              nome,
              unidade,
              custo_info,
              obrigatorio: si.obrigatorio,
              quantidade_sugerida: si.quantidade_sugerida,
              ordem: si.ordem,
            };
          }));
        }
      };
      fetchItens();
    }
  }, [servico?.id]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!formData.categoria) newErrors.categoria = 'Categoria é obrigatória';
    if (formData.tipo_servico === 'simples') {
      if (formData.custo_padrao === undefined || formData.custo_padrao === null || formData.custo_padrao < 0) {
        newErrors.custo_padrao = 'Custo padrão é obrigatório';
      }
      if (!formData.unidade_medida) {
        newErrors.unidade_medida = 'Unidade de medida é obrigatória';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Dados inválidos');

      let servicoId = servico?.id;

      const payload: any = {
        nome: formData.nome.trim(),
        descricao: formData.descricao?.trim() || null,
        categoria: formData.categoria,
        requer_talhao: formData.requer_talhao,
        tipo_servico: formData.tipo_servico,
        custo_padrao: formData.tipo_servico === 'simples' ? formData.custo_padrao : null,
        unidade_medida: formData.tipo_servico === 'simples' ? formData.unidade_medida : null,
      };

      if (servico?.id) {
        const { error } = await supabase
          .from('servicos')
          .update(payload)
          .eq('id', servico.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('servicos')
          .insert({ ...payload, propriedade_id: propriedadeId, ativo: true })
          .select()
          .single();
        if (error) throw error;
        servicoId = data.id;
      }

      // Gerenciar itens vinculados (apenas para composto)
      if (servico?.id) {
        await supabase.from('servicos_itens').delete().eq('servico_id', servico.id);
      }

      if (formData.tipo_servico === 'composto' && itensVinculados.length > 0 && servicoId) {
        const { error: erroItens } = await supabase
          .from('servicos_itens')
          .insert(
            itensVinculados.map((iv, index) => ({
              servico_id: servicoId,
              tipo_ref: iv.tipo_ref,
              produto_id: iv.tipo_ref === 'produto' ? iv.produto_id : null,
              maquina_id: iv.tipo_ref === 'maquina' ? iv.maquina_id : null,
              servico_ref_id: iv.tipo_ref === 'servico_simples' ? iv.servico_ref_id : null,
              item_id: null,
              obrigatorio: iv.obrigatorio,
              quantidade_sugerida: iv.quantidade_sugerida || null,
              ordem: index,
            }))
          );
        if (erroItens) throw erroItens;
      }
    },
    onSuccess: () => {
      toast({ title: `Serviço ${servico ? 'atualizado' : 'criado'} com sucesso` });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar serviço', description: error.message, variant: 'destructive' });
    },
  });

  const adicionarProduto = (produtoId: string) => {
    const p = produtos?.find(x => x.id === produtoId);
    if (!p) return;
    setItensVinculados(prev => [...prev, {
      tipo_ref: 'produto', produto_id: produtoId,
      nome: p.nome, unidade: p.unidade || '', obrigatorio: false,
      quantidade_sugerida: undefined, ordem: prev.length,
    }]);
    setAddingType(null);
  };

  const adicionarMaquina = (maquinaId: string) => {
    const m = maquinas?.find(x => x.id === maquinaId);
    if (!m) return;
    setItensVinculados(prev => [...prev, {
      tipo_ref: 'maquina', maquina_id: maquinaId,
      nome: m.nome, unidade: 'hora', custo_info: m.custo_hora,
      obrigatorio: false, quantidade_sugerida: undefined, ordem: prev.length,
    }]);
    setAddingType(null);
  };

  const adicionarServicoSimples = (sId: string) => {
    const s = servicosSimples?.find(x => x.id === sId);
    if (!s) return;
    setItensVinculados(prev => [...prev, {
      tipo_ref: 'servico_simples', servico_ref_id: sId,
      nome: s.nome, unidade: s.unidade_medida || '', custo_info: s.custo_padrao,
      obrigatorio: false, quantidade_sugerida: undefined, ordem: prev.length,
    }]);
    setAddingType(null);
  };

  const removerItem = (index: number) => {
    setItensVinculados(prev => prev.filter((_, i) => i !== index));
  };

  const atualizarItem = (index: number, updates: Partial<ItemVinculado>) => {
    setItensVinculados(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], ...updates };
      return newItems;
    });
  };

  const getRefIcon = (tipo: string) => {
    switch (tipo) {
      case 'produto': return <Package className="h-4 w-4 text-blue-600" />;
      case 'maquina': return <Truck className="h-4 w-4 text-orange-600" />;
      case 'servico_simples': return <Wrench className="h-4 w-4 text-purple-600" />;
      default: return null;
    }
  };

  const getRefLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'produto': 'Produto', 'maquina': 'Máquina', 'servico_simples': 'Serviço',
    };
    return labels[tipo] || tipo;
  };

  // Filtrar itens já adicionados
  const produtosDisponiveis = produtos?.filter(
    p => !itensVinculados.some(iv => iv.tipo_ref === 'produto' && iv.produto_id === p.id)
  );
  const maquinasDisponiveis = maquinas?.filter(
    m => !itensVinculados.some(iv => iv.tipo_ref === 'maquina' && iv.maquina_id === m.id)
  );
  const servicosSimplesDisponiveis = servicosSimples?.filter(
    s => !itensVinculados.some(iv => iv.tipo_ref === 'servico_simples' && iv.servico_ref_id === s.id)
  );

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
      <DialogHeader>
        <DialogTitle>{servico ? 'Editar' : 'Novo'} Serviço</DialogTitle>
      </DialogHeader>

      {/* Dados Básicos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome do Serviço *</Label>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex: Adubação de Cobertura, Diária de Trabalho"
              maxLength={200}
              className={errors.nome ? 'border-destructive' : ''}
            />
            {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
          </div>

          <div>
            <Label>Categoria *</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
            >
              <SelectTrigger className={errors.categoria ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_SERVICO.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoria && <p className="text-xs text-destructive mt-1">{errors.categoria}</p>}
          </div>

          <div>
            <Label>Tipo de Serviço *</Label>
            <Select
              value={formData.tipo_servico}
              onValueChange={(value: 'simples' | 'composto') =>
                setFormData(prev => ({ ...prev, tipo_servico: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples (custo direto)</SelectItem>
                <SelectItem value="composto">Composto (com itens vinculados)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva este tipo de operação..."
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex-1">
              <Label className="text-sm font-medium">Requer seleção de talhão</Label>
              <p className="text-xs text-muted-foreground">
                Se ativado, será obrigatório selecionar um talhão ao fazer lançamentos
              </p>
            </div>
            <Switch
              checked={formData.requer_talhao}
              onCheckedChange={(checked) =>
                setFormData(prev => ({ ...prev, requer_talhao: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Campos de Serviço Simples */}
      {formData.tipo_servico === 'simples' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Custo do Serviço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Custo Padrão (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.custo_padrao !== undefined && formData.custo_padrao !== null ? formData.custo_padrao : ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev, custo_padrao: e.target.value === '' ? undefined : parseFloat(e.target.value),
                }))}
                placeholder="Ex: 150.00"
                className={errors.custo_padrao ? 'border-destructive' : ''}
              />
              {errors.custo_padrao && <p className="text-xs text-destructive mt-1">{errors.custo_padrao}</p>}
            </div>

            <div>
              <Label>Unidade de Medida *</Label>
              <Select
                value={formData.unidade_medida || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, unidade_medida: value }))}
              >
                <SelectTrigger className={errors.unidade_medida ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_SIMPLES.map(u => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unidade_medida && <p className="text-xs text-destructive mt-1">{errors.unidade_medida}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Itens Vinculados (apenas composto) */}
      {formData.tipo_servico === 'composto' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Itens do Serviço</CardTitle>
            <p className="text-xs text-muted-foreground">
              Defina produtos, máquinas e serviços usados nesta operação
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {itensVinculados.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Nenhum item vinculado. Use os botões abaixo para adicionar.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {itensVinculados.map((iv, index) => (
                  <Card key={index} className="border">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getRefIcon(iv.tipo_ref)}
                              <span className="font-medium text-sm">{iv.nome}</span>
                              <Badge variant="outline" className="text-xs">
                                {getRefLabel(iv.tipo_ref)}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => removerItem(index)}
                              className="h-7 w-7 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {iv.custo_info != null && (
                            <p className="text-xs text-muted-foreground">
                              Custo: R$ {iv.custo_info.toFixed(2)}/{iv.unidade}
                            </p>
                          )}

                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Label className="text-xs">
                                Qtd. Sugerida ({iv.unidade})
                              </Label>
                              <Input
                                type="number" step="0.001" min="0"
                                value={iv.quantidade_sugerida || ''}
                                onChange={(e) => atualizarItem(index, {
                                  quantidade_sugerida: parseFloat(e.target.value) || undefined,
                                })}
                                placeholder="Opcional"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-5">
                              <Switch
                                checked={iv.obrigatorio}
                                onCheckedChange={(checked) =>
                                  atualizarItem(index, { obrigatorio: checked })
                                }
                              />
                              <Label className="text-xs">Obrigatório</Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Separator />

            {/* Botões para adicionar */}
            <div>
              <Label className="text-sm mb-2 block">Adicionar ao Serviço</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => setAddingType(addingType === 'produto' ? null : 'produto')}
                  className={addingType === 'produto' ? 'ring-2 ring-ring' : ''}
                >
                  <Package className="h-4 w-4 mr-1" />
                  + Produto do Estoque
                </Button>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => setAddingType(addingType === 'maquina' ? null : 'maquina')}
                  className={addingType === 'maquina' ? 'ring-2 ring-ring' : ''}
                >
                  <Truck className="h-4 w-4 mr-1" />
                  + Máquina
                </Button>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => setAddingType(addingType === 'servico_simples' ? null : 'servico_simples')}
                  className={addingType === 'servico_simples' ? 'ring-2 ring-ring' : ''}
                >
                  <Wrench className="h-4 w-4 mr-1" />
                  + Serviço Simples
                </Button>
              </div>
            </div>

            {/* Select dinâmico baseado no tipo */}
            {addingType === 'produto' && (
              <Select onValueChange={adicionarProduto} value="">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto..." />
                </SelectTrigger>
                <SelectContent>
                  {(!produtosDisponiveis || produtosDisponiveis.length === 0) ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum produto disponível
                    </div>
                  ) : (
                    produtosDisponiveis.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <Package className="h-3 w-3" />
                          <span>{p.nome}</span>
                          <span className="text-xs text-muted-foreground">({p.unidade})</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {addingType === 'maquina' && (
              <Select onValueChange={adicionarMaquina} value="">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma máquina..." />
                </SelectTrigger>
                <SelectContent>
                  {(!maquinasDisponiveis || maquinasDisponiveis.length === 0) ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Nenhuma máquina disponível
                    </div>
                  ) : (
                    maquinasDisponiveis.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <Truck className="h-3 w-3" />
                          <span>{m.nome}</span>
                          {m.custo_hora && (
                            <span className="text-xs text-muted-foreground">
                              (R$ {m.custo_hora}/h)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {addingType === 'servico_simples' && (
              <Select onValueChange={adicionarServicoSimples} value="">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço simples..." />
                </SelectTrigger>
                <SelectContent>
                  {(!servicosSimplesDisponiveis || servicosSimplesDisponiveis.length === 0) ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum serviço simples disponível
                    </div>
                  ) : (
                    servicosSimplesDisponiveis.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <Wrench className="h-3 w-3" />
                          <span>{s.nome}</span>
                          {s.custo_padrao && (
                            <span className="text-xs text-muted-foreground">
                              (R$ {s.custo_padrao}/{s.unidade_medida})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Botões */}
      <div className="flex justify-end gap-2 sticky bottom-0 bg-background pt-2 pb-1">
        <Button variant="outline" onClick={onSuccess}>Cancelar</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
          ) : (
            'Salvar Serviço'
          )}
        </Button>
      </div>
    </div>
  );
}
