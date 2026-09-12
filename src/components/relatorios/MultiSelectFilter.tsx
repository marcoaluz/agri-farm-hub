import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OpcaoFiltro {
  value: string
  label: string
}

interface Props {
  opcoes: OpcaoFiltro[]
  selecionados: string[]
  onChange: (valores: string[]) => void
  placeholder: string
  className?: string
}

/**
 * Seletor de múltipla escolha (checkbox dentro do dropdown) com contador
 * "N selecionados". Vazio = "todos".
 */
export function MultiSelectFilter({ opcoes, selecionados, onChange, placeholder, className }: Props) {
  const toggle = (valor: string) => {
    onChange(
      selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor]
    )
  }

  const texto =
    selecionados.length === 0
      ? placeholder
      : selecionados.length === 1
        ? opcoes.find((o) => o.value === selecionados[0])?.label || '1 selecionado'
        : `${selecionados.length} selecionados`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn('justify-between font-normal', className)}
        >
          <span className={cn('truncate', selecionados.length === 0 && 'text-muted-foreground')}>
            {texto}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs text-muted-foreground">{placeholder}</span>
          {selecionados.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange([])}>
              Limpar
            </Button>
          )}
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1">
          {opcoes.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Nenhuma opção</p>
          ) : (
            opcoes.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/60"
              >
                <Checkbox
                  checked={selecionados.includes(o.value)}
                  onCheckedChange={() => toggle(o.value)}
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
