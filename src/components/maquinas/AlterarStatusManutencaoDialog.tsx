import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { restaurarFIFO } from '@/lib/fifoConsumo';

interface AlterarStatusManutencaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manutencao: {
    id: string;
    descricao: string;
    observacoes: string | null;
    maquina_id?: string;
    horimetro_na_manutencao?: number | null;
    horimetro_anterior?: number | null;
    detalhamento_lotes?: any;
  } | null;
  maquina?: { id: string; unidade_calculo?: string } | null;
  modo: 'realizar' | 'cancelar' | null;
}

export function AlterarStatusManutencaoDialog({
  open,
  onOpenChange,
  manutencao,
  maquina,
  modo,
}: AlterarStatusManutencaoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [dataRealizada, setDataRealizada] = useState(new Date());
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [horimetroRealizacao, setHorimetroRealizacao] = useState(
    manutencao?.horimetro_na_manutencao != null ? String(manutencao.horimetro_na_manutencao) : ''
  );

  const ehKm = maquina?.unidade_calculo === 'km';
  const campoMedidor = ehKm ? 'km_atual' : 'horimetro_atual';

  async function handleConfirm() {
    if (!manutencao) return;

    if (modo === 'cancelar' && !motivoCancelamento.trim()) {
      toast({ title: 'Informe o motivo do cancelamento', variant: 'destructive' });
      return;
    }

    setSaving(true);

    if (modo === 'realizar') {
      const dataRealFormatada = dataRealizada ? format(dataRealizada, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const horimetroNum = horimetroRealizacao ? Number(horimetroRealizacao) : null;

      const payload: any = { status: 'realizada', data_realizada: dataRealFormatada };
      let vaiAtualizarMedidor = false;
      let medidorAnterior: number | null = null;

      if (horimetroNum != null && manutencao.maquina_id) {
        const { data: maq } = await supabase
          .from('maquinas' as any)
          .select(campoMedidor)
          .eq('id', manutencao.maquina_id)
          .single();
        const atual = Number((maq as any)?.[campoMedidor] || 0);
        if (horimetroNum > atual) {
          vaiAtualizarMedidor = true;
          medidorAnterior = atual;
        }
        payload.horimetro_na_manutencao = horimetroNum;
        payload.horimetro_anterior = vaiAtualizarMedidor ? medidorAnterior : (manutencao.horimetro_anterior ?? null);
      }

      const { error } = await supabase.from('maquina_manutencoes' as any).update(payload).eq('id', manutencao.id);
      if (error) {
        setSaving(false);
        toast({ title: 'Erro ao atualizar manutenção', description: error.message, variant: 'destructive' });
        return;
      }

      if (vaiAtualizarMedidor && manutencao.maquina_id) {
        await supabase.from('maquinas' as any).update({ [campoMedidor]: horimetroNum }).eq('id', manutencao.maquina_id);
      }

      toast({ title: 'Manutenção marcada como realizada. Lançamento gerado no Financeiro.' });
    } else {
      const payload: any = {
        status: 'cancelada',
        observacoes: manutencao.observacoes
          ? `${manutencao.observacoes}\n[Cancelado] ${motivoCancelamento.trim()}`
          : `[Cancelado] ${motivoCancelamento.trim()}`,
      };

      const { error } = await supabase.from('maquina_manutencoes' as any).update(payload).eq('id', manutencao.id);
      if (error) {
        setSaving(false);
        toast({ title: 'Erro ao cancelar manutenção', description: error.message, variant: 'destructive' });
        return;
      }

      let horimetroRevertido = false;

      // Reverte o horímetro/km só se ninguém mexeu nele depois desta manutenção
      if (manutencao.horimetro_anterior != null && manutencao.horimetro_na_manutencao != null && manutencao.maquina_id) {
        const { data: revertido } = await supabase
          .from('maquinas' as any)
          .update({ [campoMedidor]: manutencao.horimetro_anterior })
          .eq('id', manutencao.maquina_id)
          .eq(campoMedidor, manutencao.horimetro_na_manutencao)
          .select('id');
        horimetroRevertido = !!(revertido && revertido.length > 0);
      }

      // Devolve ao estoque o que foi consumido via FIFO, se veio do estoque
      if (manutencao.detalhamento_lotes) {
        await restaurarFIFO(manutencao.detalhamento_lotes);
      }

      toast({
        title: 'Manutenção cancelada. Lançamento removido do Financeiro (se existia).',
        description:
          manutencao.horimetro_anterior != null && !horimetroRevertido
            ? 'Observação: o horímetro/km não foi revertido porque já foi atualizado por outro evento depois.'
            : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-manutencao'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
    }

    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ['manutencoes-todas'] });
    queryClient.invalidateQueries({ queryKey: ['manutencoes-proximas'] });
    queryClient.invalidateQueries({ queryKey: ['manutencoes'] });
    queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    queryClient.invalidateQueries({ queryKey: ['transacoes'] });
    queryClient.invalidateQueries({ queryKey: ['maquinas-stats-safra'] });
    queryClient.invalidateQueries({ queryKey: ['maquinas'] });
    setMotivoCancelamento('');
    setDataRealizada(new Date());
    setHorimetroRealizacao('');
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
          <div className="space-y-4">
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
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{ehKm ? 'Km' : 'Horímetro'} no momento (opcional)</Label>
              <Input
                type="number"
                value={horimetroRealizacao}
                onChange={(e) => setHorimetroRealizacao(e.target.value)}
                placeholder="Deixe em branco se não souber"
              />
              <p className="text-xs text-muted-foreground">
                Se maior que o valor atual da máquina, atualiza o {ehKm ? 'km' : 'horímetro'} automaticamente.
              </p>
            </div>

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
              A manutenção continua no histórico. O lançamento no Financeiro é removido, o horímetro/km é revertido (se
              nada mudou depois) e o estoque consumido (se veio do estoque) é devolvido.
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
