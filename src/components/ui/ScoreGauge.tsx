'use client';

import { useEffect, useState } from 'react';

interface ScoreGaugeProps {
  score: number | null;
  label: string;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score < 50) return '#E53E3E';
  if (score < 90) return '#FF7F11';
  return '#22c55e';
}

export default function ScoreGauge({ score, label, size = 96 }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const displayScore = score !== null ? Math.round(score * 100) : null;

  useEffect(() => {
    if (displayScore === null) return;
    // Small delay before starting animation
    const timer = setTimeout(() => setAnimatedScore(displayScore), 100);
    return () => clearTimeout(timer);
  }, [displayScore]);

  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = displayScore !== null ? animatedScore / 100 : 0;
  const dashOffset = circumference * (1 - progress);
  const color = displayScore !== null ? getScoreColor(displayScore) : '#d1d5db';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
          />
          {/* Score arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease' }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold"
            style={{ fontSize: size * 0.28, color }}
          >
            {displayScore !== null ? displayScore : '?'}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-600 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}
