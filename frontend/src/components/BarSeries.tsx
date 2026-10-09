import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table, Td } from './ui'

type Row = Record<string, string | number>

/**
 * Histogramme à une seule série (recettes par jour, entrées par heure).
 * Une série : pas de légende, le titre la nomme. Couleur : emplacement 1 de la palette
 * catégorielle validée (bleu), avec un pas distinct en mode sombre (variables CSS).
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
      <div className="mb-2 flex justify-end">
        <button type="button" className="text-sm font-semibold text-slate-600 underline-offset-2 hover:underline dark:text-slate-400" onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Voir le graphique' : 'Voir le tableau'}
        </button>
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
            <Bar dataKey={yKey} fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
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
