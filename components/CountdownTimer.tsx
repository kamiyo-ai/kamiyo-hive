'use client';

import { useState, useEffect } from 'react';

const TRIALS_END = new Date('2026-01-26T20:00:00Z').getTime();

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = TRIALS_END - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted || !timeLeft) {
    return (
      <div className="text-center">
        <div className="gradient-text text-[10px] sm:text-xs uppercase tracking-wider mb-2">Trials end in</div>
        <div className="text-lg sm:text-2xl font-mono text-white mb-1 tracking-wider">--:--:--:--</div>
        <div className="flex justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs text-gray-500">
          <span>days</span>
          <span>hrs</span>
          <span>min</span>
          <span>sec</span>
        </div>
      </div>
    );
  }

  const isEnded = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (isEnded) {
    return (
      <div className="text-center">
        <div className="text-gray-500 text-sm">Trials have ended</div>
      </div>
    );
  }

  const timeString = `${String(timeLeft.days).padStart(2, '0')}:${String(timeLeft.hours).padStart(2, '0')}:${String(timeLeft.minutes).padStart(2, '0')}:${String(timeLeft.seconds).padStart(2, '0')}`;

  return (
    <div className="text-center">
      <div className="gradient-text text-[10px] sm:text-xs uppercase tracking-wider mb-2">Trials end in</div>
      <div className="text-lg sm:text-2xl font-mono text-white mb-1 tracking-wider">{timeString}</div>
      <div className="flex justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs text-gray-500">
        <span>days</span>
        <span>hrs</span>
        <span>min</span>
        <span>sec</span>
      </div>
    </div>
  );
}
