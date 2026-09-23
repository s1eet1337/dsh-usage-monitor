import { createHmac } from 'node:crypto';
/**
 * Host-side alert router.
 *
 * Watches provider alert levels between overview refreshes and fires enabled
 * webhooks when a provider ENTERS `warn`/`critical` (or escalates
 * `warn → critical`). Continuous alerts do not re-fire on every poll — only on
 * level changes. Best-effort: a failed webhook is logged, never fatal.
 */
export class AlertNotifier {
    config;
    now;
    last = new Map();
    cooldownUntil = new Map();
    constructor(config, now = Date.now) {
        this.config = config;
        this.now = now;
    }
    process(providers) {
        const cfg = this.config();
        const now = this.now();
        for (const view of providers) {
            const level = view.alert ?? 'ok';
            const previous = this.last.get(view.provider) ?? 'ok';
            this.last.set(view.provider, level);
            if (level === 'ok' || level === previous)
                continue;
            // Fired only when entering alerting or escalating. The cooldown is keyed
            // per hook (not per provider) so each configured webhook honours its own
            // `cooldownMs` — that field used to be silently ignored.
            const payload = buildAlertPayload(view, level, now);
            for (const hook of cfg.webhooks) {
                if (hook.enabled === false || hook.url === '')
                    continue;
                const key = `${view.provider}\u0000${hook.url}`;
                const until = this.cooldownUntil.get(key) ?? 0;
                if (now < until)
                    continue;
                this.cooldownUntil.set(key, now + cooldownOf(hook.cooldownMs));
                void this.dispatch(hook.url, hook.secret, payload).catch((err) => {
                    console.warn('[dsh-usage-monitor] webhook 推送失败:', err instanceof Error ? err.message : String(err));
                });
            }
        }
    }
    async dispatch(url, secret, payload) {
        const body = JSON.stringify(payload);
        const headers = { 'content-type': 'application/json' };
        if (secret !== undefined && secret !== '') {
            headers['x-dsh-usage-monitor-signature'] = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
            await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
        }
        finally {
            clearTimeout(timer);
        }
    }
}
/** Per-hook cooldown, defaulting to 1h and clamped to a sane band. */
const cooldownOf = (configured) => typeof configured === 'number' && Number.isFinite(configured)
    ? Math.min(86_400_000, Math.max(1_000, configured))
    : 3_600_000;
function buildAlertPayload(view, level, at) {
    const balance = view.balance?.supported === true && Number.isFinite(view.balance.amount)
        ? { amount: view.balance.amount, currency: view.balance.currency }
        : null;
    const budget = view.budget
        ? { amount: view.budget.amount, currency: view.budget.currency, warnPct: view.budget.warnPct }
        : null;
    const message = level === 'critical'
        ? `${view.label} 余额已耗尽或跌破预算下限`
        : `${view.label} 余额低于预算的 ${view.budget?.warnPct ?? 5}%（剩余 ${view.remainingPct !== null ? Math.round(view.remainingPct * 100) : '?'}%）`;
    return { event: 'balance-low', provider: view.provider, label: view.label, level, at, balance, budget, remainingPct: view.remainingPct, message };
}
