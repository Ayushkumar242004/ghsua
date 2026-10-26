'use client'

import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CalendarDays, Download, Gauge, Loader2, RefreshCw, Search, Wind } from 'lucide-react'

import { fetchActualWind, fetchWindForecast, type WindRecord, type WindResponse } from '@/lib/wind-api'

const initialActualRange = { from: '2026-01-01', to: '2026-01-31' }
const initialForecastRange = { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' }

function formatDisplayDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC')
}

function formatGeneration(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return `${num.toLocaleString()} MW`
}

export default function WattSightLiveDashboard() {
  const [actualRange, setActualRange] = useState(initialActualRange)
  const [forecastRange, setForecastRange] = useState(initialForecastRange)
  const [actualData, setActualData] = useState<WindResponse | null>(null)
  const [forecastData, setForecastData] = useState<WindResponse | null>(null)
  const [loadingActual, setLoadingActual] = useState(false)
  const [loadingForecast, setLoadingForecast] = useState(false)
  const [errorActual, setErrorActual] = useState<string | null>(null)
  const [errorForecast, setErrorForecast] = useState<string | null>(null)
  const [actualQuery, setActualQuery] = useState('')
  const [forecastQuery, setForecastQuery] = useState('')

  const runActualQuery = async (signal?: AbortSignal) => {
    setLoadingActual(true)
    setErrorActual(null)
    try {
      const result = await fetchActualWind({ from: actualRange.from, to: actualRange.to, signal })
      if (signal?.aborted) return
      setActualData(result)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setErrorActual(error instanceof Error ? error.message : 'Unable to load actual data')
      setActualData(null)
    } finally {
      if (!signal?.aborted) {
        setLoadingActual(false)
      }
    }
  }

  const runForecastQuery = async (signal?: AbortSignal) => {
    setLoadingForecast(true)
    setErrorForecast(null)
    try {
      const result = await fetchWindForecast({ from: forecastRange.from, to: forecastRange.to, signal })
      if (signal?.aborted) return
      setForecastData(result)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setErrorForecast(error instanceof Error ? error.message : 'Unable to load forecast data')
      setForecastData(null)
    } finally {
      if (!signal?.aborted) {
        setLoadingForecast(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void runActualQuery(controller.signal)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void runForecastQuery(controller.signal)
    return () => controller.abort()
  }, [])

  const actualChartData = useMemo(() => {
    return (actualData?.data ?? []).slice(0, 12).map((item, index) => ({
      label: `${index + 1}`,
      generation: Number(item.generation ?? 0),
      startTime: item.startTime ?? `Period ${index + 1}`,
    }))
  }, [actualData])

  const forecastChartData = useMemo(() => {
    return (forecastData?.data ?? []).slice(0, 12).map((item, index) => ({
      label: `${index + 1}`,
      generation: Number(item.generation ?? 0),
      startTime: item.startTime ?? `Period ${index + 1}`,
    }))
  }, [forecastData])

  const actualRows = useMemo(() => {
    return (actualData?.data ?? []).filter((item) => {
      const haystack = JSON.stringify(item).toLowerCase()
      return haystack.includes(actualQuery.toLowerCase())
    })
  }, [actualData, actualQuery])

  const forecastRows = useMemo(() => {
    return (forecastData?.data ?? []).filter((item) => {
      const haystack = JSON.stringify(item).toLowerCase()
      return haystack.includes(forecastQuery.toLowerCase())
    })
  }, [forecastData, forecastQuery])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-slate-100">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Live BMRS dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold">WattSight wind procurement monitor</h1>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
          <Wind className="h-4 w-4 text-cyan-400" />
          <span>Connected to FastAPI backend</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Actual generation</p>
              <h2 className="mt-1 text-xl font-semibold">FUELHH / WIND</h2>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-500"
              onClick={() => void runActualQuery()}
              disabled={loadingActual}
            >
              {loadingActual ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">From</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                type="date"
                value={actualRange.from}
                onChange={(event) => setActualRange((current) => ({ ...current, from: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">To</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                type="date"
                value={actualRange.to}
                onChange={(event) => setActualRange((current) => ({ ...current, to: event.target.value }))}
              />
            </label>
            <button
              className="self-end rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              onClick={() => void runActualQuery()}
              disabled={loadingActual}
            >
              Load data
            </button>
          </div>

          {errorActual ? (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{errorActual}</div>
          ) : null}

          {actualData ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
                <span>Records: {actualData.count}</span>
                <span>Dataset: {actualData.dataset}</span>
              </div>
              <div className="h-52 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={actualChartData}>
                    <defs>
                      <linearGradient id="actualFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#334155" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="generation" stroke="#22d3ee" strokeWidth={2} fill="url(#actualFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Forecast generation</p>
              <h2 className="mt-1 text-xl font-semibold">WINDFOR</h2>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-500"
              onClick={() => void runForecastQuery()}
              disabled={loadingForecast}
            >
              {loadingForecast ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">Published from</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                type="datetime-local"
                value={forecastRange.from.replace('Z', '')}
                onChange={(event) => setForecastRange((current) => ({ ...current, from: `${event.target.value}:00Z` }))}
              />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">Published to</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                type="datetime-local"
                value={forecastRange.to.replace('Z', '')}
                onChange={(event) => setForecastRange((current) => ({ ...current, to: `${event.target.value}:00Z` }))}
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              onClick={() => void runForecastQuery()}
              disabled={loadingForecast}
            >
              Load data
            </button>
          </div>

          {errorForecast ? (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{errorForecast}</div>
          ) : null}

          {forecastData ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
                <span>Records: {forecastData.count}</span>
                <span>Dataset: {forecastData.dataset}</span>
              </div>
              <div className="h-52 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastChartData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="generation" stroke="#67e8f9" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Actual records</h3>
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-300">
              <Search className="h-4 w-4" />
              <input
                aria-label="Search actual records"
                className="w-32 bg-transparent outline-none"
                placeholder="Search"
                value={actualQuery}
                onChange={(event) => setActualQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2">Settlement date</th>
                  <th className="px-2 py-2">Period</th>
                  <th className="px-2 py-2">Start</th>
                  <th className="px-2 py-2">Generation</th>
                </tr>
              </thead>
              <tbody>
                {actualRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-slate-400" colSpan={4}>No actual records available for the selected filters.</td>
                  </tr>
                ) : (
                  actualRows.slice(0, 10).map((row, index) => (
                    <tr
                      key={`${row.settlementDate ?? 'date'}-${row.settlementPeriod ?? 'period'}-${row.startTime ?? 'start'}-${index}`}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="px-2 py-2">{row.settlementDate ?? '—'}</td>
                      <td className="px-2 py-2">{row.settlementPeriod ?? '—'}</td>
                      <td className="px-2 py-2">{formatDisplayDate(String(row.startTime ?? ''))}</td>
                      <td className="px-2 py-2">{formatGeneration(row.generation ?? null)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Forecast records</h3>
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-300">
              <Search className="h-4 w-4" />
              <input
                aria-label="Search forecast records"
                className="w-32 bg-transparent outline-none"
                placeholder="Search"
                value={forecastQuery}
                onChange={(event) => setForecastQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2">Publish time</th>
                  <th className="px-2 py-2">Delivery start</th>
                  <th className="px-2 py-2">Generation</th>
                </tr>
              </thead>
              <tbody>
                {forecastRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-slate-400" colSpan={3}>No forecast records available for the selected filters.</td>
                  </tr>
                ) : (
                  forecastRows.slice(0, 10).map((row, index) => (
                    <tr
                      key={`${row.publishTime ?? 'publish'}-${row.startTime ?? 'start'}-${row.generation ?? 'gen'}-${index}`}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="px-2 py-2">{formatDisplayDate(String(row.publishTime ?? ''))}</td>
                      <td className="px-2 py-2">{formatDisplayDate(String(row.startTime ?? ''))}</td>
                      <td className="px-2 py-2">{formatGeneration(row.generation ?? null)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
