import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Maquina {
  id: string;
  nome: string;
  horimetro_atual: number;
}

interface ManutencaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maquina: Maquina | null;
  propriedadeId: string;
}

const tiposManutencao = [
  { value: 'preventiva', label: 'Preventiva' },
  { value: 'corretiva', label: 'Corretiva' },
  { value: 'revisao', label: 'Revisão' },
  { value: 'troca_oleo', label: 'Troca de Óleo' },
  { value: 'troca_filtro', label: 'Troca de Filtro' },
  { value: 'pneu', label: 'Pneu' },
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'outro', label: 'Outro' },
];

export function ManutencaoDialog({ open, onOpenChange, maquina, propriedadeId }: ManutencaoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [tipo, setTipo] = useState('preventiva');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState('agendada');
  const [dataPrevista, setDataPrevista] = useState<Date | undefined>(new Date());
  const [dataRealizada, setDataRealizada] = useState<Date | undefined>();
  const [horimetroManutencao, setHorimetroManutencao] = useState('');
  const [proximoHorimetro, setProximoHorimetro] = useState('');
  const [custo, setCusto] = useState('');
  const [oficina, setOficina] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const resetForm = () => {
    setTipo('preventiva');
    setDescricao('');
    setStatus('agendada');
    setDataPrevista(new Date());
    setDataRealizada(undefined);
    setHorimetroManutencao('');
    setProximoHorimetro('');
    setCusto('');
    setOficina('');
    setObservacoes('');
  };

  const handleSave = async () => {
    if (!maquina || !descricao.trim()) {
      toast({ title: 'Preencha a descrição', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('maquina_manutencoes' as any)
        .insert({
          propriedade_id: propriedadeId,
          maquina_id: maquina.id,
          tipo,
          descricao: descricao.trim(),
          status,
          data_prevista: dataPrevista ? format(dataPrevista, 'yyyy-MM-dd') : null,
          data_realizada: status === 'realizada' && dataRealizada ? format(dataRealizada, 'yyyy-MM-dd') : null,
          horimetro_manutencao: horimetroManutencao ? Number(horimetroManutencao) : null,
          proximo_horimetro: proximoHorimetro ? Number(proximoHorimetro) : null,
          custo: custo ? Number(custo) : null,
          oficina: oficina.trim() || null,
          observacoes: observacoes.trim() || null,
        });

      if (error) throw error;

      toast({ title: 'Manutenção registrada com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['manutencoes-proximas'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
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
            Máquina: <strong>{maquina.nome}</strong> · Horímetro atual: {maquina.horimetro_atual}h
          </p>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tiposManutencao.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Input
              placeholder="Ex: Troca de óleo do motor"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
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
              <Label>Horímetro na Manutenção</Label>
              <Input type="number" placeholder="Ex: 1500" value={horimetroManutencao} onChange={e => setHorimetroManutencao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Próximo Horímetro</Label>
              <Input type="number" placeholder="Ex: 1750" value={proximoHorimetro} onChange={e => setProximoHorimetro(e.target.value)} />
            </div>
          </div>

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

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea placeholder="Observações adicionais..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Manutenção'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
