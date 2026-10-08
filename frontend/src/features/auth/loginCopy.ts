import type { Lang } from '../../app/providers/I18nProvider';

export const loginCopy: Record<Lang, {
  headline: string;
  summary: string;
  points: [string, string, string];
  title: string;
  welcome: string;
  username: string;
  password: string;
  submit: string;
  busy: string;
  showPassword: string;
  hidePassword: string;
  session: string;
  environment: string;
}> = {
  en: {
    headline: 'Run approved operations across your RHEL fleet.',
    summary: 'Command Bank, workflows, and live execution history over verified SSH.',
    points: [
      'Pinned host keys on every connection',
      'Approvals before risky commands run',
      'Full history of every execution',
    ],
    title: 'Sign in',
    welcome: 'Use your AutoOps account.',
    username: 'Username',
    password: 'Password',
    submit: 'Sign in',
    busy: 'Signing in…',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    session: 'Session protected by a rotating refresh token.',
    environment: 'SECURE OPERATIONS CONSOLE',
  },
  he: {
    headline: 'הריצו פעולות מאושרות על צי שרתי ה־RHEL שלכם.',
    summary: 'מאגר פקודות, תהליכי עבודה והיסטוריית הרצות חיה דרך SSH מאומת.',
    points: [
      'מפתחות מארח מוצמדים בכל חיבור',
      'אישור לפני הרצת פקודות מסוכנות',
      'היסטוריה מלאה של כל הרצה',
    ],
    title: 'התחברות',
    welcome: 'השתמשו בחשבון ה־AutoOps שלכם.',
    username: 'שם משתמש',
    password: 'סיסמה',
    submit: 'התחבר',
    busy: 'מתחבר…',
    showPassword: 'הצג סיסמה',
    hidePassword: 'הסתר סיסמה',
    session: 'החיבור מוגן באמצעות אסימון רענון מתחלף.',
    environment: 'מסוף תפעול מאובטח',
  },
};
