import { BarChart3, FileSpreadsheet, FileDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, Button, Card, Empty, Field, Input, Loading, PageHeader, Select, Table, Td, cx } from '../../components/ui'
import { api, errorMessage, openDocument, qs } from '../../lib/api'
import { daysAgoIso, todayIso } from '../../lib/format'

const REPORTS: { key: string; label: string }[] = [
  { key: 'periode', label: 'Synthèse de la période' },
  { key: 'journalier', label: 'Rapport journalier' },
  { key: 'mensuel', label: 'Rapport mensuel' },
  { key: 'paiements', label: 'Liste des paiements' },
  { key: 'modes', label: 'Par mode de paiement' },
  { key: 'employes', label: 'Par employé' },
  { key: 'formules', label: 'Par formule' },
  { key: 'frequentation', label: 'Fréquentation (heures et jours)' },
  { key: 'renouvellement', label: 'Taux de renouvellement' },
  { key: 'entrees-manuelles', label: 'Entrées manuelles' },
  { key: 'annulations', label: 'Annulations' },
  { key: 'reductions', label: 'Réductions' },
  { key: 'depenses', label: 'Dépenses validées' },
  { key: 'caisse', label: 'Sessions de caisse' },
]

type ReportTable = { titre: string; colonnes: string[]; lignes: (string | number | null)[][]; totaux?: (string | number | null)[] }

/** Rapports : filtres de période, affichage, export CSV et PDF (calculs faits par le serveur). */
export default function Reports() {
  const [type, setType] = useState('journalier')
  const [du, setDu] = useState(daysAgoIso(1))
  const [au, setAu] = useState(daysAgoIso(1))

  const single = type === 'journalier' || type === 'mensuel'
  const params = { du, au: single ? undefined : au }

  const report = useQuery({
    queryKey: ['report', type, du, au],
    queryFn: () => api<{ table: ReportTable; du: string; au: string }>(`reports/${type}` + qs(params)),
  })

  const preset = (from: string, to: string) => { setDu(from); setAu(to) }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Pilotage" title="Rapports" subtitle="Filtrez une période, consultez, exportez en CSV (Excel) ou PDF." />
      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Rapport">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label={type === 'mensuel' ? 'Mois (un jour du mois)' : single ? 'Jour' : 'Du'}>
            <Input type="date" value={du} max={todayIso()} onChange={(e) => setDu(e.target.value)} />
          </Field>
          {!single && (
            <Field label="Au">
              <Input type="date" value={au} max={todayIso()} onChange={(e) => setAu(e.target.value)} />
            </Field>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => preset(todayIso(), todayIso())}>Aujourd'hui</Button>
          <Button variant="secondary" size="sm" onClick={() => preset(daysAgoIso(1), daysAgoIso(1))}>Hier</Button>
          <Button variant="secondary" size="sm" onClick={() => preset(daysAgoIso(6), todayIso())}>7 jours</Button>
          <Button variant="secondary" size="sm" onClick={() => preset(todayIso().slice(0, 8) + '01', todayIso())}>Ce mois</Button>
          <Button variant="secondary" size="sm" onClick={() => preset(daysAgoIso(29), todayIso())}>30 jours</Button>
          <span className="flex-1" />
          <Button variant="secondary" icon={FileSpreadsheet} onClick={() => openDocument(`reports/${type}` + qs({ ...params, format: 'csv' }))}>Export CSV</Button>
          <Button icon={FileDown} onClick={() => openDocument(`reports/${type}` + qs({ ...params, format: 'pdf' }))}>Export PDF</Button>
        </div>
      </Card>

      <Card title={report.data?.table.titre} icon={BarChart3}>
        {report.isLoading && <Loading />}
        {report.error && <Alert>{errorMessage(report.error)}</Alert>}
        {report.data && report.data.table.lignes.length === 0 && <Empty>Aucune donnée sur la période.</Empty>}
        {report.data && report.data.table.lignes.length > 0 && (
          <Table head={report.data.table.colonnes}>
            {report.data.table.lignes.map((ligne, i) => (
              <tr key={i}>
                {ligne.map((cell, j) => <Td key={j} className={cx(typeof cell === 'number' && 'text-right whitespace-nowrap')}>{fmt(cell)}</Td>)}
              </tr>
            ))}
            {report.data.table.totaux && (
              <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-600">
                {report.data.table.totaux.map((cell, j) => <Td key={j} className={cx(typeof cell === 'number' && 'text-right whitespace-nowrap')}>{fmt(cell)}</Td>)}
              </tr>
            )}
          </Table>
        )}
      </Card>
    </div>
  )
}

function fmt(cell: string | number | null): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'number') return cell.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return cell
}
