import { getRequestConfig } from 'next-intl/server';
import { locales, Locale } from './index';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as Locale)) {
    locale = 'en';
  }

  const common = (await import(`../locales/${locale}/common.json`)).default;
  const home = (await import(`../locales/${locale}/home.json`)).default;
  const trials = (await import(`../locales/${locale}/trials.json`)).default;
  const governance = (await import(`../locales/${locale}/governance.json`)).default;
  const stake = (await import(`../locales/${locale}/stake.json`)).default;
  const escrow = (await import(`../locales/${locale}/escrow.json`)).default;
  const dreams = (await import(`../locales/${locale}/dreams.json`)).default;
  const roadmap = (await import(`../locales/${locale}/roadmap.json`)).default;
  const faq = (await import(`../locales/${locale}/faq.json`)).default;

  return {
    locale,
    messages: {
      common,
      home,
      trials,
      governance,
      stake,
      escrow,
      dreams,
      roadmap,
      faq
    }
  };
});
