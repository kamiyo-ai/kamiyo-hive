'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { useScrambleText } from '@/hooks/useScrambleText';
import MorphingIcon from '@/components/MorphingIcon';
import { MobileWalletModal } from '@/components/MobileWalletModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { listTeams, SwarmTeam } from '@/lib/swarm-api';

export function Header() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { text: connectText, setIsHovering: setConnectHovering } = useScrambleText(t('buttons.connect'), true);
  const [isConnectHovered, setIsConnectHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isMenuHovered, setMenuHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [teams, setTeams] = useState<SwarmTeam[]>([]);
  const [isMobileWalletModalOpen, setMobileWalletModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const data = await listTeams();
      setTeams(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (connected) fetchTeams();
  }, [connected, fetchTeams]);

  const navItems = [
    { href: '/stake', label: t('nav.stake') },
    { href: '/governance', label: t('nav.governance') },
    { href: '/escrow', label: t('nav.escrow') },
  ];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        const isHamburger = (event.target as Element).closest('button[aria-label*="menu"]');
        if (!isHamburger) setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setIsDropdownOpen(false);
  };

  return (
    <>
      <header className={`fixed top-0 left-0 w-full bg-black/90 backdrop-blur-sm border-b border-gray-500/25 z-40 transition-transform duration-300 ${isMenuOpen ? '-translate-x-72' : 'translate-x-0'}`}>
        <div className="w-full px-5 mx-auto py-3 flex items-center justify-between" style={{ maxWidth: '1400px' }}>
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="flex items-center flex-shrink-0">
              <img
                src="/media/KAMIYO_logomark.png"
                alt="KAMIYO"
                width="240"
                height="64"
                className="object-contain h-10 sm:h-12 md:h-14 w-auto"
              />
            </Link>
            <nav className="hidden md:flex items-center gap-5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm text-gray-500 hover:text-gray-300 transition-colors duration-300 uppercase tracking-wider ${
                    pathname.startsWith(item.href) ? 'text-white' : ''
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <a
                href="https://kamiyo.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors duration-300 uppercase tracking-wider"
              >
                {t('nav.website')}
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            {connected && publicKey ? (
              <div className="relative" ref={dropdownRef}>
                {/* Mobile connected indicator */}
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="md:hidden flex items-center gap-1.5 text-sm text-gray-400 border border-gray-500/50 rounded px-2 py-1 hover:border-gray-400 transition-colors"
                >
                  <img src="/icons/icon-settlement.svg" alt="" className="w-4 h-4 flex-shrink-0" />
                  <span className="font-mono text-[10px]">
                    {publicKey.toBase58().slice(0, 4)}..
                  </span>
                </button>
                {/* Desktop connected button */}
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="hidden md:flex items-center gap-2 text-sm text-gray-400 border border-gray-500/50 rounded px-3 py-1.5 hover:border-gray-400 transition-colors w-[192px]"
                >
                  <img src="/icons/icon-settlement.svg" alt="" className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className="font-mono text-xs flex-1 text-left">
                    {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                  </span>
                  <svg
                    className={`w-3 h-3 transition-transform flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-black border border-gray-500/50 rounded-lg shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-500/25">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">{t('buttons.connected')}</p>
                      <p className="text-[0.8rem] text-white font-mono mt-1">
                        {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                      </p>
                    </div>

                    {/* SwarmTeams */}
                    {teams.length > 0 && (
                      <div className="py-2 border-b border-gray-500/25">
                        <p className="px-4 text-[0.65rem] text-gray-600 uppercase tracking-wider mb-1">SwarmTeams</p>
                        {teams.map((team) => (
                          <Link
                            key={team.id}
                            href={`/swarm/${team.id}`}
                            onClick={() => setIsDropdownOpen(false)}
                            className="flex items-center justify-between px-4 py-1.5 text-[0.8rem] text-gray-400 hover:text-white hover:bg-gray-500/10 transition-colors"
                          >
                            <span>{team.name}</span>
                            <span className="text-[0.65rem] text-gray-600">{team.poolBalance.toFixed(1)} {team.currency}</span>
                          </Link>
                        ))}
                        <Link
                          href="/swarm"
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex items-center gap-1 px-4 py-1.5 text-[0.7rem] text-gray-600 hover:text-gray-400 transition-colors"
                        >
                          <span>+</span> {t('buttons.newTeam')}
                        </Link>
                      </div>
                    )}

                    <div className="py-1">
                      <Link
                        href="/link-wallet"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-[0.8rem] text-gray-400 hover:text-white hover:bg-gray-500/10 transition-colors"
                      >
                        <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        {t('buttons.linkXAccount')}
                      </Link>
                      <button
                        onClick={() => {
                          disconnect();
                          setIsDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-[0.8rem] text-gray-400 hover:text-white hover:bg-gray-500/10 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {t('buttons.disconnect')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Mobile connect button */}
                <button
                  onClick={() => setMobileWalletModalOpen(true)}
                  className="md:hidden flex items-center gap-2 text-sm text-white tracking-wider"
                >
                  <img src="/icons/icon-settlement.svg" alt="" className="w-5 h-5" />
                </button>
                {/* Desktop connect button */}
                <button
                  onClick={() => setMobileWalletModalOpen(true)}
                  onMouseEnter={() => { setConnectHovering(true); setIsConnectHovered(true); }}
                  onMouseLeave={() => { setConnectHovering(false); setIsConnectHovered(false); }}
                  className="hidden md:flex items-center gap-2 text-sm text-white tracking-wider group cursor-pointer"
                >
                  <MorphingIcon size={22} paused={!isConnectHovered} />
                  {connectText}
                </button>
              </>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen(!isMenuOpen)}
              onMouseEnter={() => setMenuHovered(true)}
              onMouseLeave={() => setMenuHovered(false)}
              className={`cursor-pointer focus:outline-none transition-all duration-300 ${isMenuOpen ? 'fixed right-5 top-[22px] sm:top-[26px] md:top-[30px] z-[60]' : ''}`}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <svg
                className={`overflow-visible transition-all duration-300 ${isMenuOpen ? 'w-5 h-5' : 'w-6 h-6'}`}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line
                  x1={isMenuOpen ? '6' : (isMenuHovered ? '4' : '10')}
                  y1={isMenuOpen ? '6' : '6'}
                  x2={isMenuOpen ? '18' : '20'}
                  y2={isMenuOpen ? '18' : '6'}
                  stroke={isMenuHovered ? '#ffffff' : '#9ca3af'}
                  strokeWidth="1.5"
                  className="transition-all duration-300"
                />
                <line
                  x1={isMenuHovered ? '4' : '7'}
                  y1="10"
                  x2="20"
                  y2="10"
                  stroke={isMenuHovered ? '#ffffff' : '#9ca3af'}
                  strokeWidth="1.5"
                  className={`transition-all duration-300 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`}
                />
                <line
                  x1="4"
                  y1="14"
                  x2="20"
                  y2="14"
                  stroke={isMenuHovered ? '#ffffff' : '#9ca3af'}
                  strokeWidth="1.5"
                  className={`transition-all duration-300 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`}
                />
                <line
                  x1={isMenuOpen ? '6' : (isMenuHovered ? '4' : '7')}
                  y1={isMenuOpen ? '18' : '18'}
                  x2={isMenuOpen ? '18' : '20'}
                  y2={isMenuOpen ? '6' : '18'}
                  stroke={isMenuHovered ? '#ffffff' : '#9ca3af'}
                  strokeWidth="1.5"
                  className="transition-all duration-300"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out menu panel */}
      {mounted && createPortal(
        <div
          ref={menuRef}
          className={`w-72 fixed top-0 right-0 h-screen flex flex-col bg-black border-l border-gray-500/25 transform transition-transform duration-300 z-50 ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-72'
          }`}
        >
          <div className="py-4 flex flex-col h-full justify-between overflow-y-auto">
            <div>
              <Link href="/" className="flex items-center mb-8 justify-center" onClick={closeMenu}>
                <img
                  src="/media/KAMIYO_logomark.png"
                  alt="KAMIYO"
                  width="240"
                  height="64"
                  className="object-contain w-48 h-auto"
                />
              </Link>

              {/* Nav links (shown on mobile, hidden on desktop since they're in the header) */}
              <nav className="md:hidden flex flex-col items-center space-y-4 py-6 border-b border-gray-500/25">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className={`transition-colors duration-300 text-sm uppercase ${
                      pathname.startsWith(item.href) ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Secondary links */}
              <nav className="flex flex-col items-center space-y-4 py-6">
                <Link
                  href="/roadmap"
                  onClick={closeMenu}
                  className={`transition-colors duration-300 text-xs ${
                    pathname === '/roadmap' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t('nav.roadmap')}
                </Link>
                <a
                  href="https://kamiyo.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                  className="transition-colors duration-300 text-xs text-gray-500 hover:text-gray-300"
                >
                  {t('nav.website')}
                </a>
                <a
                  href="https://kamiyo.ai/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                  className="transition-colors duration-300 text-xs text-gray-500 hover:text-gray-300"
                >
                  {t('nav.docs')}
                </a>
                <a
                  href="https://kamiyo.ai/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                  className="transition-colors duration-300 text-xs text-gray-500 hover:text-gray-300"
                >
                  {t('nav.privacyPolicy')}
                </a>
                <a
                  href="https://kamiyo.ai/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                  className="transition-colors duration-300 text-xs text-gray-500 hover:text-gray-300"
                >
                  {t('nav.termsOfService')}
                </a>
              </nav>

              {/* Socials */}
              <nav className="flex flex-col items-center space-y-4 pt-6 border-t border-gray-500/25">
                <a href="https://x.com/kamiyoai" target="_blank" rel="noopener noreferrer" onClick={closeMenu} className="transition-colors duration-300 text-xs text-gray-500 hover:text-gray-300">X</a>
                <a href="https://discord.gg/6yX8kd2UpC" target="_blank" rel="noopener noreferrer" onClick={closeMenu} className="transition-colors duration-300 text-xs text-gray-500 hover:text-gray-300">Discord</a>
                <a href="https://github.com/kamiyo-ai/kamiyo-protocol" target="_blank" rel="noopener noreferrer" onClick={closeMenu} className="transition-colors duration-300 text-xs text-gray-500 hover:text-gray-300">GitHub</a>
                <a href="https://t.me/+lZwTKzO6aABhMjU0" target="_blank" rel="noopener noreferrer" onClick={closeMenu} className="transition-colors duration-300 text-xs text-gray-500 hover:text-gray-300">Telegram</a>
              </nav>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Mobile wallet connection modal */}
      <MobileWalletModal
        isOpen={isMobileWalletModalOpen}
        onClose={() => setMobileWalletModalOpen(false)}
        onDesktopConnect={() => setVisible(true)}
      />
    </>
  );
}
