import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../../stores/settingsStore'
import type { UIMessage } from '../../types/chat'
import {
  buildConversationNavigationItems,
  ConversationNavigator,
  type ConversationNavigationSource,
} from './ConversationNavigator'

function source(message: UIMessage, renderIndex: number): ConversationNavigationSource {
  return {
    message,
    renderIndex,
    renderItemKey: message.id,
  }
}

describe('buildConversationNavigationItems', () => {
  it('keeps only visible user and assistant messages in transcript order', () => {
    const items = buildConversationNavigationItems([
      source({ id: 'user-1', type: 'user_text', content: '  Review   the API  ', timestamp: 1 }, 0),
      source({ id: 'thinking-1', type: 'thinking', content: 'hidden', timestamp: 2 }, 1),
      source({ id: 'assistant-empty', type: 'assistant_text', content: '  ', timestamp: 3 }, 2),
      source({ id: 'assistant-1', type: 'assistant_text', content: '**API** review complete', timestamp: 4 }, 3),
      source({ id: 'system-1', type: 'system', content: 'hidden', timestamp: 5 }, 4),
    ])

    expect(items).toEqual([
      {
        id: 'user-1',
        renderItemKey: 'user-1',
        renderIndex: 0,
        role: 'user',
        preview: 'Review the API',
        attachmentCount: 0,
      },
      {
        id: 'assistant-1',
        renderItemKey: 'assistant-1',
        renderIndex: 3,
        role: 'assistant',
        preview: 'API review complete',
        attachmentCount: 0,
      },
    ])
  })

  it('counts user attachments and flattens markdown into preview text', () => {
    const items = buildConversationNavigationItems([
      source({
        id: 'user-files',
        type: 'user_text',
        content: '> Please inspect [`MessageList`](https://example.com)\n\n```ts\nconst ready = true\n```',
        timestamp: 1,
        attachments: [
          { type: 'file', name: 'one.ts', mimeType: 'text/plain' },
          { type: 'file', name: 'two.ts', mimeType: 'text/plain' },
        ],
      }, 0),
    ])

    expect(items[0]).toMatchObject({
      preview: 'Please inspect MessageList const ready = true',
      attachmentCount: 2,
    })
  })

  it('bounds previews for very long messages', () => {
    const items = buildConversationNavigationItems([
      source({ id: 'long', type: 'assistant_text', content: 'long answer '.repeat(200), timestamp: 1 }, 0),
    ])

    expect(items[0]?.preview.length).toBeLessThanOrEqual(280)
    expect(items[0]?.preview.endsWith('…')).toBe(true)
  })
})

describe('ConversationNavigator', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' })
  })

  it('renders ordered role markers and identifies the active target', () => {
    render(
      <ConversationNavigator
        mode="full"
        items={[
          { id: 'user-1', renderItemKey: 'user-1', renderIndex: 0, role: 'user', preview: 'First prompt', attachmentCount: 0 },
          { id: 'assistant-1', renderItemKey: 'assistant-1', renderIndex: 1, role: 'assistant', preview: 'First answer', attachmentCount: 0 },
        ]}
        activeItemId="assistant-1"
        onNavigate={vi.fn()}
      />,
    )

    const markers = screen.getAllByRole('button')
    expect(markers.map((marker) => marker.getAttribute('data-role'))).toEqual(['user', 'assistant'])
    expect(markers[0]?.getAttribute('aria-current')).toBeNull()
    expect(markers[1]?.getAttribute('aria-current')).toBe('location')

    const markerBars = markers.map((marker) => marker.querySelector('[aria-hidden="true"]'))
    expect(screen.getByTestId('conversation-navigator').getAttribute('data-mode')).toBe('full')
    expect(markerBars.every((bar) => bar?.className.includes('w-3'))).toBe(true)
    expect(markerBars.every((bar) => bar?.className.includes('group-hover:w-5'))).toBe(true)
    expect(markerBars.every((bar) => bar?.className.includes('group-focus-visible:w-5'))).toBe(true)
    expect(markerBars[1]?.className).toContain('bg-[var(--color-brand)]')
    expect(markerBars[1]?.className.split(/\s+/)).not.toContain('w-5')
  })

  it('uses equal shorter marker geometry in compact mode', () => {
    render(
      <ConversationNavigator
        mode="compact"
        items={[
          { id: 'user-1', renderItemKey: 'user-1', renderIndex: 0, role: 'user', preview: 'First prompt', attachmentCount: 0 },
          { id: 'assistant-1', renderItemKey: 'assistant-1', renderIndex: 1, role: 'assistant', preview: 'First answer', attachmentCount: 0 },
        ]}
        activeItemId="user-1"
        onNavigate={vi.fn()}
      />,
    )

    const markers = screen.getAllByRole('button')
    const markerBars = markers.map((marker) => marker.querySelector('[aria-hidden="true"]'))
    expect(screen.getByTestId('conversation-navigator').getAttribute('data-mode')).toBe('compact')
    expect(markerBars.every((bar) => bar?.className.includes('w-2.5'))).toBe(true)
    expect(markerBars.every((bar) => bar?.className.includes('group-hover:w-4'))).toBe(true)
    expect(markerBars.every((bar) => bar?.className.includes('motion-reduce:transition-none'))).toBe(true)
  })

  it('uses an edge-sized lane when the transcript becomes narrow', () => {
    render(
      <ConversationNavigator
        mode="edge"
        items={[
          { id: 'user-1', renderItemKey: 'user-1', renderIndex: 0, role: 'user', preview: 'First prompt', attachmentCount: 0 },
          { id: 'assistant-1', renderItemKey: 'assistant-1', renderIndex: 1, role: 'assistant', preview: 'First answer', attachmentCount: 0 },
        ]}
        activeItemId="assistant-1"
        onNavigate={vi.fn()}
      />,
    )

    const markers = screen.getAllByRole('button')
    const markerBars = markers.map((marker) => marker.querySelector('[aria-hidden="true"]'))
    expect(screen.getByTestId('conversation-navigator').getAttribute('data-mode')).toBe('edge')
    expect(markerBars.every((bar) => bar?.className.includes('w-1.5'))).toBe(true)
    expect(markerBars.every((bar) => bar?.className.includes('group-hover:w-3'))).toBe(true)
  })

  it('shows the preview on hover or focus and navigates on click', () => {
    const onNavigate = vi.fn()
    const item = {
      id: 'user-1',
      renderItemKey: 'user-1',
      renderIndex: 0,
      role: 'user' as const,
      preview: 'Inspect the virtual transcript',
      attachmentCount: 2,
    }
    render(
      <ConversationNavigator
        mode="full"
        items={[item]}
        activeItemId="user-1"
        onNavigate={onNavigate}
      />,
    )

    const marker = screen.getByRole('button', { name: /User message.*Inspect the virtual transcript/ })
    expect(screen.queryByTestId('conversation-navigation-preview')).toBeNull()

    fireEvent.mouseEnter(marker)
    const preview = screen.getByTestId('conversation-navigation-preview')
    expect(preview.parentElement).toBe(document.body)
    expect(preview.textContent).toContain('User message')
    expect(preview.textContent).toContain('Inspect the virtual transcript')
    expect(preview.textContent).toContain('2')

    fireEvent.mouseLeave(marker)
    fireEvent.focus(marker)
    expect(screen.getByTestId('conversation-navigation-preview')).toBeTruthy()

    fireEvent.click(marker)
    expect(onNavigate).toHaveBeenCalledWith(item)
  })
})
