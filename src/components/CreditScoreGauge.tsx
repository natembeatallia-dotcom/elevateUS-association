import { scoreBand } from '../lib/finance';

export function CreditScoreGauge({
  score, size = 180,
}: { score: number; size?: number }) {
  const band = scoreBand(score);
  const clamped = Math.max(0, Math.min(1000, score));
  const pct = clamped / 1000;

  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // 270deg arc
  const arc = 0.75;
  const dash = c * arc;
  const offset = dash * (1 - pct);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-[135deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={band.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1), stroke 0.4s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-ink-900">{clamped}</span>
          <span className={`text-xs font-semibold ${band.text}`}>{band.label}</span>
        </div>
      </div>
      <div className="mt-2 flex w-full max-w-xs justify-between px-2 text-[10px] font-medium text-ink-400">
        <span>0</span><span>350</span><span>500</span><span>650</span><span>750</span><span>1000</span>
      </div>
    </div>
  );
}
