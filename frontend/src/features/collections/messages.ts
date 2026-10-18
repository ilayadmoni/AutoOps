import { useI18n } from '../../app/providers/I18nProvider';

const en = {
  all: 'All items', favorites: 'Favorites', filter: 'Filter items', favorite: 'Favorite: {name}',
  edit: 'Edit', done: 'Done', select: 'Select: {name}', selectAll: 'Select visible', clear: 'Clear selection',
  selected: '{n} selected', delete: 'Delete selected ({n})', title: 'Delete {n} items?',
  confirm: 'These items will be deleted for everyone with access. This cannot be undone. Items in use may be protected.',
  deleted: '{n} items deleted', failed: 'Some items could not be deleted. Review the errors and try again.',
  empty: 'No favorites yet', emptyHint: 'Use the star beside an item to keep it here for quick access.',
};
const he: typeof en = {
  all: 'כל הפריטים', favorites: 'מועדפים', filter: 'סינון פריטים', favorite: 'מועדף: {name}',
  edit: 'עריכה', done: 'סיום', select: 'בחירה: {name}', selectAll: 'בחירת המוצגים', clear: 'ניקוי הבחירה',
  selected: '{n} נבחרו', delete: 'מחיקת הנבחרים ({n})', title: 'למחוק {n} פריטים?',
  confirm: 'הפריטים יימחקו עבור כל מי שיש לו גישה. לא ניתן לבטל פעולה זו. פריטים בשימוש עשויים להיות מוגנים.',
  deleted: '{n} פריטים נמחקו', failed: 'לא ניתן למחוק חלק מהפריטים. בדקו את השגיאות ונסו שוב.',
  empty: 'עדיין אין מועדפים', emptyHint: 'לחצו על הכוכב שלצד פריט כדי לשמור אותו כאן לגישה מהירה.',
};
export function useCollectionMessages() {
  const { lang } = useI18n();
  return (key: keyof typeof en, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), (lang === 'he' ? he : en)[key]);
}
