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
import { css } from './style'
import { Chip, Hub, Trigger } from './components'
import { startBackgroundPoll } from './store'

/** Plugin identity for the client bundle id (same as the host row). */
export const name = 'dsh-usage-monitor'

/** Services required before apply. */
export const inject = ['slots']

type Disposer = () => void

interface SlotsFace {
  inject(key: string, callback: () => Disposer): Disposer
  register(registration: Record<string, unknown>, render: (props: unknown) => unknown): Disposer
}

interface ClientCtx {
  slots?: SlotsFace
  effect?(fn: (() => void | Disposer) | (() => Promise<void>), label?: string): unknown
}

export function apply(ctx: ClientCtx): void {
  // One stylesheet for the whole plugin; the module loader claims and removes
  // `<style data-plugin="…">` tags on unload (mirrors ecosystem plugins).
  if (typeof document !== 'undefined') {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-usage-monitor'
    tag.textContent = css
    document.head.appendChild(tag)
  }

  if (ctx.effect !== undefined) {
    ctx.effect(startBackgroundPoll, 'dsh-usage-monitor: background poll')
  } else {
    startBackgroundPoll()
  }

  const slots = ctx.slots
  if (slots === undefined) return

  if (ctx.effect !== undefined) {
    ctx.effect(
      () => slots.inject('conversation.session.header.utilities', () =>
        slots.register(
          { name: 'conversation.session.header.utilities', id: 'dsh-usage-monitor-chip', order: 1500, label: '余额' },
          () => <Chip />,
        )),
      'dsh-usage-monitor: header chip',
    )
    ctx.effect(
      () => slots.inject('sidebar.footer.action', () =>
        slots.register(
          { name: 'sidebar.footer.action', id: 'dsh-usage-monitor-trigger', order: 900, label: '用量监控' },
          () => <Trigger />,
        )),
      'dsh-usage-monitor: sidebar trigger',
    )
    ctx.effect(
      () => slots.inject('shell.overlay', () =>
        slots.register(
          { name: 'shell.overlay', id: 'dsh-usage-monitor-hub', order: 2000, label: '用量监控' },
          () => <Hub />,
        )),
      'dsh-usage-monitor: overlay hub',
    )
  } else {
    slots.inject('conversation.session.header.utilities', () =>
      slots.register({ name: 'conversation.session.header.utilities', id: 'dsh-usage-monitor-chip', order: 1500, label: '余额' }, () => <Chip />))
    slots.inject('sidebar.footer.action', () =>
      slots.register({ name: 'sidebar.footer.action', id: 'dsh-usage-monitor-trigger', order: 900, label: '用量监控' }, () => <Trigger />))
    slots.inject('shell.overlay', () =>
      slots.register({ name: 'shell.overlay', id: 'dsh-usage-monitor-hub', order: 2000, label: '用量监控' }, () => <Hub />))
  }
}
