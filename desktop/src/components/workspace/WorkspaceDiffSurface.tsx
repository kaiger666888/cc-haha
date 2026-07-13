import {
  Fragment,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { CornerDownLeft, MessageSquare, Plus } from 'lucide-react'
import { Highlight, type PrismTheme } from 'prism-react-renderer'
import { useTranslation } from '../../i18n'
import {
  getCompatibleDiffRange,
  parseWorkspaceDiff,
  type WorkspaceDiffRow,
  type WorkspaceDiffSelection,
} from './workspaceDiffModel'

export const WORKSPACE_PREVIEW_LINE_LIMIT = 2000
export const WORKSPACE_PLAIN_TEXT_LINE_THRESHOLD = 5000

export const workspacePrismTheme: PrismTheme = {
  plain: {
    color: 'var(--color-code-fg)',
    backgroundColor: 'transparent',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: 'var(--color-code-comment)', fontStyle: 'italic' } },
    { types: ['string', 'attr-value', 'template-string'], style: { color: 'var(--color-code-string)' } },
    { types: ['keyword', 'selector', 'important', 'atrule'], style: { color: 'var(--color-code-keyword)' } },
    { types: ['function'], style: { color: 'var(--color-code-function)' } },
    { types: ['tag'], style: { color: 'var(--color-code-keyword)' } },
    { types: ['number', 'boolean'], style: { color: 'var(--color-code-number)' } },
    { types: ['operator'], style: { color: 'var(--color-code-fg)' } },
    { types: ['punctuation'], style: { color: 'var(--color-code-punctuation)' } },
    { types: ['variable', 'parameter'], style: { color: 'var(--color-code-fg)' } },
    { types: ['property', 'attr-name'], style: { color: 'var(--color-code-property)' } },
    { types: ['builtin', 'class-name', 'constant', 'symbol'], style: { color: 'var(--color-code-type)' } },
    { types: ['inserted'], style: { color: 'var(--color-code-inserted)' } },
    { types: ['deleted'], style: { color: 'var(--color-code-deleted)' } },
  ],
}

export function getFileExtension(name: string) {
  const cleanName = name.split('/').pop() ?? name
  const lastDot = cleanName.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === cleanName.length - 1) return ''
  return cleanName.slice(lastDot + 1).toLowerCase()
}

export function normalizePrismLanguage(language: string) {
  const lower = language.toLowerCase()
  const map: Record<string, string> = {
    text: 'text',
    typescript: 'typescript',
    ts: 'typescript',
    tsx: 'tsx',
    javascript: 'javascript',
    js: 'javascript',
    jsx: 'jsx',
    markdown: 'markdown',
    md: 'markdown',
    html: 'markup',
    xml: 'markup',
    shell: 'bash',
    sh: 'bash',
    zsh: 'bash',
    diff: 'diff',
  }
  return map[lower] ?? lower
}

export function getLanguageFromPath(path: string) {
  return normalizePrismLanguage(getFileExtension(path) || 'text')
}

export const InlineHighlightedCode = memo(function InlineHighlightedCode({
  value,
  language,
}: {
  value: string
  language: string
}) {
  return (
    <Highlight theme={workspacePrismTheme} code={value} language={normalizePrismLanguage(language)}>
      {({ tokens, getTokenProps }) => (
        <>
          {(tokens[0] ?? []).map((token, tokenIndex) => {
            const { key: tokenKey, ...tokenProps } = getTokenProps({ token, key: tokenIndex })
            return <span key={String(tokenKey)} {...tokenProps} />
          })}
        </>
      )}
    </Highlight>
  )
})

export interface WorkspaceDiffCommentSelection {
  side: 'old' | 'new'
  lineStart: number
  lineEnd: number
  quote: string
  hunkId: string
}

export interface WorkspaceDiffSurfaceProps {
  value: string
  path: string
  className?: string
  lineLimit?: number
  onAddComment?: (selection: WorkspaceDiffCommentSelection, note: string) => void
}

interface ReviewState {
  anchorId: string | null
  focusId: string | null
  selection: WorkspaceDiffSelection | null
  draft: string
}

type ReviewStatus = 'selectionReset' | 'diffChanged' | 'collapsedSelection' | null

const emptyReviewState: ReviewState = {
  anchorId: null,
  focusId: null,
  selection: null,
  draft: '',
}

function rowTone(row: WorkspaceDiffRow) {
  if (row.kind === 'addition') return 'bg-[var(--color-diff-added-bg)]'
  if (row.kind === 'deletion') return 'bg-[var(--color-diff-removed-bg)]'
  if (row.kind === 'hunk') return 'bg-[var(--color-diff-highlight-bg)]'
  return 'hover:bg-[var(--color-surface-hover)]'
}

function prefixTone(row: WorkspaceDiffRow) {
  if (row.kind === 'addition') return 'text-[var(--color-diff-added-text)]'
  if (row.kind === 'deletion') return 'text-[var(--color-diff-removed-text)]'
  return 'text-[var(--color-text-tertiary)]'
}

function codeTone(row: WorkspaceDiffRow) {
  if (row.kind === 'metadata') return 'font-semibold text-[var(--color-text-secondary)]'
  if (row.kind === 'hunk') return 'font-semibold text-[var(--color-warning)]'
  return ''
}

export function WorkspaceDiffSurface({
  value,
  path,
  className = 'min-h-0 flex-1 overflow-auto bg-[var(--color-code-bg)]',
  lineLimit = WORKSPACE_PREVIEW_LINE_LIMIT,
  onAddComment,
}: WorkspaceDiffSurfaceProps) {
  const t = useTranslation()
  const files = useMemo(() => parseWorkspaceDiff(value), [value])
  const rows = useMemo(() => files.flatMap((file) => file.rows), [files])
  const displayItemIds = useMemo(
    () => files.flatMap((file) => [`${file.id}-header`, ...file.rows.map((row) => row.id)]),
    [files],
  )
  const [review, setReview] = useState<ReviewState>(emptyReviewState)
  const [status, setStatus] = useState<ReviewStatus>(null)
  const [showAllRows, setShowAllRows] = useState(false)
  const visibleItemIds = useMemo(
    () => new Set(showAllRows ? displayItemIds : displayItemIds.slice(0, lineLimit)),
    [displayItemIds, lineLimit, showAllRows],
  )
  const visibleRows = useMemo(() => rows.filter((row) => visibleItemIds.has(row.id)), [rows, visibleItemIds])
  const selectableRows = useMemo(() => visibleRows.filter((row) => row.selectable), [visibleRows])
  const usePlainLargePreview = showAllRows && rows.length > WORKSPACE_PLAIN_TEXT_LINE_THRESHOLD
  const [rovingId, setRovingId] = useState<string | null>(() => rows.find((row) => row.selectable)?.id ?? null)
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>())
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const shouldFocusEditor = useRef(false)
  const pendingRovingFocus = useRef<string | null>(null)
  const previousPath = useRef(path)
  const previousValue = useRef(value)
  const selectedIds = new Set(review.selection?.rowIds ?? [])
  const sideLabel = (side: 'old' | 'new') => t(`workspace.diffReview.side.${side}`)

  useEffect(() => {
    const pathChanged = previousPath.current !== path
    const valueChanged = previousValue.current !== value
    previousPath.current = path
    previousValue.current = value

    if (pathChanged) {
      setReview(emptyReviewState)
      setStatus(null)
      setShowAllRows(false)
      setRovingId(selectableRows[0]?.id ?? null)
      return
    }

    if (valueChanged) {
      setReview((current) => ({
        ...current,
        anchorId: null,
        focusId: null,
        selection: null,
      }))
      setStatus(review.draft ? 'diffChanged' : null)
      setRovingId(selectableRows[0]?.id ?? null)
    }
  }, [path, review.draft, selectableRows, value])

  useEffect(() => {
    if (!rovingId || !selectableRows.some((row) => row.id === rovingId)) {
      setRovingId(selectableRows[0]?.id ?? null)
    }
    const pendingId = pendingRovingFocus.current
    if (pendingId && selectableRows.some((row) => row.id === pendingId)) {
      pendingRovingFocus.current = null
      setRovingId(pendingId)
      buttonRefs.current.get(pendingId)?.focus()
    }
  }, [rovingId, selectableRows])

  useEffect(() => {
    if (review.selection && shouldFocusEditor.current) {
      shouldFocusEditor.current = false
      editorRef.current?.focus()
    }
  }, [review.selection])

  const focusButton = (id: string | null) => {
    if (id) buttonRefs.current.get(id)?.focus()
  }

  const selectSingleRow = (row: WorkspaceDiffRow, resetStatus: ReviewStatus = null, focusEditor = false) => {
    const selection = getCompatibleDiffRange(rows, row.id, row.id)
    if (!selection) return
    shouldFocusEditor.current = focusEditor
    setReview((current) => ({
      ...current,
      anchorId: row.id,
      focusId: row.id,
      selection,
    }))
    setStatus(resetStatus)
  }

  const extendSelection = (row: WorkspaceDiffRow, focusEditor = false) => {
    if (!review.anchorId) {
      selectSingleRow(row, null, focusEditor)
      return
    }
    const selection = getCompatibleDiffRange(rows, review.anchorId, row.id)
    if (!selection) {
      selectSingleRow(row, 'selectionReset', focusEditor)
      return
    }
    shouldFocusEditor.current = focusEditor
    setReview((current) => ({ ...current, focusId: row.id, selection }))
    setStatus(null)
  }

  const activateRow = (row: WorkspaceDiffRow, extend: boolean, focusEditor: boolean) => {
    setRovingId(row.id)
    if (extend) extendSelection(row, focusEditor)
    else selectSingleRow(row, null, focusEditor)
  }

  const handleRowClick = (event: MouseEvent<HTMLButtonElement>, row: WorkspaceDiffRow) => {
    activateRow(row, event.shiftKey, true)
  }

  const moveRovingFocus = (row: WorkspaceDiffRow, direction: -1 | 1, extend: boolean) => {
    const currentIndex = selectableRows.findIndex((candidate) => candidate.id === row.id)
    const anchorRow = review.anchorId
      ? selectableRows.find((candidate) => candidate.id === review.anchorId) ?? row
      : row
    let target = selectableRows[currentIndex + direction]
    if (extend) {
      let targetIndex = currentIndex + direction
      while (target && (target.side !== anchorRow.side || target.hunkId !== anchorRow.hunkId)) {
        targetIndex += direction
        target = selectableRows[targetIndex]
      }
    }
    if (!target) return
    setRovingId(target.id)
    focusButton(target.id)
    if (extend && !review.anchorId) {
      const selection = getCompatibleDiffRange(rows, row.id, target.id)
      if (selection) {
        setReview((current) => ({
          ...current,
          anchorId: row.id,
          focusId: target.id,
          selection,
        }))
        setStatus(null)
      } else {
        selectSingleRow(target, 'selectionReset')
      }
    } else if (extend) {
      extendSelection(target)
    }
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>, row: WorkspaceDiffRow) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveRovingFocus(row, event.key === 'ArrowDown' ? 1 : -1, event.shiftKey)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const navigationRows = event.shiftKey
        ? selectableRows.filter((candidate) => (
          candidate.side === row.side && candidate.hunkId === row.hunkId
        ))
        : selectableRows
      const target = event.key === 'Home' ? navigationRows[0] : navigationRows.at(-1)
      if (target) {
        setRovingId(target.id)
        focusButton(target.id)
        if (event.shiftKey && !review.anchorId) {
          const selection = getCompatibleDiffRange(rows, row.id, target.id)
          if (selection) {
            setReview((current) => ({
              ...current,
              anchorId: row.id,
              focusId: target.id,
              selection,
            }))
            setStatus(null)
          }
        } else if (event.shiftKey) {
          extendSelection(target)
        }
      }
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateRow(row, event.shiftKey, true)
    }
  }

  const closeEditor = () => {
    const restoreId = review.anchorId
    setReview((current) => ({ ...current, anchorId: null, focusId: null, selection: null }))
    setStatus(null)
    focusButton(restoreId)
  }

  const submitComment = () => {
    const note = review.draft.trim()
    if (!note || !review.selection) return
    const { side, lineStart, lineEnd, quote, hunkId } = review.selection
    onAddComment?.({ side, lineStart, lineEnd, quote, hunkId }, note)
    const restoreId = review.anchorId
    setReview(emptyReviewState)
    setStatus(null)
    focusButton(restoreId)
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeEditor()
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      submitComment()
    }
  }

  const toggleRows = () => {
    if (!showAllRows) {
      setShowAllRows(true)
      return
    }

    const collapsedItemIds = new Set(displayItemIds.slice(0, lineLimit))
    const collapsedSelectableRows = rows.filter((row) => row.selectable && collapsedItemIds.has(row.id))
    const nextRovingId = collapsedSelectableRows[0]?.id ?? null
    const selectionWillBeHidden = review.selection?.rowIds.some((id) => !collapsedItemIds.has(id)) ?? false

    if (selectionWillBeHidden) {
      setReview((current) => ({
        ...current,
        anchorId: null,
        focusId: null,
        selection: null,
      }))
      setStatus('collapsedSelection')
    }
    setRovingId(nextRovingId)
    pendingRovingFocus.current = nextRovingId
    setShowAllRows(false)
  }

  const renderEditor = () => review.selection && (
    <div
      data-diff-editor=""
      className="min-w-[420px] border-y border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-3 py-2"
    >
      {status && (
        <div role="status" aria-live="polite" className="mb-1.5 text-[11px] text-[var(--color-warning)]">
          {t(`workspace.diffReview.${status}`)}
        </div>
      )}
      <div className="flex items-start gap-2 pl-[84px]">
        <MessageSquare aria-hidden="true" className="mt-1.5 shrink-0 text-[var(--color-text-tertiary)]" size={14} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
            {sideLabel(review.selection.side)} L{review.selection.lineStart}{review.selection.lineEnd === review.selection.lineStart ? '' : `-L${review.selection.lineEnd}`}
          </div>
          <textarea
            ref={editorRef}
            aria-label={t('workspace.diffReview.editorLabel')}
            value={review.draft}
            onChange={(event) => setReview((current) => ({ ...current, draft: event.target.value }))}
            onKeyDown={handleEditorKeyDown}
            rows={2}
            className="block min-h-14 w-full resize-y rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-container)] px-2 py-1.5 font-[var(--font-sans)] text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
          />
        </div>
        <button
          type="button"
          aria-label={t('workspace.diffReview.submitAria')}
          disabled={!review.draft.trim()}
          onClick={submitComment}
          className="mt-6 inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-[5px] px-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CornerDownLeft aria-hidden="true" size={14} />
          <span>{t('workspace.diffReview.submit')}</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className={className}>
      <div className="relative min-w-max py-2">
        <div
          data-workspace-code=""
          data-testid="workspace-code"
          className="m-0 font-[var(--font-mono)] text-[12px] leading-[1.55] text-[var(--color-code-fg)]"
        >
          {files.map((file) => {
            const headerVisible = visibleItemIds.has(`${file.id}-header`)
            const fileRows = file.rows.filter((row) => visibleItemIds.has(row.id))
            if (!headerVisible && fileRows.length === 0) return null
            const oldPath = file.oldPath ? `a/${file.oldPath}` : '/dev/null'
            const newPath = file.newPath ? `b/${file.newPath}` : '/dev/null'
            const language = getLanguageFromPath(file.newPath ?? file.oldPath ?? path)
            return (
              <div key={file.id}>
                {headerVisible && (
                  <div
                    data-testid="workspace-diff-file-header"
                    className="min-h-7 border-y border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-1 font-semibold text-[var(--color-text-secondary)]"
                  >
                    diff --git {oldPath} {newPath}
                  </div>
                )}
                {fileRows.map((row) => {
                  const line = row.side === 'old' ? row.oldLine : row.newLine
                  const selected = selectedIds.has(row.id)
                  return (
                    <Fragment key={row.id}>
                      <div
                        data-diff-row-id={row.id}
                        className={`group grid min-h-7 min-w-full w-max grid-cols-[42px_42px_28px_18px_minmax(max-content,1fr)] items-stretch px-3 ${rowTone(row)} ${
                          selected ? 'outline outline-1 -outline-offset-1 outline-[var(--color-border-focus)]' : ''
                        }`}
                      >
                        <span className="select-none self-center text-right text-[11px] text-[var(--color-text-tertiary)]">
                          {row.oldLine ?? ''}
                        </span>
                        <span className="select-none self-center text-right text-[11px] text-[var(--color-text-tertiary)]">
                          {row.newLine ?? ''}
                        </span>
                        <span className="flex h-7 w-7 items-center justify-center">
                          {row.selectable && row.side && line !== null && (
                            <button
                              ref={(element) => {
                                if (element) buttonRefs.current.set(row.id, element)
                                else buttonRefs.current.delete(row.id)
                              }}
                              type="button"
                              aria-label={t('workspace.diffReview.commentLineAria', {
                                path,
                                side: sideLabel(row.side),
                                line,
                              })}
                              aria-pressed={selected}
                              tabIndex={row.id === rovingId ? 0 : -1}
                              onClick={(event) => handleRowClick(event, row)}
                              onFocus={() => setRovingId(row.id)}
                              onKeyDown={(event) => handleRowKeyDown(event, row)}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-[5px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-border-focus)] ${
                                selected ? 'text-[var(--color-accent)]' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                              }`}
                            >
                              {selected ? <MessageSquare aria-hidden="true" size={14} /> : <Plus aria-hidden="true" size={14} />}
                            </button>
                          )}
                        </span>
                        <span className={`select-none self-center text-center ${prefixTone(row)}`}>{row.prefix || ' '}</span>
                        <span
                          data-row-text={row.text}
                          data-selected={selected ? 'true' : undefined}
                          className={`whitespace-pre self-center pr-6 ${codeTone(row)}`}
                        >
                          {row.selectable && row.text && !usePlainLargePreview
                            ? <InlineHighlightedCode value={row.text} language={language} />
                            : row.text || ' '}
                        </span>
                      </div>
                      {review.selection?.endId === row.id ? renderEditor() : null}
                    </Fragment>
                  )
                })}
              </div>
            )
          })}
        </div>

        {status && !review.selection && (
          <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-3 py-2">
            <div role="status" aria-live="polite" className="text-[11px] text-[var(--color-warning)]">
              {t(`workspace.diffReview.${status}`)}
            </div>
          </div>
        )}

        {displayItemIds.length > lineLimit && (
          <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
            <span>
              {showAllRows
                ? t('workspace.previewAllLines', { total: displayItemIds.length })
                : t('workspace.previewLineLimit', { count: visibleItemIds.size, total: displayItemIds.length })}
            </span>
            <button
              type="button"
              onClick={toggleRows}
              className="ml-auto h-7 rounded-[5px] px-2 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            >
              {showAllRows ? t('workspace.collapsePreview') : t('workspace.showAllLoadedLines')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
