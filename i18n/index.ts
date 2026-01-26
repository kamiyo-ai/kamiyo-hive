export const locales = ['en', 'ja', 'zh'] as const;
export type Locale = (typeof locales)[number];
