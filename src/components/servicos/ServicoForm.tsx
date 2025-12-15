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
import { Loader2, Plus, Trash2, GripVertical, Info, Package, Wrench, Tractor } from 'lucide-react';

interface Servico {
  id?: string;
  nome: string;
  descricao?: string;
  categoria: string;
  requer_talhao: boolean;
}

interface Item {
  id: string;
  nome: string;
  tipo: 'produto_estoque' | 'servico' | 'maquina_hora';
  unidade_medida: string;
}

interface ItemVinculado {
  item_id: string;
  item?: Item;
  obrigatorio: boolean;
  quantidade_sugerida?: number;
  ordem: number;
}

interface ServicoFormProps {
  servico: Servico | null;
  onSuccess: () => void;
}

const CATEGORIAS_SERVICO = [
  'Preparo do Solo',
  'Plantio',
  'Adubação',
  'Aplicação',
  'Irrigação',
  'Colheita',
  'Transporte',
  'Manutenção',
  'Outros'
];

export function ServicoForm({ servico, onSuccess }: ServicoFormProps) {
  const { propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<Servico>({
    nome: servico?.nome || '',
    descricao: servico?.descricao || '',
    categoria: servico?.categoria || '',
    requer_talhao: servico?.requer_talhao ?? true
  });

  const [itensVinculados, setItensVinculados] = useState<ItemVinculado[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Buscar todos os itens disponíveis
  const { data: itensDisponiveis } = useQuery({
    queryKey: ['itens', propriedadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('itens')
        .select('id, nome, tipo, unidade_medida')
        .eq('propriedade_id', propriedadeAtual?.id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data as Item[];
    },
    enabled: !!propriedadeAtual?.id
  });

  // Buscar itens já vinculados (se editando)
  useEffect(() => {
    if (servico?.id) {
      const fetchItensVinculados = async () => {
        const { data, error } = await supabase
          .from('servicos_itens')
          .select(`
            item_id,
            obrigatorio,
            quantidade_sugerida,
            ordem,
            item:itens(id, nome, tipo, unidade_medida)
          `)
          .eq('servico_id', servico.id)
          .order('ordem');

        if (!error && data) {
          setItensVinculados(data.map((si: any) => ({
            item_id: si.item_id,
            item: si.item,
            obrigatorio: si.obrigatorio,
            quantidade_sugerida: si.quantidade_sugerida,
            ordem: si.ordem
          })));
        }
      };
      fetchItensVinculados();
    }
  }, [servico?.id]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    } else if (formData.nome.length > 200) {
      newErrors.nome = 'Nome deve ter no máximo 200 caracteres';
    }
    
    if (!formData.categoria) {
      newErrors.categoria = 'Categoria é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Mutation para salvar
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Dados inválidos');

      let servicoId = servico?.id;

      if (servico?.id) {
        const { error } = await supabase
          .from('servicos')
          .update({
            nome: formData.nome.trim(),
            descricao: formData.descricao?.trim() || null,
            categoria: formData.categoria,
            requer_talhao: formData.requer_talhao
          })
          .eq('id', servico.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('servicos')
          .insert({
            nome: formData.nome.trim(),
            descricao: formData.descricao?.trim() || null,
            categoria: formData.categoria,
            requer_talhao: formData.requer_talhao,
            propriedade_id: propriedadeAtual?.id
          })
          .select()
          .single();
        
        if (error) throw error;
        servicoId = data.id;
      }

      // Remover itens antigos
      if (servico?.id) {
        await supabase
          .from('servicos_itens')
          .delete()
          .eq('servico_id', servico.id);
      }

      // Inserir novos itens vinculados
      if (itensVinculados.length > 0 && servicoId) {
        const { error: erroItens } = await supabase
          .from('servicos_itens')
          .insert(
            itensVinculados.map((iv, index) => ({
              servico_id: servicoId,
              item_id: iv.item_id,
              obrigatorio: iv.obrigatorio,
              quantidade_sugerida: iv.quantidade_sugerida || null,
              ordem: index
            }))
          );

        if (erroItens) throw erroItens;
      }
    },
    onSuccess: () => {
      toast({ 
        title: `Serviço ${servico ? 'atualizado' : 'criado'} com sucesso` 
      });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar serviço',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const adicionarItem = (itemId: string) => {
    const item = itensDisponiveis?.find(i => i.id === itemId);
    if (!item) return;

    setItensVinculados(prev => [...prev, {
      item_id: itemId,
      item,
      obrigatorio: false,
      quantidade_sugerida: undefined,
      ordem: prev.length
    }]);
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

  const itensParaAdicionar = itensDisponiveis?.filter(
    item => !itensVinculados.some(iv => iv.item_id === item.id)
  );

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'produto_estoque':
        return <Package className="h-4 w-4 text-blue-600" />;
      case 'servico':
        return <Wrench className="h-4 w-4 text-purple-600" />;
      case 'maquina_hora':
        return <Tractor className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'produto_estoque': 'Produto',
      'servico': 'Serviço',
      'maquina_hora': 'Máquina'
    };
    return labels[tipo] || tipo;
  };

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
              placeholder="Ex: Adubação de Cobertura, Plantio, Colheita"
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
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoria && <p className="text-xs text-destructive mt-1">{errors.categoria}</p>}
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

      {/* Itens Vinculados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Itens do Serviço</CardTitle>
          <p className="text-xs text-muted-foreground">
            Defina quais itens podem ser usados neste serviço
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {itensVinculados.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Nenhum item vinculado. Adicione itens que podem ser usados neste serviço.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {itensVinculados.map((itemVinc, index) => (
                <Card key={index} className="border">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="pt-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getTipoIcon(itemVinc.item?.tipo || '')}
                            <span className="font-medium text-sm">{itemVinc.item?.nome}</span>
                            <Badge variant="outline" className="text-xs">
                              {getTipoLabel(itemVinc.item?.tipo || '')}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removerItem(index)}
                            className="h-7 w-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Label className="text-xs">
                              Qtd. Sugerida ({itemVinc.item?.unidade_medida})
                            </Label>
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              value={itemVinc.quantidade_sugerida || ''}
                              onChange={(e) => atualizarItem(index, {
                                quantidade_sugerida: parseFloat(e.target.value) || undefined
                              })}
                              placeholder="Opcional"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-5">
                            <Switch
                              checked={itemVinc.obrigatorio}
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

          <div>
            <Label className="text-sm">Adicionar Item</Label>
            <Select onValueChange={adicionarItem} value="">
              <SelectTrigger>
                <SelectValue placeholder="Selecione um item para adicionar" />
              </SelectTrigger>
              <SelectContent>
                {itensParaAdicionar?.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    {itensDisponiveis?.length === 0 
                      ? 'Nenhum item cadastrado'
                      : 'Todos os itens já foram adicionados'}
                  </div>
                ) : (
                  itensParaAdicionar?.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        {getTipoIcon(item.tipo)}
                        <span>{item.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          ({item.unidade_medida})
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-end gap-2 sticky bottom-0 bg-background pt-2 pb-1">
        <Button variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Serviço'
          )}
        </Button>
      </div>
    </div>
  );
}
