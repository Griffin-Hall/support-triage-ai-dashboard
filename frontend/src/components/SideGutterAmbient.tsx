import type { CSSProperties } from 'react';

interface FloatingSquare {
  size: number;
  top: string;
  inset: string;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  rotate: number;
  opacity: number;
}

const LEFT_SQUARES: FloatingSquare[] = [
  { size: 20, top: '10%', inset: '26%', duration: 24, delay: -6, driftX: 12, driftY: 20, rotate: 5, opacity: 0.42 },
  { size: 14, top: '24%', inset: '62%', duration: 30, delay: -12, driftX: 10, driftY: 16, rotate: 4, opacity: 0.32 },
  { size: 26, top: '38%', inset: '30%', duration: 34, delay: -4, driftX: 16, driftY: 26, rotate: 7, opacity: 0.34 },
  { size: 12, top: '53%', inset: '68%', duration: 22, delay: -10, driftX: 9, driftY: 14, rotate: 3, opacity: 0.36 },
  { size: 18, top: '64%', inset: '18%', duration: 28, delay: -8, driftX: 13, driftY: 18, rotate: 5, opacity: 0.3 },
  { size: 24, top: '76%', inset: '56%', duration: 36, delay: -15, driftX: 18, driftY: 24, rotate: 8, opacity: 0.28 },
  { size: 10, top: '88%', inset: '34%', duration: 20, delay: -3, driftX: 8, driftY: 11, rotate: 4, opacity: 0.33 },
];

const RIGHT_SQUARES: FloatingSquare[] = [
  { size: 16, top: '8%', inset: '24%', duration: 26, delay: -9, driftX: 10, driftY: 15, rotate: 4, opacity: 0.33 },
  { size: 22, top: '19%', inset: '58%', duration: 32, delay: -13, driftX: 14, driftY: 21, rotate: 6, opacity: 0.38 },
  { size: 12, top: '34%', inset: '28%', duration: 21, delay: -5, driftX: 9, driftY: 12, rotate: 3, opacity: 0.34 },
  { size: 28, top: '46%', inset: '64%', duration: 38, delay: -16, driftX: 18, driftY: 28, rotate: 9, opacity: 0.26 },
  { size: 14, top: '59%', inset: '38%', duration: 25, delay: -7, driftX: 11, driftY: 16, rotate: 5, opacity: 0.31 },
  { size: 20, top: '73%', inset: '70%', duration: 33, delay: -11, driftX: 15, driftY: 23, rotate: 6, opacity: 0.29 },
  { size: 11, top: '87%', inset: '30%', duration: 19, delay: -2, driftX: 8, driftY: 10, rotate: 3, opacity: 0.35 },
];

function toSquareStyle(square: FloatingSquare): CSSProperties {
  return {
    '--sq-size': `${square.size}px`,
    '--sq-top': square.top,
    '--sq-inset': square.inset,
    '--sq-duration': `${square.duration}s`,
    '--sq-delay': `${square.delay}s`,
    '--sq-drift-x': `${square.driftX}px`,
    '--sq-drift-y': `${square.driftY}px`,
    '--sq-rotate': `${square.rotate}deg`,
    '--sq-opacity': square.opacity,
  } as CSSProperties;
}

export default function SideGutterAmbient() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="gutter-ambient gutter-ambient--left">
        <div className="gutter-ambient__grid" />
        <div className="gutter-ambient__glow" />
        {LEFT_SQUARES.map((square, index) => (
          <span key={`left-${index}`} className="gutter-ambient__square" style={toSquareStyle(square)} />
        ))}
      </div>

      <div className="gutter-ambient gutter-ambient--right">
        <div className="gutter-ambient__grid" />
        <div className="gutter-ambient__glow" />
        {RIGHT_SQUARES.map((square, index) => (
          <span key={`right-${index}`} className="gutter-ambient__square" style={toSquareStyle(square)} />
        ))}
      </div>
    </div>
  );
}
