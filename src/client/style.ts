/**
 * One stylesheet for the whole plugin. The module loader claims and removes
 * `<style data-plugin="…">` tags on unload, so the client entry only appends.
 * Colors follow the app's light/dark preference via `prefers-color-scheme`
 * and CSS variables with neutral fallbacks.
 */
export const css = `
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
`
