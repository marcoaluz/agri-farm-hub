import { useState, useEffect, useRef } from 'react'
import { User, Save, Lock, Camera, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Perfil() {
  const { user } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [perfil, setPerfil] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name, perfil, avatar_url')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        setFullName(data.full_name || '')
        setPerfil(data.perfil || '')
        setAvatarUrl(data.avatar_url || null)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  const handleSaveProfile = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('user_profiles')
      .update({ full_name: fullName })
      .eq('id', user.id)

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Perfil atualizado!', description: 'Suas informações foram salvas.' })
    }
    setSaving(false)
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem (jpg, png...).', variant: 'destructive' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Máximo de 5MB.', variant: 'destructive' })
      return
    }

    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (uploadError) {
      setUploadingAvatar(false)
      toast({ title: 'Erro ao enviar foto', description: uploadError.message, variant: 'destructive' })
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}` // evita cache de imagem antiga

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    setUploadingAvatar(false)

    if (updateError) {
      toast({ title: 'Erro ao salvar foto', description: updateError.message, variant: 'destructive' })
      return
    }

    setAvatarUrl(publicUrl)
    toast({ title: 'Foto de perfil atualizada!' })
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Senhas não coincidem', description: 'Verifique e tente novamente.', variant: 'destructive' })
      return
    }

    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      toast({ title: 'Erro ao alterar senha', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Senha alterada!', description: 'Sua senha foi atualizada com sucesso.' })
      setNewPassword('')
      setConfirmPassword('')
    }
    setChangingPassword(false)
  }

  const perfilLabel: Record<string, string> = {
    admin: 'Administrador',
    proprietario: 'Proprietário',
    gerente: 'Gerente',
    operador: 'Operador',
    consultor: 'Consultor',
  }

  const getInitials = () => {
    if (fullName) {
      const parts = fullName.split(' ')
      return (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Pessoais</CardTitle>
            <CardDescription>Atualize suas informações de perfil</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl || undefined} alt="Foto de perfil" />
                  <AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground p-2 shadow-md hover:bg-primary/90 disabled:opacity-50"
                  aria-label="Trocar foto"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <Button variant="outline" size="sm" onClick={handleAvatarClick} disabled={uploadingAvatar}>
                <Camera className="h-4 w-4 mr-2" />
                {uploadingAvatar ? 'Enviando...' : 'Trocar foto'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="opacity-70" />
            </div>

            <div className="space-y-2">
              <Label>Perfil</Label>
              <div>
                <Badge variant="secondary">{perfilLabel[perfil] || perfil}</Badge>
              </div>
            </div>

            <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </CardContent>
        </Card>

        {/* Alterar Senha */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alterar Senha</CardTitle>
            <CardDescription>Defina uma nova senha para sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>

            <Button onClick={handleChangePassword} disabled={changingPassword} variant="outline" className="w-full">
              <Lock className="h-4 w-4 mr-2" />
              {changingPassword ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
