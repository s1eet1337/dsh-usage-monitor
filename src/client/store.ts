/**
 * Tiny module-level UI store with a subscribe() API (external-store style).
 * Components use `useUi` to select slices; one background poller (started by
 * the client entry, stopped on unload) keeps the overview fresh and derives
 * one-shot alert toasts from provider level transitions.
 */
import { useSyncExternalStore } from 'react'
import { fetchConfig, fetchOverview, fetchOverviewRaw, fetchPlatform, updateConfig } from './api'
import type { ApiResult } from './api'
import type { AlertLevel, MonitorConfig, OverviewData, PlatformSpend, ProviderView } from '../core/core'

export interface Toast {
  id: number
  provider: string
  label: string
  level: AlertLevel
  message: string
  at: number
}

export interface UiState {
  overview: OverviewData | null
  overviewAt: number
  overviewError: string | null
  config: MonitorConfig | null
  configAt: number
  open: boolean
  activeTab: 'overview' | 'detail' | 'platform' | 'settings'
  loading: boolean
  /** A manual platform sync is in flight. */
  platformBusy: boolean
  toasts: Toast[]
  /** Last level we surfaced a toast for, per provider. */
  surfaced: Record<string, AlertLevel>
}

const state: UiState = {
  overview: null,
  overviewAt: 0,
  overviewError: null,
  config: null,
  configAt: 0,
  open: false,
  activeTab: 'overview',
  loading: false,
  platformBusy: false,
  toasts: [],
  surfaced: {},
}

const listeners = new Set<() => void>()
let toastId = 0

const emit = (): void => {
  for (const fn of [...listeners]) fn()
}

export function getState(): UiState {
  return state
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function patch(partial: Partial<UiState>): void {
  Object.assign(state, partial)
  emit()
}

/* ------------------------------------------------------------------ *
 * Selectors / actions
 * ------------------------------------------------------------------ */

export function useUi<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(state),
  )
}

export const setOpen = (open: boolean): void => patch({ open })
export const toggleOpen = (): void => patch({ open: !state.open })
export const setTab = (activeTab: UiState['activeTab']): void => patch({ activeTab, open: true })

/** Provider views sorted: alerting first, then by label. */
export function orderedProviders(overview: OverviewData | null): ProviderView[] {
  if (overview === null) return []
  const views = [...overview.providers]
  const rank = (v: ProviderView): number => (v.alert === 'critical' ? 0 : v.alert === 'warn' ? 1 : v.status === 'ok' ? 2 : 3)
  views.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
  return views
}

export async function refreshOverview(force = false): Promise<ApiResult<OverviewData>> {
  patch({ loading: true })
  const res = await fetchOverview(force)
  if (res.ok) {
    patch({
      overview: res.data,
      overviewAt: Date.now(),
      overviewError: null,
      loading: false,
    })
    surfaceToasts(res.data)
    schedulePlatformSettle()
  } else {
    patch({ overviewError: res.error, loading: false })
  }
  return res
}

/**
 * The host answers the very first platform request with a 'loading' placeholder
 * while it fetches in the background. Poll a few times (uncached, cheap) so the
 * real numbers — or a token error — show up within seconds instead of a minute.
 */
let platformSettleTimer: ReturnType<typeof setTimeout> | null = null

function schedulePlatformSettle(): void {
  if (state.overview?.platform?.status !== 'loading') return
  if (platformSettleTimer !== null) return
  let attempts = 0
  const tick = (): void => {
    platformSettleTimer = null
    attempts += 1
    if (attempts > 20 || state.overview?.platform?.status !== 'loading') return
    void fetchOverviewRaw().then((res) => {
      if (res.ok) patch({ overview: res.data, overviewAt: Date.now() })
      platformSettleTimer = setTimeout(tick, 3000)
    })
  }
  platformSettleTimer = setTimeout(tick, 2500)
}

export function stopPlatformSettle(): void {
  if (platformSettleTimer !== null) {
    clearTimeout(platformSettleTimer)
    platformSettleTimer = null
  }
}

function surfaceToasts(overview: OverviewData): void {
  const newToasts: Toast[] = []
  const surfaced = { ...state.surfaced }
  for (const view of overview.providers) {
    const level = view.alert ?? 'ok'
    const previous = surfaced[view.provider] ?? 'ok'
    surfaced[view.provider] = level
    if (level === 'ok' || level === previous) continue
    if (previous !== 'warn' || level === 'critical') {
      // entering warn/critical, or escalating warn → critical
      newToasts.push({
        id: ++toastId,
        provider: view.provider,
        label: view.label,
        level,
        message: view.balance?.reason ?? `${view.label} 余额 ${view.balance?.supported === true && Number.isFinite(view.balance.amount) ? '低于预警线' : '状态异常'}`,
        at: Date.now(),
      })
    }
  }
  if (newToasts.length > 0) {
    patch({ surfaced, toasts: [...state.toasts, ...newToasts].slice(-5) })
    setTimeout(() => dismissToast(newToasts[0]?.id ?? -1), 8_000)
  } else {
    patch({ surfaced })
  }
}

export function dismissToast(id: number): void {
  patch({ toasts: state.toasts.filter((t) => t.id !== id) })
}

/**
 * 「立即同步」：只刷新平台数据，并把结果直接贴回当前 overview，避免连带重新
 * 拉取所有 Provider 余额（那会多打几次厂商接口）。
 */
export async function syncPlatform(): Promise<ApiResult<PlatformSpend>> {
  patch({ platformBusy: true })
  const res = await fetchPlatform(true)
  if (res.ok && state.overview !== null) {
    patch({ overview: { ...state.overview, platform: res.data } })
  }
  patch({ platformBusy: false })
  return res
}

export async function loadConfig(force = false): Promise<ApiResult<MonitorConfig>> {
  const res = await fetchConfig(force)
  if (res.ok) patch({ config: res.data, configAt: Date.now() })
  return res
}

export async function saveConfig(patchBody: Record<string, unknown>): Promise<ApiResult<MonitorConfig>> {
  const res = await updateConfig(patchBody)
  if (res.ok) patch({ config: res.data, configAt: Date.now() })
  return res
}

/* ------------------------------------------------------------------ *
 * Background polling (started once by the client entry).
 * ------------------------------------------------------------------ */

export function startBackgroundPoll(): () => void {
  const tick = (): void => {
    void refreshOverview()
  }
  let timer: ReturnType<typeof setInterval> | null = null
  // config.pollMs used to be a dead knob: the interval was hardcoded here.
  const intervalMs = (): number => {
    const configured = state.config?.pollMs
    return typeof configured === 'number' && Number.isFinite(configured) && configured >= 5_000
      ? configured
      : 60_000
  }
  const arm = (): void => {
    if (timer !== null) clearInterval(timer)
    timer = setInterval(tick, intervalMs())
  }
  // Warm caches immediately, then (re)arm once the config lands so a
  // non-default pollMs takes effect without a reload.
  void loadConfig().then(() => arm())
  void refreshOverview()
  arm()
  return () => {
    if (timer !== null) clearInterval(timer)
    stopPlatformSettle()
  }
}
