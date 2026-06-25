import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGlobal } from '@/contexts/GlobalContext'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Search, Contact as ContactIcon } from 'lucide-react'
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

const TIPOS = [
  { v: 'fornecedor', l: 'Fornecedor' },
  { v: 'cliente', l: 'Cliente' },
  { v: 'ambos', l: 'Ambos' },
]

function badgeTipo(t: string) {
  if (t === 'cliente') return 'bg-emerald-100 text-emerald-700'
  if (t === 'ambos') return 'bg-indigo-100 text-indigo-700'
  return 'bg-amber-100 text-amber-700'
}

const initialForm = {
  nome: '', tipo: 'fornecedor', documento: '', telefone: '', email: '',
  endereco: '', observacoes: '',
}

export default function Contatos() {
  const { propriedadeAtual } = useGlobal()
  const [contatos, setContatos] = useState<Contato[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState<Contato | null>(null)
  const [excluir, setExcluir] = useState<Contato | null>(null)
  const [form, setForm] = useState(initialForm)

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

  useEffect(() => { fetchContatos() }, [fetchContatos])

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
    const { error } = await supabase
      .from('contatos' as any)
      .update({ ativo: false })
      .eq('id', excluir.id)
    if (error) {
      toast.error('Erro ao excluir')
      return
    }
    toast.success('Contato removido')
    setExcluir(null)
    fetchContatos()
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
        <Button onClick={abrirNovo} disabled={!propriedadeAtual}>
          <Plus className="h-4 w-4 mr-1" /> Novo contato
        </Button>
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
            <div className="overflow-x-auto">
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
                          {TIPOS.find(t => t.v === c.tipo)?.l ?? c.tipo}
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
