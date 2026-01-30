import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';

interface ProdutoFormProps {
  onSuccess: () => void;
  produto?: {
    id: string;
    nome: string;
    categoria: string;
    unidade_medida: string;
    nivel_minimo: number;
  } | null;
}

const CATEGORIAS = [
  'Fertilizante',
  'Defensivo',
  'Semente',
  'Adubo',
  'Herbicida',
  'Fungicida',
  'Inseticida',
  'Combustível',
  'Outros'
];

const UNIDADES = [
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'un', label: 'Unidade (un)' },
  { value: 'sc', label: 'Saca (sc)' },
  { value: 't', label: 'Tonelada (t)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'ml', label: 'Mililitro (ml)' },
];

export function ProdutoForm({ onSuccess, produto }: ProdutoFormProps) {
  const { propriedadeAtual } = useGlobal();
  const queryClient = useQueryClient();
  const isEditing = !!produto;

  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    unidade_medida: '',
    nivel_minimo: 0,
  });

  useEffect(() => {
    if (produto) {
      setFormData({
        nome: produto.nome || '',
        categoria: produto.categoria || '',
        unidade_medida: produto.unidade_medida || '',
        nivel_minimo: produto.nivel_minimo || 0,
      });
    } else {
      setFormData({
        nome: '',
        categoria: '',
        unidade_medida: '',
        nivel_minimo: 0,
      });
    }
  }, [produto]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!propriedadeAtual?.id) {
        throw new Error('Nenhuma propriedade selecionada');
      }

      const payload = {
        propriedade_id: propriedadeAtual.id,
        nome: data.nome.trim(),
        categoria: data.categoria,
        unidade_medida: data.unidade_medida,
        nivel_minimo: data.nivel_minimo,
        ativo: true,
      };

      if (isEditing && produto) {
        const { error } = await supabase
          .from('produtos')
          .update(payload)
          .eq('id', produto.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('produtos')
          .insert(payload);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-custos'] });
      toast.success(isEditing ? 'Produto atualizado!' : 'Produto cadastrado com sucesso!');
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar produto: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast.error('Informe o nome do produto');
      return;
    }
    if (!formData.categoria) {
      toast.error('Selecione a categoria');
      return;
    }
    if (!formData.unidade_medida) {
      toast.error('Selecione a unidade de medida');
      return;
    }

    mutation.mutate(formData);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          {isEditing ? 'Editar Produto' : 'Novo Produto'}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Atualize as informações do produto.'
            : 'Cadastre um novo produto para controlar o estoque.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-4">
        {/* Nome */}
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do Produto *</Label>
          <Input
            id="nome"
            placeholder="Ex: Ureia Granulada"
            value={formData.nome}
            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
            autoFocus
          />
        </div>

        {/* Categoria */}
        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select
            value={formData.categoria}
            onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Unidade de Medida */}
        <div className="space-y-2">
          <Label>Unidade de Medida *</Label>
          <Select
            value={formData.unidade_medida}
            onValueChange={(value) => setFormData(prev => ({ ...prev, unidade_medida: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES.map(un => (
                <SelectItem key={un.value} value={un.value}>
                  {un.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Nível Mínimo */}
        <div className="space-y-2">
          <Label htmlFor="nivel_minimo">Nível Mínimo (alerta)</Label>
          <Input
            id="nivel_minimo"
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            value={formData.nivel_minimo || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              nivel_minimo: parseFloat(e.target.value) || 0 
            }))}
          />
          <p className="text-xs text-muted-foreground">
            Você será alertado quando o estoque ficar abaixo deste valor.
          </p>
        </div>

        <DialogFooter className="pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Cadastrar Produto'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
