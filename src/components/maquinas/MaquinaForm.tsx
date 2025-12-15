import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGlobal } from '@/contexts/GlobalContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface Maquina {
  id: string;
  propriedade_id: string;
  nome: string;
  modelo?: string;
  ano_fabricacao?: number;
  horimetro_inicial: number;
  horimetro_atual: number;
  custo_hora?: number;
  ativo: boolean;
  created_at: string;
}

interface MaquinaFormProps {
  maquina: Maquina | null;
  onSuccess: () => void;
}

export function MaquinaForm({ maquina, onSuccess }: MaquinaFormProps) {
  const { propriedadeAtual } = useGlobal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: '',
    modelo: '',
    ano_fabricacao: '',
    horimetro_inicial: 0,
    horimetro_atual: 0,
    custo_hora: ''
  });

  useEffect(() => {
    if (maquina) {
      setFormData({
        nome: maquina.nome,
        modelo: maquina.modelo || '',
        ano_fabricacao: maquina.ano_fabricacao?.toString() || '',
        horimetro_inicial: maquina.horimetro_inicial,
        horimetro_atual: maquina.horimetro_atual,
        custo_hora: maquina.custo_hora?.toString() || ''
      });
    }
  }, [maquina]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        propriedade_id: propriedadeAtual?.id,
        nome: formData.nome,
        modelo: formData.modelo || null,
        ano_fabricacao: formData.ano_fabricacao ? parseInt(formData.ano_fabricacao) : null,
        horimetro_inicial: formData.horimetro_inicial,
        horimetro_atual: formData.horimetro_atual,
        custo_hora: formData.custo_hora ? parseFloat(formData.custo_hora) : null
      };

      if (maquina) {
        const { error } = await supabase
          .from('maquinas')
          .update(payload)
          .eq('id', maquina.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('maquinas')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: maquina ? 'Máquina atualizada!' : 'Máquina cadastrada!',
      });
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const isValid = formData.nome.trim().length > 0;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>
          {maquina ? 'Editar Máquina' : 'Nova Máquina'}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label>Nome *</Label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
            placeholder="Ex: Trator John Deere"
            maxLength={200}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Modelo</Label>
            <Input
              value={formData.modelo}
              onChange={(e) => setFormData(prev => ({ ...prev, modelo: e.target.value }))}
              placeholder="Ex: 6145J"
              maxLength={100}
            />
          </div>
          <div>
            <Label>Ano de Fabricação</Label>
            <Input
              type="number"
              value={formData.ano_fabricacao}
              onChange={(e) => setFormData(prev => ({ ...prev, ano_fabricacao: e.target.value }))}
              placeholder="Ex: 2020"
              min={1900}
              max={new Date().getFullYear() + 1}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Horímetro Inicial (h)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.horimetro_inicial || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                horimetro_inicial: parseFloat(e.target.value) || 0 
              }))}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Horímetro Atual (h)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.horimetro_atual || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                horimetro_atual: parseFloat(e.target.value) || 0 
              }))}
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <Label>Custo por Hora (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.custo_hora}
            onChange={(e) => setFormData(prev => ({ ...prev, custo_hora: e.target.value }))}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !isValid}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            maquina ? 'Salvar Alterações' : 'Cadastrar'
          )}
        </Button>
      </div>
    </div>
  );
}
