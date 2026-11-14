import React, { useEffect, useRef } from 'react';

interface ConfettiBurstProps {
  burstKey: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  vr: number;
  tilt: number;
  vt: number;
  shape: 'rect' | 'circle' | 'diamond';
  alpha: number;
  decay: number;
}

const COLORS = [
  '#d97706', // amber gold
  '#f59e0b', // warm gold
  '#b45309', // deep ochre
  '#16130e', // portfolio ink
  '#065f46', // emerald
  '#be123c', // crimson
  '#f8f5ec', // parchment cream
  '#0369a1', // ocean blue
];

export default function ConfettiBurst({ burstKey }: ConfettiBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (burstKey <= 0) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const shapes: Array<'rect' | 'circle' | 'diamond'> = ['rect', 'rect', 'diamond', 'circle'];

    const spawnBurst = (originX: number, originY: number, angleDeg: number, spreadDeg: number, count: number, speedMin: number, speedMax: number) => {
      for (let i = 0; i < count; i++) {
        const angle = ((angleDeg + (Math.random() - 0.5) * spreadDeg) * Math.PI) / 180;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          w: 6 + Math.random() * 6,
          h: 4 + Math.random() * 6,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.22,
          tilt: Math.random() * Math.PI * 2,
          vt: 0.08 + Math.random() * 0.14,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          alpha: 1,
          decay: 0.0055 + Math.random() * 0.0045,
        });
      }
    };

    // Twin side cannons + center celebration shower
    spawnBurst(width * 0.15, height * 0.72, -65, 42, 42, 10, 20);
    spawnBurst(width * 0.85, height * 0.72, -115, 42, 42, 10, 20);
    spawnBurst(width * 0.5, height * 0.28, -90, 120, 44, 6, 15);

    const gravity = 0.34;
    const drag = 0.985;

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      let alive = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.alpha <= 0.02 || p.y > height + 40) continue;

        alive++;
        p.vx *= drag;
        p.vy = p.vy * drag + gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        p.tilt += p.vt;

        if (p.y > height * 0.55 || p.vy > 4) {
          p.alpha = Math.max(0, p.alpha - p.decay);
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        const scaleY = Math.cos(p.tilt);
        ctx.scale(1, Math.abs(scaleY) < 0.2 ? 0.2 : scaleY);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'diamond') {
          ctx.beginPath();
          ctx.moveTo(0, -p.h * 0.7);
          ctx.lineTo(p.w * 0.65, 0);
          ctx.lineTo(0, p.h * 0.7);
          ctx.lineTo(-p.w * 0.65, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }

        ctx.restore();
      }

      if (alive > 0) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, width, height);
    };
  }, [burstKey]);

  if (burstKey <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[90] pointer-events-none"
    />
  );
}
