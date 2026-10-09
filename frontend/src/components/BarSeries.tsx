import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table, Td } from './ui'

type Row = Record<string, string | number>

/**
 * Histogramme à une seule série (recettes par jour, entrées par heure).
 * Une série : pas de légende, le titre la nomme. Couleur : vert de la marque (contraste ≥ 3:1 sur la surface),
 * pas distinct en mode sombre (variables CSS dans index.css).
 * Une vue tableau est toujours disponible (accessibilité, lecteurs d'écran).
 */
export function BarSeries({
  data, xKey, yKey, valueLabel, format, height = 260,
}: {
  data: Row[]
  xKey: string
  yKey: string
  valueLabel: string
  format: (value: number) => string
  height?: number
}) {
  const [asTable, setAsTable] = useState(false)

  return (
    <div className="viz-root">
      <div className="mb-3 flex justify-end">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-white/5" role="group" aria-label="Affichage">
          {['Graphique', 'Tableau'].map((label, i) => (
            <button
              key={label}
              type="button"
              aria-pressed={asTable === (i === 1)}
              onClick={() => setAsTable(i === 1)}
              className={asTable === (i === 1) ? 'rounded-lg bg-white px-3 py-1.5 text-slate-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'rounded-lg px-3 py-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <Table head={['', valueLabel]}>
            {data.map((row, i) => (
              <tr key={i}>
                <Td>{String(row[xKey])}</Td>
                <Td className="text-right font-semibold">{format(Number(row[yKey]))}</Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
            <defs>
              <linearGradient id="viz-bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--viz-series-1)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--viz-series-1-end)" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--viz-axis)' }} tick={{ fill: 'var(--viz-text-muted)', fontSize: 12 }} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--viz-text-muted)', fontSize: 12 }} width={56} tickFormatter={(v: number) => compact(v)} />
            <Tooltip
              cursor={{ fill: 'var(--viz-hover)' }}
              formatter={(value) => [format(Number(value)), valueLabel]}
              contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', borderRadius: 12, color: 'var(--viz-text)' }}
              labelStyle={{ color: 'var(--viz-text)', fontWeight: 700 }}
              itemStyle={{ color: 'var(--viz-text)' }}
            />
            <Bar dataKey={yKey} fill="url(#viz-bar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

/** 150000 → « 150k », 2000000 → « 2M » (axe uniquement ; les valeurs exactes sont dans l'infobulle). */
function compact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${+(v / 1_000).toFixed(0)}k`
  return String(v)
}
