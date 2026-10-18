import { Check, Pencil, Star, Trash2 } from 'lucide-react';
import { Button, Checkbox, ConfirmDialog, EmptyState, ErrorAlert, IconButton, Segmented } from '../../components/ui';
import { useCollectionMessages } from './messages';
import { itemName, type CollectionTools, type Item } from './useCollectionTools';
import './collections.css';

export function EditCollection({ tools }: { tools: CollectionTools }) {
  const text = useCollectionMessages();
  return <Button icon={tools.active ? <Check size={14} /> : <Pencil size={14} />} aria-pressed={tools.active}
    disabled={tools.busy} onClick={tools.toggleMode}>{text(tools.active ? 'done' : 'edit')}</Button>;
}

export function FavoriteButton({ tools, item }: { tools: CollectionTools; item: Item }) {
  const text = useCollectionMessages();
  return <IconButton label={text('favorite', { name: itemName(item) })} aria-pressed={tools.isFavorite(item.id)}
    className="favoriteButton" disabled={tools.favorites.isPending || tools.favorites.isError || tools.favoriteBusy}
    onClick={event => { event.stopPropagation(); tools.toggleFavorite(item.id); }}>
    <Star size={16} fill={tools.isFavorite(item.id) ? 'currentColor' : 'none'} aria-hidden="true" />
  </IconButton>;
}

export function ItemControls({ tools, item }: { tools: CollectionTools; item: Item }) {
  const text = useCollectionMessages();
  return <span className="collectionItemControls" onClick={event => event.stopPropagation()}>
    {tools.active && <Checkbox aria-label={text('select', { name: itemName(item) })} checked={tools.ids.has(item.id)}
      disabled={tools.busy || !tools.canDelete(item)} onChange={() => tools.toggle(item.id)} />}
    <FavoriteButton tools={tools} item={item} />
  </span>;
}

export function FavoritesEmpty() {
  const text = useCollectionMessages();
  return <EmptyState title={text('empty')} hint={text('emptyHint')} />;
}

export function CollectionToolbar({ tools, visible, hideBulk = false }: { tools: CollectionTools; visible: Item[]; hideBulk?: boolean }) {
  const text = useCollectionMessages();
  return <>
    <div className="collectionToolbar">
      <Segmented value={tools.onlyFavorites ? 'favorites' : 'all'} label={text('filter')} onChange={value => tools.setOnlyFavorites(value === 'favorites')}
        options={[{ value: 'all', label: text('all') }, { value: 'favorites', label: text('favorites'), icon: <Star size={14} /> }]} />
      {tools.active && !hideBulk && <>
        <Button small disabled={tools.busy || !visible.some(tools.canDelete)} onClick={() => tools.selectVisible(visible)}>{text('selectAll')}</Button>
        <Button small disabled={tools.busy || !tools.selected.length} onClick={tools.clear}>{text('clear')}</Button>
        <span className="muted small" role="status">{text('selected', { n: tools.selected.length })}</span>
        <Button small variant="danger" icon={<Trash2 size={14} />} busy={tools.busy} disabled={!tools.selected.length}
          onClick={tools.review}>{text('delete', { n: tools.selected.length })}</Button>
      </>}
    </div>
    <ErrorAlert error={tools.favorites.error} onRetry={() => tools.favorites.refetch()} />
    {tools.failures.length > 0 && <div className="alert danger" role="alert"><div>{text('failed')}
      <ul>{tools.failures.map(({ item, message }) => <li key={item.id}><bdi>{itemName(item)}</bdi>: {message}</li>)}</ul>
    </div></div>}
    {tools.targets && <ConfirmDialog danger title={text('title', { n: tools.targets.length })}
      message={<div><p>{text('confirm')}</p><ul className="collectionDeleteList">{tools.targets.map(item => <li key={item.id}><bdi>{itemName(item)}</bdi></li>)}</ul></div>}
      confirmLabel={text('delete', { n: tools.targets.length })} busy={tools.busy} onCancel={tools.cancel} onConfirm={tools.confirm} />}
  </>;
}
