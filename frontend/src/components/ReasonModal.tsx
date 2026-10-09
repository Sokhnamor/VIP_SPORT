import { useState } from 'react'
import { errorMessage } from '../lib/api'
import { Alert, Button, Field, Modal, Textarea } from './ui'

/** Confirmation d'une action sensible avec motif obligatoire (annulation, suspension, rejet…). */
export function ReasonModal({
  open, title, description, confirmLabel, danger, onClose, onConfirm,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  danger?: boolean
  onClose: () => void
  onConfirm: (motif: string) => Promise<void>
}) {
  const [motif, setMotif] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const close = () => {
    setMotif('')
    setError(null)
    onClose()
  }

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm(motif.trim())
      close()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>Retour</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={submit} loading={loading} disabled={motif.trim().length < 3}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {description && <p className="text-slate-700 dark:text-slate-300">{description}</p>}
        {error && <Alert>{error}</Alert>}
        <Field label="Motif" required>
          <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} autoFocus />
        </Field>
      </div>
    </Modal>
  )
}
