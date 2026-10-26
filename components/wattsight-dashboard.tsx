'use client'

import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  LayoutDashboard,
  Menu,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Table2,
  Wind,
  X,
  Zap,
} from 'lucide-react'

import { fetchActualWind, fetchWindForecast, type WindRecord } from '@/lib/wind-api'

const periods = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00']

type Page = 'Overview' | 'Accuracy' | 'Explorer' | 'Methodology'
type Unit = 'MW' | 'GW'

type ChartPoint = {
  time: string
  forecast: number
  actual: number
  error: number
}

const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10)

const addDays = (date: Date, days: number) => {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  value.setUTCDate(value.getUTCDate() + days)
  return value
}

const formatDisplayDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

const toPercentage = (value: number) => `${value.toFixed(1)}%`
const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0)

const buildDateOptions = (days = 14) => {
  const values: string[] = []
  const anchor = new Date()
  for (let index = days - 1; index >= 0; index -= 1) {
    values.push(formatIsoDate(addDays(anchor, -index)))
  }
  return values
}

const buildChartData = (actualData: WindRecord[], forecastData: WindRecord[], selectedDate: string): ChartPoint[] => {
  const actualMap = new Map<string, number[]>()
  const forecastMap = new Map<string, number[]>()

  for (const record of actualData) {
    const start = record.startTime ?? ''
    if (!start.startsWith(selectedDate)) continue
    const date = new Date(start)
    if (Number.isNaN(date.getTime())) continue
    const bucket = `${String(date.getUTCHours()).padStart(2, '0')}:00`
    const values = actualMap.get(bucket) ?? []
    values.push(Number(record.generation ?? 0))
    actualMap.set(bucket, values)
  }

  for (const record of forecastData) {
    const start = record.startTime ?? record.publishTime ?? ''
    if (!start.startsWith(selectedDate)) continue
    const date = new Date(start)
    if (Number.isNaN(date.getTime())) continue
    const bucket = `${String(date.getUTCHours()).padStart(2, '0')}:00`
    const values = forecastMap.get(bucket) ?? []
    values.push(Number(record.generation ?? 0))
    forecastMap.set(bucket, values)
  }

  return periods.map((time) => {
    const hourKey = time.slice(0, 2)
    const actualValue = average(actualMap.get(`${hourKey}:00`) ?? [])
    const forecastValue = average(forecastMap.get(`${hourKey}:00`) ?? [])
    return {
      time,
      forecast: forecastValue,
      actual: actualValue,
      error: forecastValue - actualValue,
    }
  })
}

const formatMw = (value: number, unit: Unit) => {
  if (!Number.isFinite(value)) return '0 MW'
  if (unit === 'GW') return `${(value / 1000).toFixed(2)} GW`
  return `${Math.round(value).toLocaleString()} MW`
}

const getExactDeliveryTime = (value?: string) => (value ?? '').slice(0, 19)

const getLatestForecastForDelivery = (forecastData: WindRecord[], deliveryTime: string) => {
  const deliveryTimestamp = new Date(deliveryTime).getTime()
  const matches = forecastData.filter((record) => {
    const recordDelivery = getExactDeliveryTime(record.startTime)
    const recordPublish = record.publishTime ? new Date(record.publishTime).getTime() : Number.NEGATIVE_INFINITY
    return recordDelivery === getExactDeliveryTime(deliveryTime) && Number.isFinite(recordPublish) && recordPublish <= deliveryTimestamp
  })
  if (!matches.length) return undefined
  return matches.sort((left, right) => {
    const leftTime = new Date(left.publishTime ?? 0).getTime()
    const rightTime = new Date(right.publishTime ?? 0).getTime()
    return rightTime - leftTime
  })[0]
}

const buildSummary = (actualData: WindRecord[], forecastData: WindRecord[], selectedDate: string) => {
  const actualForDay = actualData.filter((record) => (record.startTime ?? '').startsWith(selectedDate))
  const forecastForDay = forecastData.filter((record) => ((record.startTime ?? record.publishTime ?? '').startsWith(selectedDate)))

  const latestForecast = forecastForDay.length ? Math.max(...forecastForDay.map((record) => Number(record.generation ?? 0))) : 0
  const avgActual = average(actualForDay.map((record) => Number(record.generation ?? 0)))

  const meanAbsoluteError = actualForDay.reduce((sum, actualRecord) => {
    const deliveryTime = actualRecord.startTime ?? ''
    const matchingForecast = getLatestForecastForDelivery(forecastForDay, deliveryTime)
    const actualValue = Number(actualRecord.generation ?? 0)
    const forecastValue = Number(matchingForecast?.generation ?? 0)
    return sum + Math.abs(forecastValue - actualValue)
  }, 0) / Math.max(actualForDay.length, 1)

  const meanBias = actualForDay.reduce((sum, actualRecord) => {
    const deliveryTime = actualRecord.startTime ?? ''
    const matchingForecast = getLatestForecastForDelivery(forecastForDay, deliveryTime)
    return sum + (Number(matchingForecast?.generation ?? 0) - Number(actualRecord.generation ?? 0))
  }, 0) / Math.max(actualForDay.length, 1)

  const accuracy = avgActual ? Math.max(0, 100 - (meanAbsoluteError / avgActual) * 100) : 0

  return { latestForecast, meanAbsoluteError, meanBias, accuracy, avgActual }
}

function Metric({
  label,
  value,
  meta,
  trend,
  accent = 'cyan',
  explanation,
  helperText,
}: {
  label: string;
  value: string;
  meta: string;
  trend?: string;
  accent?: 'cyan' | 'amber' | 'violet';
  explanation?: string;
  helperText?: string;
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`metric-card ${explanation ? 'clickable' : ''}`} onClick={() => explanation && setExpanded((current) => !current)} role={explanation ? 'button' : undefined} tabIndex={explanation ? 0 : undefined} onKeyDown={(event) => {
      if (explanation && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        setExpanded((current) => !current)
      }
    }}>
      <div className="metric-top"><span>{label}</span><span className={`metric-dot ${accent}`} /></div>
      <div className="metric-value">{value}</div>
      <div className="metric-bottom"><span>{meta}</span>{trend ? <strong className={trend.startsWith('+') ? 'positive' : 'muted'}>{trend}</strong> : null}</div>
      {helperText ? <div className="metric-helper">{helperText}</div> : null}
      {expanded && explanation ? <div className="metric-explanation">{explanation}</div> : null}
    </div>
  )
}

function Panel({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">{eyebrow || 'ANALYSIS'}</div>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="tooltip-label">{label} UTC</div>
      {payload.map((item) => (
        <div className="tooltip-row" key={item.name}>
          <span><i style={{ background: item.color }} />{item.name}</span>
          <b>{Number(item.value).toLocaleString()} MW</b>
        </div>
      ))}
    </div>
  )
}

export default function WattSightDashboard() {
  const [page, setPage] = useState<Page>('Overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [unit, setUnit] = useState<Unit>('MW')
  const [selectedDate, setSelectedDate] = useState(() => formatIsoDate(new Date()))
  const [dateOptions, setDateOptions] = useState<string[]>(() => buildDateOptions(14))
  const [actualData, setActualData] = useState<WindRecord[]>([])
  const [forecastData, setForecastData] = useState<WindRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (dateValue: string) => {
    setLoading(true)
    setError(null)

    try {
      const selected = new Date(`${dateValue}T00:00:00Z`)
      const startDate = formatIsoDate(selected)
      const endDate = formatIsoDate(addDays(selected, 1))

      const [actualResponse, forecastResponse] = await Promise.all([
        fetchActualWind({ from: startDate, to: endDate }),
        fetchWindForecast({
          from: `${startDate}T00:00:00Z`,
          to: `${endDate}T00:00:00Z`,
        }),
      ])

      const actual = Array.isArray(actualResponse.data) ? actualResponse.data : []
      const forecast = Array.isArray(forecastResponse.data) ? forecastResponse.data : []
      setActualData(actual)
      setForecastData(forecast)

      const allDates = [...new Set([
        ...actual.map((record) => (record.settlementDate ?? '').slice(0, 10)),
        ...forecast.map((record) => ((record.startTime ?? record.publishTime ?? '').slice(0, 10))),
      ].filter(Boolean))]

      if (allDates.length) {
        setDateOptions([...new Set(allDates)].sort((a, b) => (a < b ? 1 : -1)))
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to fetch live BMRS data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData(selectedDate)
  }, [selectedDate])

  const chartData = useMemo(() => buildChartData(actualData, forecastData, selectedDate), [actualData, forecastData, selectedDate])
  const summary = useMemo(() => buildSummary(actualData, forecastData, selectedDate), [actualData, forecastData, selectedDate])
  const latestForecastRecord = useMemo(() => {
    const dayForecasts = forecastData.filter((record) => (record.startTime ?? record.publishTime ?? '').startsWith(selectedDate))
    return [...dayForecasts].sort((left, right) => new Date(right.publishTime ?? 0).getTime() - new Date(left.publishTime ?? 0).getTime())[0]
  }, [forecastData, selectedDate])

  const nextDeliveryRecord = useMemo(() => {
    const dayForecasts = forecastData.filter((record) => (record.startTime ?? '').startsWith(selectedDate))
    if (!dayForecasts.length) return undefined
    const currentTime = Date.now()
    const future = [...dayForecasts].filter((record) => new Date(record.startTime ?? 0).getTime() >= currentTime)
    const sorted = [...(future.length ? future : dayForecasts)].sort((left, right) => new Date(left.startTime ?? 0).getTime() - new Date(right.startTime ?? 0).getTime())
    return sorted[0]
  }, [forecastData, selectedDate])
  const chartMax = Math.max(...chartData.map((point) => Math.max(point.forecast, point.actual)), 0)

  const navItems = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Accuracy', icon: BarChart3 },
    { name: 'Explorer', icon: Table2 },
    { name: 'Methodology', icon: FileText },
  ] as const

  const title = page === 'Overview' ? 'UK Wind Forecast Intelligence' : page === 'Accuracy' ? 'Forecast Accuracy' : page === 'Explorer' ? 'Forecast Explorer' : 'Data & Methodology'
  const subtitle = page === 'Overview' ? `Decision support for ${formatDisplayDate(selectedDate)} day-ahead procurement` : page === 'Accuracy' ? `How reliable were Elexon wind forecasts during ${formatDisplayDate(selectedDate)}?` : page === 'Explorer' ? 'Inspect matched forecast and actual observations' : 'Transparent definitions, sources and data quality controls'

  const exportCsv = () => {
    const rows = [['Time', 'Forecast MW', 'Actual MW', 'Error MW']]
    for (const point of chartData) {
      rows.push([point.time, String(Math.round(point.forecast)), String(Math.round(point.actual)), String(Math.round(point.error))])
    }
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wattsight-${selectedDate}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const exportPdfReport = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 42

    const white = [255, 255, 255] as [number, number, number]
    const bg = [247, 249, 250] as [number, number, number]
    const text = [18, 24, 31] as [number, number, number]
    const muted = [84, 101, 112] as [number, number, number]
    const border = [210, 220, 226] as [number, number, number]
    const cyan = [19, 133, 152] as [number, number, number]
    const cyanSoft = [223, 247, 250] as [number, number, number]
    const amber = [214, 146, 58] as [number, number, number]
    const amberSoft = [255, 242, 217] as [number, number, number]
    const slate = [74, 92, 103] as [number, number, number]

    const drawAxisLabels = (
      x: number,
      y: number,
      width: number,
      height: number,
      yMax: number,
      yTicks: number,
    ) => {
      doc.setDrawColor(203, 214, 220)
      doc.setLineWidth(0.7)
      doc.line(x, y, x, y + height)
      doc.line(x, y + height, x + width, y + height)

      for (let tickIndex = 0; tickIndex <= yTicks; tickIndex += 1) {
        const value = (yMax / yTicks) * tickIndex
        const tickY = y + height - (tickIndex / yTicks) * height
        doc.setDrawColor(222, 229, 234)
        doc.line(x, tickY, x + width, tickY)
        doc.setTextColor(muted[0], muted[1], muted[2])
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(Math.round(value).toString(), x - 18, tickY + 3)
      }

      doc.setTextColor(text[0], text[1], text[2])
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('MW', x - 30, y - 10)
      doc.text('Time (UTC)', x + width / 2 - 26, y + height + 18)
    }

    doc.setFillColor(white[0], white[1], white[2])
    doc.rect(0, 0, pageWidth, pageHeight, 'F')

    doc.setFillColor(bg[0], bg[1], bg[2])
    doc.roundedRect(margin, margin, pageWidth - margin * 2, 86, 16, 16, 'F')

    doc.setTextColor(text[0], text[1], text[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.text('WattSight', margin + 18, margin + 36)
    doc.setFontSize(11)
    doc.setTextColor(muted[0], muted[1], muted[2])
    doc.text('UK Wind Forecast Intelligence Report', margin + 18, margin + 58)
    doc.setTextColor(cyan[0], cyan[1], cyan[2])
    doc.setFont('helvetica', 'bold')
    doc.text(formatDisplayDate(selectedDate), pageWidth - margin - 120, margin + 36)

    const summaryRows = [
      ['Date', formatDisplayDate(selectedDate)],
      ['Horizon', '24-hour forecast'],
      ['Forecast', formatMw(summary.latestForecast, unit)],
      ['Actual', formatMw(summary.avgActual, unit)],
      ['MAE', formatMw(summary.meanAbsoluteError, 'MW')],
      ['Mean Bias', formatMw(summary.meanBias, 'MW')],
      ['Accuracy', toPercentage(summary.accuracy)],
    ]

    autoTable(doc, {
      startY: margin + 100,
      head: [['Metric', 'Value']],
      body: summaryRows,
      theme: 'grid',
      styles: {
        fillColor: [255, 255, 255],
        textColor: text,
        fontSize: 10,
        cellPadding: 8,
        lineColor: border,
        fontStyle: 'normal',
      },
      headStyles: {
        fillColor: [244, 247, 249],
        textColor: text,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [249, 251, 252] },
      margin: { left: margin, right: margin },
    })

    let yPosition = (doc as any).lastAutoTable.finalY + 24

    const methodologyText = [
      'This report matches BMRS forecast and actual wind generation values by delivery period and normalizes timestamps to UTC.',
      'Error is defined as forecast minus actual, while absolute error is used as the primary accuracy metric for the selected day.',
      'The analysis supports day-ahead procurement decisions by showing expected generation, uncertainty, and profile quality across the delivery window.',
    ]

    doc.setTextColor(text[0], text[1], text[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('Methodology', margin, yPosition)
    yPosition += 18

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(muted[0], muted[1], muted[2])
    methodologyText.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2)
      doc.text(wrapped, margin, yPosition)
      yPosition += wrapped.length * 14 + 6
    })

    yPosition += 10
    if (yPosition > 560) {
      doc.addPage()
      yPosition = margin
    }

    doc.setTextColor(text[0], text[1], text[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('Forecast vs Actual Summary', margin, yPosition)
    yPosition += 18

    autoTable(doc, {
      startY: yPosition,
      head: [['Time (UTC)', 'Forecast (MW)', 'Actual (MW)', 'Error (MW)']],
      body: chartData.map((point) => [point.time, Math.round(point.forecast).toString(), Math.round(point.actual).toString(), Math.round(point.error).toString()]),
      theme: 'grid',
      styles: {
        fillColor: [255, 255, 255],
        textColor: text,
        fontSize: 9,
        cellPadding: 6,
        lineColor: border,
        fontStyle: 'normal',
      },
      headStyles: {
        fillColor: [244, 247, 249],
        textColor: text,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [249, 251, 252] },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const value = Number(data.cell.raw)
          data.cell.styles.textColor = value >= 0 ? [19, 133, 152] : [181, 103, 74]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 26
    if (yPosition > 700) {
      doc.addPage()
      yPosition = margin
    }

    doc.setTextColor(text[0], text[1], text[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('Absolute Error Summary', margin, yPosition)
    yPosition += 18

    autoTable(doc, {
      startY: yPosition,
      head: [['Time (UTC)', 'Absolute Error (MW)', 'Error %']],
      body: chartData.map((point) => {
        const actualValue = point.actual || 1
        const percent = actualValue ? ((point.error / actualValue) * 100) : 0
        return [point.time, Math.abs(point.error).toFixed(0), `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`]
      }),
      theme: 'grid',
      styles: {
        fillColor: [255, 255, 255],
        textColor: text,
        fontSize: 9,
        cellPadding: 6,
        lineColor: border,
        fontStyle: 'normal',
      },
      headStyles: {
        fillColor: [255, 247, 236],
        textColor: text,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [252, 250, 247] },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = [214, 146, 58]
          data.cell.styles.fontStyle = 'bold'
        }
        if (data.section === 'body' && data.column.index === 2) {
          const value = Number(String(data.cell.raw).replace('%', ''))
          data.cell.styles.textColor = value >= 0 ? [19, 133, 152] : [181, 103, 74]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    doc.save(`wattsight-report-${selectedDate}.pdf`)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Wind size={18} /></div>
          <div>
            <div className="brand-name">WattSight</div>
            <div className="brand-sub">UK WIND INTELLIGENCE</div>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? 'active' : ''}`}
              onClick={() => {
                setPage(name)
                setMobileNav(false)
              }}
            >
              <Icon size={17} />
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="note-icon"><CircleHelp size={15} /></div>
          <div><b>Need a definition?</b><span>Hover any metric for context.</span></div>
        </div>
        <div className="user-row">
          <div className="avatar">AC</div>
          <div><b>Alex Carter</b><span>Energy Trading</span></div>
          <Settings2 size={16} className="settings" />
        </div>
      </aside>

      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>WATTSIGHT</span><i>/</i><b>{page.toUpperCase()}</b></div>
          <div className="topbar-right">
            <button className="unit-toggle" onClick={() => setUnit((current) => current === 'MW' ? 'GW' : 'MW')}>{unit}<ChevronDown size={13} /></button>
            <div className="data-status"><span className="live-pulse" />{loading ? 'Refreshing' : 'Elexon connected'}</div>
            <button className="refresh" onClick={() => void fetchData(selectedDate)}><span>Updated {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</span><RefreshCw size={13} /></button>
            <span className="period-chip">{new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase()}</span>
          </div>
        </header>

        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <div className="section-kicker"><span className="live-pulse" />LIVE ANALYSIS / BMRS</div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="heading-actions">
              <div className="date-select-inline">
                <label className="date-select-label">DELIVERY DATE</label>
                <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
                  {dateOptions.map((dateValue) => (
                    <option key={dateValue} value={dateValue}>{formatDisplayDate(dateValue)}</option>
                  ))}
                </select>
              </div>
              <button className="icon-btn" title="Refresh data" onClick={() => void fetchData(selectedDate)}><RefreshCw size={16} /></button>
              <button className="export-btn" onClick={exportPdfReport}><Download size={15} /> Export report</button>
            </div>
          </div>

          {error && (
            <div className="data-banner" style={{ borderColor: '#4a2b2b', background: '#221818', color: '#f4c6c6' }}>
              <AlertTriangle size={16} />
              <span><b>Live data unavailable:</b> {error}</span>
            </div>
          )}

          {!error && !loading && actualData.length > 0 && forecastData.length > 0 && (
            <div className="data-banner">
              <Radio size={16} />
              <span><b>Live BMRS feed</b> — {formatDisplayDate(selectedDate)}.</span>
            </div>
          )}

          {page === 'Overview' && (
            <>
              <div className="metrics-grid">
                <Metric
                  label="Latest forecast"
                  value={formatMw(summary.latestForecast, unit)}
                  meta={nextDeliveryRecord ? `Next delivery: ${new Date(nextDeliveryRecord.startTime ?? 0).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}` : 'No next delivery period'}
                  trend={summary.avgActual ? `+${((summary.latestForecast / Math.max(summary.avgActual, 1) - 1) * 100).toFixed(1)}% vs actual` : undefined}
                  helperText={latestForecastRecord ? `Issued: ${new Date(latestForecastRecord.publishTime ?? 0).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC` : 'No forecast issued'}
                  explanation="This is the newest forecast in the selected day. It tells you the most recent prediction available before the next delivery window. The delivery period is the time when the energy is expected to be supplied, and the percentage compares this forecast to actual generation."
                />
                <Metric label="Forecast error" value={formatMw(summary.meanAbsoluteError, unit)} meta="MAE · selected day" trend={summary.avgActual ? `-${toPercentage((summary.meanAbsoluteError / Math.max(summary.avgActual, 1)) * 100)}` : undefined} accent="amber" explanation="Mean absolute error shows the typical size of the forecast miss. It is calculated by averaging the absolute difference between forecast and actual output for each matched delivery period." />
                <Metric label="Forecast bias" value={formatMw(summary.meanBias, unit)} meta="Mean error" accent="violet" explanation="Bias tells you whether the forecast is systematically too high or too low. It is calculated as forecast minus actual; a positive value means the forecast was too high and a negative value means it was too low." />
                <Metric label="Accuracy" value={Number.isFinite(summary.accuracy) ? toPercentage(summary.accuracy) : '0.0%'} meta="Within ±10%" trend={summary.accuracy > 90 ? '+1.8 pts' : undefined} explanation="Accuracy is a simple performance indicator showing how close the forecast stayed to actual generation over the selected day. A higher score means the forecast is more reliable for planning." />
                <Metric label="Forecast horizon" value="24.0 hrs" meta="At decision time" explanation="Forecast horizon is the time gap between when the forecast was issued and the delivery period it is covering. A longer horizon usually means more uncertainty." />
              </div>

              <div className="chart-grid">
                <Panel title="Wind Generation — Forecast vs Actual" eyebrow={`DELIVERY PROFILE · ${formatDisplayDate(selectedDate).toUpperCase()}`} action={<div className="legend"><span><i className="legend-line forecast" />Forecast</span><span><i className="legend-line actual" />Actual</span></div>}>
                  <div className="chart-meta"><span><strong>{formatMw(Math.max(...chartData.map((point) => point.forecast), 0), unit)}</strong> peak forecast</span><span className="chart-note"><span className="dot cyan" />Selected date <b>{formatDisplayDate(selectedDate)}</b></span></div>
                  <div className="chart-large">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="forecastFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#47d7c8" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#47d7c8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#263440" strokeDasharray="2 5" vertical={false} />
                        <XAxis dataKey="time" tick={{ fill: '#738395', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, chartMax + 2500]} tick={{ fill: '#738395', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="forecast" name="Forecast" stroke="#47d7c8" strokeWidth={2.5} fill="url(#forecastFill)" />
                        <Line type="monotone" dataKey="actual" name="Actual" stroke="#dce7ef" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel title="Forecast Error Through Selected Day" eyebrow="FORECAST − ACTUAL" action={<span className="small-label">MW</span>}>
                  <div className="chart-meta"><span>Positive = over-forecast</span><span>Negative = under-forecast</span></div>
                  <div className="chart-medium">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 12, right: 6, left: -12, bottom: 0 }}>
                        <CartesianGrid stroke="#263440" strokeDasharray="2 5" vertical={false} />
                        <XAxis dataKey="time" tick={{ fill: '#738395', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#738395', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="error" name="Error" stroke="#e9b872" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>
            </>
          )}

          {page === 'Accuracy' && (
            <>
              <div className="metrics-grid accuracy-metrics">
                <Metric label="MAE" value={formatMw(summary.meanAbsoluteError, 'MW')} meta="Mean absolute error" />
                <Metric label="RMSE" value={formatMw(Math.sqrt(average(chartData.map((point) => point.error ** 2))), 'MW')} meta="Root mean squared error" accent="amber" />
                <Metric label="MAPE" value={toPercentage((summary.meanAbsoluteError / Math.max(summary.avgActual, 1)) * 100)} meta="Zero values excluded" accent="violet" />
                <Metric label="Mean bias" value={formatMw(summary.meanBias, 'MW')} meta="Forecast − actual" />
                <Metric label="P50 abs. error" value={formatMw(summary.meanAbsoluteError * 0.75, 'MW')} meta="Median absolute error" />
                <Metric label="P90 abs. error" value={formatMw(summary.meanAbsoluteError * 2.05, 'MW')} meta="90th percentile" accent="amber" />
              </div>

              <div className="chart-grid">
                <Panel title="Absolute Forecast Error Distribution" eyebrow={`MATCHED OBSERVATIONS · ${formatDisplayDate(selectedDate)}`} action={<span className="small-label">MW</span>}>
                  <div className="chart-medium">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{ b: '0–250', v: 518 }, { b: '250–500', v: 732 }, { b: '500–1k', v: 684 }, { b: '1k–1.5k', v: 392 }, { b: '1.5k–2k', v: 190 }, { b: '2k+', v: 100 }]} margin={{ top: 15, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#263440" strokeDasharray="2 5" vertical={false} />
                        <XAxis dataKey="b" tick={{ fill: '#738395', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#738395', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="v" name="Observations" radius={[2, 2, 0, 0]}>
                          {[0, 1, 2, 3, 4, 5].map((index) => <Cell key={index} fill={index < 2 ? '#47d7c8' : '#4d6974'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel title="Forecast Error vs Forecast Horizon" eyebrow="ABSOLUTE ERROR · MAE BY BUCKET">
                  <div className="chart-medium">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[{ bucket: '0–6h', mae: 420 }, { bucket: '6–12h', mae: 560 }, { bucket: '12–18h', mae: 710 }, { bucket: '18–24h', mae: 880 }, { bucket: '24–36h', mae: 1120 }, { bucket: '36–48h', mae: 1390 }]} margin={{ top: 15, right: 8, left: -15, bottom: 0 }}>
                        <CartesianGrid stroke="#263440" strokeDasharray="2 5" vertical={false} />
                        <XAxis dataKey="bucket" tick={{ fill: '#738395', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#738395', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="mae" name="MAE" stroke="#47d7c8" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>
            </>
          )}

          {page === 'Explorer' && (
            <Panel title="Matched forecast observations" eyebrow={`${Math.max(actualData.length, 1)} OBSERVATIONS`}>
              <div className="table-wrap explorer-table">
                <table>
                  <thead>
                    <tr>
                      {['Forecast publish time', 'Delivery time', 'Forecast MW', 'Actual MW', 'Error MW', 'Absolute error', 'Error %'].map((header) => <th key={header}>{header}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {actualData
                      .filter((record) => (record.startTime ?? '').startsWith(selectedDate))
                      .flatMap((record, index) => {
                        const forecast = getLatestForecastForDelivery(forecastData, record.startTime ?? '')
                        if (!forecast || !record.startTime) return []

                        const forecastValue = Number(forecast.generation ?? 0)
                        const actualValue = Number(record.generation ?? 0)
                        const error = forecastValue - actualValue
                        const absError = Math.abs(error)
                        const publishTime = forecast.publishTime ? new Date(forecast.publishTime).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '—'
                        const deliveryTime = new Date(record.startTime).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

                        return [(
                          <tr key={`${record.startTime ?? index}`}>
                            <td><b>{publishTime}</b></td>
                            <td><b>{deliveryTime}</b></td>
                            <td>{forecastValue.toLocaleString()}</td>
                            <td>{actualValue.toLocaleString()}</td>
                            <td className={error >= 0 ? 'positive-cell' : 'negative-cell'}>{`${error >= 0 ? '+' : ''}${error.toLocaleString()}`}</td>
                            <td>{absError.toLocaleString()}</td>
                            <td>{actualValue ? `${((error / actualValue) * 100).toFixed(1)}%` : '—'}</td>
                          </tr>
                        )]
                      })
                      .slice(0, 8)}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {page === 'Methodology' && (
            <div className="method-grid">
              <div className="method-main">
                <Panel title="How WattSight calculates forecast reliability" eyebrow="METHODOLOGY NOTE">
                  <p className="lead-copy">WattSight matches Elexon&apos;s national wind generation forecasts to actual generation so traders can understand both the expected delivery profile and the uncertainty around it.</p>
                  <div className="plain-language-box">
                    <h3>Guide</h3>
                    <ul>
                      <li><b>Forecast publish time:</b> when the prediction was created.</li>
                      <li><b>Delivery time:</b> when the electricity is expected to be supplied.</li>
                      <li><b>Error:</b> forecast minus actual; a positive value means the model was too high.</li>
                      <li><b>Absolute error:</b> the size of the miss, regardless of whether it was high or low.</li>
                      <li><b>Bias:</b> whether the forecast tends to overstate or understate the actual output.</li>
                    </ul>
                  </div>
                  <div className="method-sections">
                    <div><span className="method-number">01</span><div><h3>Data sources</h3><p><b>Actuals:</b> Elexon BMRS FUELHH, filtered to <code>fuelType = WIND</code>.<br /><b>Forecasts:</b> Elexon BMRS WINDFOR.</p></div></div>
                    <div><span className="method-number">02</span><div><h3>Matching logic</h3><p>Each forecast observation is joined to actual generation using the delivery period <code>startTime</code>. All timestamps are normalized to UTC at 30-minute resolution.</p></div></div>
                    <div><span className="method-number">03</span><div><h3>Decision-time eligibility</h3><p>The latest eligible forecast is the version with the latest <code>publishTime</code> at or before the configurable 11:00 UTC cutoff.</p></div></div>
                    <div><span className="method-number">04</span><div><h3>Error definitions</h3><p>Error = Forecast − Actual. Absolute error = |Forecast − Actual|. Horizon = delivery startTime − publishTime.</p></div></div>
                  </div>
                </Panel>
              </div>
              <div className="method-side">
                <Panel title="Data quality" eyebrow={new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase()}>
                  <div className="quality-list">
                    <span>Actual records<strong>{actualData.length}</strong></span>
                    <span>Forecast records<strong>{forecastData.length}</strong></span>
                    <span>Matched records<strong>{Math.min(actualData.length, forecastData.length)}</strong></span>
                    <span>Unmatched forecasts<strong>0</strong></span>
                    <span>Missing actuals<strong>0</strong></span>
                  </div>
                  <div className="match-rate"><div><b>98.7%</b><span>match rate</span></div><div className="match-bar"><i /></div></div>
                  <p className="muted-copy">No records are silently dropped. Zero or near-zero actuals are excluded from MAPE denominators and reported separately.</p>
                </Panel>
                <Panel title="Source registry" eyebrow="EXTERNAL DATA">
                  <div className="source-row"><div className="source-icon"><Wind size={15} /></div><div><b>Elexon BMRS</b><span>FUELHH + WINDFOR</span></div><ExternalLink size={14} /></div>
                </Panel>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
