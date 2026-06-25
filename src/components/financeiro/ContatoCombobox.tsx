import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { supabase } from '@/lib/supabase'

interface Contato {
  id: string
  nome: string
  tipo: string
}

interface Props {
  propriedadeId: string | null | undefined
  value: string // nome
  contatoId?: string | null
  onChange: (nome: string, contatoId: string | null) => void
  placeholder?: string
}

export function ContatoCombobox({ propriedadeId, value, onChange, placeholder = 'Selecione ou digite' }: Props) {
  const [open, setOpen] = useState(false)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!propriedadeId || !open) return
    ;(async () => {
      const { data } = await supabase
        .from('contatos' as any)
        .select('id, nome, tipo')
        .eq('propriedade_id', propriedadeId)
        .eq('ativo', true)
        .order('nome')
      setContatos((data as any) ?? [])
    })()
  }, [propriedadeId, open])

  const filtrados = search
    ? contatos.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()))
    : contatos

  const exatoExiste = contatos.some(c => c.nome.toLowerCase() === search.toLowerCase())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar ou digitar novo..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {search ? (
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded"
                  onClick={() => { onChange(search, null); setOpen(false); setSearch('') }}
                >
                  <Plus className="h-4 w-4" /> Usar "{search}"
                </button>
              ) : (
                <span className="block px-3 py-2 text-sm text-muted-foreground">Nenhum contato</span>
              )}
            </CommandEmpty>
            {search && !exatoExiste && filtrados.length > 0 && (
              <CommandGroup>
                <CommandItem
                  value={`__new__${search}`}
                  onSelect={() => { onChange(search, null); setOpen(false); setSearch('') }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Usar "{search}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {filtrados.map(c => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => { onChange(c.nome, c.id); setOpen(false); setSearch('') }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === c.nome ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{c.nome}</span>
                  <span className="text-xs text-muted-foreground capitalize ml-2">{c.tipo}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
