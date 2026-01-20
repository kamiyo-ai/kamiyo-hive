'use client';

import { useState } from 'react';
import { useScrambleText } from '@/hooks/useScrambleText';

interface PayButtonProps {
  text?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
}

export default function PayButton({ text = 'Submit', onClick, disabled = false }: PayButtonProps) {
  const [loading, setLoading] = useState(false);

  const isEnabled = !disabled && !loading;
  const displayText = loading ? 'Processing...' : text;
  const { text: scrambledText, setIsHovering } = useScrambleText(displayText, isEnabled);

  const handleClick = async () => {
    if (isEnabled && onClick) {
      setLoading(true);
      try {
        await onClick();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <button
      onClick={isEnabled ? handleClick : undefined}
      onMouseEnter={() => isEnabled && setIsHovering(true)}
      onMouseLeave={() => isEnabled && setIsHovering(false)}
      disabled={!isEnabled}
      className={`group transition-all duration-300 relative px-6 py-3 bg-transparent text-white text-xs uppercase overflow-visible -ml-8
        ${!isEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className="relative z-10 ml-8 tracking-wider transition-all duration-300 ease-out inline-block min-w-max">
        {scrambledText}
      </span>

      <span
        className={`pointer-events-none absolute inset-0 border border-dotted cta-gradient skew-x-[-45deg] translate-x-4 transition-all duration-300`}
      />
      <span
        className={`pointer-events-none absolute inset-0 border-r border-dotted cta-gradient-border-right skew-x-[-45deg] translate-x-4 transition-all duration-300`}
      />
      <span
        className={`pointer-events-none absolute bottom-0 left-[-4px] w-full border-b border-dotted cta-gradient-border-bottom transition-all duration-300`}
      />
    </button>
  );
}
