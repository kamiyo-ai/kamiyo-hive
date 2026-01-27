'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useScrambleText } from '@/hooks/useScrambleText';
import MorphingIcon from '@/components/MorphingIcon';

interface FeatureCardProps {
  title: string;
  description: string;
  href: string;
}

export default function FeatureCard({ title, description, href }: FeatureCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { text: scrambledTitle, setIsHovering } = useScrambleText(title, true);

  return (
    <Link
      href={href}
      onMouseEnter={() => { setIsHovering(true); setIsHovered(true); }}
      onMouseLeave={() => { setIsHovering(false); setIsHovered(false); }}
      className="card relative p-6 rounded-xl border border-gray-500/25 block transition-all duration-300 hover:border-transparent group"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <MorphingIcon size={48} paused={!isHovered} />
        </div>
        <div>
          <h3 className="text-lg text-white mb-2 transition-colors group-hover:text-cyan">
            {scrambledTitle}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
