'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Category = 'gettingStarted' | 'identity' | 'staking' | 'governance' | 'swarm' | 'escrow' | 'technical';

interface FAQ {
  question: string;
  answer: string;
}

export default function FAQPage() {
  const t = useTranslations('faq');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const categories: Category[] = ['gettingStarted', 'identity', 'staking', 'governance', 'swarm', 'escrow', 'technical'];

  // Get all FAQs from translations
  const allFaqs = useMemo(() => {
    const faqList: Array<{ category: Category; faq: FAQ; index: number }> = [];
    categories.forEach(category => {
      const categoryFaqs = t.raw(`faqs.${category}`) as FAQ[];
      categoryFaqs.forEach((faq, index) => {
        faqList.push({ category, faq, index });
      });
    });
    return faqList;
  }, [t]);

  // Filter FAQs based on category and search
  const filteredFaqs = useMemo(() => {
    let filtered = allFaqs;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.faq.question.toLowerCase().includes(query) ||
        item.faq.answer.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allFaqs, selectedCategory, searchQuery]);

  const toggleItem = (key: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-10 px-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-10 pb-6">
        <p className="font-light text-sm uppercase tracking-widest gradient-text mb-4">
          — FAQ よくある質問
        </p>
        <h1 className="text-3xl md:text-4xl font-medium text-white mb-4">{t('title')}</h1>
        <p className="text-gray-500 max-w-2xl">{t('subtitle')}</p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black border border-gray-800 rounded-lg px-6 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-700 transition-colors"
        />
      </div>

      {/* Category Filters */}
      <div className="mb-10 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 text-sm rounded transition-colors ${
            selectedCategory === 'all'
              ? 'bg-white/10 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {t('allCategories')}
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              selectedCategory === category
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t(`categories.${category}`)}
          </button>
        ))}
      </div>

      {/* FAQ Items */}
      {filteredFaqs.length > 0 ? (
        <div className="space-y-4 mb-16">
          {filteredFaqs.map(({ category, faq, index }) => {
            const key = `${category}-${index}`;
            const isExpanded = expandedItems.has(key);

            return (
              <div
                key={key}
                className="bg-black border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-colors"
              >
                <button
                  onClick={() => toggleItem(key)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left"
                >
                  <div className="flex-1 pr-4">
                    <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">
                      {t(`categories.${category}`)}
                    </div>
                    <h3 className="text-white font-medium">
                      {faq.question}
                    </h3>
                  </div>
                  <div className="flex-shrink-0">
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-6 pb-5 pt-0">
                    <div className="border-t border-gray-800 pt-4">
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-500">{t('noResults')}</p>
        </div>
      )}

      {/* Related Pages */}
      <div className="mt-16">
        <p className="font-light text-sm uppercase tracking-widest gradient-text mb-6">
          — {t('relatedPages.title')} 関連ページ
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/stake"
            className="bg-black border border-gray-500/25 rounded-lg p-5 hover:border-gray-700 transition-colors group"
          >
            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Staking</div>
            <h4 className="text-white text-sm">{t('relatedPages.stake')}</h4>
          </Link>

          <Link
            href="/governance"
            className="bg-black border border-gray-500/25 rounded-lg p-5 hover:border-gray-700 transition-colors group"
          >
            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Governance</div>
            <h4 className="text-white text-sm">{t('relatedPages.governance')}</h4>
          </Link>

          <Link
            href="/swarm"
            className="bg-black border border-gray-500/25 rounded-lg p-5 hover:border-gray-700 transition-colors group"
          >
            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Swarm</div>
            <h4 className="text-white text-sm">{t('relatedPages.swarm')}</h4>
          </Link>

          <Link
            href="/escrow"
            className="bg-black border border-gray-500/25 rounded-lg p-5 hover:border-gray-700 transition-colors group"
          >
            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Escrow</div>
            <h4 className="text-white text-sm">{t('relatedPages.escrow')}</h4>
          </Link>

          <a
            href="https://kamiyo.ai/roadmap"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-black border border-gray-500/25 rounded-lg p-5 hover:border-gray-700 transition-colors group"
          >
            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Roadmap</div>
            <h4 className="text-white text-sm">{t('relatedPages.roadmap')}</h4>
          </a>
        </div>
      </div>
    </div>
  );
}
