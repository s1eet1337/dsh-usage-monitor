import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { defaultConfig, normalizeConfig, isRecord } from '../core/core.ts'
import type { MonitorConfig } from '../core/core.ts'

/** Default plugin state dir: $DSH_HOME/storages/dsh-usage-monitor (CLI: ~/.dsh/…). */
export function defaultStorageDir(storageDirOverride?: string): string {
  if (storageDirOverride !== undefined && storageDirOverride !== '') return storageDirOverride
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh')
  return join(home, 'storages', 'dsh-usage-monitor')
}

/**
 * Config persisted to `<storageDir>/config.json`.
 *
 * Precedence: row config (cordis.patch.yml) seeds the file the first time;
 * afterwards the file (written by the Settings UI / the config API) is the
 * source of truth. Writes are serialised and atomic (tmp + rename).
 */
export class ConfigStore {
  private readonly file: string
  private config: MonitorConfig
  private queue: Promise<void> = Promise.resolve()

  constructor(storageDir: string, rowConfig: unknown) {
    this.file = join(storageDir, 'config.json')
    let base = normalizeConfig(rowConfig)
    try {
      if (existsSync(this.file)) {
        const raw: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
        base = normalizeConfig(raw)
      }
    } catch {
      // unreadable/corrupt config → fall back to row/default config
    }
    this.config = base
    this.scheduleSave()
  }

  get filePath(): string {
    return this.file
  }

  get(): MonitorConfig {
    return this.config
  }

  /** Merge a partial patch (already validated shape-wise by normalizeConfig). */
  update(patch: unknown): MonitorConfig {
    if (!isRecord(patch)) return this.config
    const raw: Record<string, unknown> = { ...this.config, ...patch }
    // Webhook secrets never leave the host (the API redacts them to '').
    // A client round-trip that sends `secret: ''`/omits it must therefore
    // KEEP the stored secret for the same URL instead of clearing it.
    // Same rule for the DeepSeek platform token: it never leaves the host, so a
    // client round-trip that sends ''/omits it must KEEP the stored value.
    if (isRecord(patch.deepseekPlatform)) {
      const incoming = patch.deepseekPlatform
      const sent = incoming.userToken
      const stored = this.config.deepseekPlatform.userToken
      if ((sent === undefined || sent === '') && stored !== undefined && stored !== '') {
        raw.deepseekPlatform = { ...incoming, userToken: stored }
      }
    }
    if (Array.isArray(patch.webhooks)) {
      const merged = patch.webhooks.map((hook) => {
        if (!isRecord(hook)) return hook
        const url = typeof hook.url === 'string' ? hook.url : ''
        const wantsClear = hook.secret === undefined || hook.secret === ''
        const existing = this.config.webhooks.find((w) => w.url === url)
        if (wantsClear && existing?.secret !== undefined && existing.secret !== '') {
          return { ...hook, secret: existing.secret }
        }
        return hook
      })
      raw.webhooks = merged
    }
    this.config = normalizeConfig(raw)
    this.scheduleSave()
    return this.config
  }

  private scheduleSave(): void {
    this.queue = this.queue.then(async () => {
      try {
        await mkdir(join(this.file, '..'), { recursive: true })
        const tmp = `${this.file}.tmp`
        await writeFile(tmp, JSON.stringify(this.config, null, 2), 'utf8')
        await rename(tmp, this.file)
      } catch (err) {
        console.warn('[dsh-usage-monitor] 保存配置失败:', err instanceof Error ? err.message : String(err))
      }
    })
  }

  flush(): Promise<void> {
    return this.queue
  }
}

export function cloneDefaultConfig(): MonitorConfig {
  return defaultConfig()
}
