import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AlterarStatusManutencaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manutencao: { id: string; descricao: string; observacoes: string | null } | null;
  modo: 'realizar' | 'cancelar' | null;
}

export function AlterarStatusManutencaoDialog({
  open,
  onOpenChange,
  manutencao,
  modo,
}: AlterarStatusManutencaoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [dataRealizada, setDataRealizada] = useState(new Date());
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  async function handleConfirm() {
    if (!manutencao) return;

    if (modo === 'cancelar' && !motivoCancelamento.trim()) {
      toast({ title: 'Informe o motivo do cancelamento', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const payload: any =
      modo === 'realizar'
        ? {
            status: 'realizada',
            data_realizada: dataRealizada
              ? format(dataRealizada, 'yyyy-MM-dd')
              : format(new Date(), 'yyyy-MM-dd'),
          }
        : {
            status: 'cancelada',
            observacoes: manutencao.observacoes
              ? `${manutencao.observacoes}\n[Cancelado] ${motivoCancelamento.trim()}`
              : `[Cancelado] ${motivoCancelamento.trim()}`,
          };

    const { error } = await supabase
      .from('maquina_manutencoes' as any)
      .update(payload)
      .eq('id', manutencao.id);
    setSaving(false);

    if (error) {
      toast({ title: 'Erro ao atualizar manutenção', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title:
        modo === 'realizar'
          ? 'Manutenção marcada como realizada. Lançamento gerado no Financeiro.'
          : 'Manutenção cancelada. Lançamento removido do Financeiro (se existia).',
    });
    queryClient.invalidateQueries({ queryKey: ['manutencoes-todas'] });
    queryClient.invalidateQueries({ queryKey: ['manutencoes-proximas'] });
    queryClient.invalidateQueries({ queryKey: ['manutencoes'] });
    queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    queryClient.invalidateQueries({ queryKey: ['transacoes'] });
    queryClient.invalidateQueries({ queryKey: ['maquinas-stats-safra'] });
    setMotivoCancelamento('');
    setDataRealizada(new Date());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modo === 'realizar' ? 'Marcar manutenção como realizada' : 'Cancelar manutenção'}
          </DialogTitle>
        </DialogHeader>

        {manutencao && <p className="text-sm text-muted-foreground">{manutencao.descricao}</p>}

        {modo === 'realizar' ? (
          <div className="space-y-2">
            <Label>Data da realização *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataRealizada ? format(dataRealizada, 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataRealizada}
                  onSelect={(d) => d && setDataRealizada(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Isso vai gerar (ou atualizar) o lançamento correspondente no Financeiro.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Motivo do cancelamento *</Label>
            <Textarea
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Ex: Orçamento não aprovado, serviço não será mais necessário..."
            />
            <p className="text-xs text-muted-foreground">
              A manutenção continua no histórico, mas o lançamento correspondente no Financeiro (se existir) será
              removido.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving}
            variant={modo === 'cancelar' ? 'destructive' : 'default'}
          >
            {saving
              ? 'Salvando...'
              : modo === 'realizar'
              ? 'Confirmar realização'
              : 'Confirmar cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
