import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Search, Contact as ContactIcon, Tags, Check as CheckIcon, X as XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Contato {
  id: string
  propriedade_id: string
  nome: string
  tipo: 'fornecedor' | 'cliente' | 'ambos'
  documento: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  observacoes: string | null
  ativo: boolean
}

interface CategoriaContato {
  id: string
  nome: string
  ativo?: boolean
}

// Categorias padrão usadas como reserva, caso o usuário ainda não tenha criado nenhuma
const TIPOS_PADRAO: CategoriaContato[] = [
  { id: 'fornecedor', nome: 'fornecedor' },
  { id: 'cliente', nome: 'cliente' },
  { id: 'ambos', nome: 'ambos' },
]

const LABELS_LEGADO: Record<string, string> = {
  fornecedor: 'Fornecedor', cliente: 'Cliente', ambos: 'Ambos',
}

function labelTipo(t: string) {
  return LABELS_LEGADO[t] ?? t
}

function badgeTipo(t: string) {
  if (t === 'cliente') return 'bg-emerald-100 text-emerald-700'
  if (t === 'ambos') return 'bg-indigo-100 text-indigo-700'
  if (t === 'fornecedor') return 'bg-amber-100 text-amber-700'
  return 'bg-sky-100 text-sky-700'
}

const initialForm = {
  nome: '', tipo: 'fornecedor', documento: '', telefone: '', email: '',
  endereco: '', observacoes: '',
}

export default function Contatos() {
  const { propriedadeAtual } = useGlobal()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [contatos, setContatos] = useState<Contato[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState<Contato | null>(null)
  const [excluir, setExcluir] = useState<Contato | null>(null)
  const [form, setForm] = useState(initialForm)

  // Categorias de contato (editáveis pelo usuário)
  const [categorias, setCategorias] = useState<CategoriaContato[]>(TIPOS_PADRAO)
  const [gerenciarOpen, setGerenciarOpen] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null)
  const [nomeRenomeado, setNomeRenomeado] = useState('')
  const [savingCat, setSavingCat] = useState(false)
  const [excluirCategoria, setExcluirCategoria] = useState<CategoriaContato | null>(null)

  const fetchContatos = useCallback(async () => {
    if (!propriedadeAtual?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('contatos' as any)
      .select('*')
      .eq('propriedade_id', propriedadeAtual.id)
      .eq('ativo', true)
      .order('nome')
    setLoading(false)
    if (error) {
      toast.error('Erro ao carregar contatos')
      setContatos([])
      return
    }
    setContatos((data as any) ?? [])
  }, [propriedadeAtual?.id])

  const fetchCategorias = useCallback(async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('categorias_contato' as any)
      .select('*')
      .eq('usuario_id', user.id)
      .eq('ativo', true)
      .order('nome')
    if (error || !data || (data as any[]).length === 0) {
      setCategorias(TIPOS_PADRAO)
      return
    }
    setCategorias(data as any)
  }, [user?.id])

  useEffect(() => { fetchContatos() }, [fetchContatos])
  useEffect(() => { fetchCategorias() }, [fetchCategorias])

  async function criarCategoria() {
    const nome = novaCategoria.trim()
    if (!nome || !propriedadeAtual?.id) return
    setSavingCat(true)
    const { error } = await supabase.rpc('criar_categoria_compartilhada' as any, {
      p_tabela: 'categorias_contato',
      p_propriedade_id: propriedadeAtual.id,
      p_nome: nome,
      p_icone: null,
    })
    setSavingCat(false)
    if (error) {
      toast.error((error as any).code === '23505' ? 'Essa categoria já existe' : 'Erro ao criar categoria')
      return
    }
    setNovaCategoria('')
    toast.success('Categoria criada')
    fetchCategorias()
  }

  async function salvarRenomear(cat: CategoriaContato) {
    const nome = nomeRenomeado.trim()
    if (!nome || nome === cat.nome) { setRenomeandoId(null); return }
    setSavingCat(true)
    const { error } = await supabase
      .from('categorias_contato' as any)
      .update({ nome })
      .eq('id', cat.id)
    setSavingCat(false)
    if (error) {
      toast.error('Erro ao renomear categoria')
      return
    }
    setRenomeandoId(null)
    toast.success('Categoria renomeada')
    fetchCategorias()
    fetchContatos()
  }

  async function confirmarExclusaoCategoria() {
    if (!excluirCategoria) return
    setSavingCat(true)
    const { error } = await supabase
      .from('categorias_contato' as any)
      .update({ ativo: false })
      .eq('id', excluirCategoria.id)
    setSavingCat(false)
    if (error) {
      toast.error('Erro ao remover categoria')
      return
    }
    setExcluirCategoria(null)
    toast.success('Categoria removida')
    fetchCategorias()
  }

  function abrirNovo() {
    setEditando(null)
    setForm(initialForm)
    setOpen(true)
  }

  function abrirEdicao(c: Contato) {
    setEditando(c)
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      documento: c.documento ?? '',
      telefone: c.telefone ?? '',
      email: c.email ?? '',
      endereco: c.endereco ?? '',
      observacoes: c.observacoes ?? '',
    })
    setOpen(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!propriedadeAtual?.id) return
    const nome = form.nome.trim()
    if (!nome) { toast.error('Informe o nome'); return }
    if (nome.length > 150) { toast.error('Nome muito longo'); return }
    if (form.email && form.email.length > 0) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!re.test(form.email)) { toast.error('E-mail inválido'); return }
    }
    setSaving(true)
    const payload: any = {
      nome,
      tipo: form.tipo,
      documento: form.documento.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      endereco: form.endereco.trim() || null,
      observacoes: form.observacoes.trim() || null,
    }
    let error
    if (editando) {
      ({ error } = await supabase.from('contatos' as any).update(payload).eq('id', editando.id))
    } else {
      payload.propriedade_id = propriedadeAtual.id
      payload.ativo = true
      ;({ error } = await supabase.from('contatos' as any).insert(payload))
    }
    setSaving(false)
    if (error) {
      toast.error('Erro ao salvar: ' + error.message)
      return
    }
    toast.success(editando ? 'Contato atualizado' : 'Contato criado')
    setOpen(false)
    fetchContatos()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setSaving(true)
    const { data, error } = await supabase
      .from('contatos' as any)
      .update({ ativo: false })
      .eq('id', excluir.id)
      .select('id')
    setSaving(false)
    if (error) {
      toast.error('Erro ao excluir: ' + error.message)
      return
    }
    if (!data || (data as any[]).length === 0) {
      toast.error('O contato não foi encontrado ou você não tem permissão para removê-lo.')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['contatos'] })
    setExcluir(null)
    await fetchContatos()
    toast.success('Contato removido')
  }

  const filtrados = busca
    ? contatos.filter(c =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (c.documento ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (c.email ?? '').toLowerCase().includes(busca.toLowerCase())
      )
    : contatos

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ContactIcon className="h-6 w-6" /> Contatos
          </h1>
          <p className="text-sm text-muted-foreground">Fornecedores e clientes da propriedade</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setGerenciarOpen(true)} disabled={!user}>
            <Tags className="h-4 w-4 mr-1" /> Gerenciar categorias
          </Button>
          <Button onClick={abrirNovo} disabled={!propriedadeAtual}>
            <Plus className="h-4 w-4 mr-1" /> Novo contato
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{filtrados.length} contato(s)</CardTitle>
            <div className="relative w-64 max-w-full">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum contato cadastrado.
            </div>
          ) : (
            <>
              {/* Desktop: tabela */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>
                          <Badge className={badgeTipo(c.tipo)} variant="secondary">
                            {labelTipo(c.tipo)}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.documento ?? '—'}</TableCell>
                        <TableCell>{c.telefone ?? '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{c.email ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => abrirEdicao(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setExcluir(c)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: cards */}
              <div className="block md:hidden space-y-2">
                {filtrados.map(c => (
                  <Card
                    key={c.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => abrirEdicao(c)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{c.nome}</div>
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            <div>{labelTipo(c.tipo)}{c.telefone ? ` · ${c.telefone}` : ''}</div>
                            {c.email && <div className="truncate">{c.email}</div>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge className={badgeTipo(c.tipo)} variant="secondary">
                            {labelTipo(c.tipo)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={e => { e.stopPropagation(); setExcluir(c) }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog Novo / Editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar contato' : 'Novo contato'}</DialogTitle>
            <DialogDescription>
              {editando ? 'Atualize as informações do contato.' : 'Cadastre um fornecedor ou cliente.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Nome *</Label>
                <Input maxLength={150} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {[
                      ...categorias,
                      ...(form.tipo && !categorias.some(c => c.nome === form.tipo)
                        ? [{ id: form.tipo, nome: form.tipo }]
                        : []),
                    ].map(cat => (
                      <SelectItem key={cat.id} value={cat.nome}>{labelTipo(cat.nome)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Documento (CPF/CNPJ)</Label>
                <Input maxLength={20} value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input maxLength={20} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" maxLength={150} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Endereço</Label>
                <Input maxLength={250} value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={2} maxLength={500} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog exclusão */}
      <AlertDialog open={!!excluir} onOpenChange={o => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contato "{excluir?.nome}" será arquivado e não aparecerá mais nas listagens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} disabled={saving}>{saving ? 'Excluindo...' : 'Excluir'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog gerenciar categorias */}
      <Dialog open={gerenciarOpen} onOpenChange={setGerenciarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Categorias de contato</DialogTitle>
            <DialogDescription>
              Crie, renomeie ou remova as categorias usadas no cadastro de contatos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova categoria"
              value={novaCategoria}
              maxLength={50}
              onChange={e => setNovaCategoria(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criarCategoria() } }}
            />
            <Button onClick={criarCategoria} disabled={savingCat || !novaCategoria.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1">
            {categorias.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma categoria ainda.</p>
            )}
            {categorias.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                {renomeandoId === cat.id ? (
                  <>
                    <Input
                      className="h-8"
                      value={nomeRenomeado}
                      maxLength={50}
                      autoFocus
                      onChange={e => setNomeRenomeado(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarRenomear(cat) } }}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => salvarRenomear(cat)} disabled={savingCat}>
                      <CheckIcon className="h-4 w-4 text-emerald-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRenomeandoId(null)}>
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{labelTipo(cat.nome)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => { setRenomeandoId(cat.id); setNomeRenomeado(cat.nome) }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setExcluirCategoria(cat)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGerenciarOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog exclusão de categoria */}
      <AlertDialog open={!!excluirCategoria} onOpenChange={o => !o && setExcluirCategoria(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria "{excluirCategoria?.nome}" deixará de aparecer na lista. Os contatos já cadastrados com ela continuam como estão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingCat}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusaoCategoria} disabled={savingCat}>
              {savingCat ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
