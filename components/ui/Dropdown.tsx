'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  className?: string;
}

export function Dropdown({ value, onChange, options, className = '' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  const menu = isOpen && typeof document !== 'undefined' ? createPortal(
    <div
      className="fixed bg-black border border-gray-500/50 rounded shadow-lg overflow-hidden"
      style={{
        top: menuPosition.top,
        left: menuPosition.left,
        width: menuPosition.width,
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            onChange(option.value);
            setIsOpen(false);
          }}
          className={`w-full px-4 py-3 text-sm text-left transition-colors ${
            option.value === value
              ? 'bg-gray-900'
              : 'text-white hover:bg-gray-900/50'
          }`}
          style={{ color: option.value === value ? '#00f0ff' : undefined }}
        >
          {option.label}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm text-left flex items-center justify-between focus:border-cyan focus:outline-none transition-colors"
      >
        <span>{selectedOption.label}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {menu}
    </div>
  );
}
