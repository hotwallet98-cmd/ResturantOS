/** Shared palette for recharts so every chart in the app looks consistent. */
export const chartColors = ['#fe5a11', '#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6', '#64748b']

export const chartGrid = { stroke: '#e2e8f0', strokeDasharray: '3 3' }
export const chartAxis = { stroke: '#94a3b8', fontSize: 12, tickLine: false, axisLine: false } as const
export const chartTooltip = {
  contentStyle: { borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgb(15 23 42 / 0.08)', fontSize: 12 },
  cursor: { fill: 'rgb(241 245 249 / 0.6)' },
}
