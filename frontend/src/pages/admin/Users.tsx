import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Field, Input, Loading, Modal, PageHeader, Select, Table, Td } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateTime, ROLES } from '../../lib/format'
import type { User } from '../../lib/types'

/** Comptes du personnel : un compte par employé ; désactivation plutôt que suppression. */
export default function Users() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<{ data: User[] }>('users').then((r) => r.data) })
  const [editing, setEditing] = useState<Partial<User> | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const toggleActive = async (u: User) => {
    try {
      await api(`users/${u.id}`, { method: 'PUT', body: { actif: !u.actif } })
      setFeedback({ tone: 'green', text: u.actif ? `Compte de ${u.nom} désactivé : ses sessions sont coupées.` : `Compte de ${u.nom} réactivé.` })
      refresh()
    } catch (e) {
      setFeedback({ tone: 'red', text: e instanceof ApiError ? e.message : 'Erreur.' })
    }
  }

  return (
    <div>
      <PageHeader title="Utilisateurs" actions={<Button onClick={() => setEditing({ nom: '', identifiant: '', role: 'receptionniste' })}>+ Nouveau compte</Button>} />
      {feedback && <div className="mb-4"><Alert tone={feedback.tone}>{feedback.text}</Alert></div>}
      <Card>
        {users.isLoading && <Loading />}
        {users.data && (
          <Table head={['Nom', 'Identifiant', 'Rôle', 'Statut', 'Dernière connexion', '']}>
            {users.data.map((u) => (
              <tr key={u.id} className={u.actif ? '' : 'opacity-60'}>
                <Td className="font-semibold">{u.nom}{u.id === me?.id && ' (moi)'}</Td>
                <Td className="font-mono text-sm">{u.identifiant}</Td>
                <Td>{u.role_libelle}</Td>
                <Td>
                  <Badge tone={u.actif ? 'green' : 'slate'}>{u.actif ? 'Actif' : 'Désactivé'}</Badge>
                  {u.doit_changer_mdp && <span className="block text-xs text-amber-700">mot de passe provisoire</span>}
                </Td>
                <Td className="whitespace-nowrap">{dateTime(u.derniere_connexion)}</Td>
                <Td className="whitespace-nowrap">
                  <Button variant="ghost" onClick={() => setEditing(u)}>Modifier</Button>
                  <Button variant="ghost" onClick={() => setResetting(u)}>Mot de passe</Button>
                  {u.id !== me?.id && <Button variant="ghost" onClick={() => toggleActive(u)}>{u.actif ? 'Désactiver' : 'Réactiver'}</Button>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {editing && <UserForm user={editing} onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); setFeedback({ tone: 'green', text }); refresh() }} />}
      {resetting && <ResetPassword user={resetting} onClose={() => setResetting(null)} onDone={() => { setFeedback({ tone: 'green', text: `Mot de passe provisoire défini pour ${resetting.nom} (à changer à sa prochaine connexion).` }); setResetting(null); refresh() }} />}
    </div>
  )
}

function UserForm({ user, onClose, onSaved }: { user: Partial<User>; onClose: () => void; onSaved: (msg: string) => void }) {
  const [values, setValues] = useState({ nom: user.nom ?? '', identifiant: user.identifiant ?? '', role: user.role ?? 'receptionniste', mot_de_passe: '' })
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)

  const save = async () => {
    setLoading(true)
    setError(null)
    try {
      if (user.id) {
        await api(`users/${user.id}`, { method: 'PUT', body: { nom: values.nom, identifiant: values.identifiant, role: values.role } })
        onSaved('Compte modifié.')
      } else {
        await api('users', { body: values })
        onSaved(`Compte créé. Communiquez le mot de passe provisoire à ${values.nom} : il devra le changer à sa première connexion.`)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Erreur inattendue.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open title={user.id ? 'Modifier le compte' : 'Nouveau compte'} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={save} loading={loading}>Enregistrer</Button>
      </>
    }>
      <div className="space-y-3">
        {error && !error.errors && <Alert>{error.message}</Alert>}
        <Field label="Nom de l'employé" error={error?.field('nom')}><Input value={values.nom} onChange={(e) => setValues({ ...values, nom: e.target.value })} /></Field>
        <Field label="Identifiant de connexion" error={error?.field('identifiant')}><Input value={values.identifiant} autoCapitalize="none" onChange={(e) => setValues({ ...values, identifiant: e.target.value })} /></Field>
        <Field label="Rôle">
          <Select value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value as User['role'] })}>
            {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        {!user.id && (
          <Field label="Mot de passe provisoire" hint="10 caractères minimum, majuscules, minuscules et chiffres." error={error?.field('mot_de_passe')}>
            <Input type="text" autoComplete="off" value={values.mot_de_passe} onChange={(e) => setValues({ ...values, mot_de_passe: e.target.value })} />
          </Field>
        )}
      </div>
    </Modal>
  )
}

function ResetPassword({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const save = async () => {
    setLoading(true)
    setError(null)
    try {
      await api(`users/${user.id}/reset-password`, { body: { mot_de_passe: pwd } })
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? (e.field('mot_de_passe') ?? e.message) : 'Erreur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open title={`Nouveau mot de passe pour ${user.nom}`} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={save} loading={loading}>Définir</Button>
      </>
    }>
      <div className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <p>Mot de passe provisoire : l'employé devra le changer à sa prochaine connexion. Ses sessions ouvertes sont coupées.</p>
        <Field label="Mot de passe provisoire"><Input value={pwd} autoComplete="off" onChange={(e) => setPwd(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
