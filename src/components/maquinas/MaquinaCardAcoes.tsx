import { useState } from 'react';
import { Fuel, Wrench, History, Edit, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import HistoricoAbastecimentos from './HistoricoAbastecimentos';

interface MaquinaCardAcoesProps {
  maquina: any;
  onAbastecer: () => void;
  onManutencao: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}

export function MaquinaCardAcoes({
  maquina,
  onAbastecer,
  onManutencao,
  onEditar,
  onExcluir,
}: MaquinaCardAcoesProps) {
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  return (
    <div className="flex flex-col gap-2 pt-4 border-t sm:flex-row sm:items-center">
      {/* Ações principais */}
      <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-1 sm:min-w-0">
        <Button variant="outline" size="sm" className="w-full sm:flex-1 min-w-0" onClick={onAbastecer}>
          <Fuel className="h-4 w-4 mr-1 shrink-0" />
          <span className="truncate">Abastecer</span>
        </Button>
        <Button variant="outline" size="sm" className="w-full sm:flex-1 min-w-0" onClick={onManutencao}>
          <Wrench className="h-4 w-4 mr-1 shrink-0" />
          <span className="truncate">Manutenção</span>
        </Button>
      </div>

      {/* Ações secundárias */}
      <div className="flex items-center justify-end gap-1 shrink-0">
        {/* Desktop grande: ícones separados */}
        <div className="hidden 2xl:flex items-center gap-1">
          <Button variant="ghost" size="sm" title="Histórico" onClick={() => setHistoricoAberto(true)}>
            <History className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" title="Editar" onClick={onEditar}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            title="Excluir"
            className="text-destructive"
            onClick={() => setConfirmandoExcluir(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile e tablet: dropdown */}
        <div className="2xl:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Mais ações">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setHistoricoAberto(true)}>
                <History className="h-4 w-4 mr-2" />
                Histórico
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEditar}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmandoExcluir(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Sheet open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <SheetTrigger asChild>
          <span className="hidden" />
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <HistoricoAbastecimentos maquina={maquina} />
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmandoExcluir} onOpenChange={setConfirmandoExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir máquina?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai excluir "{maquina.nome}" permanentemente. Abastecimentos e manutenções já
              registrados serão preservados no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onExcluir}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MaquinaCardAcoes;
