/**
 * React components for dsh-usage-monitor's web UI.
 * - `Chip`    → conversation.session.header.utilities (top balance pill)
 * - `Trigger` → sidebar.footer.action (opens the panel)
 * - `Hub`     → shell.overlay (alert toasts + the panel, always mounted)
 */
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { DailyPoint, MonitorConfig, OverviewData, PlatformSpend, ProviderBudgetView, ProviderView, UsageData } from '../core/core'
import { currencySymbol, fmtMoney, fmtPct, fmtTokens } from '../core/core'
import { buildAreaPath, buildLineGeometry, yTicks } from '../core/chart'
import { fetchExportCsv, fetchUsage } from './api'
import type { ApiResult, UsageQuery } from './api'
import { dismissToast, orderedProviders, refreshOverview, saveConfig, setOpen, syncPlatform, toggleOpen, useUi } from './store'

const PROVIDER_STYLE: Record<string, { bg: string; ch: string }> = {
  deepseek: { bg: '#4d6bfe', ch: 'D' },
  openai: { bg: '#10a37f', ch: 'O' },
  anthropic: { bg: '#b85c38', ch: 'A' },
  zhipu: { bg: '#0e6cff', ch: 'G' },
  moonshot: { bg: '#6e46e5', ch: 'K' },
  siliconflow: { bg: '#179c6d', ch: 'S' },
}

const logoStyle = (provider: string): CSSProperties => {
  const s = PROVIDER_STYLE[provider]
  return { background: s?.bg ?? '#64748b', flex: 'none' }
}

const logoChar = (provider: string): string => PROVIDER_STYLE[provider]?.ch ?? provider.slice(0, 1).toUpperCase()

const alertClass = (view: ProviderView): string => {
  if (view.alert === 'critical') return 'critical'
  if (view.alert === 'warn') return 'warn'
  return ''
}

/* ================================================================== *
 * Chip — the top balance pill in the session header utilities row
 * ================================================================== */

export function Chip(): ReactElement {
  const overview = useUi((s) => s.overview)
  const view = useMemo(() => pickChipView(overview), [overview])
  if (view === null) {
    return (
      <button type="button" className="um-root um-chip" onClick={() => setOpen(true)} title="用量监控未加载">
        <span className="um-chip-missing">用量</span>
      </button>
    )
  }
  const money = view.balance?.supported === true && Number.isFinite(view.balance.amount)
  const cls = ['um-root', 'um-chip', alertClass(view)]
  if (view.alert !== null && view.alert !== 'ok') cls.push('alarm')
  const title = [
    view.label,
    view.balance?.reason ?? `余额 ${money ? fmtMoney(view.balance?.amount ?? 0, view.balance?.currency ?? '') : '不可用'}`,
    view.remainingPct !== null ? `预算剩余 ${fmtPct(view.remainingPct)}` : null,
  ].filter(Boolean).join(' · ')
  return (
    <button type="button" className={cls.join(' ')} onClick={() => setOpen(true)} title={title}>
      <span className="um-provider-dot" />
      <span className="um-currency">{money ? view.balance?.currency : '—'}</span>
      <span className="um-amount">{money ? fmtMoney(view.balance?.amount ?? 0, view.balance?.currency ?? '') : '不可用'}</span>
    </button>
  )
}

function pickChipView(overview: OverviewData | null): ProviderView | null {
  if (overview === null) return null
  const views = overview.providers
  if (views.length === 0) return null
  if (overview.current !== null) {
    const current = views.find((v) => v.provider === overview.current?.provider)
    if (current !== undefined) return current
  }
  const usable = views.find((v) => v.balance?.supported === true && v.alert !== 'critical')
  return usable ?? views[0] ?? null
}

/* ================================================================== *
 * Trigger — the sidebar footer action that opens the panel
 * ================================================================== */

export function Trigger(): ReactElement {
  const open = useUi((s) => s.open)
  const overview = useUi((s) => s.overview)
  const hasAlert = useMemo(() => (overview?.providers ?? []).some((v) => v.alert === 'warn' || v.alert === 'critical'), [overview])
  return (
    <button
      type="button"
      className="um-root um-trigger"
      aria-label="用量监控"
      title="用量与余额监控"
      onClick={toggleOpen}
      style={{ color: open ? 'var(--um-accent, #4f6ef7)' : undefined }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="M7 14l3-4 3 3 4-6" />
      </svg>
      <span className="um-trigger-label">用量</span>
      {hasAlert ? <span className="um-dot" /> : null}
    </button>
  )
}

/* ================================================================== *
 * Hub — always-mounted overlay: panel + toasts
 * ================================================================== */

export function Hub(): ReactElement {
  const open = useUi((s) => s.open)
  const toasts = useUi((s) => s.toasts)
  return (
    <div className="um-root">
      {toasts.length > 0 ? (
        <div className="um-toasts" role="status">
          {toasts.map((t) => (
            <div key={t.id} className={`um-toast ${t.level}`}>
              <div>
                <b>{t.label}</b> · {t.level === 'critical' ? '余额预警（严重）' : '余额预警'}：{t.message}
              </div>
              <button type="button" aria-label="关闭" onClick={() => dismissToast(t.id)}>×</button>
            </div>
          ))}
        </div>
      ) : null}
      {open ? <Panel /> : null}
    </div>
  )
}

function Panel(): ReactElement {
  const overview = useUi((s) => s.overview)
  const overviewError = useUi((s) => s.overviewError)
  const loading = useUi((s) => s.loading)
  const [tab, setTab] = useState<'overview' | 'detail' | 'platform' | 'settings'>('overview')
  const current = overview?.current
  return (
    <>
      <div className="um-backdrop" onClick={() => setOpen(false)} />
      <section className="um-panel" role="dialog" aria-label="用量与余额监控">
        <header className="um-head">
          <h2>用量监控</h2>
          <span className="um-sub">
            {current !== null && current !== undefined ? `${current.provider} / ${current.model}` : '多 Provider · 余额与用量'}
          </span>
          <span className="um-spacer" />
          <button type="button" className="um-icon-btn" onClick={() => { void refreshOverview(true) }} disabled={loading}>
            {loading ? '刷新中…' : '刷新'}
          </button>
          <button type="button" className="um-icon-btn" onClick={() => setOpen(false)} aria-label="关闭">✕</button>
        </header>
        <nav className="um-tabs">
          <button type="button" className={`um-tab ${tab === 'overview' ? 'on' : ''}`} onClick={() => setTab('overview')}>概览</button>
          <button type="button" className={`um-tab ${tab === 'detail' ? 'on' : ''}`} onClick={() => setTab('detail')}>用量明细</button>
          <button type="button" className={`um-tab ${tab === 'platform' ? 'on' : ''}`} onClick={() => setTab('platform')}>平台消费</button>
          <button type="button" className={`um-tab ${tab === 'settings' ? 'on' : ''}`} onClick={() => setTab('settings')}>预算与告警</button>
        </nav>
        <div className="um-body">
          {overviewError !== null ? <div className="um-error">加载失败：{overviewError}</div> : null}
          {tab === 'overview' ? <OverviewTab overview={overview} /> : null}
          {tab === 'detail' ? <DetailTab /> : null}
          {tab === 'platform' ? <PlatformTab /> : null}
          {tab === 'settings' ? <SettingsTab /> : null}
        </div>
      </section>
    </>
  )
}

/* ================================================================== *
 * Overview
 * ================================================================== */

function OverviewTab(props: { overview: OverviewData | null }): ReactElement {
  const overview = props.overview
  const providers = orderedProviders(overview)
  if (overview === null || providers.length === 0) {
    return <div className="um-hint">尚未加载到数据 — 请确认 host 侧已安装并在本机网络内。</div>
  }
  const today = overview.today
  // ?? null also covers a host that predates the platform field.
  const platform = overview.platform ?? null
  return (
    <div>
      <div className="um-total-line">
        <span>今日合计 <b>{fmtTokens(today?.total ?? 0)}</b> tokens（in {fmtTokens(today?.input ?? 0)} / out {fmtTokens(today?.output ?? 0)}）</span>
        <span>估算花费 <b>{today?.cost !== null && today?.cost !== undefined ? `$${today.cost.toFixed(4)}` : '—'}</b></span>
        <span>调用 <b>{today?.calls ?? 0}</b> 次</span>
        {overview.usageCoverage !== null ? (
          <span className="um-muted">
            会话日志 {overview.usageCoverage.scannedSessions}/{overview.usageCoverage.listedSessions} · 记录 {overview.usageCoverage.usageRecords}（跳过 {overview.usageCoverage.skippedRecords}）
          </span>
        ) : null}
      </div>
      {platform !== null && platform.status !== 'disabled' ? <PlatformStrip platform={platform} /> : null}
      <div className="um-grid">
        {providers.map((view) => <ProviderCard key={view.provider} view={view} platform={platform} />)}
      </div>
      <p className="um-note">
        用量统计来自 DSH 本地会话日志（request/header + assistant/message 事件，保留最近 90 天），与厂商账单存在时差；花费为参考价估算，非账单。余额每 60s 轮询。
      </p>
    </div>
  )
}

function ProviderCard(props: { view: ProviderView; platform: PlatformSpend | null | undefined }): ReactElement {
  const view = props.view
  const platform = props.platform != null && props.platform.status === 'ok' && view.provider === 'deepseek' ? props.platform : null
  const money = view.balance?.supported === true && Number.isFinite(view.balance.amount)
  const budget = view.budget
  const bar = barInfo(view, budget)
  return (
    <article className="um-card">
      <div className="um-card-head">
        <span className="um-logo" style={logoStyle(view.provider)}>{logoChar(view.provider)}</span>
        <span className="um-name">{view.label}</span>
        <span className={`um-pill ${statusClass(view)}`}>{statusText(view)}</span>
      </div>
      {money ? (
        <div className="um-balance"><span className="um-cur">{view.balance?.currency}</span>{fmtMoney(view.balance?.amount ?? 0, view.balance?.currency ?? '')}</div>
      ) : (
        <div className="um-hint">{view.balance?.reason ?? statusText(view)}</div>
      )}
      <div className="um-row">
        <span>今日</span><b>{fmtTokens(view.today?.total ?? 0)}</b>
        <span>in</span><b>{fmtTokens(view.today?.input ?? 0)}</b>
        <span>out</span><b>{fmtTokens(view.today?.output ?? 0)}</b>
        {view.today?.cost !== null && view.today?.cost !== undefined ? <span>≈<b>${view.today.cost.toFixed(4)}</b></span> : null}
      </div>
      {platform !== null ? (
        <div className="um-row um-row-platform" title="来自 platform.deepseek.com 用量页的真实账单口径">
          <span>实际</span>
          <span>今日</span><b>{fmtMoney(platform.today.cost, platform.currency)}</b>
          <span>本月</span><b>{fmtMoney(platform.month.cost, platform.currency)}</b>
          <span>累计</span><b>{fmtMoney(platform.lifetime.cost, platform.currency)}</b>
        </div>
      ) : null}
      <div className="um-bar" title={budget?.amount !== null && budget?.amount !== undefined ? `预算 ${budget?.currency}${budget?.amount}` : '未设置预算'}>
        <i className={alertClass(view)} style={{ width: bar === null ? '0%' : `${Math.min(100, Math.max(0, bar.usedPct * 100)).toFixed(1)}%` }} />
      </div>
      <div className="um-hint">
        {bar === null
          ? '未设置预算：在「预算与告警」中填写以启用进度条与低余额告警'
          : `预算剩余 ${fmtPct(bar.remainingPct)} · 预警线 ${budget === null ? 5 : budget.warnPct}%`}
      </div>
    </article>
  )
}

function barInfo(view: ProviderView, budget: ProviderBudgetView | null): { remainingPct: number; usedPct: number } | null {
  if (budget === null || budget.amount === null || budget.amount === undefined) return null
  if (view.remainingPct === null) return null
  const remainingPct = view.remainingPct
  return { remainingPct, usedPct: Math.max(0, 1 - remainingPct) }
}

function statusText(view: ProviderView): string {
  switch (view.status) {
    case 'ok': return '正常'
    case 'missing-key': return '缺 API Key'
    case 'unsupported': return view.error === 'disabled' ? '已停用' : '无余额接口'
    case 'error': return '错误'
    default: return view.status
  }
}

function statusClass(view: ProviderView): string {
  if (view.alert === 'critical') return 'critical'
  if (view.alert === 'warn') return 'warn'
  if (view.status === 'ok') return 'ok'
  return ''
}

/* ================================================================== *
 * Detail tab — filter + trend chart + table + CSV export
 * ================================================================== */

function DetailTab(): ReactElement {
  const overview = useUi((s) => s.overview)
  const [days, setDays] = useState(7)
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [group, setGroup] = useState<'day' | 'session'>('day')
  const [data, setData] = useState<UsageData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = (force = false): void => {
    setBusy(true)
    const query: UsageQuery = { days, provider, model, group }
    void fetchUsage(query, force).then((res: ApiResult<UsageData>) => {
      setBusy(false)
      if (res.ok) {
        setErr(null)
        setData(res.data)
        if (res.data.providers.length === 1 && provider === '') setProvider(res.data.providers[0] ?? '')
        if (model === '' && res.data.models.length === 1) setModel(res.data.models[0] ?? '')
      } else {
        setErr(res.error)
      }
    })
  }

  useEffect(() => { load() }, [days, provider, model, group]) // eslint-disable-line react-hooks/exhaustive-deps

  // Offer every provider that ever appears in the ledger, plus this adapter set.
  const providerOptions = useMemo(() => {
    const set = new Set<string>((overview?.providers ?? []).map((v) => v.provider))
    for (const p of data?.providers ?? []) set.add(p)
    return [...set].sort()
  }, [overview, data])

  const doExport = (): void => {
    setExporting(true)
    const query: UsageQuery = { days, provider, model, group }
    void fetchExportCsv(query).then((res: ApiResult<string>) => {
      setExporting(false)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dsh-usage-monitor-${group}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    })
  }

  return (
    <div>
      <div className="um-toolbar">
        <select className="um-select" value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Provider">
          <option value="">全部 Provider</option>
          {providerOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="um-select" value={model} onChange={(e) => setModel(e.target.value)} aria-label="模型">
          <option value="">全部模型</option>
          {(data?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="um-seg" role="group" aria-label="时间范围">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d}天</button>
          ))}
        </span>
        <span className="um-seg" role="group" aria-label="分组">
          <button type="button" className={group === 'day' ? 'on' : ''} onClick={() => setGroup('day')}>按日</button>
          <button type="button" className={group === 'session' ? 'on' : ''} onClick={() => setGroup('session')}>按会话</button>
        </span>
        <span className="um-spacer" />
        <button type="button" className="um-icon-btn" onClick={() => load(true)} disabled={busy}>{busy ? '…' : '刷新'}</button>
        <button type="button" className="um-icon-btn" onClick={doExport} disabled={exporting}>{exporting ? '导出中…' : '导出 CSV'}</button>
      </div>
      {err !== null ? <div className="um-error">{err}</div> : null}
      {data !== null ? <TrendBlock data={data} /> : <div className="um-hint">加载用量明细…</div>}
    </div>
  )
}

function TrendBlock(props: { data: UsageData }): ReactElement {
  const d = props.data
  const totals = d.totals
  return (
    <div>
      <div className="um-total-line">
        <span>区间合计 <b>{fmtTokens(totals.total)}</b> tokens</span>
        <span>in <b>{fmtTokens(totals.input)}</b></span>
        <span>out <b>{fmtTokens(totals.output)}</b></span>
        <span>估算花费 <b>{totals.cost !== null ? `$${totals.cost.toFixed(4)}` : '—'}</b></span>
        <span>调用 <b>{totals.calls}</b></span>
      </div>
      <TrendChart daily={d.daily} />
      <div className="um-table-wrap">
        {d.group === 'session' ? <SessionTable data={d} /> : <DayTable data={d} />}
      </div>
    </div>
  )
}

function TrendChart(props: { daily: DailyPoint[] }): ReactElement {
  const width = 680
  const height = 210
  const pad = 30
  const values = props.daily.map((p) => p.total)
  const geo = buildLineGeometry(values, width, height, pad)
  const ticks = yTicks(geo.max, 3)
  const labels = props.daily.map((p) => p.date.slice(5))
  const mid = Math.floor(labels.length / 2)
  const xFor = (i: number): number => (labels.length > 1 ? pad + (i * (width - pad * 2)) / (labels.length - 1) : width / 2)
  return (
    <div className="um-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每日 Token 消耗趋势">
        {ticks.map((t) => {
          const y = geo.yOf(t)
          return (
            <g key={t}>
              <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(127,135,146,.16)" strokeWidth="1" />
              <text x={pad - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--um-muted, #7a828e)">{fmtTokens(t)}</text>
            </g>
          )
        })}
        {props.daily.length > 1 ? (
          <path d={buildAreaPath(geo.points, geo.zeroY)} fill="rgba(79,110,247,.12)" />
        ) : null}
        <polyline points={geo.points} fill="none" stroke="#4f6ef7" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {[0, mid, labels.length - 1].filter((i, idx, arr) => arr.indexOf(i) === idx).map((i) => (
          <text key={i} x={xFor(i)} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--um-muted, #7a828e)">{labels[i]}</text>
        ))}
      </svg>
    </div>
  )
}

function DayTable(props: { data: UsageData }): ReactElement {
  return (
    <table className="um-table">
      <thead>
        <tr><th>日期</th><th>Provider</th><th>模型</th><th>输入</th><th>输出</th><th>缓存</th><th>总Token</th><th>花费(USD估)</th><th>次数</th><th>会话数</th></tr>
      </thead>
      <tbody>
        {props.data.rows.map((r, i) => (
          <tr key={`${r.date}-${r.provider}-${r.model}-${i}`}>
            <td>{r.date}</td><td>{r.provider}</td><td>{r.model}</td>
            <td>{fmtTokens(r.input)}</td><td>{fmtTokens(r.output)}</td><td>{fmtTokens(r.cache)}</td>
            <td>{fmtTokens(r.total)}</td>
            <td>{r.cost !== null ? `$${r.cost.toFixed(4)}` : '—'}</td>
            <td>{r.calls}</td><td>{r.sessions}</td>
          </tr>
        ))}
        {props.data.rows.length === 0 ? <tr><td colSpan={10} className="um-muted">该筛选下暂无记录</td></tr> : null}
      </tbody>
    </table>
  )
}

function SessionTable(props: { data: UsageData }): ReactElement {
  return (
    <table className="um-table">
      <thead>
        <tr><th>日期</th><th>会话</th><th>会话ID</th><th>Provider</th><th>模型</th><th>输入</th><th>输出</th><th>总Token</th><th>花费(USD估)</th><th>次数</th></tr>
      </thead>
      <tbody>
        {props.data.sessionRows.map((r, i) => (
          <tr key={`${r.sessionId}-${r.provider}-${r.model}-${r.date}-${i}`}>
            <td>{r.date}</td><td title={r.sessionId}>{r.title}</td><td className="um-muted">{r.sessionId.slice(0, 10)}</td>
            <td>{r.provider}</td><td>{r.model}</td>
            <td>{fmtTokens(r.input)}</td><td>{fmtTokens(r.output)}</td><td>{fmtTokens(r.total)}</td>
            <td>{r.cost !== null ? `$${r.cost.toFixed(4)}` : '—'}</td><td>{r.calls}</td>
          </tr>
        ))}
        {props.data.sessionRows.length === 0 ? <tr><td colSpan={10} className="um-muted">该筛选下暂无记录</td></tr> : null}
      </tbody>
    </table>
  )
}

/* ================================================================== *
 * Platform spend — DeepSeek 官网用量页口径
 * ================================================================== */

function platformStatusText(p: PlatformSpend): string {
  switch (p.status) {
    case 'ok': return '已同步'
    case 'loading': return '同步中…'
    case 'disabled': return '已关闭'
    case 'missing-token': return '未配置 userToken'
    case 'auth': return '登录态失效'
    case 'http': return '接口错误'
    case 'network': return '网络错误'
    case 'parse': return '解析失败'
    default: return p.status
  }
}

const platformPillClass = (p: PlatformSpend): string =>
  p.status === 'ok' ? 'ok' : p.status === 'loading' ? '' : 'warn'

function Stat(props: { label: string; value: string; sub: string }): ReactElement {
  return (
    <div className="um-stat">
      <span className="um-stat-label">{props.label}</span>
      <span className="um-stat-value">{props.value}</span>
      <span className="um-stat-sub">{props.sub}</span>
    </div>
  )
}

function SyncButton(): ReactElement {
  const busy = useUi((s) => s.platformBusy)
  return (
    <button type="button" className="um-icon-btn" onClick={() => { void syncPlatform() }} disabled={busy}>
      {busy ? '同步中…' : '立即同步'}
    </button>
  )
}

function PlatformStrip(props: { platform: PlatformSpend }): ReactElement {
  const p = props.platform
  const walletTotal = p.wallet === null ? null : (p.wallet.normal ?? 0) + (p.wallet.bonus ?? 0)
  return (
    <div className="um-platform">
      <div className="um-platform-head">
        <span className="um-logo" style={logoStyle('deepseek')}>D</span>
        <b>DeepSeek 平台实际消费</b>
        <span className={`um-pill ${platformPillClass(p)}`}>{platformStatusText(p)}</span>
        <span className="um-spacer" />
        <SyncButton />
      </div>
      {p.status === 'ok' ? (
        <div className="um-stats">
          <Stat label="今日" value={fmtMoney(p.today.cost, p.currency)} sub={`${fmtTokens(p.today.tokens)} tokens`} />
          <Stat label="本月" value={fmtMoney(p.month.cost, p.currency)} sub={`${fmtTokens(p.month.tokens)} tokens`} />
          <Stat label="累计消费" value={fmtMoney(p.lifetime.cost, p.currency)} sub={`${p.lifetime.months} 个月${p.lifetime.complete ? '' : '（回填中）'}`} />
          {walletTotal !== null ? (
            <Stat
              label="平台余额"
              value={fmtMoney(walletTotal, p.currency)}
              sub={`充值 ${fmtMoney(p.wallet?.normal ?? 0, p.currency)} / 赠送 ${fmtMoney(p.wallet?.bonus ?? 0, p.currency)}`}
            />
          ) : null}
        </div>
      ) : (
        <p className="um-hint">{p.error ?? platformStatusText(p)}</p>
      )}
      <p className="um-note">
        来自 platform.deepseek.com 用量页（登录态私有接口），即官网账单口径（{p.currency}）；与下方「估算花费（USD 参考价）」不是一回事。
      </p>
    </div>
  )
}

function PlatformTab(): ReactElement {
  const overview = useUi((s) => s.overview)
  const platform = overview?.platform ?? null
  if (platform === null) return <div className="um-hint">平台数据尚未加载…</div>
  if (platform.status === 'disabled') return <div className="um-hint">平台同步已关闭 — 在「预算与告警」中开启。</div>
  if (platform.status === 'missing-token') {
    return <div className="um-hint">尚未配置 DeepSeek 平台 userToken：在「预算与告警」里粘贴一次即可同步官网的实际消费。</div>
  }
  return (
    <div>
      <div className="um-total-line">
        <span>数据时间 <b>{new Date(platform.at).toLocaleString()}</b></span>
        <span>今日 <b>{fmtMoney(platform.today.cost, platform.currency)}</b></span>
        <span>本月 <b>{fmtMoney(platform.month.cost, platform.currency)}</b></span>
        <span>累计 <b>{fmtMoney(platform.lifetime.cost, platform.currency)}</b>（{platform.lifetime.months} 个月{platform.lifetime.complete ? '' : '，回填中'}）</span>
        <span className="um-spacer" />
        <SyncButton />
      </div>
      {platform.status !== 'ok' && platform.status !== 'loading' ? (
        <div className="um-error">{platform.error ?? platformStatusText(platform)}</div>
      ) : null}
      <SpendChart daily={platform.daily} currency={platform.currency} />
      <h4 className="um-h4">本月按模型（{platform.month.month}）</h4>
      <div className="um-table-wrap">
        <table className="um-table">
          <thead>
            {/* DeepSeek bills cached and uncached input differently and the
                platform reports them separately, so show both halves instead of
                an "输入" column that just repeats the cached number. */}
            <tr><th>模型</th><th>输入(未命中)</th><th>缓存(命中)</th><th>输出</th><th>总Token</th><th>消费</th><th>占比</th></tr>
          </thead>
          <tbody>
            {platform.byModel.map((m) => (
              <tr key={m.model}>
                <td>{m.model}</td>
                <td>{fmtTokens(Math.max(0, m.input - m.cache))}</td>
                <td>{fmtTokens(m.cache)}</td>
                <td>{fmtTokens(m.output)}</td>
                <td>{fmtTokens(m.total)}</td>
                <td>{fmtMoney(m.cost, platform.currency)}</td>
                <td>{fmtPct(m.share)}</td>
              </tr>
            ))}
            {platform.byModel.length === 0 ? <tr><td colSpan={7} className="um-muted">本月暂无记录</td></tr> : null}
          </tbody>
        </table>
      </div>
      <h4 className="um-h4">逐月消费</h4>
      <div className="um-table-wrap">
        <table className="um-table">
          <thead><tr><th>月份</th><th>Token</th><th>消费</th></tr></thead>
          <tbody>
            {platform.months.map((m) => (
              <tr key={m.month}><td>{m.month}</td><td>{fmtTokens(m.tokens)}</td><td>{fmtMoney(m.cost, platform.currency)}</td></tr>
            ))}
            {platform.months.length === 0 ? <tr><td colSpan={3} className="um-muted">暂无数据</td></tr> : null}
          </tbody>
        </table>
      </div>
      <p className="um-note">
        金额为平台账单口径；日界按平台（UTC）切分，与本地自然日可能相差几小时。逐月结果缓存在本机，已结束的月份不再重复请求。
      </p>
    </div>
  )
}

function SpendChart(props: { daily: PlatformSpend['daily']; currency: string }): ReactElement {
  const width = 680
  const height = 190
  const pad = 34
  const values = props.daily.map((d) => d.cost)
  const geo = buildLineGeometry(values, width, height, pad)
  const ticks = yTicks(geo.max, 3)
  const lastIndex = values.length - 1
  const mid = Math.floor(values.length / 2)
  const xFor = (i: number): number => (values.length > 1 ? pad + (i * (width - pad * 2)) / (values.length - 1) : width / 2)
  const labelAt = (i: number): string => props.daily[i]?.date.slice(5) ?? ''
  return (
    <div className="um-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每日消费趋势">
        {ticks.map((t) => {
          const y = geo.yOf(t)
          return (
            <g key={t}>
              <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(127,135,146,.16)" strokeWidth="1" />
              <text x={pad - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--um-muted, #7a828e)">{fmtMoney(t, props.currency)}</text>
            </g>
          )
        })}
        {values.length > 1 ? <path d={buildAreaPath(geo.points, geo.zeroY)} fill="rgba(34,160,107,.14)" /> : null}
        <polyline points={geo.points} fill="none" stroke="#22a06b" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {[0, mid, lastIndex].filter((i, idx, arr) => arr.indexOf(i) === idx).map((i) => (
          <text key={i} x={xFor(i)} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--um-muted, #7a828e)">{labelAt(i)}</text>
        ))}
      </svg>
    </div>
  )
}

/* ================================================================== *
 * Settings tab — budgets, thresholds, webhooks
 * ================================================================== */

interface HookDraft {
  url: string
  secret: string
  enabled: boolean
}

function SettingsTab(): ReactElement {
  const config = useUi((s) => s.config)
  const platformSpend = useUi((s) => s.overview?.platform ?? null)
  const [budgets, setBudgets] = useState<Record<string, { enabled: boolean; budget: string; warnPct: string }>>({})
  const [hooks, setHooks] = useState<HookDraft[]>([])
  const [plat, setPlat] = useState<{ enabled: boolean; token: string; historyMonths: string }>({ enabled: true, token: '', historyMonths: '36' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (config === null) return
    const next: Record<string, { enabled: boolean; budget: string; warnPct: string }> = {}
    for (const [id, b] of Object.entries(config.balances)) {
      next[id] = {
        enabled: b.enabled !== false,
        budget: b.budget !== undefined && b.budget !== null ? String(b.budget) : '',
        warnPct: b.warnPct !== undefined && b.warnPct !== null ? String(b.warnPct) : '5',
      }
    }
    setBudgets(next)
    setHooks(config.webhooks.map((w) => ({ url: w.url, secret: '', enabled: w.enabled !== false })))
    setPlat({
      enabled: config.deepseekPlatform?.enabled !== false,
      // The stored token is never echoed back: an empty box means "keep it".
      token: '',
      historyMonths: String(config.deepseekPlatform?.historyMonths ?? 36),
    })
  }, [config])

  const doSave = (): void => {
    setSaving(true)
    const balances: Record<string, Record<string, unknown>> = {}
    for (const [id, d] of Object.entries(budgets)) {
      balances[id] = {
        enabled: d.enabled,
        budget: d.budget !== '' ? Number(d.budget) : undefined,
        warnPct: d.warnPct !== '' ? Number(d.warnPct) : 5,
      }
    }
    const webhooks = hooks
      .filter((h) => h.url.trim() !== '')
      .map((h) => ({
        url: h.url.trim(),
        enabled: h.enabled,
        // Empty secret ⇒ keep the previously stored one (host-side merge).
        secret: h.secret.trim() !== '' ? h.secret.trim() : undefined,
      }))
    void saveConfig({
      balances,
      webhooks,
      deepseekPlatform: {
        enabled: plat.enabled,
        historyMonths: plat.historyMonths !== '' ? Number(plat.historyMonths) : 36,
        // Empty ⇒ keep the stored token (host-side merge), same as webhook secrets.
        userToken: plat.token.trim() !== '' ? plat.token.trim() : undefined,
      },
    }).then((res) => {
      setSaving(false)
      setSaved(true)
      setPlat((prev) => ({ ...prev, token: '' }))
      setTimeout(() => setSaved(false), 2000)
      // A fresh token (or a re-enable) is worth syncing right away.
      if (res.ok) void syncPlatform()
    })
  }

  if (config === null) return <div className="um-hint">加载配置中…</div>

  return (
    <div>
      <p className="um-hint">预算进度与低余额告警都基于「预算」：余额 ≤ 预算 × 预警百分比 时告警（默认 5%）。余额不可用但已设预算时，会改用本月估算花费推算剩余。</p>
      {Object.entries(budgets).map(([id, d]) => (
        <div className="um-cfg-card" key={id}>
          <h3><span className="um-logo" style={logoStyle(id)}>{logoChar(id)}</span>{labelOf(id)}</h3>
          <div className="um-cfg-row">
            <label className="um-check"><input type="checkbox" checked={d.enabled} onChange={(e) => setBudgets({ ...budgets, [id]: { ...d, enabled: e.target.checked } })} />监控</label>
            <label>预算金额
              <input className="um-input" type="number" min="0" step="any" value={d.budget} placeholder="不设" onChange={(e) => setBudgets({ ...budgets, [id]: { ...d, budget: e.target.value } })} />
            </label>
            <label>预警 %（余额占预算）
              <input className="um-input small" type="number" min="0.1" max="100" step="0.5" value={d.warnPct} onChange={(e) => setBudgets({ ...budgets, [id]: { ...d, warnPct: e.target.value } })} />
            </label>
          </div>
        </div>
      ))}
      <div className="um-cfg-card">
        <h3><span className="um-logo" style={logoStyle('deepseek')}>D</span>DeepSeek 官网实际消费同步</h3>
        <p className="um-hint">
          官网没有开放消费查询 API：用量页走的是登录态私有接口，需要浏览器里的 userToken。登录 platform.deepseek.com 后，在浏览器控制台执行
          <code> JSON.parse(localStorage.getItem('userToken')).value </code>
          并把结果粘贴到下面（只保存在本机配置文件，回传给浏览器时始终为空）。
        </p>
        <div className="um-cfg-row">
          <label className="um-check">
            <input type="checkbox" checked={plat.enabled} onChange={(e) => setPlat({ ...plat, enabled: e.target.checked })} />启用同步
          </label>
          <label>历史回填月数
            <input
              className="um-input small"
              type="number"
              min="1"
              max="60"
              value={plat.historyMonths}
              onChange={(e) => setPlat({ ...plat, historyMonths: e.target.value })}
            />
          </label>
          <input
            className="um-input wide"
            type="password"
            placeholder="userToken（已保存则留空保留）"
            value={plat.token}
            onChange={(e) => setPlat({ ...plat, token: e.target.value })}
          />
        </div>
        <div className="um-cfg-row" style={{ marginTop: 8 }}>
          <span className={`um-pill ${platformSpend === null ? '' : platformPillClass(platformSpend)}`}>
            {platformSpend === null ? '未同步' : platformStatusText(platformSpend)}
          </span>
          {platformSpend !== null && platformSpend.status === 'ok' ? (
            <span className="um-hint">
              今日 {fmtMoney(platformSpend.today.cost, platformSpend.currency)} ·
              本月 {fmtMoney(platformSpend.month.cost, platformSpend.currency)} ·
              累计 {fmtMoney(platformSpend.lifetime.cost, platformSpend.currency)}（{platformSpend.lifetime.months} 个月）·
              同步于 {new Date(platformSpend.at).toLocaleTimeString()}
            </span>
          ) : platformSpend?.error != null ? (
            <span className="um-hint">{platformSpend.error}</span>
          ) : null}
          <span className="um-spacer" />
          <SyncButton />
        </div>
        <div className="um-actions">
          {/* Its own save button: the shared one lives in the webhook card
              further down, which is easy to miss right after pasting a token. */}
          <button type="button" className="um-save" onClick={doSave} disabled={saving}>
            {saving ? '保存中…' : '保存设置'}
          </button>
          {saved ? <span className="um-saved">✓ 已保存</span> : null}
        </div>
      </div>
      <div className="um-cfg-card">
        <h3>Webhook 通知（余额进入预警时推送，HMAC-SHA256 签名可选）</h3>
        {hooks.map((h, i) => (
          <div className="um-cfg-row" key={i} style={{ marginBottom: 8 }}>
            <input className="um-input wide" placeholder="https://example.com/hook" value={h.url} onChange={(e) => setHooks(hooks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <input className="um-input wide" type="password" placeholder="Secret（已存密钥不回显，留空保留）" value={h.secret} onChange={(e) => setHooks(hooks.map((x, j) => (j === i ? { ...x, secret: e.target.value } : x)))} />
            <label className="um-check"><input type="checkbox" checked={h.enabled} onChange={(e) => setHooks(hooks.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} />启用</label>
            <button type="button" className="um-icon-btn" onClick={() => setHooks(hooks.filter((_, j) => j !== i))}>删除</button>
          </div>
        ))}
        <button type="button" className="um-icon-btn" onClick={() => setHooks([...hooks, { url: '', secret: '', enabled: true }])}>+ 添加 Webhook</button>
        <div className="um-actions">
          <button type="button" className="um-save" onClick={doSave} disabled={saving}>{saving ? '保存中…' : '保存设置'}</button>
          {saved ? <span className="um-saved">✓ 已保存</span> : null}
        </div>
      </div>
      <p className="um-note">设置持久化在 host 的 {config.storageDir ?? '$DSH_HOME/storages/dsh-usage-monitor/config.json'}（本机）。API Key 不在此存储，始终从 DSH 凭证/环境变量读取。</p>
    </div>
  )
}

function labelOf(id: string): string {
  const map: Record<string, string> = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    zhipu: '智谱 GLM',
    moonshot: 'Moonshot / Kimi',
    siliconflow: 'SiliconFlow',
  }
  return map[id] ?? id
}

/** Export injected for the entry file (uses the same hub store). */
export function PanelOnly(): ReactElement {
  return <Hub />
}

export function useCurrencySymbolFor(currency: string): string {
  return currencySymbol(currency)
}
