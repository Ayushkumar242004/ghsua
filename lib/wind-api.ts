export type WindRecord = Record<string, unknown> & {
  dataset?: string
  publishTime?: string
  startTime?: string
  settlementDate?: string
  settlementPeriod?: number
  fuelType?: string
  generation?: number | null
}

export type WindResponse = {
  dataset: string
  filters: Record<string, string>
  count: number
  data: WindRecord[]
  source: string
  requestedAt: string
}

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000').replace(/\/$/, '')

async function request(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<WindResponse> {
  const query = new URLSearchParams(params)
  const response = await fetch(`${backendUrl}${path}?${query.toString()}`, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.detail ?? 'Unable to load BMRS data')
  }

  return body as WindResponse
}

export function fetchActualWind(params: { from: string; to: string; signal?: AbortSignal }) {
  return request(
    '/api/v1/wind/actual',
    { settlementDateFrom: params.from, settlementDateTo: params.to, fuelType: 'WIND' },
    params.signal,
  )
}

export function fetchWindForecast(params: { from: string; to: string; signal?: AbortSignal }) {
  return request(
    '/api/v1/wind/forecast',
    { publishDateTimeFrom: params.from, publishDateTimeTo: params.to },
    params.signal,
  )
}

