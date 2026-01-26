import { getRequestConfig } from 'next-intl/server';
import { locales, Locale } from './index';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as Locale)) {
    locale = 'en';
  }

  return {
    locale,
    messages: (await import(`../locales/${locale}/common.json`)).default
  };
});
