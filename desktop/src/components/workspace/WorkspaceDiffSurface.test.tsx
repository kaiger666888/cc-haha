import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../../stores/settingsStore'
import { WorkspaceDiffSurface } from './WorkspaceDiffSurface'
import {
  WORKSPACE_PLAIN_TEXT_LINE_THRESHOLD,
  WORKSPACE_PREVIEW_LINE_LIMIT,
  WorkspaceDiffSurface as ExportedWorkspaceDiffSurface,
} from './WorkspaceCodeSurface'

const highlightRenderSpy = vi.hoisted(() => vi.fn())

vi.mock('prism-react-renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prism-react-renderer')>()
  return {
    ...actual,
    Highlight: (props: ComponentProps<typeof actual.Highlight>) => {
      highlightRenderSpy()
      return <actual.Highlight {...props} />
    },
  }
})

const diff = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -10,2 +10,3 @@',
  ' const a = 1',
  '-const b = 2',
  '+const b = 3',
  '+const c = 4',
  '@@ -20 +21 @@',
  '-old tail',
  '+new tail',
].join('\n')

function getCodeRow(text: string) {
  const row = document.querySelector(`[data-row-text="${text}"]`)
  expect(row).not.toBeNull()
  return row!
}

describe('WorkspaceDiffSurface', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' })
    highlightRenderSpy.mockClear()
  })

  it('submits a forward range with its source coordinates and quote', () => {
    const onAddComment = vi.fn()
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" onAddComment={onAddComment} />)

    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' }))
    expect(screen.getByRole('textbox', { name: 'Review comment' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 12' }), { shiftKey: true })
    expect(screen.getByText('new L11-L12')).toBeInTheDocument()
    const rangeEndRow = getCodeRow('const c = 4').closest('[data-diff-row-id]')
    const editorContainer = screen.getByRole('textbox', { name: 'Review comment' }).closest('[data-diff-editor]')
    expect(rangeEndRow?.nextElementSibling).toBe(editorContainer)
    expect(getCodeRow('const b = 3')).toHaveAttribute('data-selected', 'true')
    expect(getCodeRow('const c = 4')).toHaveAttribute('data-selected', 'true')

    const editor = screen.getByRole('textbox', { name: 'Review comment' })
    fireEvent.change(editor, { target: { value: 'Use a shared helper' } })
    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true })

    expect(onAddComment).toHaveBeenCalledWith(expect.objectContaining({
      side: 'new',
      lineStart: 11,
      lineEnd: 12,
      quote: 'const b = 3\nconst c = 4',
      hunkId: 'file-0-hunk-0',
    }), 'Use a shared helper')
  })

  it('normalizes reverse Shift selection', () => {
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)

    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 12' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' }), { shiftKey: true })

    expect(screen.getByText('new L11-L12')).toBeInTheDocument()
    expect(getCodeRow('const b = 3')).toHaveAttribute('data-selected', 'true')
    expect(getCodeRow('const c = 4')).toHaveAttribute('data-selected', 'true')
  })

  it('does not submit an empty review comment', () => {
    const onAddComment = vi.fn()
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" onAddComment={onAddComment} />)

    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' }))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Review comment' }), { key: 'Enter', ctrlKey: true })

    expect(onAddComment).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Review comment' })).toBeInTheDocument()
  })

  it('closes on Escape and restores focus to the anchor gutter button', () => {
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)
    const anchor = screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' })

    fireEvent.click(anchor)
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Review comment' }), { key: 'Escape' })

    expect(screen.queryByRole('textbox', { name: 'Review comment' })).not.toBeInTheDocument()
    expect(anchor).toHaveFocus()
  })

  it('resets an incompatible Shift range and announces why', () => {
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)

    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts old line 20' }), { shiftKey: true })

    expect(screen.getByText('Selection reset: choose lines from the same side and hunk.')).toBeInTheDocument()
    expect(screen.getByText('old L20')).toBeInTheDocument()
  })

  it('uses one roving tab stop and supports Arrow, Home, End, and activation keys', () => {
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)
    const buttons = screen.getAllByRole('button', { name: /Comment on src\/a\.ts/ })
    const firstButton = buttons[0]!
    const secondButton = buttons[1]!

    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1)
    act(() => firstButton.focus())
    fireEvent.keyDown(firstButton, { key: 'ArrowDown' })
    expect(secondButton).toHaveFocus()
    expect(secondButton).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(secondButton, { key: 'End' })
    expect(buttons.at(-1)).toHaveFocus()
    fireEvent.keyDown(buttons.at(-1)!, { key: 'Home' })
    expect(firstButton).toHaveFocus()
    fireEvent.keyDown(firstButton, { key: ' ' })
    expect(screen.getByRole('textbox', { name: 'Review comment' })).toHaveFocus()
  })

  it('keeps Shift+Home selection inside the current side and hunk', () => {
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)
    const line10 = screen.getByRole('button', { name: 'Comment on src/a.ts new line 10' })
    const line11 = screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' })

    act(() => line11.focus())
    fireEvent.keyDown(line11, { key: 'Home', shiftKey: true })

    expect(line10).toHaveFocus()
    expect(screen.getByText('new L10-L11')).toBeInTheDocument()
    expect(getCodeRow('const a = 1')).toHaveAttribute('data-selected', 'true')
    expect(getCodeRow('const b = 3')).toHaveAttribute('data-selected', 'true')
  })

  it('extends the range with Shift+Arrow and returns focus after submit', () => {
    const onAddComment = vi.fn()
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" onAddComment={onAddComment} />)
    const anchor = screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' })

    act(() => anchor.focus())
    fireEvent.keyDown(anchor, { key: 'ArrowDown', shiftKey: true })
    expect(screen.getByText('new L11-L12')).toBeInTheDocument()

    const editor = screen.getByRole('textbox', { name: 'Review comment' })
    fireEvent.change(editor, { target: { value: 'Keep this focused' } })
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true })
    expect(onAddComment).toHaveBeenCalledOnce()
    expect(anchor).toHaveFocus()
  })

  it('skips incompatible rows when extending with Shift+Arrow', () => {
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)
    const anchor = screen.getByRole('button', { name: 'Comment on src/a.ts new line 10' })

    act(() => anchor.focus())
    fireEvent.keyDown(anchor, { key: 'ArrowDown', shiftKey: true })

    expect(screen.getByText('new L10-L11')).toBeInTheDocument()
    expect(getCodeRow('const a = 1')).toHaveAttribute('data-selected', 'true')
    expect(getCodeRow('const b = 3')).toHaveAttribute('data-selected', 'true')
  })

  it('keeps gutter focus for repeatable Shift+Arrow extension and shrinking', () => {
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)
    const line10 = screen.getByRole('button', { name: 'Comment on src/a.ts new line 10' })
    const line11 = screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' })
    const line12 = screen.getByRole('button', { name: 'Comment on src/a.ts new line 12' })

    act(() => line10.focus())
    fireEvent.keyDown(line10, { key: 'ArrowDown', shiftKey: true })
    expect(line11).toHaveFocus()
    fireEvent.keyDown(line11, { key: 'ArrowDown', shiftKey: true })
    expect(line12).toHaveFocus()
    expect(screen.getByText('new L10-L12')).toBeInTheDocument()

    fireEvent.keyDown(line12, { key: 'ArrowUp', shiftKey: true })
    expect(line11).toHaveFocus()
    expect(screen.getByText('new L10-L11')).toBeInTheDocument()
  })

  it('keeps roving navigation on mounted rows when the preview is truncated', () => {
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" lineLimit={5} />)
    const visibleButtons = screen.getAllByRole('button', { name: /Comment on src\/a\.ts/ })
    const lastVisibleButton = visibleButtons.at(-1)!

    act(() => lastVisibleButton.focus())
    fireEvent.keyDown(lastVisibleButton, { key: 'ArrowDown' })

    expect(lastVisibleButton).toHaveFocus()
    expect(visibleButtons.filter((button) => button.tabIndex === 0)).toHaveLength(1)
    expect(screen.getByText('Showing first 5 of 11 loaded lines.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show all loaded lines' })).toBeInTheDocument()
  })

  it('invalidates a hidden selection on collapse while preserving its draft and visible roving target', () => {
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" lineLimit={5} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show all loaded lines' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Review comment' }), {
      target: { value: 'Keep this collapsed draft' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse preview' }))

    expect(screen.queryByRole('textbox', { name: 'Review comment' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Select visible lines again')
    const visibleButtons = screen.getAllByRole('button', { name: /Comment on src\/a\.ts/ })
    expect(visibleButtons.filter((button) => button.tabIndex === 0)).toHaveLength(1)
    expect(visibleButtons[0]).toHaveFocus()

    fireEvent.click(visibleButtons[0]!)
    expect(screen.getByRole('textbox', { name: 'Review comment' })).toHaveValue('Keep this collapsed draft')
  })

  it('uses plain text instead of Prism after expanding a diff beyond the large preview threshold', () => {
    const additions = Array.from(
      { length: WORKSPACE_PLAIN_TEXT_LINE_THRESHOLD + 1 },
      (_, index) => `+const value${index} = ${index}`,
    )
    const largeDiff = [
      'diff --git a/src/large.ts b/src/large.ts',
      '--- a/src/large.ts',
      '+++ b/src/large.ts',
      `@@ -0,0 +1,${additions.length} @@`,
      ...additions,
    ].join('\n')
    render(<WorkspaceDiffSurface value={largeDiff} path="src/large.ts" lineLimit={1} />)

    fireEvent.click(screen.getByRole('button', { name: 'Show all loaded lines' }))

    expect(document.querySelector('.token')).not.toBeInTheDocument()
    expect(getCodeRow('const value5000 = 5000')).toHaveTextContent('const value5000 = 5000')
  })

  it('renders parsed file headers and keeps multiple files visually separated', () => {
    const multiFileDiff = [
      diff,
      'diff --git a/src/b.ts b/src/b.ts',
      '--- a/src/b.ts',
      '+++ b/src/b.ts',
      '@@ -1 +1 @@',
      '-export const before = true',
      '+export const after = true',
    ].join('\n')

    render(<WorkspaceDiffSurface value={multiFileDiff} path="workspace.diff" />)

    const headers = screen.getAllByTestId('workspace-diff-file-header')
    expect(headers).toHaveLength(2)
    expect(headers[0]).toHaveTextContent('diff --git a/src/a.ts b/src/a.ts')
    expect(headers[1]).toHaveTextContent('diff --git a/src/b.ts b/src/b.ts')
  })

  it('renders TypeScript Prism tokens through the compatibility export without a circular runtime failure', () => {
    render(<ExportedWorkspaceDiffSurface value={diff} path="src/a.ts" />)

    const keyword = screen.getAllByText('const').find((element) => element.classList.contains('keyword'))
    expect(keyword).toHaveClass('token', 'keyword')
    expect(document.querySelectorAll('[data-row-text="const b = 3"]')).toHaveLength(1)
  })

  it('renders the complete review flow in Chinese', () => {
    useSettingsStore.setState({ locale: 'zh' })
    render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)

    const gutter = screen.getByRole('button', { name: '评论 src/a.ts 的新侧第 11 行' })
    fireEvent.click(gutter)

    expect(screen.getByRole('textbox', { name: '评审评论' })).toHaveFocus()
    expect(screen.getByText('新 L11')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '提交评审评论' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '评论 src/a.ts 的旧侧第 20 行' }), { shiftKey: true })
    expect(screen.getByRole('status')).toHaveTextContent('只能选择同一侧、同一变更块中的行')
  })

  it('does not rerun Prism highlighting for each controlled draft change', () => {
    const additions = Array.from(
      { length: WORKSPACE_PREVIEW_LINE_LIMIT - 4 },
      (_, index) => `+const value${index + 1} = ${index + 1}`,
    )
    const nearLimitDiff = [
      'diff --git a/src/near-limit.ts b/src/near-limit.ts',
      '--- a/src/near-limit.ts',
      '+++ b/src/near-limit.ts',
      `@@ -0,0 +1,${additions.length} @@`,
      ...additions,
    ].join('\n')
    render(<WorkspaceDiffSurface value={nearLimitDiff} path="src/near-limit.ts" />)
    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/near-limit.ts new line 1' }))
    const highlightCountBeforeTyping = highlightRenderSpy.mock.calls.length
    const editor = screen.getByRole('textbox', { name: 'Review comment' })

    fireEvent.change(editor, { target: { value: 'a' } })
    fireEvent.change(editor, { target: { value: 'ab' } })
    fireEvent.change(editor, { target: { value: 'abc' } })

    expect(highlightRenderSpy).toHaveBeenCalledTimes(highlightCountBeforeTyping)
    expect(editor).toHaveValue('abc')
  })

  it('preserves draft text but invalidates its selection when the diff changes', () => {
    const { rerender } = render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)

    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Review comment' }), {
      target: { value: 'Draft survives refresh' },
    })
    rerender(<WorkspaceDiffSurface value={`${diff}\n`} path="src/a.ts" />)

    expect(screen.queryByRole('textbox', { name: 'Review comment' })).not.toBeInTheDocument()
    expect(screen.getByText('Diff changed. Select lines again to submit this comment.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' }))
    expect(screen.getByRole('textbox', { name: 'Review comment' })).toHaveValue('Draft survives refresh')
  })

  it('resets the editor and draft when the path changes', () => {
    const { rerender } = render(<WorkspaceDiffSurface value={diff} path="src/a.ts" />)
    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/a.ts new line 11' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Review comment' }), {
      target: { value: 'Discard on another file' },
    })

    rerender(<WorkspaceDiffSurface value={diff} path="src/b.ts" />)

    expect(screen.queryByRole('textbox', { name: 'Review comment' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Comment on src/b.ts new line 11' }))
    expect(screen.getByRole('textbox', { name: 'Review comment' })).toHaveValue('')
  })
})
