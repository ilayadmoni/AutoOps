import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, IconButton } from '../../components/ui';
import type { useExecutionPaging } from './useExecutionPaging';
import { EXECUTION_PAGE_SIZE } from './executionPaging';

export default function ExecutionPager({ paging, count }: { paging: ReturnType<typeof useExecutionPaging>; count: number }) {
  const { t, dir } = useI18n();
  const First = dir === 'rtl' ? ChevronLast : ChevronFirst;
  const Previous = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const Last = dir === 'rtl' ? ChevronFirst : ChevronLast;
  const start = Math.max(0, Math.min(paging.page - 1, paging.pages - 3));
  const visiblePages = Array.from({ length: Math.min(3, paging.pages) }, (_, i) => start + i);
  return <nav className="executionPager" aria-label={t('fleet.executionPages')}>
    <div className="executionPagerSummary">
      <strong role="status">{t('fleet.machineRange', {
        from: paging.page * EXECUTION_PAGE_SIZE + 1, to: Math.min((paging.page + 1) * EXECUTION_PAGE_SIZE, count), total: count,
      })}</strong>
      <small className="muted">{t('fleet.pageNumber', { page: paging.page + 1, total: paging.pages })}</small>
    </div>
    <div className="executionPagerControls">
      <span className="executionPagerEdge"><IconButton label={t('fleet.firstPage')} disabled={paging.page === 0} onClick={() => paging.navigate(0)}><First size={17} /></IconButton></span>
      <IconButton label={t('common.previous')} disabled={paging.page === 0} onClick={() => paging.navigate(paging.page - 1)}><Previous size={17} /></IconButton>
      <div className="segmented executionPageNumbers" role="group" aria-label={t('fleet.executionPage')}>
        {visiblePages.map(index => <Button key={index} small variant="ghost"
          aria-label={t('fleet.pageNumber', { page: index + 1, total: paging.pages })}
          aria-current={paging.page === index ? 'page' : undefined} onClick={() => paging.navigate(index)}>
          {index + 1}
        </Button>)}
      </div>
      <IconButton label={t('common.next')} disabled={paging.page === paging.pages - 1} onClick={() => paging.navigate(paging.page + 1)}><Next size={17} /></IconButton>
      <span className="executionPagerEdge"><IconButton label={t('fleet.lastPage')} disabled={paging.page === paging.pages - 1} onClick={() => paging.navigate(paging.pages - 1)}><Last size={17} /></IconButton></span>
    </div>
    {!paging.finished && (paging.following ? <span className="badge info"><Radio size={12} />{t('fleet.following')}</span>
      : <Button small icon={<Radio size={14} />} onClick={paging.follow}>{t('fleet.resumeFollowing')}</Button>)}
  </nav>;
}
