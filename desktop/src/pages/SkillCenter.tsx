import { useState } from 'react'
import { SkillList } from '../components/skills/SkillList'
import { useTranslation } from '../i18n'

type SkillCenterTab = 'marketplace' | 'mine'

export function SkillCenter() {
  const t = useTranslation()
  const [activeTab, setActiveTab] = useState<SkillCenterTab>('marketplace')

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-surface)]">
      <header className="flex flex-none flex-col gap-4 border-b border-[var(--color-border)] px-6 py-4">
        <h2 className="text-lg font-semibold tracking-normal text-[var(--color-text-primary)]">
          {t('skillCenter.title')}
        </h2>
        <div
          role="tablist"
          aria-label={t('skillCenter.title')}
          className="inline-flex w-fit rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'marketplace'}
            className={tabClass(activeTab === 'marketplace')}
            onClick={() => setActiveTab('marketplace')}
          >
            {t('skillCenter.tab.marketplace')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mine'}
            className={tabClass(activeTab === 'mine')}
            onClick={() => setActiveTab('mine')}
          >
            {t('skillCenter.tab.mine')}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'marketplace' ? (
          <div
            role="tabpanel"
            data-testid="skill-marketplace-tab"
            className="text-sm text-[var(--color-text-secondary)]"
          >
            {t('skillCenter.marketplace.loading')}
          </div>
        ) : (
          <div role="tabpanel" data-testid="skill-mine-tab">
            <SkillList />
          </div>
        )}
      </main>
    </div>
  )
}

function tabClass(active: boolean) {
  return [
    'min-w-[6rem] rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]',
    active
      ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
  ].join(' ')
}
