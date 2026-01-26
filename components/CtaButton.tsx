'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useScrambleText } from '@/hooks/useScrambleText';

interface CtaButtonProps {
  text: string;
  href: string;
  variant?: 'default' | 'hero';
}

export default function CtaButton({ text, href, variant = 'default' }: CtaButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { text: scrambledText, setIsHovering } = useScrambleText(text, true);

  const isHero = variant === 'hero';

  return (
    <Link
      href={href}
      onMouseEnter={() => {
        setIsHovering(true);
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        setIsHovered(false);
      }}
      className="group transition-all duration-300 relative px-5 sm:px-6 py-2.5 sm:py-3 text-white text-xs uppercase overflow-visible -ml-6 sm:-ml-8"
    >
      <span className="relative z-10 ml-6 sm:ml-8 tracking-wider transition-all duration-300 ease-out inline-block whitespace-nowrap">
        {scrambledText}
      </span>

      
      {/* Base border - hides on hover for hero variant */}
      <span className={`pointer-events-none absolute inset-0 border border-dotted cta-gradient skew-x-[-45deg] translate-x-4 transition-all duration-500 ${isHero && isHovered ? 'opacity-0' : 'opacity-100'}`} />

      {/* Expanding tunnel rings on hover - hero only */}
      {isHero && (
        <>
          <span
            className={`pointer-events-none absolute inset-0 border border-dotted skew-x-[-45deg] translate-x-4 transition-all duration-400 cta-gradient
              ${isHovered ? 'fade-out rotate-0 skew-x-[-65deg] scale-[2.2] opacity-100' : 'rotate-[85deg] skew-x-[-105deg] scale-100 opacity-0'}`}
            style={{ zIndex: -1 }}
          />
          <span
            className={`pointer-events-none absolute inset-0 border skew-x-[-45deg] translate-x-4 transition-transform duration-300 cta-gradient
              ${isHovered ? 'rotate-0 skew-x-[55deg] scale-100 opacity-100' : 'rotate-[15deg] skew-x-[-95deg] scale-100 opacity-0'}`}
            style={{ zIndex: -1 }}
          />
          <span
            className={`pointer-events-none absolute inset-0 border skew-x-[-45deg] translate-x-4 transition-transform duration-500 cta-gradient
              ${isHovered ? 'fade-out rotate-0 skew-x-[-65deg] scale-[1.5] opacity-100' : 'rotate-[25deg] skew-x-[-55deg] scale-100 opacity-0'}`}
            style={{ zIndex: -2 }}
          />
          <span
            className={`pointer-events-none absolute inset-0 border border-l-0 border-r-0 skew-x-[-45deg] translate-x-4 transition-transform duration-300 cta-gradient
              ${isHovered ? 'rotate-0 skew-x-[-85deg] opacity-100' : 'rotate-[35deg] skew-x-[-105deg] opacity-0'}`}
            style={{ zIndex: -3 }}
          />
          <span
            className={`pointer-events-none absolute inset-0 border skew-x-[-45deg] translate-x-4 transition-transform duration-700 cta-gradient
              ${isHovered ? 'fade-out rotate-0 skew-x-[-15deg] scale-[1.8] opacity-100' : 'rotate-[45deg] skew-x-[-125deg] scale-100 opacity-0'}`}
            style={{ zIndex: -4 }}
          />
        </>
      )}

      <span className={`pointer-events-none absolute inset-0 border-r border-dotted cta-gradient-border-right skew-x-[-45deg] translate-x-4 transition-all duration-300 ${isHero && isHovered ? 'opacity-0' : 'opacity-100'}`} />
      <span className={`pointer-events-none absolute bottom-0 left-[-4px] border-b border-dotted cta-gradient-border-bottom transition-all duration-300 w-full ${isHero && isHovered ? 'opacity-0' : 'opacity-100'}`} />
    </Link>
  );
}
