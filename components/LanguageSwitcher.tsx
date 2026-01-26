'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { locales, Locale } from '@/i18n/index';

const localeLabels: Record<Locale, string> = {
  en: 'EN',
  ja: 'JA',
  zh: 'ZH'
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const switchLocale = (newLocale: Locale) => {
    const segments = pathname.split('/');
    if (locales.includes(segments[1] as Locale)) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    const newPath = segments.join('/') || '/';
    router.push(newPath);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-500/25 rounded px-2 py-1"
      >
        <span className="font-mono">{localeLabels[locale]}</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 bg-black border border-gray-500/25 rounded overflow-hidden z-50">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => switchLocale(l)}
              className={`block w-full px-3 py-1.5 text-xs font-mono text-left transition-colors ${
                l === locale ? 'text-white bg-gray-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-500/10'
              }`}
            >
              {localeLabels[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
