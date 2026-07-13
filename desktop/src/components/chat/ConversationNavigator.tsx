import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Paperclip } from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { UIMessage } from '../../types/chat'

export type ConversationNavigationSource = {
  message: UIMessage
  renderItemKey: string
  renderIndex: number
}

export type ConversationNavigationItem = {
  id: string
  renderItemKey: string
  renderIndex: number
  role: 'user' | 'assistant'
  preview: string
  attachmentCount: number
}

export type ConversationNavigationMode = 'full' | 'compact' | 'edge'

const NAVIGATION_MODE_STYLES: Record<ConversationNavigationMode, {
  position: string
  lane: string
  button: string
  marker: string
}> = {
  full: {
    position: 'left-2',
    lane: 'w-10',
    button: 'w-10 pl-1.5',
    marker: 'w-3 group-hover:w-5 group-focus-visible:w-5',
  },
  compact: {
    position: 'left-1',
    lane: 'w-7',
    button: 'w-7 pl-1',
    marker: 'w-2.5 group-hover:w-4 group-focus-visible:w-4',
  },
  edge: {
    position: 'left-0',
    lane: 'w-5',
    button: 'w-5 pl-0.5',
    marker: 'w-1.5 group-hover:w-3 group-focus-visible:w-3',
  },
}

function normalizePreview(content: string) {
  const normalized = content.slice(0, 2_000)
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/```[a-z0-9_-]*\s*/gi, ' ')
    .replace(/```/g, ' ')
    .replace(/[`*_>#~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (normalized.length <= 280) return normalized
  return `${normalized.slice(0, 279).trimEnd()}…`
}

export function buildConversationNavigationItems(
  sources: ConversationNavigationSource[],
): ConversationNavigationItem[] {
  return sources.flatMap(({ message, renderItemKey, renderIndex }) => {
    if (message.type !== 'user_text' && message.type !== 'assistant_text') return []
    const preview = normalizePreview(message.content)
    if (!preview) return []

    return [{
      id: message.id,
      renderItemKey,
      renderIndex,
      role: message.type === 'user_text' ? 'user' : 'assistant',
      preview,
      attachmentCount: message.type === 'user_text' ? message.attachments?.length ?? 0 : 0,
    }]
  })
}

export function ConversationNavigator({
  mode,
  items,
  activeItemId,
  onNavigate,
}: {
  mode: ConversationNavigationMode
  items: ConversationNavigationItem[]
  activeItemId: string | null
  onNavigate: (item: ConversationNavigationItem) => void
}) {
  const t = useTranslation()
  const [previewItemId, setPreviewItemId] = useState<string | null>(null)
  const [previewPosition, setPreviewPosition] = useState({ left: 0, top: 0 })
  const markerRefs = useRef(new Map<string, HTMLButtonElement>())
  const previewItem = items.find((item) => item.id === previewItemId) ?? null
  const modeStyles = NAVIGATION_MODE_STYLES[mode]

  const openPreview = (itemId: string, marker: HTMLButtonElement) => {
    const rect = marker.getBoundingClientRect()
    setPreviewPosition({
      left: rect.right + 6,
      top: Math.min(window.innerHeight - 88, Math.max(88, rect.top + rect.height / 2)),
    })
    setPreviewItemId(itemId)
  }

  useEffect(() => {
    if (!activeItemId) return
    markerRefs.current.get(activeItemId)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeItemId])

  return (
    <nav
      data-testid="conversation-navigator"
      data-mode={mode}
      aria-label={t('chat.conversationNavigator.label')}
      className={`absolute top-1/2 z-30 flex max-h-[64%] -translate-y-1/2 flex-col overflow-visible ${modeStyles.position}`}
    >
      <div className={`conversation-navigation-scroll flex max-h-full flex-col items-start gap-0.5 overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${modeStyles.lane}`}>
        {items.map((item) => {
          const roleLabel = item.role === 'user'
            ? t('chat.userMessageReference')
            : t('chat.assistantMessageReference')
          const isActive = item.id === activeItemId

          return (
            <div key={item.id} className="relative flex shrink-0 items-center">
              <button
                ref={(node) => {
                  if (node) markerRefs.current.set(item.id, node)
                  else markerRefs.current.delete(item.id)
                }}
                type="button"
                data-role={item.role}
                aria-label={`${roleLabel}: ${item.preview}`}
                aria-current={isActive ? 'location' : undefined}
                aria-describedby={previewItemId === item.id ? 'conversation-navigation-preview' : undefined}
                onMouseEnter={(event) => openPreview(item.id, event.currentTarget)}
                onMouseLeave={(event) => {
                  if (document.activeElement !== event.currentTarget) setPreviewItemId(null)
                }}
                onFocus={(event) => openPreview(item.id, event.currentTarget)}
                onBlur={() => setPreviewItemId(null)}
                onClick={() => onNavigate(item)}
                className={`group flex h-4 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/35 ${modeStyles.button}`}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'block h-0.5 rounded-full transition-[width,background-color,opacity] duration-200 ease-out motion-reduce:transition-none',
                    modeStyles.marker,
                    isActive
                      ? 'bg-[var(--color-brand)] opacity-100'
                      : item.role === 'user'
                        ? 'bg-[var(--color-text-secondary)] opacity-75 group-hover:bg-[var(--color-text-primary)] group-hover:opacity-100 group-focus-visible:bg-[var(--color-text-primary)] group-focus-visible:opacity-100'
                        : 'bg-[var(--color-outline)] opacity-65 group-hover:bg-[var(--color-text-secondary)] group-hover:opacity-100 group-focus-visible:bg-[var(--color-text-secondary)] group-focus-visible:opacity-100',
                  ].join(' ')}
                />
              </button>

            </div>
          )
        })}
      </div>
      {previewItem ? createPortal(
        <div
          id="conversation-navigation-preview"
          data-testid="conversation-navigation-preview"
          role="tooltip"
          className="fixed z-50 w-[min(320px,calc(100vw-88px))] -translate-y-1/2 rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface-container-lowest)] px-3.5 py-3 text-left shadow-[var(--shadow-dropdown)]"
          style={{ left: previewPosition.left, top: previewPosition.top }}
        >
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
            {previewItem.role === 'user' ? t('chat.userMessageReference') : t('chat.assistantMessageReference')}
          </div>
          <p className="line-clamp-3 text-[13px] leading-5 text-[var(--color-text-primary)]">
            {previewItem.preview}
          </p>
          {previewItem.attachmentCount > 0 ? (
            <div
              aria-label={t('chat.conversationNavigator.attachments', { count: previewItem.attachmentCount })}
              className="mt-2 flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]"
            >
              <Paperclip size={12} strokeWidth={2} aria-hidden="true" />
              <span>{previewItem.attachmentCount}</span>
            </div>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </nav>
  )
}
