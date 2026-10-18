export const enConnection = {
  'connection.action': 'Test connection',
  'connection.title': 'Test server connection: {name}',
  'connection.explain': 'Check SSH access, the server identity, login credentials and operating system using the selected account.',
  'connection.username': 'SSH username',
  'connection.credential': 'Assigned credential',
  'connection.unassigned': 'No credential assigned',
  'connection.unavailable': 'Could not load credential details',
  'connection.identity': 'Verify server identity',
  'connection.identityRequired': 'Verify and approve the server identity before testing the connection.',
  'connection.identityChanged': 'The server identity has changed. Review and verify the change before reconnecting.',
  'connection.success': 'The connection and login succeeded.',
  'connection.failed': 'The connection check did not complete successfully. Review the results below.',
};

export const heConnection: Record<keyof typeof enConnection, string> = {
  'connection.action': 'בדיקת חיבור לשרת',
  'connection.title': 'בדיקת חיבור לשרת: {name}',
  'connection.explain': 'בדיקת גישת SSH, זהות השרת, ההתחברות ומערכת ההפעלה באמצעות פרטי הגישה שנבחרו.',
  'connection.username': 'שם משתמש SSH',
  'connection.credential': 'פרטי גישה משויכים',
  'connection.unassigned': 'לא שויכו פרטי גישה',
  'connection.unavailable': 'לא ניתן לטעון את פרטי הגישה',
  'connection.identity': 'אימות זהות השרת',
  'connection.identityRequired': 'לפני בדיקת החיבור יש לאמת ולאשר את זהות השרת.',
  'connection.identityChanged': 'זהות השרת השתנתה. יש לבדוק ולאמת את השינוי לפני חיבור מחדש.',
  'connection.success': 'החיבור וההתחברות לשרת הצליחו.',
  'connection.failed': 'בדיקת החיבור לא הושלמה בהצלחה. יש לעיין בתוצאות למטה.',
};
