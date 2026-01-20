'use client';

import { useState, useEffect } from 'react';

export function useScrambleText(originalText: string, enabled = true, loading = false) {
  const [text, setText] = useState(loading ? 'Initiating...' : originalText);
  const [isHovering, setIsHovering] = useState(false);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  useEffect(() => {
    let scrambleInterval: NodeJS.Timeout;

    if (!enabled) {
      setText(originalText);
      return;
    }

    if (loading) {
      continuousScramble();
      return;
    }

    if (isHovering) {
      scrambleLetters();
    } else {
      descrambleLetters();
    }

    function continuousScramble() {
      setText(
        originalText
          .split('')
          .map(() => chars[Math.floor(Math.random() * chars.length)])
          .join('')
      );

      scrambleInterval = setInterval(() => {
        setText(
          originalText
            .split('')
            .map(() => chars[Math.floor(Math.random() * chars.length)])
            .join('')
        );
      }, 50);
    }

    function scrambleLetters() {
      if (!enabled) return;

      let progress = 0;
      scrambleInterval = setInterval(() => {
        if (progress >= originalText.length) {
          clearInterval(scrambleInterval);
          return;
        }
        setText((prevText) =>
          prevText
            .split('')
            .map((char, index) =>
              index < progress ? originalText[index] : chars[Math.floor(Math.random() * chars.length)]
            )
            .join('')
        );
        progress++;
      }, 45);
    }

    function descrambleLetters() {
      if (!enabled) return;

      let progress = originalText.length;
      scrambleInterval = setInterval(() => {
        if (progress <= 0) {
          clearInterval(scrambleInterval);
          setText(originalText);
          return;
        }
        setText((prevText) =>
          prevText
            .split('')
            .map((char, index) =>
              index >= progress ? originalText[index] : chars[Math.floor(Math.random() * chars.length)]
            )
            .join('')
        );
        progress--;
      }, 35);
    }

    return () => clearInterval(scrambleInterval);
  }, [isHovering, enabled, loading, originalText, chars]);

  return { text, setIsHovering };
}
