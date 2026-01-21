'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useScrambleText } from '@/hooks/useScrambleText';
import MorphingIcon from '@/components/MorphingIcon';

export function Header() {
  const pathname = usePathname();
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { text: connectText, setIsHovering: setConnectHovering } = useScrambleText('Connect', true);
  const [isConnectHovered, setIsConnectHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { href: '/stake', label: 'Stake' },
    { href: '/governance', label: 'Governance' },
    { href: '/escrow', label: 'Escrow' },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full bg-black/90 backdrop-blur-sm border-b border-gray-500/25 z-40">
      <div className="w-full px-5 mx-auto py-3 flex items-center justify-between" style={{ maxWidth: '1400px' }}>
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
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
              Website
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {connected && publicKey ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 text-sm text-gray-400 border border-gray-500/50 rounded px-3 py-1.5 hover:border-gray-400 transition-colors"
              >
                <svg className="w-[18px] h-[18px] brightness-150" viewBox="0 0 21 18">
                  <defs>
                    <linearGradient id="connectedIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00f0ff" />
                      <stop offset="100%" stopColor="#ff44f5" />
                    </linearGradient>
                  </defs>
                  <rect x="3.4" y="3.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="5.4" y="3.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="3.4" y="5.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="5.4" y="5.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="7.4" y="3.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="9.4" y="3.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="7.4" y="5.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="9.4" y="5.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="11.4" y="3.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="13.4" y="3.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="11.4" y="5.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="13.4" y="5.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="15.4" y="3.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="17.4" y="3.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="15.4" y="5.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="17.4" y="5.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="1.4" y="7.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="3.4" y="7.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="1.4" y="9.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="3.4" y="9.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="9.4" y="7.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="11.4" y="7.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="9.4" y="9.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="11.4" y="9.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="17.4" y="7.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="19.4" y="7.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="17.4" y="9.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="19.4" y="9.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="3.4" y="11.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="5.4" y="11.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="3.4" y="13.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="5.4" y="13.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="7.4" y="11.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="9.4" y="11.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="7.4" y="13.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="9.4" y="13.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="11.4" y="11.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="13.4" y="11.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="11.4" y="13.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="13.4" y="13.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                  <rect x="15.4" y="11.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="17.4" y="11.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="15.4" y="13.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" /><rect x="17.4" y="13.4" width="1.2" height="1.2" fill="url(#connectedIconGradient)" />
                </svg>
                <span className="font-mono text-xs">
                  {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                </span>
                <svg
                  className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-black border border-gray-500/50 rounded-lg shadow-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-500/25">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Connected</p>
                    <p className="text-sm text-white font-mono mt-1">
                      {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                    </p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/link-wallet"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-500/10 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      Link X Account
                    </Link>
                    <button
                      onClick={() => {
                        disconnect();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-500/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setVisible(true)}
              onMouseEnter={() => { setConnectHovering(true); setIsConnectHovered(true); }}
              onMouseLeave={() => { setConnectHovering(false); setIsConnectHovered(false); }}
              className="flex items-center gap-2 text-sm text-white tracking-wider group cursor-pointer"
            >
              <MorphingIcon size={22} paused={!isConnectHovered} />
              {connectText}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
