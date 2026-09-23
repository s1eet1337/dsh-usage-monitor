window.__ModuleLoader__.load({ id: "dsh-usage-monitor", factory: (__hostRequire) => {
var module = { exports: {} }; var exports = module.exports;

var __registry = {};
var __loaded = {};
function define(key, fn) { __registry[key] = fn; }
function __dirOf(key) { var i = key.lastIndexOf('/'); return i < 0 ? '' : key.slice(0, i); }
function __load(key) {
  if (__loaded[key]) return __registry[key].exports;
  if (!__registry[key]) { throw new Error('dsh-usage-monitor: unknown module ' + key); }
  var m = { exports: {} };
  __registry[key].exports = m.exports;
  __loaded[key] = true;
  var r = function (spec) {
    if (typeof spec === 'string' && spec.charCodeAt(0) === 46) { return __load(resolveRelative(__dirOf(key), spec)); }
    return __hostRequire(spec);
  };
  __registry[key](m, m.exports, r);
  return __registry[key].exports;
}
function resolveRelative(fromDir, spec) {
  var parts = fromDir === '' ? [] : fromDir.split('/');
  var segs = spec.split('/');
  for (var i = 0; i < segs.length; i++) { var seg = segs[i];
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return parts.join('/');
}
define("client/api", function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearApiCache = exports.usageQueryKey = void 0;
exports.fetchOverview = fetchOverview;
exports.fetchOverviewRaw = fetchOverviewRaw;
exports.fetchUsage = fetchUsage;
exports.fetchPlatform = fetchPlatform;
exports.fetchConfig = fetchConfig;
exports.updateConfig = updateConfig;
exports.fetchExportCsv = fetchExportCsv;
const OVERVIEW_TTL_MS = 60_000;
const USAGE_TTL_MS = 5 * 60_000;
const mem = new Map();
async function getJson(path) {
    try {
        const res = await fetch(path, { headers: { accept: 'application/json' }, cache: 'no-store' });
        const body = (await res.json());
        if (body.ok === true && body.data !== undefined)
            return { ok: true, data: body.data };
        return { ok: false, error: typeof body.error === 'string' ? body.error : `HTTP ${res.status}` };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
const API_PREFIX = '/plugins/dsh-usage-monitor';
const usageQueryKey = (q) => `${API_PREFIX}/usage?days=${q.days}&provider=${encodeURIComponent(q.provider)}&model=${encodeURIComponent(q.model)}&group=${q.group}`;
exports.usageQueryKey = usageQueryKey;
async function fetchOverview(force = false) {
    const key = 'overview';
    const hit = mem.get(key);
    if (!force && hit !== undefined && Date.now() - hit.at < OVERVIEW_TTL_MS)
        return { ok: true, data: hit.data };
    const path = `${API_PREFIX}/overview${force ? '?refresh=1' : ''}`;
    const res = await getJson(path);
    if (res.ok)
        mem.set(key, { data: res.data, at: Date.now() });
    return res;
}
/**
 * Overview without the client-side TTL cache, used while the host reports the
 * platform snapshot as still 'loading' — the host answers these cheaply.
 */
async function fetchOverviewRaw() {
    return getJson(`${API_PREFIX}/overview`);
}
async function fetchUsage(query, force = false) {
    const key = `usage:${(0, exports.usageQueryKey)(query)}`;
    const hit = mem.get(key);
    if (!force && hit !== undefined && Date.now() - hit.at < USAGE_TTL_MS)
        return { ok: true, data: hit.data };
    const path = `${(0, exports.usageQueryKey)(query)}${force ? '&refresh=1' : ''}`;
    const res = await getJson(path);
    if (res.ok)
        mem.set(key, { data: res.data, at: Date.now() });
    return res;
}
/**
 * Force a DeepSeek platform sync (private endpoints). Never cached client-side:
 * the host memo already coalesces, and the user pressed a button to see fresh
 * numbers.
 */
async function fetchPlatform(force = true) {
    return getJson(`${API_PREFIX}/platform${force ? '?refresh=1' : ''}`);
}
async function fetchConfig(force = false) {
    const key = 'config';
    const hit = mem.get(key);
    if (!force && hit !== undefined && Date.now() - hit.at < OVERVIEW_TTL_MS)
        return { ok: true, data: hit.data };
    const res = await getJson(`${API_PREFIX}/config`);
    if (res.ok)
        mem.set(key, { data: res.data, at: Date.now() });
    return res;
}
async function updateConfig(patch) {
    try {
        const res = await fetch(`${API_PREFIX}/config`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(patch),
        });
        const body = (await res.json());
        if (body.ok === true && body.data !== undefined) {
            mem.set('config', { data: body.data, at: Date.now() });
            mem.delete('overview');
            return { ok: true, data: body.data };
        }
        return { ok: false, error: typeof body.error === 'string' ? body.error : `HTTP ${res.status}` };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
async function fetchExportCsv(query) {
    const path = `${API_PREFIX}/export?days=${query.days}&provider=${encodeURIComponent(query.provider)}&model=${encodeURIComponent(query.model)}&group=${query.group}`;
    try {
        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok)
            return { ok: false, error: `HTTP ${res.status}` };
        return { ok: true, data: await res.text() };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
const clearApiCache = () => {
    mem.clear();
};
exports.clearApiCache = clearApiCache;

});
define("client/components", function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chip = Chip;
exports.Trigger = Trigger;
exports.Hub = Hub;
exports.PanelOnly = PanelOnly;
exports.useCurrencySymbolFor = useCurrencySymbolFor;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * React components for dsh-usage-monitor's web UI.
 * - `Chip`    → conversation.session.header.utilities (top balance pill)
 * - `Trigger` → sidebar.footer.action (opens the panel)
 * - `Hub`     → shell.overlay (alert toasts + the panel, always mounted)
 */
const react_1 = require("react");
const core_1 = require("../core/core");
const chart_1 = require("../core/chart");
const api_1 = require("./api");
const store_1 = require("./store");
const PROVIDER_STYLE = {
    deepseek: { bg: '#4d6bfe', ch: 'D' },
    openai: { bg: '#10a37f', ch: 'O' },
    anthropic: { bg: '#b85c38', ch: 'A' },
    zhipu: { bg: '#0e6cff', ch: 'G' },
    moonshot: { bg: '#6e46e5', ch: 'K' },
    siliconflow: { bg: '#179c6d', ch: 'S' },
};
const logoStyle = (provider) => {
    const s = PROVIDER_STYLE[provider];
    return { background: s?.bg ?? '#64748b', flex: 'none' };
};
const logoChar = (provider) => PROVIDER_STYLE[provider]?.ch ?? provider.slice(0, 1).toUpperCase();
const alertClass = (view) => {
    if (view.alert === 'critical')
        return 'critical';
    if (view.alert === 'warn')
        return 'warn';
    return '';
};
/* ================================================================== *
 * Chip — the top balance pill in the session header utilities row
 * ================================================================== */
function Chip() {
    const overview = (0, store_1.useUi)((s) => s.overview);
    const view = (0, react_1.useMemo)(() => pickChipView(overview), [overview]);
    if (view === null) {
        return ((0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-root um-chip", onClick: () => (0, store_1.setOpen)(true), title: "\u7528\u91CF\u76D1\u63A7\u672A\u52A0\u8F7D", children: (0, jsx_runtime_1.jsx)("span", { className: "um-chip-missing", children: "\u7528\u91CF" }) }));
    }
    const money = view.balance?.supported === true && Number.isFinite(view.balance.amount);
    const cls = ['um-root', 'um-chip', alertClass(view)];
    if (view.alert !== null && view.alert !== 'ok')
        cls.push('alarm');
    const title = [
        view.label,
        view.balance?.reason ?? `余额 ${money ? (0, core_1.fmtMoney)(view.balance?.amount ?? 0, view.balance?.currency ?? '') : '不可用'}`,
        view.remainingPct !== null ? `预算剩余 ${(0, core_1.fmtPct)(view.remainingPct)}` : null,
    ].filter(Boolean).join(' · ');
    return ((0, jsx_runtime_1.jsxs)("button", { type: "button", className: cls.join(' '), onClick: () => (0, store_1.setOpen)(true), title: title, children: [(0, jsx_runtime_1.jsx)("span", { className: "um-provider-dot" }), (0, jsx_runtime_1.jsx)("span", { className: "um-currency", children: money ? view.balance?.currency : '—' }), (0, jsx_runtime_1.jsx)("span", { className: "um-amount", children: money ? (0, core_1.fmtMoney)(view.balance?.amount ?? 0, view.balance?.currency ?? '') : '不可用' })] }));
}
function pickChipView(overview) {
    if (overview === null)
        return null;
    const views = overview.providers;
    if (views.length === 0)
        return null;
    if (overview.current !== null) {
        const current = views.find((v) => v.provider === overview.current?.provider);
        if (current !== undefined)
            return current;
    }
    const usable = views.find((v) => v.balance?.supported === true && v.alert !== 'critical');
    return usable ?? views[0] ?? null;
}
/* ================================================================== *
 * Trigger — the sidebar footer action that opens the panel
 * ================================================================== */
function Trigger() {
    const open = (0, store_1.useUi)((s) => s.open);
    const overview = (0, store_1.useUi)((s) => s.overview);
    const hasAlert = (0, react_1.useMemo)(() => (overview?.providers ?? []).some((v) => v.alert === 'warn' || v.alert === 'critical'), [overview]);
    return ((0, jsx_runtime_1.jsxs)("button", { type: "button", className: "um-root um-trigger", "aria-label": "\u7528\u91CF\u76D1\u63A7", title: "\u7528\u91CF\u4E0E\u4F59\u989D\u76D1\u63A7", onClick: store_1.toggleOpen, style: { color: open ? 'var(--um-accent, #4f6ef7)' : undefined }, children: [(0, jsx_runtime_1.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [(0, jsx_runtime_1.jsx)("path", { d: "M3 3v18h18" }), (0, jsx_runtime_1.jsx)("path", { d: "M7 14l3-4 3 3 4-6" })] }), (0, jsx_runtime_1.jsx)("span", { className: "um-trigger-label", children: "\u7528\u91CF" }), hasAlert ? (0, jsx_runtime_1.jsx)("span", { className: "um-dot" }) : null] }));
}
/* ================================================================== *
 * Hub — always-mounted overlay: panel + toasts
 * ================================================================== */
function Hub() {
    const open = (0, store_1.useUi)((s) => s.open);
    const toasts = (0, store_1.useUi)((s) => s.toasts);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "um-root", children: [toasts.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "um-toasts", role: "status", children: toasts.map((t) => ((0, jsx_runtime_1.jsxs)("div", { className: `um-toast ${t.level}`, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("b", { children: t.label }), " \u00B7 ", t.level === 'critical' ? '余额预警（严重）' : '余额预警', "\uFF1A", t.message] }), (0, jsx_runtime_1.jsx)("button", { type: "button", "aria-label": "\u5173\u95ED", onClick: () => (0, store_1.dismissToast)(t.id), children: "\u00D7" })] }, t.id))) })) : null, open ? (0, jsx_runtime_1.jsx)(Panel, {}) : null] }));
}
function Panel() {
    const overview = (0, store_1.useUi)((s) => s.overview);
    const overviewError = (0, store_1.useUi)((s) => s.overviewError);
    const loading = (0, store_1.useUi)((s) => s.loading);
    const [tab, setTab] = (0, react_1.useState)('overview');
    const current = overview?.current;
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "um-backdrop", onClick: () => (0, store_1.setOpen)(false) }), (0, jsx_runtime_1.jsxs)("section", { className: "um-panel", role: "dialog", "aria-label": "\u7528\u91CF\u4E0E\u4F59\u989D\u76D1\u63A7", children: [(0, jsx_runtime_1.jsxs)("header", { className: "um-head", children: [(0, jsx_runtime_1.jsx)("h2", { children: "\u7528\u91CF\u76D1\u63A7" }), (0, jsx_runtime_1.jsx)("span", { className: "um-sub", children: current !== null && current !== undefined ? `${current.provider} / ${current.model}` : '多 Provider · 余额与用量' }), (0, jsx_runtime_1.jsx)("span", { className: "um-spacer" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-icon-btn", onClick: () => { void (0, store_1.refreshOverview)(true); }, disabled: loading, children: loading ? '刷新中…' : '刷新' }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-icon-btn", onClick: () => (0, store_1.setOpen)(false), "aria-label": "\u5173\u95ED", children: "\u2715" })] }), (0, jsx_runtime_1.jsxs)("nav", { className: "um-tabs", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: `um-tab ${tab === 'overview' ? 'on' : ''}`, onClick: () => setTab('overview'), children: "\u6982\u89C8" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: `um-tab ${tab === 'detail' ? 'on' : ''}`, onClick: () => setTab('detail'), children: "\u7528\u91CF\u660E\u7EC6" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: `um-tab ${tab === 'platform' ? 'on' : ''}`, onClick: () => setTab('platform'), children: "\u5E73\u53F0\u6D88\u8D39" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: `um-tab ${tab === 'settings' ? 'on' : ''}`, onClick: () => setTab('settings'), children: "\u9884\u7B97\u4E0E\u544A\u8B66" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "um-body", children: [overviewError !== null ? (0, jsx_runtime_1.jsxs)("div", { className: "um-error", children: ["\u52A0\u8F7D\u5931\u8D25\uFF1A", overviewError] }) : null, tab === 'overview' ? (0, jsx_runtime_1.jsx)(OverviewTab, { overview: overview }) : null, tab === 'detail' ? (0, jsx_runtime_1.jsx)(DetailTab, {}) : null, tab === 'platform' ? (0, jsx_runtime_1.jsx)(PlatformTab, {}) : null, tab === 'settings' ? (0, jsx_runtime_1.jsx)(SettingsTab, {}) : null] })] })] }));
}
/* ================================================================== *
 * Overview
 * ================================================================== */
function OverviewTab(props) {
    const overview = props.overview;
    const providers = (0, store_1.orderedProviders)(overview);
    if (overview === null || providers.length === 0) {
        return (0, jsx_runtime_1.jsx)("div", { className: "um-hint", children: "\u5C1A\u672A\u52A0\u8F7D\u5230\u6570\u636E \u2014 \u8BF7\u786E\u8BA4 host \u4FA7\u5DF2\u5B89\u88C5\u5E76\u5728\u672C\u673A\u7F51\u7EDC\u5185\u3002" });
    }
    const today = overview.today;
    // ?? null also covers a host that predates the platform field.
    const platform = overview.platform ?? null;
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "um-total-line", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["\u4ECA\u65E5\u5408\u8BA1 ", (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtTokens)(today?.total ?? 0) }), " tokens\uFF08in ", (0, core_1.fmtTokens)(today?.input ?? 0), " / out ", (0, core_1.fmtTokens)(today?.output ?? 0), "\uFF09"] }), (0, jsx_runtime_1.jsxs)("span", { children: ["\u4F30\u7B97\u82B1\u8D39 ", (0, jsx_runtime_1.jsx)("b", { children: today?.cost !== null && today?.cost !== undefined ? `$${today.cost.toFixed(4)}` : '—' })] }), (0, jsx_runtime_1.jsxs)("span", { children: ["\u8C03\u7528 ", (0, jsx_runtime_1.jsx)("b", { children: today?.calls ?? 0 }), " \u6B21"] }), overview.usageCoverage !== null ? ((0, jsx_runtime_1.jsxs)("span", { className: "um-muted", children: ["\u4F1A\u8BDD\u65E5\u5FD7 ", overview.usageCoverage.scannedSessions, "/", overview.usageCoverage.listedSessions, " \u00B7 \u8BB0\u5F55 ", overview.usageCoverage.usageRecords, "\uFF08\u8DF3\u8FC7 ", overview.usageCoverage.skippedRecords, "\uFF09"] })) : null] }), platform !== null && platform.status !== 'disabled' ? (0, jsx_runtime_1.jsx)(PlatformStrip, { platform: platform }) : null, (0, jsx_runtime_1.jsx)("div", { className: "um-grid", children: providers.map((view) => (0, jsx_runtime_1.jsx)(ProviderCard, { view: view, platform: platform }, view.provider)) }), (0, jsx_runtime_1.jsx)("p", { className: "um-note", children: "\u7528\u91CF\u7EDF\u8BA1\u6765\u81EA DSH \u672C\u5730\u4F1A\u8BDD\u65E5\u5FD7\uFF08request/header + assistant/message \u4E8B\u4EF6\uFF0C\u4FDD\u7559\u6700\u8FD1 90 \u5929\uFF09\uFF0C\u4E0E\u5382\u5546\u8D26\u5355\u5B58\u5728\u65F6\u5DEE\uFF1B\u82B1\u8D39\u4E3A\u53C2\u8003\u4EF7\u4F30\u7B97\uFF0C\u975E\u8D26\u5355\u3002\u4F59\u989D\u6BCF 60s \u8F6E\u8BE2\u3002" })] }));
}
function ProviderCard(props) {
    const view = props.view;
    const platform = props.platform != null && props.platform.status === 'ok' && view.provider === 'deepseek' ? props.platform : null;
    const money = view.balance?.supported === true && Number.isFinite(view.balance.amount);
    const budget = view.budget;
    const bar = barInfo(view, budget);
    return ((0, jsx_runtime_1.jsxs)("article", { className: "um-card", children: [(0, jsx_runtime_1.jsxs)("div", { className: "um-card-head", children: [(0, jsx_runtime_1.jsx)("span", { className: "um-logo", style: logoStyle(view.provider), children: logoChar(view.provider) }), (0, jsx_runtime_1.jsx)("span", { className: "um-name", children: view.label }), (0, jsx_runtime_1.jsx)("span", { className: `um-pill ${statusClass(view)}`, children: statusText(view) })] }), money ? ((0, jsx_runtime_1.jsxs)("div", { className: "um-balance", children: [(0, jsx_runtime_1.jsx)("span", { className: "um-cur", children: view.balance?.currency }), (0, core_1.fmtMoney)(view.balance?.amount ?? 0, view.balance?.currency ?? '')] })) : ((0, jsx_runtime_1.jsx)("div", { className: "um-hint", children: view.balance?.reason ?? statusText(view) })), (0, jsx_runtime_1.jsxs)("div", { className: "um-row", children: [(0, jsx_runtime_1.jsx)("span", { children: "\u4ECA\u65E5" }), (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtTokens)(view.today?.total ?? 0) }), (0, jsx_runtime_1.jsx)("span", { children: "in" }), (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtTokens)(view.today?.input ?? 0) }), (0, jsx_runtime_1.jsx)("span", { children: "out" }), (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtTokens)(view.today?.output ?? 0) }), view.today?.cost !== null && view.today?.cost !== undefined ? (0, jsx_runtime_1.jsxs)("span", { children: ["\u2248", (0, jsx_runtime_1.jsxs)("b", { children: ["$", view.today.cost.toFixed(4)] })] }) : null] }), platform !== null ? ((0, jsx_runtime_1.jsxs)("div", { className: "um-row um-row-platform", title: "\u6765\u81EA platform.deepseek.com \u7528\u91CF\u9875\u7684\u771F\u5B9E\u8D26\u5355\u53E3\u5F84", children: [(0, jsx_runtime_1.jsx)("span", { children: "\u5B9E\u9645" }), (0, jsx_runtime_1.jsx)("span", { children: "\u4ECA\u65E5" }), (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtMoney)(platform.today.cost, platform.currency) }), (0, jsx_runtime_1.jsx)("span", { children: "\u672C\u6708" }), (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtMoney)(platform.month.cost, platform.currency) }), (0, jsx_runtime_1.jsx)("span", { children: "\u7D2F\u8BA1" }), (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtMoney)(platform.lifetime.cost, platform.currency) })] })) : null, (0, jsx_runtime_1.jsx)("div", { className: "um-bar", title: budget?.amount !== null && budget?.amount !== undefined ? `预算 ${budget?.currency}${budget?.amount}` : '未设置预算', children: (0, jsx_runtime_1.jsx)("i", { className: alertClass(view), style: { width: bar === null ? '0%' : `${Math.min(100, Math.max(0, bar.usedPct * 100)).toFixed(1)}%` } }) }), (0, jsx_runtime_1.jsx)("div", { className: "um-hint", children: bar === null
                    ? '未设置预算：在「预算与告警」中填写以启用进度条与低余额告警'
                    : `预算剩余 ${(0, core_1.fmtPct)(bar.remainingPct)} · 预警线 ${budget === null ? 5 : budget.warnPct}%` })] }));
}
function barInfo(view, budget) {
    if (budget === null || budget.amount === null || budget.amount === undefined)
        return null;
    if (view.remainingPct === null)
        return null;
    const remainingPct = view.remainingPct;
    return { remainingPct, usedPct: Math.max(0, 1 - remainingPct) };
}
function statusText(view) {
    switch (view.status) {
        case 'ok': return '正常';
        case 'missing-key': return '缺 API Key';
        case 'unsupported': return view.error === 'disabled' ? '已停用' : '无余额接口';
        case 'error': return '错误';
        default: return view.status;
    }
}
function statusClass(view) {
    if (view.alert === 'critical')
        return 'critical';
    if (view.alert === 'warn')
        return 'warn';
    if (view.status === 'ok')
        return 'ok';
    return '';
}
/* ================================================================== *
 * Detail tab — filter + trend chart + table + CSV export
 * ================================================================== */
function DetailTab() {
    const overview = (0, store_1.useUi)((s) => s.overview);
    const [days, setDays] = (0, react_1.useState)(7);
    const [provider, setProvider] = (0, react_1.useState)('');
    const [model, setModel] = (0, react_1.useState)('');
    const [group, setGroup] = (0, react_1.useState)('day');
    const [data, setData] = (0, react_1.useState)(null);
    const [err, setErr] = (0, react_1.useState)(null);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [exporting, setExporting] = (0, react_1.useState)(false);
    const load = (force = false) => {
        setBusy(true);
        const query = { days, provider, model, group };
        void (0, api_1.fetchUsage)(query, force).then((res) => {
            setBusy(false);
            if (res.ok) {
                setErr(null);
                setData(res.data);
                if (res.data.providers.length === 1 && provider === '')
                    setProvider(res.data.providers[0] ?? '');
                if (model === '' && res.data.models.length === 1)
                    setModel(res.data.models[0] ?? '');
            }
            else {
                setErr(res.error);
            }
        });
    };
    (0, react_1.useEffect)(() => { load(); }, [days, provider, model, group]); // eslint-disable-line react-hooks/exhaustive-deps
    // Offer every provider that ever appears in the ledger, plus this adapter set.
    const providerOptions = (0, react_1.useMemo)(() => {
        const set = new Set((overview?.providers ?? []).map((v) => v.provider));
        for (const p of data?.providers ?? [])
            set.add(p);
        return [...set].sort();
    }, [overview, data]);
    const doExport = () => {
        setExporting(true);
        const query = { days, provider, model, group };
        void (0, api_1.fetchExportCsv)(query).then((res) => {
            setExporting(false);
            if (!res.ok) {
                setErr(res.error);
                return;
            }
            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dsh-usage-monitor-${group}-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        });
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "um-toolbar", children: [(0, jsx_runtime_1.jsxs)("select", { className: "um-select", value: provider, onChange: (e) => setProvider(e.target.value), "aria-label": "Provider", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u5168\u90E8 Provider" }), providerOptions.map((p) => (0, jsx_runtime_1.jsx)("option", { value: p, children: p }, p))] }), (0, jsx_runtime_1.jsxs)("select", { className: "um-select", value: model, onChange: (e) => setModel(e.target.value), "aria-label": "\u6A21\u578B", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u5168\u90E8\u6A21\u578B" }), (data?.models ?? []).map((m) => (0, jsx_runtime_1.jsx)("option", { value: m, children: m }, m))] }), (0, jsx_runtime_1.jsx)("span", { className: "um-seg", role: "group", "aria-label": "\u65F6\u95F4\u8303\u56F4", children: [7, 30, 90].map((d) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", className: days === d ? 'on' : '', onClick: () => setDays(d), children: [d, "\u5929"] }, d))) }), (0, jsx_runtime_1.jsxs)("span", { className: "um-seg", role: "group", "aria-label": "\u5206\u7EC4", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: group === 'day' ? 'on' : '', onClick: () => setGroup('day'), children: "\u6309\u65E5" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: group === 'session' ? 'on' : '', onClick: () => setGroup('session'), children: "\u6309\u4F1A\u8BDD" })] }), (0, jsx_runtime_1.jsx)("span", { className: "um-spacer" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-icon-btn", onClick: () => load(true), disabled: busy, children: busy ? '…' : '刷新' }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-icon-btn", onClick: doExport, disabled: exporting, children: exporting ? '导出中…' : '导出 CSV' })] }), err !== null ? (0, jsx_runtime_1.jsx)("div", { className: "um-error", children: err }) : null, data !== null ? (0, jsx_runtime_1.jsx)(TrendBlock, { data: data }) : (0, jsx_runtime_1.jsx)("div", { className: "um-hint", children: "\u52A0\u8F7D\u7528\u91CF\u660E\u7EC6\u2026" })] }));
}
function TrendBlock(props) {
    const d = props.data;
    const totals = d.totals;
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "um-total-line", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["\u533A\u95F4\u5408\u8BA1 ", (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtTokens)(totals.total) }), " tokens"] }), (0, jsx_runtime_1.jsxs)("span", { children: ["in ", (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtTokens)(totals.input) })] }), (0, jsx_runtime_1.jsxs)("span", { children: ["out ", (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtTokens)(totals.output) })] }), (0, jsx_runtime_1.jsxs)("span", { children: ["\u4F30\u7B97\u82B1\u8D39 ", (0, jsx_runtime_1.jsx)("b", { children: totals.cost !== null ? `$${totals.cost.toFixed(4)}` : '—' })] }), (0, jsx_runtime_1.jsxs)("span", { children: ["\u8C03\u7528 ", (0, jsx_runtime_1.jsx)("b", { children: totals.calls })] })] }), (0, jsx_runtime_1.jsx)(TrendChart, { daily: d.daily }), (0, jsx_runtime_1.jsx)("div", { className: "um-table-wrap", children: d.group === 'session' ? (0, jsx_runtime_1.jsx)(SessionTable, { data: d }) : (0, jsx_runtime_1.jsx)(DayTable, { data: d }) })] }));
}
function TrendChart(props) {
    const width = 680;
    const height = 210;
    const pad = 30;
    const values = props.daily.map((p) => p.total);
    const geo = (0, chart_1.buildLineGeometry)(values, width, height, pad);
    const ticks = (0, chart_1.yTicks)(geo.max, 3);
    const labels = props.daily.map((p) => p.date.slice(5));
    const mid = Math.floor(labels.length / 2);
    const xFor = (i) => (labels.length > 1 ? pad + (i * (width - pad * 2)) / (labels.length - 1) : width / 2);
    return ((0, jsx_runtime_1.jsx)("div", { className: "um-chart", children: (0, jsx_runtime_1.jsxs)("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "\u6BCF\u65E5 Token \u6D88\u8017\u8D8B\u52BF", children: [ticks.map((t) => {
                    const y = geo.yOf(t);
                    return ((0, jsx_runtime_1.jsxs)("g", { children: [(0, jsx_runtime_1.jsx)("line", { x1: pad, y1: y, x2: width - pad, y2: y, stroke: "rgba(127,135,146,.16)", strokeWidth: "1" }), (0, jsx_runtime_1.jsx)("text", { x: pad - 6, y: y + 3, textAnchor: "end", fontSize: "9", fill: "var(--um-muted, #7a828e)", children: (0, core_1.fmtTokens)(t) })] }, t));
                }), props.daily.length > 1 ? ((0, jsx_runtime_1.jsx)("path", { d: (0, chart_1.buildAreaPath)(geo.points, geo.zeroY), fill: "rgba(79,110,247,.12)" })) : null, (0, jsx_runtime_1.jsx)("polyline", { points: geo.points, fill: "none", stroke: "#4f6ef7", strokeWidth: "1.8", strokeLinejoin: "round", strokeLinecap: "round" }), [0, mid, labels.length - 1].filter((i, idx, arr) => arr.indexOf(i) === idx).map((i) => ((0, jsx_runtime_1.jsx)("text", { x: xFor(i), y: height - 8, textAnchor: "middle", fontSize: "9", fill: "var(--um-muted, #7a828e)", children: labels[i] }, i)))] }) }));
}
function DayTable(props) {
    return ((0, jsx_runtime_1.jsxs)("table", { className: "um-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "\u65E5\u671F" }), (0, jsx_runtime_1.jsx)("th", { children: "Provider" }), (0, jsx_runtime_1.jsx)("th", { children: "\u6A21\u578B" }), (0, jsx_runtime_1.jsx)("th", { children: "\u8F93\u5165" }), (0, jsx_runtime_1.jsx)("th", { children: "\u8F93\u51FA" }), (0, jsx_runtime_1.jsx)("th", { children: "\u7F13\u5B58" }), (0, jsx_runtime_1.jsx)("th", { children: "\u603BToken" }), (0, jsx_runtime_1.jsx)("th", { children: "\u82B1\u8D39(USD\u4F30)" }), (0, jsx_runtime_1.jsx)("th", { children: "\u6B21\u6570" }), (0, jsx_runtime_1.jsx)("th", { children: "\u4F1A\u8BDD\u6570" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [props.data.rows.map((r, i) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: r.date }), (0, jsx_runtime_1.jsx)("td", { children: r.provider }), (0, jsx_runtime_1.jsx)("td", { children: r.model }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(r.input) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(r.output) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(r.cache) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(r.total) }), (0, jsx_runtime_1.jsx)("td", { children: r.cost !== null ? `$${r.cost.toFixed(4)}` : '—' }), (0, jsx_runtime_1.jsx)("td", { children: r.calls }), (0, jsx_runtime_1.jsx)("td", { children: r.sessions })] }, `${r.date}-${r.provider}-${r.model}-${i}`))), props.data.rows.length === 0 ? (0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 10, className: "um-muted", children: "\u8BE5\u7B5B\u9009\u4E0B\u6682\u65E0\u8BB0\u5F55" }) }) : null] })] }));
}
function SessionTable(props) {
    return ((0, jsx_runtime_1.jsxs)("table", { className: "um-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "\u65E5\u671F" }), (0, jsx_runtime_1.jsx)("th", { children: "\u4F1A\u8BDD" }), (0, jsx_runtime_1.jsx)("th", { children: "\u4F1A\u8BDDID" }), (0, jsx_runtime_1.jsx)("th", { children: "Provider" }), (0, jsx_runtime_1.jsx)("th", { children: "\u6A21\u578B" }), (0, jsx_runtime_1.jsx)("th", { children: "\u8F93\u5165" }), (0, jsx_runtime_1.jsx)("th", { children: "\u8F93\u51FA" }), (0, jsx_runtime_1.jsx)("th", { children: "\u603BToken" }), (0, jsx_runtime_1.jsx)("th", { children: "\u82B1\u8D39(USD\u4F30)" }), (0, jsx_runtime_1.jsx)("th", { children: "\u6B21\u6570" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [props.data.sessionRows.map((r, i) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: r.date }), (0, jsx_runtime_1.jsx)("td", { title: r.sessionId, children: r.title }), (0, jsx_runtime_1.jsx)("td", { className: "um-muted", children: r.sessionId.slice(0, 10) }), (0, jsx_runtime_1.jsx)("td", { children: r.provider }), (0, jsx_runtime_1.jsx)("td", { children: r.model }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(r.input) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(r.output) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(r.total) }), (0, jsx_runtime_1.jsx)("td", { children: r.cost !== null ? `$${r.cost.toFixed(4)}` : '—' }), (0, jsx_runtime_1.jsx)("td", { children: r.calls })] }, `${r.sessionId}-${r.provider}-${r.model}-${r.date}-${i}`))), props.data.sessionRows.length === 0 ? (0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 10, className: "um-muted", children: "\u8BE5\u7B5B\u9009\u4E0B\u6682\u65E0\u8BB0\u5F55" }) }) : null] })] }));
}
/* ================================================================== *
 * Platform spend — DeepSeek 官网用量页口径
 * ================================================================== */
function platformStatusText(p) {
    switch (p.status) {
        case 'ok': return '已同步';
        case 'loading': return '同步中…';
        case 'disabled': return '已关闭';
        case 'missing-token': return '未配置 userToken';
        case 'auth': return '登录态失效';
        case 'http': return '接口错误';
        case 'network': return '网络错误';
        case 'parse': return '解析失败';
        default: return p.status;
    }
}
const platformPillClass = (p) => p.status === 'ok' ? 'ok' : p.status === 'loading' ? '' : 'warn';
function Stat(props) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "um-stat", children: [(0, jsx_runtime_1.jsx)("span", { className: "um-stat-label", children: props.label }), (0, jsx_runtime_1.jsx)("span", { className: "um-stat-value", children: props.value }), (0, jsx_runtime_1.jsx)("span", { className: "um-stat-sub", children: props.sub })] }));
}
function SyncButton() {
    const busy = (0, store_1.useUi)((s) => s.platformBusy);
    return ((0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-icon-btn", onClick: () => { void (0, store_1.syncPlatform)(); }, disabled: busy, children: busy ? '同步中…' : '立即同步' }));
}
function PlatformStrip(props) {
    const p = props.platform;
    const walletTotal = p.wallet === null ? null : (p.wallet.normal ?? 0) + (p.wallet.bonus ?? 0);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "um-platform", children: [(0, jsx_runtime_1.jsxs)("div", { className: "um-platform-head", children: [(0, jsx_runtime_1.jsx)("span", { className: "um-logo", style: logoStyle('deepseek'), children: "D" }), (0, jsx_runtime_1.jsx)("b", { children: "DeepSeek \u5E73\u53F0\u5B9E\u9645\u6D88\u8D39" }), (0, jsx_runtime_1.jsx)("span", { className: `um-pill ${platformPillClass(p)}`, children: platformStatusText(p) }), (0, jsx_runtime_1.jsx)("span", { className: "um-spacer" }), (0, jsx_runtime_1.jsx)(SyncButton, {})] }), p.status === 'ok' ? ((0, jsx_runtime_1.jsxs)("div", { className: "um-stats", children: [(0, jsx_runtime_1.jsx)(Stat, { label: "\u4ECA\u65E5", value: (0, core_1.fmtMoney)(p.today.cost, p.currency), sub: `${(0, core_1.fmtTokens)(p.today.tokens)} tokens` }), (0, jsx_runtime_1.jsx)(Stat, { label: "\u672C\u6708", value: (0, core_1.fmtMoney)(p.month.cost, p.currency), sub: `${(0, core_1.fmtTokens)(p.month.tokens)} tokens` }), (0, jsx_runtime_1.jsx)(Stat, { label: "\u7D2F\u8BA1\u6D88\u8D39", value: (0, core_1.fmtMoney)(p.lifetime.cost, p.currency), sub: `${p.lifetime.months} 个月${p.lifetime.complete ? '' : '（回填中）'}` }), walletTotal !== null ? ((0, jsx_runtime_1.jsx)(Stat, { label: "\u5E73\u53F0\u4F59\u989D", value: (0, core_1.fmtMoney)(walletTotal, p.currency), sub: `充值 ${(0, core_1.fmtMoney)(p.wallet?.normal ?? 0, p.currency)} / 赠送 ${(0, core_1.fmtMoney)(p.wallet?.bonus ?? 0, p.currency)}` })) : null] })) : ((0, jsx_runtime_1.jsx)("p", { className: "um-hint", children: p.error ?? platformStatusText(p) })), (0, jsx_runtime_1.jsxs)("p", { className: "um-note", children: ["\u6765\u81EA platform.deepseek.com \u7528\u91CF\u9875\uFF08\u767B\u5F55\u6001\u79C1\u6709\u63A5\u53E3\uFF09\uFF0C\u5373\u5B98\u7F51\u8D26\u5355\u53E3\u5F84\uFF08", p.currency, "\uFF09\uFF1B\u4E0E\u4E0B\u65B9\u300C\u4F30\u7B97\u82B1\u8D39\uFF08USD \u53C2\u8003\u4EF7\uFF09\u300D\u4E0D\u662F\u4E00\u56DE\u4E8B\u3002"] })] }));
}
function PlatformTab() {
    const overview = (0, store_1.useUi)((s) => s.overview);
    const platform = overview?.platform ?? null;
    if (platform === null)
        return (0, jsx_runtime_1.jsx)("div", { className: "um-hint", children: "\u5E73\u53F0\u6570\u636E\u5C1A\u672A\u52A0\u8F7D\u2026" });
    if (platform.status === 'disabled')
        return (0, jsx_runtime_1.jsx)("div", { className: "um-hint", children: "\u5E73\u53F0\u540C\u6B65\u5DF2\u5173\u95ED \u2014 \u5728\u300C\u9884\u7B97\u4E0E\u544A\u8B66\u300D\u4E2D\u5F00\u542F\u3002" });
    if (platform.status === 'missing-token') {
        return (0, jsx_runtime_1.jsx)("div", { className: "um-hint", children: "\u5C1A\u672A\u914D\u7F6E DeepSeek \u5E73\u53F0 userToken\uFF1A\u5728\u300C\u9884\u7B97\u4E0E\u544A\u8B66\u300D\u91CC\u7C98\u8D34\u4E00\u6B21\u5373\u53EF\u540C\u6B65\u5B98\u7F51\u7684\u5B9E\u9645\u6D88\u8D39\u3002" });
    }
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "um-total-line", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["\u6570\u636E\u65F6\u95F4 ", (0, jsx_runtime_1.jsx)("b", { children: new Date(platform.at).toLocaleString() })] }), (0, jsx_runtime_1.jsxs)("span", { children: ["\u4ECA\u65E5 ", (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtMoney)(platform.today.cost, platform.currency) })] }), (0, jsx_runtime_1.jsxs)("span", { children: ["\u672C\u6708 ", (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtMoney)(platform.month.cost, platform.currency) })] }), (0, jsx_runtime_1.jsxs)("span", { children: ["\u7D2F\u8BA1 ", (0, jsx_runtime_1.jsx)("b", { children: (0, core_1.fmtMoney)(platform.lifetime.cost, platform.currency) }), "\uFF08", platform.lifetime.months, " \u4E2A\u6708", platform.lifetime.complete ? '' : '，回填中', "\uFF09"] }), (0, jsx_runtime_1.jsx)("span", { className: "um-spacer" }), (0, jsx_runtime_1.jsx)(SyncButton, {})] }), platform.status !== 'ok' && platform.status !== 'loading' ? ((0, jsx_runtime_1.jsx)("div", { className: "um-error", children: platform.error ?? platformStatusText(platform) })) : null, (0, jsx_runtime_1.jsx)(SpendChart, { daily: platform.daily, currency: platform.currency }), (0, jsx_runtime_1.jsxs)("h4", { className: "um-h4", children: ["\u672C\u6708\u6309\u6A21\u578B\uFF08", platform.month.month, "\uFF09"] }), (0, jsx_runtime_1.jsx)("div", { className: "um-table-wrap", children: (0, jsx_runtime_1.jsxs)("table", { className: "um-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "\u6A21\u578B" }), (0, jsx_runtime_1.jsx)("th", { children: "\u8F93\u5165(\u672A\u547D\u4E2D)" }), (0, jsx_runtime_1.jsx)("th", { children: "\u7F13\u5B58(\u547D\u4E2D)" }), (0, jsx_runtime_1.jsx)("th", { children: "\u8F93\u51FA" }), (0, jsx_runtime_1.jsx)("th", { children: "\u603BToken" }), (0, jsx_runtime_1.jsx)("th", { children: "\u6D88\u8D39" }), (0, jsx_runtime_1.jsx)("th", { children: "\u5360\u6BD4" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [platform.byModel.map((m) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: m.model }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(Math.max(0, m.input - m.cache)) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(m.cache) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(m.output) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(m.total) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtMoney)(m.cost, platform.currency) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtPct)(m.share) })] }, m.model))), platform.byModel.length === 0 ? (0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 7, className: "um-muted", children: "\u672C\u6708\u6682\u65E0\u8BB0\u5F55" }) }) : null] })] }) }), (0, jsx_runtime_1.jsx)("h4", { className: "um-h4", children: "\u9010\u6708\u6D88\u8D39" }), (0, jsx_runtime_1.jsx)("div", { className: "um-table-wrap", children: (0, jsx_runtime_1.jsxs)("table", { className: "um-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "\u6708\u4EFD" }), (0, jsx_runtime_1.jsx)("th", { children: "Token" }), (0, jsx_runtime_1.jsx)("th", { children: "\u6D88\u8D39" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [platform.months.map((m) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: m.month }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtTokens)(m.tokens) }), (0, jsx_runtime_1.jsx)("td", { children: (0, core_1.fmtMoney)(m.cost, platform.currency) })] }, m.month))), platform.months.length === 0 ? (0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 3, className: "um-muted", children: "\u6682\u65E0\u6570\u636E" }) }) : null] })] }) }), (0, jsx_runtime_1.jsx)("p", { className: "um-note", children: "\u91D1\u989D\u4E3A\u5E73\u53F0\u8D26\u5355\u53E3\u5F84\uFF1B\u65E5\u754C\u6309\u5E73\u53F0\uFF08UTC\uFF09\u5207\u5206\uFF0C\u4E0E\u672C\u5730\u81EA\u7136\u65E5\u53EF\u80FD\u76F8\u5DEE\u51E0\u5C0F\u65F6\u3002\u9010\u6708\u7ED3\u679C\u7F13\u5B58\u5728\u672C\u673A\uFF0C\u5DF2\u7ED3\u675F\u7684\u6708\u4EFD\u4E0D\u518D\u91CD\u590D\u8BF7\u6C42\u3002" })] }));
}
function SpendChart(props) {
    const width = 680;
    const height = 190;
    const pad = 34;
    const values = props.daily.map((d) => d.cost);
    const geo = (0, chart_1.buildLineGeometry)(values, width, height, pad);
    const ticks = (0, chart_1.yTicks)(geo.max, 3);
    const lastIndex = values.length - 1;
    const mid = Math.floor(values.length / 2);
    const xFor = (i) => (values.length > 1 ? pad + (i * (width - pad * 2)) / (values.length - 1) : width / 2);
    const labelAt = (i) => props.daily[i]?.date.slice(5) ?? '';
    return ((0, jsx_runtime_1.jsx)("div", { className: "um-chart", children: (0, jsx_runtime_1.jsxs)("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "\u6BCF\u65E5\u6D88\u8D39\u8D8B\u52BF", children: [ticks.map((t) => {
                    const y = geo.yOf(t);
                    return ((0, jsx_runtime_1.jsxs)("g", { children: [(0, jsx_runtime_1.jsx)("line", { x1: pad, y1: y, x2: width - pad, y2: y, stroke: "rgba(127,135,146,.16)", strokeWidth: "1" }), (0, jsx_runtime_1.jsx)("text", { x: pad - 6, y: y + 3, textAnchor: "end", fontSize: "9", fill: "var(--um-muted, #7a828e)", children: (0, core_1.fmtMoney)(t, props.currency) })] }, t));
                }), values.length > 1 ? (0, jsx_runtime_1.jsx)("path", { d: (0, chart_1.buildAreaPath)(geo.points, geo.zeroY), fill: "rgba(34,160,107,.14)" }) : null, (0, jsx_runtime_1.jsx)("polyline", { points: geo.points, fill: "none", stroke: "#22a06b", strokeWidth: "1.8", strokeLinejoin: "round", strokeLinecap: "round" }), [0, mid, lastIndex].filter((i, idx, arr) => arr.indexOf(i) === idx).map((i) => ((0, jsx_runtime_1.jsx)("text", { x: xFor(i), y: height - 8, textAnchor: "middle", fontSize: "9", fill: "var(--um-muted, #7a828e)", children: labelAt(i) }, i)))] }) }));
}
function SettingsTab() {
    const config = (0, store_1.useUi)((s) => s.config);
    const platformSpend = (0, store_1.useUi)((s) => s.overview?.platform ?? null);
    const [budgets, setBudgets] = (0, react_1.useState)({});
    const [hooks, setHooks] = (0, react_1.useState)([]);
    const [plat, setPlat] = (0, react_1.useState)({ enabled: true, token: '', historyMonths: '36' });
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [saved, setSaved] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (config === null)
            return;
        const next = {};
        for (const [id, b] of Object.entries(config.balances)) {
            next[id] = {
                enabled: b.enabled !== false,
                budget: b.budget !== undefined && b.budget !== null ? String(b.budget) : '',
                warnPct: b.warnPct !== undefined && b.warnPct !== null ? String(b.warnPct) : '5',
            };
        }
        setBudgets(next);
        setHooks(config.webhooks.map((w) => ({ url: w.url, secret: '', enabled: w.enabled !== false })));
        setPlat({
            enabled: config.deepseekPlatform?.enabled !== false,
            // The stored token is never echoed back: an empty box means "keep it".
            token: '',
            historyMonths: String(config.deepseekPlatform?.historyMonths ?? 36),
        });
    }, [config]);
    const doSave = () => {
        setSaving(true);
        const balances = {};
        for (const [id, d] of Object.entries(budgets)) {
            balances[id] = {
                enabled: d.enabled,
                budget: d.budget !== '' ? Number(d.budget) : undefined,
                warnPct: d.warnPct !== '' ? Number(d.warnPct) : 5,
            };
        }
        const webhooks = hooks
            .filter((h) => h.url.trim() !== '')
            .map((h) => ({
            url: h.url.trim(),
            enabled: h.enabled,
            // Empty secret ⇒ keep the previously stored one (host-side merge).
            secret: h.secret.trim() !== '' ? h.secret.trim() : undefined,
        }));
        void (0, store_1.saveConfig)({
            balances,
            webhooks,
            deepseekPlatform: {
                enabled: plat.enabled,
                historyMonths: plat.historyMonths !== '' ? Number(plat.historyMonths) : 36,
                // Empty ⇒ keep the stored token (host-side merge), same as webhook secrets.
                userToken: plat.token.trim() !== '' ? plat.token.trim() : undefined,
            },
        }).then((res) => {
            setSaving(false);
            setSaved(true);
            setPlat((prev) => ({ ...prev, token: '' }));
            setTimeout(() => setSaved(false), 2000);
            // A fresh token (or a re-enable) is worth syncing right away.
            if (res.ok)
                void (0, store_1.syncPlatform)();
        });
    };
    if (config === null)
        return (0, jsx_runtime_1.jsx)("div", { className: "um-hint", children: "\u52A0\u8F7D\u914D\u7F6E\u4E2D\u2026" });
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "um-hint", children: "\u9884\u7B97\u8FDB\u5EA6\u4E0E\u4F4E\u4F59\u989D\u544A\u8B66\u90FD\u57FA\u4E8E\u300C\u9884\u7B97\u300D\uFF1A\u4F59\u989D \u2264 \u9884\u7B97 \u00D7 \u9884\u8B66\u767E\u5206\u6BD4 \u65F6\u544A\u8B66\uFF08\u9ED8\u8BA4 5%\uFF09\u3002\u4F59\u989D\u4E0D\u53EF\u7528\u4F46\u5DF2\u8BBE\u9884\u7B97\u65F6\uFF0C\u4F1A\u6539\u7528\u672C\u6708\u4F30\u7B97\u82B1\u8D39\u63A8\u7B97\u5269\u4F59\u3002" }), Object.entries(budgets).map(([id, d]) => ((0, jsx_runtime_1.jsxs)("div", { className: "um-cfg-card", children: [(0, jsx_runtime_1.jsxs)("h3", { children: [(0, jsx_runtime_1.jsx)("span", { className: "um-logo", style: logoStyle(id), children: logoChar(id) }), labelOf(id)] }), (0, jsx_runtime_1.jsxs)("div", { className: "um-cfg-row", children: [(0, jsx_runtime_1.jsxs)("label", { className: "um-check", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: d.enabled, onChange: (e) => setBudgets({ ...budgets, [id]: { ...d, enabled: e.target.checked } }) }), "\u76D1\u63A7"] }), (0, jsx_runtime_1.jsxs)("label", { children: ["\u9884\u7B97\u91D1\u989D", (0, jsx_runtime_1.jsx)("input", { className: "um-input", type: "number", min: "0", step: "any", value: d.budget, placeholder: "\u4E0D\u8BBE", onChange: (e) => setBudgets({ ...budgets, [id]: { ...d, budget: e.target.value } }) })] }), (0, jsx_runtime_1.jsxs)("label", { children: ["\u9884\u8B66 %\uFF08\u4F59\u989D\u5360\u9884\u7B97\uFF09", (0, jsx_runtime_1.jsx)("input", { className: "um-input small", type: "number", min: "0.1", max: "100", step: "0.5", value: d.warnPct, onChange: (e) => setBudgets({ ...budgets, [id]: { ...d, warnPct: e.target.value } }) })] })] })] }, id))), (0, jsx_runtime_1.jsxs)("div", { className: "um-cfg-card", children: [(0, jsx_runtime_1.jsxs)("h3", { children: [(0, jsx_runtime_1.jsx)("span", { className: "um-logo", style: logoStyle('deepseek'), children: "D" }), "DeepSeek \u5B98\u7F51\u5B9E\u9645\u6D88\u8D39\u540C\u6B65"] }), (0, jsx_runtime_1.jsxs)("p", { className: "um-hint", children: ["\u5B98\u7F51\u6CA1\u6709\u5F00\u653E\u6D88\u8D39\u67E5\u8BE2 API\uFF1A\u7528\u91CF\u9875\u8D70\u7684\u662F\u767B\u5F55\u6001\u79C1\u6709\u63A5\u53E3\uFF0C\u9700\u8981\u6D4F\u89C8\u5668\u91CC\u7684 userToken\u3002\u767B\u5F55 platform.deepseek.com \u540E\uFF0C\u5728\u6D4F\u89C8\u5668\u63A7\u5236\u53F0\u6267\u884C", (0, jsx_runtime_1.jsx)("code", { children: " JSON.parse(localStorage.getItem('userToken')).value " }), "\u5E76\u628A\u7ED3\u679C\u7C98\u8D34\u5230\u4E0B\u9762\uFF08\u53EA\u4FDD\u5B58\u5728\u672C\u673A\u914D\u7F6E\u6587\u4EF6\uFF0C\u56DE\u4F20\u7ED9\u6D4F\u89C8\u5668\u65F6\u59CB\u7EC8\u4E3A\u7A7A\uFF09\u3002"] }), (0, jsx_runtime_1.jsxs)("div", { className: "um-cfg-row", children: [(0, jsx_runtime_1.jsxs)("label", { className: "um-check", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: plat.enabled, onChange: (e) => setPlat({ ...plat, enabled: e.target.checked }) }), "\u542F\u7528\u540C\u6B65"] }), (0, jsx_runtime_1.jsxs)("label", { children: ["\u5386\u53F2\u56DE\u586B\u6708\u6570", (0, jsx_runtime_1.jsx)("input", { className: "um-input small", type: "number", min: "1", max: "60", value: plat.historyMonths, onChange: (e) => setPlat({ ...plat, historyMonths: e.target.value }) })] }), (0, jsx_runtime_1.jsx)("input", { className: "um-input wide", type: "password", placeholder: "userToken\uFF08\u5DF2\u4FDD\u5B58\u5219\u7559\u7A7A\u4FDD\u7559\uFF09", value: plat.token, onChange: (e) => setPlat({ ...plat, token: e.target.value }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "um-cfg-row", style: { marginTop: 8 }, children: [(0, jsx_runtime_1.jsx)("span", { className: `um-pill ${platformSpend === null ? '' : platformPillClass(platformSpend)}`, children: platformSpend === null ? '未同步' : platformStatusText(platformSpend) }), platformSpend !== null && platformSpend.status === 'ok' ? ((0, jsx_runtime_1.jsxs)("span", { className: "um-hint", children: ["\u4ECA\u65E5 ", (0, core_1.fmtMoney)(platformSpend.today.cost, platformSpend.currency), " \u00B7 \u672C\u6708 ", (0, core_1.fmtMoney)(platformSpend.month.cost, platformSpend.currency), " \u00B7 \u7D2F\u8BA1 ", (0, core_1.fmtMoney)(platformSpend.lifetime.cost, platformSpend.currency), "\uFF08", platformSpend.lifetime.months, " \u4E2A\u6708\uFF09\u00B7 \u540C\u6B65\u4E8E ", new Date(platformSpend.at).toLocaleTimeString()] })) : platformSpend?.error != null ? ((0, jsx_runtime_1.jsx)("span", { className: "um-hint", children: platformSpend.error })) : null, (0, jsx_runtime_1.jsx)("span", { className: "um-spacer" }), (0, jsx_runtime_1.jsx)(SyncButton, {})] }), (0, jsx_runtime_1.jsxs)("div", { className: "um-actions", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-save", onClick: doSave, disabled: saving, children: saving ? '保存中…' : '保存设置' }), saved ? (0, jsx_runtime_1.jsx)("span", { className: "um-saved", children: "\u2713 \u5DF2\u4FDD\u5B58" }) : null] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "um-cfg-card", children: [(0, jsx_runtime_1.jsx)("h3", { children: "Webhook \u901A\u77E5\uFF08\u4F59\u989D\u8FDB\u5165\u9884\u8B66\u65F6\u63A8\u9001\uFF0CHMAC-SHA256 \u7B7E\u540D\u53EF\u9009\uFF09" }), hooks.map((h, i) => ((0, jsx_runtime_1.jsxs)("div", { className: "um-cfg-row", style: { marginBottom: 8 }, children: [(0, jsx_runtime_1.jsx)("input", { className: "um-input wide", placeholder: "https://example.com/hook", value: h.url, onChange: (e) => setHooks(hooks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x))) }), (0, jsx_runtime_1.jsx)("input", { className: "um-input wide", type: "password", placeholder: "Secret\uFF08\u5DF2\u5B58\u5BC6\u94A5\u4E0D\u56DE\u663E\uFF0C\u7559\u7A7A\u4FDD\u7559\uFF09", value: h.secret, onChange: (e) => setHooks(hooks.map((x, j) => (j === i ? { ...x, secret: e.target.value } : x))) }), (0, jsx_runtime_1.jsxs)("label", { className: "um-check", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: h.enabled, onChange: (e) => setHooks(hooks.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x))) }), "\u542F\u7528"] }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-icon-btn", onClick: () => setHooks(hooks.filter((_, j) => j !== i)), children: "\u5220\u9664" })] }, i))), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-icon-btn", onClick: () => setHooks([...hooks, { url: '', secret: '', enabled: true }]), children: "+ \u6DFB\u52A0 Webhook" }), (0, jsx_runtime_1.jsxs)("div", { className: "um-actions", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "um-save", onClick: doSave, disabled: saving, children: saving ? '保存中…' : '保存设置' }), saved ? (0, jsx_runtime_1.jsx)("span", { className: "um-saved", children: "\u2713 \u5DF2\u4FDD\u5B58" }) : null] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "um-note", children: ["\u8BBE\u7F6E\u6301\u4E45\u5316\u5728 host \u7684 ", config.storageDir ?? '$DSH_HOME/storages/dsh-usage-monitor/config.json', "\uFF08\u672C\u673A\uFF09\u3002API Key \u4E0D\u5728\u6B64\u5B58\u50A8\uFF0C\u59CB\u7EC8\u4ECE DSH \u51ED\u8BC1/\u73AF\u5883\u53D8\u91CF\u8BFB\u53D6\u3002"] })] }));
}
function labelOf(id) {
    const map = {
        deepseek: 'DeepSeek',
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        zhipu: '智谱 GLM',
        moonshot: 'Moonshot / Kimi',
        siliconflow: 'SiliconFlow',
    };
    return map[id] ?? id;
}
/** Export injected for the entry file (uses the same hub store). */
function PanelOnly() {
    return (0, jsx_runtime_1.jsx)(Hub, {});
}
function useCurrencySymbolFor(currency) {
    return (0, core_1.currencySymbol)(currency);
}

});
define("client/index", function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = exports.name = void 0;
exports.apply = apply;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * dsh-usage-monitor client half.
 *
 * Registers three additive seats:
 *  - `conversation.session.header.utilities` → the live balance chip;
 *  - `sidebar.footer.action`                 → the panel trigger icon;
 *  - `shell.overlay`                         → always-mounted hub (toasts +
 *    the detail panel when open).
 * Data comes from the host's `/api/dsh-usage-monitor` routes via same-origin
 * fetch; one background poll keeps the overview warm at the configured rate.
 */
const style_1 = require("./style");
const components_1 = require("./components");
const store_1 = require("./store");
/** Plugin identity for the client bundle id (same as the host row). */
exports.name = 'dsh-usage-monitor';
/** Services required before apply. */
exports.inject = ['slots'];
function apply(ctx) {
    // One stylesheet for the whole plugin; the module loader claims and removes
    // `<style data-plugin="…">` tags on unload (mirrors ecosystem plugins).
    if (typeof document !== 'undefined') {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-usage-monitor';
        tag.textContent = style_1.css;
        document.head.appendChild(tag);
    }
    if (ctx.effect !== undefined) {
        ctx.effect(store_1.startBackgroundPoll, 'dsh-usage-monitor: background poll');
    }
    else {
        (0, store_1.startBackgroundPoll)();
    }
    const slots = ctx.slots;
    if (slots === undefined)
        return;
    if (ctx.effect !== undefined) {
        ctx.effect(() => slots.inject('conversation.session.header.utilities', () => slots.register({ name: 'conversation.session.header.utilities', id: 'dsh-usage-monitor-chip', order: 1500, label: '余额' }, () => (0, jsx_runtime_1.jsx)(components_1.Chip, {}))), 'dsh-usage-monitor: header chip');
        ctx.effect(() => slots.inject('sidebar.footer.action', () => slots.register({ name: 'sidebar.footer.action', id: 'dsh-usage-monitor-trigger', order: 900, label: '用量监控' }, () => (0, jsx_runtime_1.jsx)(components_1.Trigger, {}))), 'dsh-usage-monitor: sidebar trigger');
        ctx.effect(() => slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'dsh-usage-monitor-hub', order: 2000, label: '用量监控' }, () => (0, jsx_runtime_1.jsx)(components_1.Hub, {}))), 'dsh-usage-monitor: overlay hub');
    }
    else {
        slots.inject('conversation.session.header.utilities', () => slots.register({ name: 'conversation.session.header.utilities', id: 'dsh-usage-monitor-chip', order: 1500, label: '余额' }, () => (0, jsx_runtime_1.jsx)(components_1.Chip, {})));
        slots.inject('sidebar.footer.action', () => slots.register({ name: 'sidebar.footer.action', id: 'dsh-usage-monitor-trigger', order: 900, label: '用量监控' }, () => (0, jsx_runtime_1.jsx)(components_1.Trigger, {})));
        slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'dsh-usage-monitor-hub', order: 2000, label: '用量监控' }, () => (0, jsx_runtime_1.jsx)(components_1.Hub, {})));
    }
}

});
define("client/store", function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTab = exports.toggleOpen = exports.setOpen = void 0;
exports.getState = getState;
exports.subscribe = subscribe;
exports.useUi = useUi;
exports.orderedProviders = orderedProviders;
exports.refreshOverview = refreshOverview;
exports.stopPlatformSettle = stopPlatformSettle;
exports.dismissToast = dismissToast;
exports.syncPlatform = syncPlatform;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.startBackgroundPoll = startBackgroundPoll;
/**
 * Tiny module-level UI store with a subscribe() API (external-store style).
 * Components use `useUi` to select slices; one background poller (started by
 * the client entry, stopped on unload) keeps the overview fresh and derives
 * one-shot alert toasts from provider level transitions.
 */
const react_1 = require("react");
const api_1 = require("./api");
const state = {
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
};
const listeners = new Set();
let toastId = 0;
const emit = () => {
    for (const fn of [...listeners])
        fn();
};
function getState() {
    return state;
}
function subscribe(fn) {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}
function patch(partial) {
    Object.assign(state, partial);
    emit();
}
/* ------------------------------------------------------------------ *
 * Selectors / actions
 * ------------------------------------------------------------------ */
function useUi(select) {
    return (0, react_1.useSyncExternalStore)(subscribe, () => select(state), () => select(state));
}
const setOpen = (open) => patch({ open });
exports.setOpen = setOpen;
const toggleOpen = () => patch({ open: !state.open });
exports.toggleOpen = toggleOpen;
const setTab = (activeTab) => patch({ activeTab, open: true });
exports.setTab = setTab;
/** Provider views sorted: alerting first, then by label. */
function orderedProviders(overview) {
    if (overview === null)
        return [];
    const views = [...overview.providers];
    const rank = (v) => (v.alert === 'critical' ? 0 : v.alert === 'warn' ? 1 : v.status === 'ok' ? 2 : 3);
    views.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
    return views;
}
async function refreshOverview(force = false) {
    patch({ loading: true });
    const res = await (0, api_1.fetchOverview)(force);
    if (res.ok) {
        patch({
            overview: res.data,
            overviewAt: Date.now(),
            overviewError: null,
            loading: false,
        });
        surfaceToasts(res.data);
        schedulePlatformSettle();
    }
    else {
        patch({ overviewError: res.error, loading: false });
    }
    return res;
}
/**
 * The host answers the very first platform request with a 'loading' placeholder
 * while it fetches in the background. Poll a few times (uncached, cheap) so the
 * real numbers — or a token error — show up within seconds instead of a minute.
 */
let platformSettleTimer = null;
function schedulePlatformSettle() {
    if (state.overview?.platform?.status !== 'loading')
        return;
    if (platformSettleTimer !== null)
        return;
    let attempts = 0;
    const tick = () => {
        platformSettleTimer = null;
        attempts += 1;
        if (attempts > 20 || state.overview?.platform?.status !== 'loading')
            return;
        void (0, api_1.fetchOverviewRaw)().then((res) => {
            if (res.ok)
                patch({ overview: res.data, overviewAt: Date.now() });
            platformSettleTimer = setTimeout(tick, 3000);
        });
    };
    platformSettleTimer = setTimeout(tick, 2500);
}
function stopPlatformSettle() {
    if (platformSettleTimer !== null) {
        clearTimeout(platformSettleTimer);
        platformSettleTimer = null;
    }
}
function surfaceToasts(overview) {
    const newToasts = [];
    const surfaced = { ...state.surfaced };
    for (const view of overview.providers) {
        const level = view.alert ?? 'ok';
        const previous = surfaced[view.provider] ?? 'ok';
        surfaced[view.provider] = level;
        if (level === 'ok' || level === previous)
            continue;
        if (previous !== 'warn' || level === 'critical') {
            // entering warn/critical, or escalating warn → critical
            newToasts.push({
                id: ++toastId,
                provider: view.provider,
                label: view.label,
                level,
                message: view.balance?.reason ?? `${view.label} 余额 ${view.balance?.supported === true && Number.isFinite(view.balance.amount) ? '低于预警线' : '状态异常'}`,
                at: Date.now(),
            });
        }
    }
    if (newToasts.length > 0) {
        patch({ surfaced, toasts: [...state.toasts, ...newToasts].slice(-5) });
        setTimeout(() => dismissToast(newToasts[0]?.id ?? -1), 8_000);
    }
    else {
        patch({ surfaced });
    }
}
function dismissToast(id) {
    patch({ toasts: state.toasts.filter((t) => t.id !== id) });
}
/**
 * 「立即同步」：只刷新平台数据，并把结果直接贴回当前 overview，避免连带重新
 * 拉取所有 Provider 余额（那会多打几次厂商接口）。
 */
async function syncPlatform() {
    patch({ platformBusy: true });
    const res = await (0, api_1.fetchPlatform)(true);
    if (res.ok && state.overview !== null) {
        patch({ overview: { ...state.overview, platform: res.data } });
    }
    patch({ platformBusy: false });
    return res;
}
async function loadConfig(force = false) {
    const res = await (0, api_1.fetchConfig)(force);
    if (res.ok)
        patch({ config: res.data, configAt: Date.now() });
    return res;
}
async function saveConfig(patchBody) {
    const res = await (0, api_1.updateConfig)(patchBody);
    if (res.ok)
        patch({ config: res.data, configAt: Date.now() });
    return res;
}
/* ------------------------------------------------------------------ *
 * Background polling (started once by the client entry).
 * ------------------------------------------------------------------ */
function startBackgroundPoll() {
    const tick = () => {
        void refreshOverview();
    };
    let timer = null;
    // config.pollMs used to be a dead knob: the interval was hardcoded here.
    const intervalMs = () => {
        const configured = state.config?.pollMs;
        return typeof configured === 'number' && Number.isFinite(configured) && configured >= 5_000
            ? configured
            : 60_000;
    };
    const arm = () => {
        if (timer !== null)
            clearInterval(timer);
        timer = setInterval(tick, intervalMs());
    };
    // Warm caches immediately, then (re)arm once the config lands so a
    // non-default pollMs takes effect without a reload.
    void loadConfig().then(() => arm());
    void refreshOverview();
    arm();
    return () => {
        if (timer !== null)
            clearInterval(timer);
        stopPlatformSettle();
    };
}

});
define("client/style", function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.css = void 0;
/**
 * One stylesheet for the whole plugin. The module loader claims and removes
 * `<style data-plugin="…">` tags on unload, so the client entry only appends.
 * Colors follow the app's light/dark preference via `prefers-color-scheme`
 * and CSS variables with neutral fallbacks.
 */
exports.css = `
.um-root, .um-root * { box-sizing: border-box; }
.um-root { --um-bg: #ffffff; --um-bg2: #f6f7f9; --um-border: #e3e6eb; --um-text: #1f2329; --um-muted: #7a828e;
  --um-ok: #22a06b; --um-warn: #d97706; --um-crit: #dc2626; --um-accent: #4f6ef7; --um-chip-bg: rgba(255,255,255,.86);
  --um-shadow: 0 10px 30px rgba(15,23,42,.14); font-size: 14px; line-height: 1.45;
  color-scheme: light dark; color: var(--um-text); }
@media (prefers-color-scheme: dark) {
  .um-root { --um-bg: #16181d; --um-bg2: #1e2127; --um-border: #2c313a; --um-text: #e8eaed; --um-muted: #9aa3af;
    --um-chip-bg: rgba(28,31,38,.9); --um-shadow: 0 10px 30px rgba(0,0,0,.5); }
}

/* ---- top chip (session header utilities) ---- */
.um-chip { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
  border-radius: 999px; border: 1px solid var(--um-border); background: var(--um-chip-bg);
  font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; backdrop-filter: blur(6px); }
.um-chip:hover { border-color: var(--um-accent); }
.um-chip .um-provider-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--um-ok); flex: none; }
.um-chip.warn .um-provider-dot { background: var(--um-warn); }
.um-chip.critical .um-provider-dot { background: var(--um-crit); }
.um-chip .um-amount { font-variant-numeric: tabular-nums; }
.um-chip .um-currency { color: var(--um-muted); font-weight: 500; }
.um-chip.critical { border-color: rgba(220,38,38,.55); }
.um-chip.alarm .um-provider-dot { animation: um-blink 1s steps(2,start) infinite; }
@keyframes um-blink { to { visibility: hidden; } }
.um-chip-missing { color: var(--um-muted); font-weight: 500; }

/* ---- sidebar trigger (high-visibility pill) ---- */
.um-trigger { position: relative; height: 30px; padding: 0 10px; gap: 6px; border-radius: 9px; display: inline-flex;
  align-items: center; justify-content: center; border: 1px solid var(--um-border); background: var(--um-bg2); color: var(--um-text); cursor: pointer;
  font-size: 12px; font-weight: 600; white-space: nowrap; }
.um-trigger:hover { border-color: var(--um-accent); background: var(--um-chip-bg); }
.um-trigger-label { display: inline; line-height: 1; }
.um-trigger .um-dot { position: absolute; top: 4px; right: 4px; width: 7px; height: 7px; border-radius: 50%; background: var(--um-crit); }
.um-trigger svg { flex: none; }

/* ---- hub / toasts / backdrop / panel ---- */
.um-toasts { position: fixed; right: 14px; bottom: 14px; z-index: 2147483000; display: flex; flex-direction: column; gap: 8px; max-width: 340px; }
.um-toast { display: flex; gap: 8px; align-items: flex-start; background: var(--um-chip-bg); border: 1px solid var(--um-border);
  border-left: 3px solid var(--um-crit); border-radius: 10px; padding: 10px 12px; box-shadow: var(--um-shadow);
  backdrop-filter: blur(8px); font-size: 12.5px; }
.um-toast.warn { border-left-color: var(--um-warn); }
.um-toast b { font-weight: 700; }
.um-toast button { margin-left: auto; border: none; background: none; color: var(--um-muted); cursor: pointer; font-size: 14px; line-height: 1; }
.um-backdrop { position: fixed; inset: 0; background: rgba(10,12,16,.32); z-index: 2147482000;
  animation: um-fade .16s ease-out; }
@keyframes um-fade { from { opacity: 0; } to { opacity: 1; } }
.um-panel { position: fixed; top: 56px; left: 50%; transform: translateX(-50%); z-index: 2147482100;
  width: min(880px, 94vw); max-height: calc(100vh - 96px); border-radius: 16px; overflow: hidden;
  background: var(--um-bg); border: 1px solid var(--um-border); box-shadow: var(--um-shadow);
  display: flex; flex-direction: column; animation: um-slide .18s ease-out; }
@keyframes um-slide { from { transform: translate(-50%, 10px); opacity: .4; } to { transform: translate(-50%, 0); opacity: 1; } }
.um-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--um-border); }
.um-head h2 { margin: 0; font-size: 15px; }
.um-head .um-sub { font-size: 12px; color: var(--um-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.um-spacer { flex: 1; }
.um-icon-btn { border: 1px solid var(--um-border); background: var(--um-bg2); color: var(--um-text); border-radius: 8px;
  padding: 4px 10px; font-size: 12.5px; cursor: pointer; height: 28px; display: inline-flex; align-items: center; gap: 4px; }
.um-icon-btn:hover { border-color: var(--um-accent); }
.um-icon-btn:disabled { opacity: .5; cursor: default; }
.um-tabs { display: flex; gap: 4px; padding: 8px 16px 0; border-bottom: 1px solid var(--um-border); }
.um-tab { border: none; background: none; padding: 8px 12px; cursor: pointer; color: var(--um-muted);
  font-size: 13px; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.um-tab.on { color: var(--um-accent); border-bottom-color: var(--um-accent); font-weight: 600; }
.um-body { flex: 1; overflow: auto; padding: 14px 16px; }
.um-hint { color: var(--um-muted); font-size: 12px; }
.um-error { color: var(--um-crit); font-size: 12.5px; padding: 6px 0; }

/* ---- overview cards ---- */
.um-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(236px, 1fr)); gap: 10px; }
.um-card { border: 1px solid var(--um-border); background: var(--um-bg2); border-radius: 12px; padding: 12px 12px 10px; display: flex; flex-direction: column; gap: 8px; }
.um-card-head { display: flex; align-items: center; gap: 8px; }
.um-logo { width: 26px; height: 26px; border-radius: 8px; flex: none; display: inline-flex; align-items: center;
  justify-content: center; color: #fff; font-weight: 800; font-size: 13px; }
.um-name { font-weight: 700; font-size: 13px; }
.um-pill { margin-left: auto; font-size: 11px; padding: 1px 8px; border-radius: 999px; background: var(--um-bg); border: 1px solid var(--um-border); color: var(--um-muted); }
.um-pill.ok { color: var(--um-ok); border-color: rgba(34,160,107,.4); }
.um-pill.warn { color: var(--um-warn); border-color: rgba(217,119,6,.45); }
.um-pill.critical { color: var(--um-crit); border-color: rgba(220,38,38,.5); }
.um-balance { font-size: 21px; font-weight: 750; font-variant-numeric: tabular-nums; letter-spacing: -.2px; }
.um-balance .um-cur { font-size: 12px; font-weight: 600; color: var(--um-muted); margin-right: 2px; }
.um-row { display: flex; gap: 6px; font-size: 12px; color: var(--um-muted); }
.um-row b { color: var(--um-text); font-variant-numeric: tabular-nums; }
.um-bar { height: 6px; border-radius: 999px; background: rgba(127,135,146,.18); overflow: hidden; }
.um-bar > i { display: block; height: 100%; border-radius: 999px; background: var(--um-ok); transition: width .4s ease; }
.um-bar > i.warn { background: var(--um-warn); }
.um-bar > i.critical { background: var(--um-crit); }
.um-bar + .um-hint { margin-top: -4px; }
.um-note { font-size: 11px; color: var(--um-muted); }

/* ---- platform spend (DeepSeek 官网账单口径) ---- */
.um-platform { border: 1px solid var(--um-border); border-radius: 12px; background: var(--um-bg2); padding: 12px; margin-bottom: 10px; }
.um-platform-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 13px; }
.um-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.um-stat { display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--um-border); border-radius: 10px; background: var(--um-bg); padding: 8px 10px; }
.um-stat-label { font-size: 11px; color: var(--um-muted); }
.um-stat-value { font-size: 18px; font-weight: 750; font-variant-numeric: tabular-nums; }
.um-stat-sub { font-size: 11px; color: var(--um-muted); font-variant-numeric: tabular-nums; }
.um-row-platform { color: var(--um-ok); }
.um-row-platform b { color: var(--um-ok); }
.um-h4 { margin: 14px 0 6px; font-size: 12.5px; color: var(--um-muted); font-weight: 600; }
.um-cfg-card code { background: var(--um-bg); border: 1px solid var(--um-border); border-radius: 4px; padding: 0 4px; font-size: 11.5px; }

/* ---- details ---- */
.um-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.um-select { border: 1px solid var(--um-border); background: var(--um-bg); color: var(--um-text); border-radius: 8px; height: 28px; font-size: 12.5px; padding: 0 6px; max-width: 200px; }
.um-seg { display: inline-flex; border: 1px solid var(--um-border); border-radius: 8px; overflow: hidden; }
.um-seg button { border: none; background: var(--um-bg); color: var(--um-muted); padding: 4px 10px; font-size: 12px; cursor: pointer; }
.um-seg button.on { background: var(--um-accent); color: #fff; }
.um-total-line { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--um-muted); margin: 2px 0 10px; }
.um-total-line b { color: var(--um-text); font-variant-numeric: tabular-nums; }
.um-chart { border: 1px solid var(--um-border); border-radius: 12px; background: var(--um-bg2); padding: 8px 6px 4px; margin-bottom: 10px; }
.um-chart svg { display: block; width: 100%; height: auto; }
.um-table-wrap { overflow: auto; border: 1px solid var(--um-border); border-radius: 12px; }
table.um-table { border-collapse: collapse; width: 100%; font-size: 12px; }
.um-table th { position: sticky; top: 0; background: var(--um-bg2); text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--um-border); white-space: nowrap; }
.um-table td { padding: 6px 10px; border-bottom: 1px solid rgba(127,135,146,.14); font-variant-numeric: tabular-nums; white-space: nowrap; }
.um-table tr:last-child td { border-bottom: none; }
.um-muted { color: var(--um-muted); }

/* ---- settings ---- */
.um-cfg-card { border: 1px solid var(--um-border); border-radius: 12px; padding: 12px; margin-bottom: 10px; background: var(--um-bg2); }
.um-cfg-card h3 { margin: 0 0 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
.um-cfg-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-size: 12.5px; }
.um-input { border: 1px solid var(--um-border); background: var(--um-bg); color: var(--um-text); border-radius: 8px; height: 28px; padding: 0 8px; font-size: 12.5px; width: 130px; }
.um-input.small { width: 80px; }
.um-input.wide { width: min(340px, 100%); flex: 1; }
.um-check { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.um-actions { display: flex; gap: 8px; margin-top: 10px; }
.um-save { background: var(--um-accent); color: #fff; border: none; border-radius: 8px; padding: 6px 16px; font-size: 12.5px; cursor: pointer; }
.um-save:disabled { opacity: .55; cursor: default; }
.um-saved { color: var(--um-ok); font-size: 12px; display: inline-flex; align-items: center; }
`;

});
define("core/chart", function (module, exports, require) {
"use strict";
/**
 * Tiny pure helpers that turn a series of numbers into SVG polyline data —
 * kept outside React so the geometry is unit-testable without a DOM.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLineGeometry = buildLineGeometry;
exports.buildAreaPath = buildAreaPath;
exports.yTicks = yTicks;
function buildLineGeometry(values, width, height, pad) {
    const count = values.length;
    const innerW = Math.max(width - pad * 2, 1);
    const innerH = Math.max(height - pad * 2, 1);
    const max = values.reduce((m, v) => Math.max(m, Number.isFinite(v) ? v : 0), 0);
    const top = max > 0 ? max : 1;
    const yOf = (value) => pad + innerH - (Math.max(0, value) / top) * innerH;
    const step = count > 1 ? innerW / (count - 1) : 0;
    const parts = [];
    for (let i = 0; i < count; i++) {
        const x = pad + i * step;
        const y = yOf(values[i] ?? 0);
        parts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return {
        points: parts.join(' '),
        zeroY: yOf(0),
        max: top,
        yOf,
    };
}
/** Area fill path (line + down to baseline + close). */
function buildAreaPath(points, zeroY) {
    if (points === '')
        return '';
    const last = points.split(' ').pop() ?? '';
    return `M ${points} L ${last} L 0,0 L 0,${zeroY.toFixed(2)} Z`;
}
/** Pick ~3 nice y-axis tick values between 0 and max. */
function yTicks(max, count = 3) {
    if (max <= 0)
        return [0];
    const rough = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    const step = nice * mag;
    const ticks = [];
    for (let v = 0; v <= max + 1e-9; v += step)
        ticks.push(v);
    if (ticks.length === 0)
        ticks.push(0);
    return ticks;
}

});
define("core/core", function (module, exports, require) {
"use strict";
/**
 * dsh-usage-monitor — shared pure core.
 *
 * This module is intentionally SELF-CONTAINED (zero relative imports) so it can
 * be compiled twice from the same source: once into the Node host bundle
 * (ESM, `src/core/*.ts` imports) and once into the browser client bundle
 * (CJS, extension-less imports). Everything here must stay free of `node:*`
 * and DOM imports.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCY_SYMBOL = exports.pad2 = exports.dayKeyOfMs = exports.dayKeyOf = exports.emptyTotals = exports.DAY_OPTIONS = exports.PROVIDERS = void 0;
exports.canonicalProvider = canonicalProvider;
exports.providerMeta = providerMeta;
exports.normalizeUserToken = normalizeUserToken;
exports.defaultBudgetConfig = defaultBudgetConfig;
exports.defaultConfig = defaultConfig;
exports.normalizeConfig = normalizeConfig;
exports.budgetFor = budgetFor;
exports.evaluateAlert = evaluateAlert;
exports.addToTotals = addToTotals;
exports.dateBefore = dateBefore;
exports.dayKeysBackTo = dayKeysBackTo;
exports.rollDaily = rollDaily;
exports.totalsOf = totalsOf;
exports.rollRows = rollRows;
exports.rollSessionRows = rollSessionRows;
exports.fmtTokens = fmtTokens;
exports.currencySymbol = currencySymbol;
exports.fmtMoney = fmtMoney;
exports.fmtPct = fmtPct;
exports.isRecord = isRecord;
exports.pickNumber = pickNumber;
exports.clamp = clamp;
exports.errorMessage = errorMessage;
exports.PROVIDERS = [
    {
        id: 'deepseek',
        label: 'DeepSeek',
        keyEnv: ['DEEPSEEK_API_KEY'],
        currencyHint: 'CNY',
        note: '官方 GET /user/balance 返回可用余额；用量从 DSH 会话日志统计。',
        docs: 'https://api-docs.deepseek.com/zh-cn/api/get-user-balance',
    },
    {
        id: 'openai',
        label: 'OpenAI',
        keyEnv: ['OPENAI_API_KEY'],
        currencyHint: 'USD',
        note: '官方已停用 credit_grants 余额查询（大多数新账号返回 404/401）；v1/models 仅校验 Key。余额默认不可用。',
        docs: 'https://platform.openai.com/docs/guides/usage',
    },
    {
        id: 'anthropic',
        label: 'Anthropic',
        keyEnv: ['ANTHROPIC_API_KEY'],
        currencyHint: 'USD',
        note: 'API Key 无公开余额/用量接口（组织 Admin API 需独立权限）。v1/models 仅校验 Key。',
        docs: 'https://docs.anthropic.com/en/api/admin-api/usage-costs',
    },
    {
        id: 'zhipu',
        label: '智谱 GLM',
        keyEnv: ['ZHIPUAI_API_KEY', 'GLM_API_KEY', 'ZAI_API_KEY'],
        currencyHint: 'CNY',
        note: '开放平台 GET /api/paas/v4/balance 返回余额；结构随账号类型略有差异，取不到时降级为“不可用”。',
        docs: 'https://open.bigmodel.cn/dev/api/normal-model/glm-4',
    },
    {
        id: 'moonshot',
        label: 'Moonshot / Kimi',
        keyEnv: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
        currencyHint: 'CNY',
        note: 'API 余额查询接口未公开稳定契约（官方文档仅控制台查看）；v1/models 仅校验 Key。',
        docs: 'https://www.kimi.com/en/help/kimi-api/api-balance-and-usage',
    },
    {
        id: 'siliconflow',
        label: 'SiliconFlow',
        keyEnv: ['SILICONFLOW_API_KEY'],
        currencyHint: 'CNY',
        note: 'GET /v1/user/info 返回账户余额（data.totalBalance）。',
        docs: 'https://docs.siliconflow.cn/cn/userguide/account/balance',
    },
];
/**
 * Map a harness runtime provider id onto this plugin's registry id.
 *
 * The harness names providers for the runtime ("deepseek-official",
 * "llama-cpp-qwen3-14b"), while balances, budgets and the pricing table are
 * keyed by the registry id ("deepseek"). Without this mapping every provider
 * card reports 0 usage while the account burns millions of tokens, and no price
 * ever matches. Unknown providers (local models, future ones) pass through
 * unchanged so their usage still appears in the ledger.
 */
function canonicalProvider(id) {
    for (const p of exports.PROVIDERS) {
        if (id === p.id || id.startsWith(`${p.id}-`) || id.startsWith(`${p.id}_`))
            return p.id;
    }
    return id;
}
function providerMeta(id) {
    const meta = exports.PROVIDERS.find((p) => p.id === id);
    if (meta !== undefined)
        return meta;
    // Unknown provider (e.g. a future harness provider) degrades gracefully.
    return {
        id: id,
        label: id,
        keyEnv: [],
        currencyHint: 'USD',
        note: '未收录的 Provider，仅展示日志统计。',
        docs: '',
    };
}
/**
 * Extract the bare token from whatever shape arrived.
 *
 * Tokens are copied out of DevTools, so the field often receives a JSON wrapper
 * (`{"value":"…","__version":"0"}`) or just the trailing fragment
 * (`…","__version":"0"}`). Either one makes the Authorization header invalid
 * (platform code 40003), which looks like an expired login rather than a paste
 * mistake. A real token is a run of base64 characters, so anything the clipboard
 * added falls outside that set.
 */
function normalizeUserToken(raw) {
    const text = raw.trim();
    if (text === '')
        return '';
    const wrapped = /"value"\s*:\s*"([^"]+)"/.exec(text);
    if (wrapped !== null && typeof wrapped[1] === 'string' && wrapped[1] !== '')
        return wrapped[1].trim();
    const run = /[A-Za-z0-9_\-+/=]{16,}/.exec(text);
    if (run !== null)
        return run[0];
    return text.replace(/^Bearer\s+/i, '').trim();
}
exports.DAY_OPTIONS = [7, 30, 90];
function defaultBudgetConfig(provider) {
    return { budget: undefined, warnPct: 5, enabled: true };
}
function defaultConfig() {
    const balances = {};
    for (const p of exports.PROVIDERS)
        balances[p.id] = defaultBudgetConfig(p.id);
    return {
        balances,
        webhooks: [],
        pollMs: 60_000,
        retentionDays: 90,
        envKeys: {},
        pricing: [],
        deepseekPlatform: { enabled: true, historyMonths: 36 },
    };
}
function normalizeConfig(raw) {
    const base = defaultConfig();
    if (raw === null || typeof raw !== 'object')
        return base;
    const src = raw;
    const balancesRaw = isRecord(src.balances) ? src.balances : {};
    for (const p of exports.PROVIDERS) {
        const entry = isRecord(balancesRaw[p.id]) ? balancesRaw[p.id] : {};
        const budget = pickNumber(entry.budget);
        const currency = typeof entry.currency === 'string' && entry.currency !== '' ? entry.currency : undefined;
        const warnPct = pickNumber(entry.warnPct);
        const enabled = typeof entry.enabled === 'boolean' ? entry.enabled : true;
        const balanceUrl = typeof entry.balanceUrl === 'string' && entry.balanceUrl !== '' ? entry.balanceUrl : undefined;
        base.balances[p.id] = {
            budget: budget !== undefined && budget > 0 ? budget : undefined,
            currency,
            warnPct: warnPct === undefined ? 5 : clamp(warnPct, 0.1, 100),
            enabled,
            balanceUrl,
        };
    }
    if (Array.isArray(src.webhooks)) {
        base.webhooks = src.webhooks
            .filter((w) => isRecord(w))
            .map((w) => ({
            url: typeof w.url === 'string' ? w.url : '',
            secret: typeof w.secret === 'string' ? w.secret : undefined,
            cooldownMs: pickNumber(w.cooldownMs),
            enabled: typeof w.enabled === 'boolean' ? w.enabled : true,
        }))
            .filter((w) => w.url !== '');
    }
    const pollMs = pickNumber(src.pollMs);
    if (pollMs !== undefined)
        base.pollMs = clamp(pollMs, 5_000, 3_600_000);
    const retention = pickNumber(src.retentionDays);
    if (retention !== undefined)
        base.retentionDays = clamp(Math.round(retention), 7, 730);
    if (isRecord(src.envKeys)) {
        for (const [k, v] of Object.entries(src.envKeys)) {
            if (typeof v === 'string' && v !== '')
                base.envKeys[k] = v;
        }
    }
    if (Array.isArray(src.pricing)) {
        base.pricing = src.pricing
            .filter((p) => isRecord(p))
            .map((p) => ({
            provider: typeof p.provider === 'string' ? p.provider : '',
            model: typeof p.model === 'string' ? p.model : '',
            priceIn: pickNumber(p.priceIn) ?? 0,
            priceOut: pickNumber(p.priceOut) ?? 0,
        }))
            .filter((p) => p.provider !== '' && p.model !== '' && p.priceIn > 0 && p.priceOut > 0);
    }
    if (isRecord(src.deepseekPlatform)) {
        const plat = src.deepseekPlatform;
        base.deepseekPlatform = {
            enabled: typeof plat.enabled === 'boolean' ? plat.enabled : true,
            historyMonths: clamp(Math.round(pickNumber(plat.historyMonths) ?? 36), 1, 60),
            userToken: (() => {
                if (typeof plat.userToken !== 'string')
                    return undefined;
                const cleaned = normalizeUserToken(plat.userToken);
                return cleaned === '' ? undefined : cleaned;
            })(),
        };
    }
    if (typeof src.storageDir === 'string' && src.storageDir !== '')
        base.storageDir = src.storageDir;
    return base;
}
function budgetFor(config, id, fallbackCurrency) {
    const entry = config.balances[id];
    const amount = entry?.budget !== undefined && entry.budget !== null && entry.budget > 0 ? entry.budget : null;
    const currency = entry?.currency ?? fallbackCurrency;
    const warnPct = entry?.warnPct ?? 5;
    return { amount, currency, warnPct };
}
/**
 * Evaluate the alert level for one provider.
 * - balance known: remaining = balance; remainingPct = balance / budget.
 * - balance unknown but monthly spend estimated and budget set:
 *   remaining ≈ budget − spend (best effort).
 */
function evaluateAlert(args) {
    const { balanceAmount, spendAmount, budget } = args;
    const budgetAmount = budget.amount;
    if (budgetAmount === null) {
        // No user budget: no progress bar, no pct alerts (absolute floor is not
        // supported by design — the budget is the user's own number).
        return { level: 'ok', remainingPct: null };
    }
    if (balanceAmount !== null) {
        const remainingPct = budgetAmount > 0 ? balanceAmount / budgetAmount : 0;
        const level = balanceAmount <= 0 ? 'critical'
            : remainingPct * 100 <= budget.warnPct ? 'warn'
                : 'ok';
        return { level, remainingPct };
    }
    if (spendAmount !== null) {
        // Estimate remaining from budget minus observed spend (only meaningful
        // when the user set a budget as a top-up ceiling).
        const remaining = budgetAmount - spendAmount;
        const remainingPct = budgetAmount > 0 ? remaining / budgetAmount : 0;
        const level = remaining <= 0 ? 'critical'
            : remainingPct * 100 <= budget.warnPct ? 'warn'
                : 'ok';
        return { level, remainingPct };
    }
    return { level: 'ok', remainingPct: null };
}
const emptyTotals = () => ({
    input: 0,
    output: 0,
    cache: 0,
    reasoning: 0,
    total: 0,
    cost: null,
    costCalls: 0,
    calls: 0,
});
exports.emptyTotals = emptyTotals;
function addToTotals(t, input, output, cache, reasoning, cost) {
    t.input += input;
    t.output += output;
    t.cache += cache;
    t.reasoning += reasoning;
    t.total += input + output + cache;
    t.calls += 1;
    if (cost !== null) {
        t.cost = (t.cost ?? 0) + cost;
        t.costCalls += 1;
    }
}
const dayKeyOf = (d) => `${d.getFullYear()}-${(0, exports.pad2)(d.getMonth() + 1)}-${(0, exports.pad2)(d.getDate())}`;
exports.dayKeyOf = dayKeyOf;
const dayKeyOfMs = (ms) => (0, exports.dayKeyOf)(new Date(ms));
exports.dayKeyOfMs = dayKeyOfMs;
function dateBefore(now, days) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
}
function dayKeysBackTo(now, count) {
    const keys = [];
    for (let i = count - 1; i >= 0; i--)
        keys.push((0, exports.dayKeyOf)(dateBefore(now, i)));
    return keys;
}
/**
 * Filter records to the trailing `days` calendar days (inclusive), then fold
 * per-day totals. Cost folding: unknown-model records contribute 0 but are
 * counted separately by the caller when needed.
 */
function rollDaily(records, days, now = new Date()) {
    const first = (0, exports.dayKeyOf)(dateBefore(now, days - 1));
    const last = (0, exports.dayKeyOf)(now);
    const buckets = new Map();
    for (const r of records) {
        const key = (0, exports.dayKeyOfMs)(r.at);
        if (key < first || key > last)
            continue;
        let b = buckets.get(key);
        if (b === undefined) {
            b = (0, exports.emptyTotals)();
            buckets.set(key, b);
        }
        addToTotals(b, r.input, r.output, r.cache, r.reasoning, r.cost);
    }
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const key = (0, exports.dayKeyOf)(dateBefore(now, i));
        const b = buckets.get(key) ?? (0, exports.emptyTotals)();
        out.push({ date: key, input: b.input, output: b.output, cache: b.cache, total: b.total, cost: b.cost, calls: b.calls });
    }
    return out;
}
function totalsOf(records) {
    const t = (0, exports.emptyTotals)();
    for (const r of records)
        addToTotals(t, r.input, r.output, r.cache, r.reasoning, r.cost);
    return t;
}
/**
 * Group day×provider×model rows (details table) over the trailing window.
 * `sessions` = number of distinct sessions contributing to that group.
 */
function rollRows(records, days, now = new Date()) {
    const first = (0, exports.dayKeyOf)(dateBefore(now, days - 1));
    const last = (0, exports.dayKeyOf)(now);
    const map = new Map();
    for (const r of records) {
        const key = (0, exports.dayKeyOfMs)(r.at);
        if (key < first || key > last)
            continue;
        const group = `${key}\u0000${r.provider}\u0000${r.model}`;
        let acc = map.get(group);
        if (acc === undefined) {
            acc = { ...(0, exports.emptyTotals)(), sessions: new Set(), topSession: new Map() };
            map.set(group, acc);
        }
        addToTotals(acc, r.input, r.output, r.cache, r.reasoning, r.cost);
        const eventTotal = r.input + r.output + r.cache;
        acc.sessions.add(r.sessionId);
        acc.topSession.set(r.sessionId, (acc.topSession.get(r.sessionId) ?? 0) + eventTotal);
    }
    const out = [];
    for (const [group, acc] of map) {
        const [date, provider, model] = group.split('\u0000');
        let topSession = '';
        let top = -1;
        for (const [sid, total] of acc.topSession) {
            if (total > top) {
                top = total;
                topSession = sid;
            }
        }
        out.push({
            date: date ?? '',
            provider: provider ?? '',
            model: model ?? '',
            input: acc.input,
            output: acc.output,
            cache: acc.cache,
            total: acc.total,
            cost: acc.cost,
            calls: acc.calls,
            sessions: acc.sessions.size,
            topSession,
        });
    }
    out.sort((a, b) => (a.date === b.date ? b.total - a.total : a.date < b.date ? -1 : 1));
    return out;
}
function rollSessionRows(records, days, now = new Date()) {
    const first = (0, exports.dayKeyOf)(dateBefore(now, days - 1));
    const last = (0, exports.dayKeyOf)(now);
    const map = new Map();
    for (const r of records) {
        const key = (0, exports.dayKeyOfMs)(r.at);
        if (key < first || key > last)
            continue;
        const group = `${key}\u0000${r.sessionId}\u0000${r.provider}\u0000${r.model}`;
        let acc = map.get(group);
        if (acc === undefined) {
            acc = { ...(0, exports.emptyTotals)() };
            map.set(group, acc);
        }
        addToTotals(acc, r.input, r.output, r.cache, r.reasoning, r.cost);
    }
    const out = [];
    const titleBySession = new Map();
    for (const r of records) {
        if (!titleBySession.has(r.sessionId) && r.sessionTitle !== '')
            titleBySession.set(r.sessionId, r.sessionTitle);
    }
    for (const [group, acc] of map) {
        const [date, sessionId, provider, model] = group.split('\u0000');
        out.push({
            date: date ?? '',
            sessionId: sessionId ?? '',
            title: titleBySession.get(sessionId ?? '') ?? `会话 ${(sessionId ?? '').slice(0, 8)}`,
            provider: provider ?? '',
            model: model ?? '',
            input: acc.input,
            output: acc.output,
            cache: acc.cache,
            total: acc.total,
            cost: acc.cost,
            calls: acc.calls,
        });
    }
    out.sort((a, b) => (a.date === b.date ? b.total - a.total : a.date < b.date ? -1 : 1));
    return out;
}
/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */
const pad2 = (n) => (n < 10 ? `0${n}` : String(n));
exports.pad2 = pad2;
function fmtTokens(n) {
    if (!Number.isFinite(n) || n < 0)
        return '—';
    if (n >= 1e9)
        return `${trim(n / 1e9)}B`;
    if (n >= 1e6)
        return `${trim(n / 1e6)}M`;
    if (n >= 1e3)
        return `${trim(n / 1e3)}k`;
    return String(Math.round(n));
}
const trim = (v) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
exports.CURRENCY_SYMBOL = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    JPY: '¥',
};
function currencySymbol(currency) {
    return exports.CURRENCY_SYMBOL[currency] ?? `${currency} `;
}
function fmtMoney(amount, currency, digits = 2) {
    if (amount === null || amount === undefined || !Number.isFinite(amount))
        return '—';
    const abs = Math.abs(amount);
    const d = abs >= 100 ? 0 : abs >= 1 ? digits : 4;
    return `${currencySymbol(currency)}${amount.toFixed(d)}`;
}
function fmtPct(v) {
    if (v === null || !Number.isFinite(v))
        return '—';
    return `${Math.round(v * 1000) / 10}%`;
}
/* ------------------------------------------------------------------ *
 * Small guards
 * ------------------------------------------------------------------ */
function isRecord(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function pickNumber(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
        return Number(v);
    return undefined;
}
function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}
function errorMessage(err) {
    const m = err?.message;
    return typeof m === 'string' && m !== '' ? m : String(err);
}

});
define("core/csv", function (module, exports, require) {
"use strict";
/**
 * Minimal dependency-free CSV writer (pure).
 * Exported rows are always full-width (all columns present) so a UTF-8 BOM is
 * added by default for Excel compatibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCsv = toCsv;
function escapeField(value) {
    if (value === null || value === undefined)
        return '';
    const text = typeof value === 'string' ? value : String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}
function toCsv(rows, columns, bom = true) {
    const head = columns.map((c) => escapeField(c.label)).join(',');
    const body = rows.map((row) => columns.map((c) => escapeField(row[c.key])).join(',')).join('\r\n');
    return `${bom ? '\uFEFF' : ''}${head}\r\n${body}\r\n`;
}

});
define("core/pricing", function (module, exports, require) {
"use strict";
/**
 * Reference pricing table (pure, self-contained).
 *
 * These are PUBLIC list prices in **USD per 1M tokens** used only to turn
 * observed token usage into a rough cost estimate for the table / export /
 * budget rows. They are NOT billing records: provider prices change, plans
 * discount, relays reprice. Every number here is a manually curated
 * approximation with a “参考价” label in the UI; users can override any model
 * through the plugin config (`pricing` overrides) or ignore the cost column.
 *
 * Entries are matched case-insensitively with `model.includes(matcher)`.
 *
 * This module stays dependency-free (both build programs compile it with
 * different relative-import rules), so provider aliasing is done here with a
 * local prefix rule instead of importing the registry: the harness reports
 * runtime ids such as `deepseek-official`, which must still match the `deepseek`
 * rows or no price would ever apply.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_TABLE = void 0;
exports.lookupRate = lookupRate;
exports.estimateCostUsd = estimateCostUsd;
exports.PRICE_TABLE = [
    // DeepSeek — current models, USD / 1M (source: api-docs.deepseek.com/quick_start/pricing).
    // The published rates have an off-peak/peak split (peak = 2× off-peak, peak =
    // 01:00–04:00 and 06:00–10:00 UTC on weekdays); a single-row table cannot
    // express that, so these entries use the midpoint and the column stays a
    // 参考价. The platform sync (platform.deepseek.com) is the real bill.
    // Matcher order matters: the most specific model name must come first.
    ['deepseek', 'deepseek-v4-flash', { input: 0.225, output: 0.9, cacheHit: 0.0045 }],
    ['deepseek', 'deepseek-flash', { input: 0.225, output: 0.9, cacheHit: 0.0045 }],
    ['deepseek', 'deepseek-v4-pro', { input: 0.99, output: 2.97, cacheHit: 0.033 }],
    // Legacy model names still routed to the same models.
    ['deepseek', 'deepseek-chat', { input: 0.27, output: 1.1, cacheHit: 0.07 }],
    ['deepseek', 'deepseek-reasoner', { input: 0.55, output: 2.19, cacheHit: 0.14 }],
    // OpenAI
    ['openai', 'gpt-4o-mini', { input: 0.15, output: 0.6, cacheHit: 0.075 }],
    ['openai', 'gpt-4o', { input: 2.5, output: 10, cacheHit: 1.25 }],
    ['openai', 'gpt-4.1-mini', { input: 0.4, output: 1.6, cacheHit: 0.2 }],
    ['openai', 'gpt-4.1-nano', { input: 0.1, output: 0.4, cacheHit: 0.05 }],
    ['openai', 'gpt-4.1', { input: 2, output: 8, cacheHit: 1 }],
    ['openai', 'o4-mini', { input: 1.1, output: 4.4, cacheHit: 0.55 }],
    ['openai', 'o3-mini', { input: 1.1, output: 4.4, cacheHit: 0.55 }],
    ['openai', 'o3', { input: 2, output: 8, cacheHit: 1 }],
    ['openai', 'o1-mini', { input: 1.1, output: 4.4, cacheHit: 0.55 }],
    ['openai', 'o1', { input: 15, output: 60, cacheHit: 7.5 }],
    // Anthropic
    ['anthropic', 'claude-opus', { input: 15, output: 75, cacheHit: 1.5 }],
    ['anthropic', 'claude-sonnet', { input: 3, output: 15, cacheHit: 0.3 }],
    ['anthropic', 'claude-haiku', { input: 0.8, output: 4, cacheHit: 0.08 }],
    // Moonshot / Kimi
    ['moonshot', 'kimi-k2', { input: 0.6, output: 2.5 }],
    ['moonshot', 'kimi-latest', { input: 0.6, output: 2.5 }],
    ['moonshot', 'moonshot-v1-128k', { input: 0.9, output: 2.4 }],
    ['moonshot', 'moonshot-v1-32k', { input: 0.6, output: 2.5 }],
    ['moonshot', 'moonshot-v1-8k', { input: 0.3, output: 0.6 }],
    // 智谱 GLM 与 SiliconFlow 未内置：价格随渠道/促销浮动，成本列显示 —
    // 可通过设置里的定价覆盖补充。
];
/** Matcher strings that should never hit (safety for prefix matches like `o1`). */
const EXACT_ONLY = new Set(['o1', 'o3', 'o4-mini', 'o3-mini', 'o1-mini']);
/** Provider ids match across the runtime/registry boundary ("deepseek" ↔ "deepseek-official"). */
const sameProvider = (a, b) => a === b || a.startsWith(`${b}-`) || b.startsWith(`${a}-`);
function lookupRate(provider, model, overrides = []) {
    const lower = model.toLowerCase();
    for (const o of overrides) {
        if (sameProvider(o.provider, provider) && lower.includes(o.model.toLowerCase())) {
            return { input: o.priceIn, output: o.priceOut };
        }
    }
    for (const [prov, matcher, rate] of exports.PRICE_TABLE) {
        if (!sameProvider(prov, provider))
            continue;
        const m = matcher.toLowerCase();
        if (EXACT_ONLY.has(matcher)) {
            if (lower === m)
                return rate;
        }
        else if (lower.includes(m)) {
            return rate;
        }
    }
    return undefined;
}
/** Estimated USD cost for one usage record, or null when no rate is known. */
function estimateCostUsd(provider, model, input, cache, output, overrides = []) {
    const rate = lookupRate(provider, model, overrides);
    if (rate === undefined)
        return null;
    const cacheRate = rate.cacheHit ?? rate.input;
    return (input * rate.input + cache * cacheRate + output * rate.output) / 1e6;
}

});

return __load("client/index");
} });
