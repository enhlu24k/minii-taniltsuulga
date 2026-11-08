import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Compass,
  ExternalLink,
  Code2,
  Wrench,
  Trophy,
  Music,
  Boxes,
  Calculator,
  Mail,
  Gamepad2,
  Languages,
  Sparkles,
  Eye,
  Copy,
  Check,
  Globe,
  Share2,
  ChevronRight,
  Flame,
  User,
  Heart,
  Flag,
  RotateCcw
} from 'lucide-react';

const P = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_';
const SHIP = P + '20261031_024714_39df675e-5060-4528-87dc-9d0c274815aa.png&w=1600&q=90';
const CAPT = P + '20261031_024703_a0298b6a-0117-47f1-8462-4be671d0407e.png&w=2048&q=90';
const PLANTS = P + '20261031_024704_3ccf1ac2-bec7-4fdb-bfce-ac19eca8db28.png&w=2048&q=90';

// Sprite boxes on 2048x1360 sheets: [img, x, y, w, h]
const BOX: Record<string, [string, number, number, number, number]> = {
  capt:  [CAPT, 34, 153, 1246, 1074],
  chest: [CAPT, 1475, 830, 446, 392],
  palm:  [PLANTS, 19, 32, 910, 1284],
  bushL: [PLANTS, 515, 820, 860, 496],
  bushR: [PLANTS, 1528, 908, 499, 405]
};

const LAY = {
  land: {
    w: 1600, h: 900,
    wave: { y0: 748, y1: 272, gap0: 1, gap1: 0.6 },
    ship: { x0: 1130, w0: 710, x1: 1345, w1: 176 },
    palm: { x: -92, y: -112, w: 620 },
    capt: { x: 120, y: 318, w: 540 },
    chest: { x: 640, y: 628, w: 200 },
    bushL: { x: 96, y: 716, w: 700 },
    bushR: { x: 1370, y: 740, w: 300 }
  },
  port: {
    w: 800, h: 1500,
    wave: { y0: 1300, y1: 430, gap0: 1, gap1: 0.7 },
    ship: { x0: 420, w0: 620, x1: 640, w1: 150 },
    palm: { x: -150, y: -60, w: 560 },
    capt: { x: 20, y: 440, w: 600 },
    chest: { x: 560, y: 830, w: 190 },
    bushL: { x: -40, y: 1330, w: 520 },
    bushR: { x: 570, y: 1340, w: 260 }
  }
};

interface WaveLayer {
  dy: number;
  a: number;
  k: number;
  v: number;
  ph: number;
  fill?: string;
  span?: [number, number];
}

const BACK: WaveLayer[] = [
  { dy: -100, a: 20, k: 1.5, v: 0.9, ph: 0, fill: 'var(--band)' },
  { dy: -52, a: 23, k: 1.9, v: 1.15, ph: 1.7, fill: 'var(--paper)' }
];

const FRONT: WaveLayer[] = [
  { dy: 0, a: 25, k: 1.7, v: 1.3, ph: 3.1, fill: 'var(--band2)' },
  { dy: 26, a: 18, k: 2.4, v: 1, ph: 4.4, span: [0.06, 0.44] },
  { dy: 48, a: 22, k: 1.45, v: 1.4, ph: 0.6, fill: 'var(--paper)' },
  { dy: 76, a: 15, k: 2.1, v: 1.2, ph: 5.1, span: [0.52, 0.97] },
  { dy: 104, a: 24, k: 1.8, v: 1.25, ph: 2.2, fill: 'var(--paper)' },
  { dy: 130, a: 14, k: 2.7, v: 1, ph: 1.1, span: [0.0, 0.62] },
  { dy: 158, a: 20, k: 1.6, v: 1.1, ph: 3.8 }
];

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function seg(p: number, a: number, b: number): number {
  return clamp((p - a) / (b - a));
}

function io(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

function out(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

function back(k: number): number {
  return 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
}

function yAt(l: WaveLayer, x: number, t: number, p: number, L: typeof LAY.land | typeof LAY.port): number {
  const W = L.wave;
  const base = mix(W.y0, W.y1, p) + l.dy * mix(W.gap0, W.gap1, p);
  const a = l.a * mix(1, 0.72, p);
  const f = ((2 * Math.PI) / 1100) * l.k * (1 - 0.35 * p);
  return (
    base +
    a * Math.sin(f * x + t * l.v + l.ph) +
    a * 0.45 * Math.sin(f * 2.3 * x - t * l.v * 0.7 + l.ph * 1.7)
  );
}

// Generate CSS for sprite cropping
function spriteStyle(key: keyof typeof BOX) {
  const [img, x, y, w, h] = BOX[key];
  const bgSizeX = (2048 / w) * 100;
  const bgSizeY = (1360 / h) * 100;
  const bgPosX = (x / (2048 - w)) * 100;
  const bgPosY = (y / (1360 - h)) * 100;
  return {
    backgroundImage: `url("${img}")`,
    backgroundSize: `${bgSizeX.toFixed(4)}% ${bgSizeY.toFixed(4)}%`,
    backgroundPosition: `${bgPosX.toFixed(4)}% ${bgPosY.toFixed(4)}%`
  };
}

export default function App() {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'projects' | 'about' | 'interests' | 'contact'>('projects');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openModal = (tab: 'projects' | 'about' | 'interests' | 'contact' = 'projects') => {
    setActiveTab(tab);
    setShowModal(true);
  };

  const copyEmail = () => {
    navigator.clipboard?.writeText('benkhluun69@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const frameRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const shadeRef = useRef<HTMLCanvasElement | null>(null);
  const wBackRef = useRef<SVGSVGElement | null>(null);
  const wFrontRef = useRef<SVGSVGElement | null>(null);

  const t1Ref = useRef<HTMLDivElement | null>(null);
  const t2Ref = useRef<HTMLDivElement | null>(null);
  const h2Ref = useRef<HTMLHeadingElement | null>(null);
  const p2Ref = useRef<HTMLParagraphElement | null>(null);
  const btn2Ref = useRef<HTMLSpanElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const cloudARef = useRef<HTMLDivElement | null>(null);
  const shipRef = useRef<HTMLDivElement | null>(null);
  const palmRef = useRef<HTMLDivElement | null>(null);
  const captRef = useRef<HTMLDivElement | null>(null);
  const chestRef = useRef<HTMLDivElement | null>(null);
  const bushLRef = useRef<HTMLDivElement | null>(null);
  const bushRRef = useRef<HTMLDivElement | null>(null);
  const curRef = useRef<HTMLDivElement | null>(null);
  const pingRef = useRef<HTMLDivElement | null>(null);

  // Keep go() accessible to buttons
  const goRef = useRef<(to: number) => void>(() => {});

  useEffect(() => {
    const frame = frameRef.current;
    const scene = sceneRef.current;
    const shade = shadeRef.current;
    const wBack = wBackRef.current;
    const wFront = wFrontRef.current;
    const t1 = t1Ref.current;
    const t2 = t2Ref.current;
    const h2 = h2Ref.current;
    const p2 = p2Ref.current;
    const btn2 = btn2Ref.current;
    const logo = logoRef.current;
    const cloudA = cloudARef.current;
    const ship = shipRef.current;
    const palm = palmRef.current;
    const capt = captRef.current;
    const chest = chestRef.current;
    const bushL = bushLRef.current;
    const bushR = bushRRef.current;
    const cur = curRef.current;
    const ping = pingRef.current;

    if (!frame || !scene || !shade || !wBack || !wFront || !ship || !t1 || !t2 || !h2 || !p2 || !btn2 || !logo || !cloudA || !palm || !capt || !chest || !bushL || !bushR) {
      return;
    }

    const _frame: HTMLDivElement = frame;
    const _scene: HTMLDivElement = scene;
    const _shade: HTMLCanvasElement = shade;
    const _wBack: SVGSVGElement = wBack;
    const _wFront: SVGSVGElement = wFront;
    const _t1: HTMLDivElement = t1;
    const _t2: HTMLDivElement = t2;
    const _h2: HTMLHeadingElement = h2;
    const _p2: HTMLParagraphElement = p2;
    const _btn2: HTMLSpanElement = btn2;
    const _logo: HTMLDivElement = logo;
    const _cloudA: HTMLDivElement = cloudA;
    const _ship: HTMLDivElement = ship;
    const _palm: HTMLDivElement = palm;
    const _capt: HTMLDivElement = capt;
    const _chest: HTMLDivElement = chest;
    const _bushL: HTMLDivElement = bushL;
    const _bushR: HTMLDivElement = bushR;

    // Check fine pointer
    const isFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (isFine) {
      document.documentElement.classList.add('fine');
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Build SVG paths for back and front waves
    _wBack.innerHTML = '';
    const backPaths = BACK.map((l) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('stroke', 'var(--line)');
      p.setAttribute('stroke-width', '3.2');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('fill', l.fill || 'none');
      _wBack.appendChild(p);
      return { path: p, layer: l };
    });

    _wFront.innerHTML = '';
    const frontPaths = FRONT.map((l) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('stroke', 'var(--line)');
      p.setAttribute('stroke-width', '3.2');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('fill', l.fill || 'none');
      _wFront.appendChild(p);
      return { path: p, layer: l };
    });

    // Draw palm shade once on low-res 64x36 canvas
    _shade.width = 64;
    _shade.height = 36;
    const sCtx = _shade.getContext('2d');
    if (sCtx) {
      sCtx.scale(0.5, 0.5);
      sCtx.fillStyle = '#ffffff';
      sCtx.fillRect(0, 0, 128, 72);
      sCtx.strokeStyle = 'rgba(120, 114, 96, 0.9)';
      sCtx.lineCap = 'round';
      const curves: [number, number, number, number, number][] = [
        [-10, 26, 38, -8, 8],
        [-8, 46, 58, -2, 5],
        [-10, 62, 74, 6, 4],
        [14, 78, 96, 16, 4],
        [40, 82, 118, 22, 3],
        [78, 80, 140, 34, 5],
        [-12, 74, 22, 56, 6]
      ];
      curves.forEach(([x0, y0, x1, y1, lw]) => {
        sCtx.lineWidth = lw;
        sCtx.beginPath();
        sCtx.moveTo(x0, y0);
        sCtx.quadraticCurveTo((x0 + x1) / 2 + 6, (y0 + y1) / 2 + 8, x1, y1);
        sCtx.stroke();
      });
    }

    // Layout variables
    let W = _frame.clientWidth;
    let H = _frame.clientHeight;
    let portrait = H > W;
    let L = portrait ? LAY.port : LAY.land;
    let S = Math.min(W / L.w, H / L.h);
    let DW = W / S;
    let DH = H / S;
    let DX = (DW - L.w) / 2;
    let DY = (DH - L.h) / 2;

    function resize() {
      W = _frame.clientWidth;
      H = _frame.clientHeight;
      portrait = H > W;
      document.documentElement.classList.toggle('portrait', portrait);
      L = portrait ? LAY.port : LAY.land;
      S = Math.min(W / L.w, H / L.h);
      DW = W / S;
      DH = H / S;
      DX = (DW - L.w) / 2;
      DY = (DH - L.h) / 2;
      _scene.style.transform = `translate(${DX * S}px, ${DY * S}px) scale(${S})`;

      _wBack.setAttribute('width', String(L.w));
      _wBack.setAttribute('height', String(L.h));
      _wBack.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);

      _wFront.setAttribute('width', String(L.w));
      _wFront.setAttribute('height', String(L.h));
      _wFront.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);

      // Static positions of elements
      _palm.style.width = L.palm.w + 'px';
      _palm.style.height = L.palm.w * (1284 / 910) + 'px';
      _palm.style.left = L.palm.x + 'px';
      _palm.style.top = L.palm.y + 'px';

      _capt.style.width = L.capt.w + 'px';
      _capt.style.height = L.capt.w * (1074 / 1246) + 'px';
      _capt.style.left = L.capt.x + 'px';
      _capt.style.top = L.capt.y + 'px';

      _chest.style.width = L.chest.w + 'px';
      _chest.style.height = L.chest.w * (392 / 446) + 'px';
      _chest.style.left = L.chest.x + 'px';
      _chest.style.top = L.chest.y + 'px';

      _bushL.style.width = L.bushL.w + 'px';
      _bushL.style.height = L.bushL.w * (496 / 860) + 'px';
      _bushL.style.left = L.bushL.x + 'px';
      _bushL.style.top = L.bushL.y + 'px';

      _bushR.style.width = L.bushR.w + 'px';
      _bushR.style.height = L.bushR.w * (405 / 499) + 'px';
      _bushR.style.left = L.bushR.x + 'px';
      _bushR.style.top = L.bushR.y + 'px';
    }

    resize();
    window.addEventListener('resize', resize);

    // Transition & Animation state
    let p = 0;
    let pFrom = 0;
    let pTo = 0;
    let pT0 = -10000;
    const t0 = performance.now();
    let wheelLockedUntil = 0;

    const go = (to: number) => {
      if (to === pTo) return;
      pFrom = p;
      pTo = to;
      pT0 = performance.now();
    };
    goRef.current = go;

    // Cursor tracking
    let mx = -100;
    let my = -100;
    let curX = -100;
    let curY = -100;
    let isDown = false;
    let isHoverLink = false;
    let pingX = 0;
    let pingY = 0;
    let pingT0 = -10000;

    const onPointerMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      const target = e.target as HTMLElement | null;
      isHoverLink = !!target?.closest('a, button, .pill, [data-go], .logo');
    };

    const onPointerDown = (e: PointerEvent) => {
      isDown = true;
      pingX = e.clientX;
      pingY = e.clientY;
      pingT0 = performance.now();
    };

    const onPointerUp = () => {
      isDown = false;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    // Wheel navigation
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (wheelLockedUntil > now) return;
      if (e.deltaY > 8) {
        go(1);
        wheelLockedUntil = now + 1200;
      } else if (e.deltaY < -8) {
        go(0);
        wheelLockedUntil = now + 1200;
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });

    // Clicks on data-go
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const goBtn = target?.closest('[data-go]') as HTMLElement | null;
      if (goBtn) {
        e.preventDefault();
        const targetGo = Number(goBtn.getAttribute('data-go'));
        go(targetGo);
        return;
      }
      const link = target?.closest('a[href="#"]');
      if (link) {
        e.preventDefault();
      }
    };
    window.addEventListener('click', onClick);

    // Build wave path
    function buildWavePath(l: WaveLayer, t: number, pVal: number): string {
      const x0 = -DX - 20;
      const x1 = L.w + DX + 20;
      const bottomY = L.h + DY + 40;
      const startX = l.span ? x0 + (x1 - x0) * l.span[0] : x0;
      const endX = l.span ? x0 + (x1 - x0) * l.span[1] : x1;

      let d = '';
      let isFirst = true;
      for (let x = startX; x <= endX; x += 22) {
        const y = yAt(l, x, t, pVal, L);
        if (isFirst) {
          d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
          isFirst = false;
        } else {
          d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      }
      const yFinal = yAt(l, endX, t, pVal, L);
      d += ` L${endX.toFixed(1)} ${yFinal.toFixed(1)}`;

      if (l.fill) {
        d += ` L${endX.toFixed(1)} ${bottomY.toFixed(1)} L${startX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
      }
      return d;
    }

    // Main render loop
    let animId: number;
    let lastNow = performance.now();

    function render(now: number) {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;

      // Update transition progress p
      const DUR = reducedMotion ? 1 : 2100;
      const kTrans = seg(now, pT0, pT0 + DUR);
      p = mix(pFrom, pTo, io(kTrans));

      const t = reducedMotion ? 0 : (now - t0) / 1000;

      // Update wave paths
      backPaths.forEach(({ path, layer }) => {
        path.setAttribute('d', buildWavePath(layer, t, p));
      });
      frontPaths.forEach(({ path, layer }) => {
        path.setAttribute('d', buildWavePath(layer, t, p));
      });

      // Ship positioning
      const c = L.ship;
      const sw = mix(c.w0, c.w1, p);
      const sx = mix(c.x0, c.x1, p);
      const sh = (sw * 2002) / 1961;
      const wy = yAt(FRONT[0], sx, t, p, L);
      const shipLeft = sx - sw / 2;
      const shipTop = wy + sw * 0.05 - sh;
      const slope = (yAt(FRONT[0], sx + 90, t, p, L) - yAt(FRONT[0], sx - 90, t, p, L)) / 180;
      const rot = Math.atan(slope) * 57.3 * 0.75;

      _ship.style.width = sw.toFixed(1) + 'px';
      _ship.style.height = sh.toFixed(1) + 'px';
      _ship.style.left = shipLeft.toFixed(1) + 'px';
      _ship.style.top = shipTop.toFixed(1) + 'px';
      _ship.style.transform = `rotate(${rot.toFixed(2)}deg)`;

      // Cloud
      const cloudX = ((((L.w * 0.72 - t * 16) % (L.w + 700)) + (L.w + 700)) % (L.w + 700)) - 400;
      _cloudA.style.left = cloudX.toFixed(1) + 'px';
      _cloudA.style.top = (portrait ? 110 : 150) + 'px';
      _cloudA.style.opacity = (1 - seg(p, 0.3, 0.7)).toFixed(3);

      // Intro
      const intro = out(seg(now, t0 + 200, t0 + 1100));

      // .t1
      _t1.style.opacity = (intro * (1 - seg(p, 0.62, 0.7))).toFixed(3);
      _t1.style.transform = `translateY(${((1 - intro) * 26 - p * 40).toFixed(2)}px)`;
      _t1.style.pointerEvents = p > 0.1 ? 'none' : 'auto';

      // Logo
      _logo.style.opacity = (1 - seg(p, 0.12, 0.3)).toFixed(3);

      // Island
      const e = io(seg(p, 0.04, 0.92));
      _palm.style.transform = `translate(${mix(-L.palm.w - 80, 0, e).toFixed(2)}px, ${mix(-170, 0, e).toFixed(2)}px) rotate(${(Math.sin(t * 0.8) * 0.7).toFixed(2)}deg)`;
      _capt.style.transform = `translateX(${mix(-L.capt.w - 160, 0, e).toFixed(2)}px) rotate(${(Math.sin(t * 1.1) * 0.5 * p).toFixed(2)}deg)`;
      _chest.style.transform = `translate(${mix(-L.chest.w - 720, 0, e).toFixed(2)}px, ${mix(120, 0, e).toFixed(2)}px)`;

      // Foreground
      const b = out(seg(p, 0.5, 1));
      _bushL.style.transform = `translateY(${mix(340, 0, b).toFixed(2)}px)`;
      _bushR.style.transform = `translateY(${mix(300, 0, b).toFixed(2)}px)`;

      // Scene 2 Copy
      const hk = seg(p, 0.42, 0.82);
      _h2.style.opacity = (hk * hk).toFixed(3);
      _h2.style.transform = `translateY(${mix(70, 0, out(hk)).toFixed(2)}px)`;

      const pk = seg(p, 0.76, 0.92);
      _p2.style.opacity = pk.toFixed(3);
      _p2.style.transform = `translateY(${mix(16, 0, pk).toFixed(2)}px)`;

      const bk = seg(p, 0.86, 1);
      _btn2.style.opacity = bk.toFixed(3);
      _btn2.style.transform = `scale(${mix(0.7, 1, back(bk)).toFixed(3)})`;
      _t2.style.pointerEvents = p > 0.9 ? 'auto' : 'none';

      // Palm shade canvas
      _shade.style.transform = `translate(${(Math.sin(t * 0.35) * 2.2).toFixed(2)}%, ${(Math.cos(t * 0.27) * 1.6).toFixed(2)}%) rotate(${(Math.sin(t * 0.22) * 0.8).toFixed(2)}deg)`;

      // Cursor easing
      if (cur && isFine) {
        const curScale = isDown ? 0.7 : isHoverLink ? 1.35 : 1;
        const f = 1 - Math.exp(-dt * 22);
        curX += (mx - curX) * f;
        curY += (my - curY) * f;
        cur.style.transform = `translate(${curX.toFixed(1)}px, ${curY.toFixed(1)}px) scale(${curScale})`;
      }

      // Cursor ping
      if (ping && isFine) {
        const pingAge = now - pingT0;
        if (pingAge < 650) {
          const pkVal = pingAge / 650;
          ping.style.display = 'block';
          ping.style.transform = `translate(${pingX.toFixed(1)}px, ${pingY.toFixed(1)}px) scale(${(1 + out(pkVal) * 1.9).toFixed(3)})`;
          ping.style.opacity = (1 - pkVal).toFixed(3);
        } else {
          ping.style.display = 'none';
        }
      }

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('click', onClick);
      document.documentElement.classList.remove('fine', 'portrait');
    };
  }, []);

  return (
    <>
      <main className="frame" id="frame" ref={frameRef}>
        {/* Logo */}
        <div
          className="logo"
          ref={logoRef}
          data-go="0"
          title="Энхлүүн — Нүүр хуудас"
        >
          <svg viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="13" cy="4.5" r="2.8" />
            <path d="M13 7.5V28M7 12h12M2.5 19c.6 5.5 5.5 9 10.5 9s9.9-3.5 10.5-9" />
            <path d="m1 21 1.5-2.5L5 20.5M25 21l-1.5-2.5-2.5 2" />
          </svg>
          <span>Enkhluun</span>
        </div>

        {/* Nav */}
        <nav>
          <a href="#" data-go="0" title="Нүүр хуудас">
            Нүүр
            <svg viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <circle cx="13" cy="4.5" r="2.8" />
              <path d="M13 7.5V28M7 12h12M2.5 19c.6 5.5 5.5 9 10.5 9s9.9-3.5 10.5-9" />
            </svg>
          </a>
          <a href="#" data-go="1" title="Миний тухай">
            Миний тухай
            <svg viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <circle cx="13" cy="4.5" r="2.8" />
              <path d="M13 7.5V28M7 12h12M2.5 19c.6 5.5 5.5 9 10.5 9s9.9-3.5 10.5-9" />
            </svg>
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openModal('projects');
            }}
            className="highlight-nav flex items-center gap-1.5 font-bold"
            title="Миний бүтээлүүд"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Миний бүтээлүүд
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openModal('interests');
            }}
            title="Сонирхол ба холбоосууд"
          >
            Сонирхол
            <svg viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <circle cx="13" cy="4.5" r="2.8" />
              <path d="M13 7.5V28M7 12h12M2.5 19c.6 5.5 5.5 9 10.5 9s9.9-3.5 10.5-9" />
            </svg>
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openModal('contact');
            }}
            title="Холбоо барих"
          >
            Холбогдох
            <svg viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <circle cx="13" cy="4.5" r="2.8" />
              <path d="M13 7.5V28M7 12h12M2.5 19c.6 5.5 5.5 9 10.5 9s9.9-3.5 10.5-9" />
            </svg>
          </a>
        </nav>

        {/* Scene Container */}
        <div id="scene" ref={sceneRef}>
          {/* Cloud */}
          <div className="spr" id="cloudA" ref={cloudARef}>
            <svg viewBox="0 0 300 80" width="300" height="80">
              <path
                fill="#d3cebe"
                d="M0 79c14-3 26-3 38-10-4-16 10-30 30-26 6-22 42-34 62-16 16-12 42-6 50 14 10-2 18 2 22 8 24 22 66 26 98 30z"
              />
            </svg>
          </div>

          {/* Back Waves */}
          <svg className="w" id="wBack" ref={wBackRef}></svg>

          {/* Scene 1 Copy */}
          <div className="t1" id="t1" ref={t1Ref}>
            <div className="eb tracking-wider">12 Настай Бүтээгч · Ирээдүйн Mechanical Engineer</div>
            <h1>
              Sain uu,<br />namaig Enkhluun gedeg
            </h1>
            <div className="flex items-center gap-3 mt-8 flex-wrap">
              <button
                type="button"
                onClick={() => openModal('projects')}
                className="pill flex items-center gap-2 bg-[#e2dcce] hover:bg-[#d8d0bf] font-bold"
              >
                <Sparkles className="w-4 h-4 text-amber-700" />
                Миний бүтээлүүд
              </button>
              <button
                type="button"
                onClick={() => goRef.current(1)}
                className="pill bg-[#f5f1e6] hover:bg-[#eae3d2]"
              >
                Миний тухай үзэх
              </button>
            </div>
          </div>

          {/* Ship */}
          <div
            className="spr"
            id="ship"
            ref={shipRef}
            style={{ backgroundImage: `url("${SHIP}")` }}
          ></div>

          {/* Front Waves */}
          <svg className="w" id="wFront" ref={wFrontRef}></svg>

          {/* Island Sprites */}
          <div className="spr" id="palm" ref={palmRef} style={spriteStyle('palm')}></div>
          <div className="spr" id="capt" ref={captRef} style={spriteStyle('capt')}></div>
          <div className="spr" id="chest" ref={chestRef} style={spriteStyle('chest')}></div>
          <div className="spr" id="bushL" ref={bushLRef} style={spriteStyle('bushL')}></div>
          <div className="spr" id="bushR" ref={bushRRef} style={spriteStyle('bushR')}></div>

          {/* Scene 2 Copy */}
          <div className="t2" id="t2" ref={t2Ref}>
            <h2 id="h2" ref={h2Ref}>
              Механик &amp;<br />Инноваци
            </h2>
            <p id="p2" ref={p2Ref}>
              12 нас · 18+ LEGO угсрагч · Морин хуурч · Картинг уралдаанч · Код бүтээгч
            </p>
            <span className="btnw" id="btn2" ref={btn2Ref}>
              <i className="tick a"></i>
              <i className="tick b"></i>
              <i className="tick c"></i>
              <button
                type="button"
                className="pill"
                onClick={(e) => {
                  e.preventDefault();
                  openModal('about');
                }}
              >
                Бүх мэдээллийг үзэх
              </button>
            </span>
          </div>
        </div>

        {/* Palm Frond Shade Canvas */}
        <canvas id="shade" ref={shadeRef}></canvas>
      </main>

      {/* Custom Ring Cursor */}
      <div id="ping" ref={pingRef}></div>
      <div id="cur" ref={curRef}></div>

      {/* Comprehensive Modal: Бүтээлүүд & Миний тухай */}
      {showModal && (
        <div
          className="articles-modal-backdrop"
          onClick={() => {
            setShowModal(false);
            setPreviewUrl(null);
          }}
        >
          <div
            className="articles-scroll"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b-2 border-[var(--line)] pb-4 mb-4">
              <div>
                <div className="text-[11px] font-bold tracking-[0.2em] text-[#6d6657] uppercase font-mono">
                  Enkhluun · Personal Portfolio &amp; Projects
                </div>
                <h3 className="text-2xl font-bold uppercase tracking-tight text-[var(--ink)] font-serif mt-0.5">
                  Энхлүүн · 12 Настай Бүтээгч
                </h3>
                <p className="text-xs text-[#5a5243] mt-0.5 font-medium">
                  Mechanical Engineer болох мөрөөдөлтэй сурагч ба код бүтээгч
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setPreviewUrl(null);
                }}
                className="p-1.5 rounded-lg border-2 border-[var(--line)] bg-[#e8e2d2] text-[var(--ink)] hover:bg-[#dbd3be] transition-colors cursor-pointer"
                aria-label="Хаах"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 mb-5 p-1.5 bg-[#e4decd] border-2 border-[var(--line)] rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeTab === 'projects'
                    ? 'bg-[var(--line)] text-[var(--paper)] shadow-sm'
                    : 'text-[#4a4235] hover:bg-[#d6cfbc]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                Миний бүтээлүүд
                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-stone-900 rounded-full text-[10px] font-extrabold">
                  2
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('about')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeTab === 'about'
                    ? 'bg-[var(--line)] text-[var(--paper)] shadow-sm'
                    : 'text-[#4a4235] hover:bg-[#d6cfbc]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Миний тухай
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('interests')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeTab === 'interests'
                    ? 'bg-[var(--line)] text-[var(--paper)] shadow-sm'
                    : 'text-[#4a4235] hover:bg-[#d6cfbc]'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Сонирхол ба Холбоосууд
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contact')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeTab === 'contact'
                    ? 'bg-[var(--line)] text-[var(--paper)] shadow-sm'
                    : 'text-[#4a4235] hover:bg-[#d6cfbc]'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Холбоо барих
              </button>
            </div>

            {/* TAB 1: МИНИЙ БҮТЭЭЛҮҮД */}
            {activeTab === 'projects' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#e8e2d0] border-2 border-[var(--line)] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--ink)] uppercase flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-700" />
                      Миний хийсэн бүтээлүүд
                    </h4>
                    <p className="text-xs text-[#554d3e] mt-0.5">
                      Энхлүүний бие даан код бичиж Netlify дээр байршуулсан бодит төслүүд
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-1 bg-[#d5cebc] rounded border border-[var(--line)]">
                    2 Веб Төсөл
                  </span>
                </div>

                {/* Project 1: eb-7c34ee.netlify.app */}
                <div className="p-4 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl shadow-sm transition-all hover:border-[#000]">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-800 text-emerald-100 rounded">
                          Бие даасан веб
                        </span>
                        <span className="text-[11px] text-[#736a57] font-mono">Netlify Deploy</span>
                      </div>
                      <h5 className="text-base font-bold text-[var(--ink)] mt-1.5">
                        Minii uuruu code bichsen taniltsuulga site
                      </h5>
                      <p className="text-xs text-[#4d4436] mt-1 leading-relaxed">
                        Энхлүүний өөрөө код бичиж бүтээсэн онлайн танилцуулга хуудас. Мөрөөдөл, сонирхол, өөрийн тухай бүх мэдээллээ бүтэцтэйгээр кодчилсон бүтээл.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">HTML5</span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">CSS3</span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">Web Layout</span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">Netlify</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 shrink-0 mt-2 sm:mt-0">
                      <a
                        href="https://eb-7c34ee.netlify.app/"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--line)] text-stone-100 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
                      >
                        <span>Сайтаар зочлох</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(previewUrl === 'https://eb-7c34ee.netlify.app/' ? null : 'https://eb-7c34ee.netlify.app/')}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 border border-[var(--line)] bg-[#ede7d8] rounded-lg text-xs font-medium hover:bg-[#dfd7c4] transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{previewUrl === 'https://eb-7c34ee.netlify.app/' ? 'Урьдчилан харахыг хаах' : 'Энд харах'}</span>
                      </button>
                    </div>
                  </div>

                  {previewUrl === 'https://eb-7c34ee.netlify.app/' && (
                    <div className="mt-3 pt-3 border-t border-[var(--line)]">
                      <div className="flex justify-between items-center mb-1.5 text-xs text-[#615949]">
                        <span>Шууд харагдац (Live Preview):</span>
                        <a href="https://eb-7c34ee.netlify.app/" target="_blank" rel="noreferrer" className="underline font-mono">
                          https://eb-7c34ee.netlify.app/
                        </a>
                      </div>
                      <iframe
                        src="https://eb-7c34ee.netlify.app/"
                        title="Enkhluun Portfolio Preview"
                        className="w-full h-72 border-2 border-[var(--line)] rounded-lg bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Project 2: js-practicee.netlify.app */}
                <div className="p-4 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl shadow-sm transition-all hover:border-[#000]">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-700 text-amber-100 rounded">
                          JavaScript дасгал
                        </span>
                        <span className="text-[11px] text-[#736a57] font-mono">Netlify Deploy</span>
                      </div>
                      <h5 className="text-base font-bold text-[var(--ink)] mt-1.5">
                        minii anhnii javascript dasgal
                      </h5>
                      <p className="text-xs text-[#4d4436] mt-1 leading-relaxed">
                        JavaScript програмчлалын хэл сурч эхлэхдээ хийсэн анхны дасгал ажил, тооцоолол, интерактив логик туршилтууд.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">JavaScript</span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">DOM Logic</span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">Practice</span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">Netlify</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 shrink-0 mt-2 sm:mt-0">
                      <a
                        href="https://js-practicee.netlify.app/"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--line)] text-stone-100 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
                      >
                        <span>Сайтаар зочлох</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(previewUrl === 'https://js-practicee.netlify.app/' ? null : 'https://js-practicee.netlify.app/')}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 border border-[var(--line)] bg-[#ede7d8] rounded-lg text-xs font-medium hover:bg-[#dfd7c4] transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{previewUrl === 'https://js-practicee.netlify.app/' ? 'Урьдчилан харахыг хаах' : 'Энд харах'}</span>
                      </button>
                    </div>
                  </div>

                  {previewUrl === 'https://js-practicee.netlify.app/' && (
                    <div className="mt-3 pt-3 border-t border-[var(--line)]">
                      <div className="flex justify-between items-center mb-1.5 text-xs text-[#615949]">
                        <span>Шууд харагдац (Live Preview):</span>
                        <a href="https://js-practicee.netlify.app/" target="_blank" rel="noreferrer" className="underline font-mono">
                          https://js-practicee.netlify.app/
                        </a>
                      </div>
                      <iframe
                        src="https://js-practicee.netlify.app/"
                        title="JS Practice Preview"
                        className="w-full h-72 border-2 border-[var(--line)] rounded-lg bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Additional Engineering & Creative Highlights */}
                <div className="pt-2">
                  <div className="text-xs uppercase font-bold text-[#635b4b] mb-2 tracking-wider">
                    Бусад инженерчлэл &amp; бүтээлч туршлагууд
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 bg-[#e6dfce] border-2 border-[var(--line)] rounded-xl">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        <Boxes className="w-4 h-4 text-rose-700" />
                        18+ LEGO загварууд
                      </div>
                      <p className="text-[11px] text-[#4d4436] mt-1 leading-normal">
                        Нарийн төвөгтэй 18+ LEGO загварыг 1-2 хоногт бүрэн угсарч ажиллуулдаг.
                      </p>
                    </div>

                    <div className="p-3 bg-[#e6dfce] border-2 border-[var(--line)] rounded-xl">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        <Trophy className="w-4 h-4 text-amber-700" />
                        Картингийн уралдаан
                      </div>
                      <p className="text-[11px] text-[#4d4436] mt-1 leading-normal">
                        Картинг спортоор уралдаж, моторын хүч болон траектор судалдаг.
                      </p>
                    </div>

                    <div className="p-3 bg-[#e6dfce] border-2 border-[var(--line)] rounded-xl">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        <Music className="w-4 h-4 text-cyan-800" />
                        Морин хуур урлаг
                      </div>
                      <p className="text-[11px] text-[#4d4436] mt-1 leading-normal">
                        Монгол ардын уламжлалт морин хуур хөгжмийг тоглож чаддаг авьяастай.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: МИНИЙ ТУХАЙ (БҮРЭН МЭДЭЭЛЭЛ) */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                {/* Hero Profile Card */}
                <div className="p-4 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest uppercase bg-[#ded7c5] px-2 py-0.5 rounded border border-[var(--line)]">
                        Танилцуулга
                      </span>
                      <h4 className="text-xl font-bold text-[var(--ink)] mt-1.5 font-serif">
                        Sain uu, namaig Enkhluun gedeg!
                      </h4>
                      <p className="text-sm text-[#453e32] font-semibold mt-1">
                        Би 12 нас энэ жил хүрнэ. Би mechanical engineer болохыг хүсдэг.
                      </p>
                      <p className="text-xs text-[#5a5243] mt-2 leading-relaxed">
                        Техник төхөөрөмж, хөдөлгүүр, код болон физик тооцоололд дуртай. Ирээдүйд шилдэг инженер болж, хүн төрөлхтөнд хэрэгтэй механизмуудыг зохион бүтээх том мөрөөдөлтэй.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="overflow-hidden rounded-lg border-2 border-[var(--line)] shadow-sm">
                        <img
                          src="https://www.vaughn.edu/wp-content/uploads/2021/01/Mechanical-Engineering-Jobs_Feature.jpg"
                          alt="Mechanical Engineering Jobs"
                          className="w-full h-28 object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <div className="p-1.5 bg-[#e4ddcc] text-[10px] font-mono text-center font-bold text-[var(--ink)]">
                          Мөрөөдлийн мэргэжил: Mechanical Engineer
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 9 Facts Grid from minii tuhai html */}
                <div>
                  <div className="text-xs font-bold text-[#5c5445] uppercase tracking-wider mb-2.5">
                    Миний тухай 9 гол баримт (Original About Me Data)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-xl flex items-start gap-2.5">
                      <Wrench className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">1. Механик Инженер</div>
                        <p className="text-[11.5px] text-[#4d4436] mt-0.5">
                          <span className="font-semibold">"bi mechanical engineer bolohiin husdeg"</span> — Механик инженер болохын тулд техник, код, математик судалж байна.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-xl flex items-start gap-2.5">
                      <Boxes className="w-5 h-5 text-rose-800 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">2. 18+ LEGO Угсрагч</div>
                        <p className="text-[11.5px] text-[#4d4436] mt-0.5">
                          <span className="font-semibold">"bi 18+ lego egluuldeg 1-2 honog boldog"</span> — Хүнд түвшний 18+ LEGO загваруудыг ердөө 1-2 өдөрт угсарч дуусгадаг.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-xl flex items-start gap-2.5">
                      <Music className="w-5 h-5 text-indigo-800 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">3. Морин Хуур Тоглодог</div>
                        <p className="text-[11.5px] text-[#4d4436] mt-0.5">
                          <span className="font-semibold">"bi morin khuur togloj cdn"</span> — Монгол үндэсний бахархалт морин хуур хөгжмийг чадамгай эзэмшсэн.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-xl flex items-start gap-2.5">
                      <Calculator className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">4. Математиктаа Сайн</div>
                        <p className="text-[11.5px] text-[#4d4436] mt-0.5">
                          <span className="font-semibold">"mat deeree sain"</span> — Математикийн бодлого, логик сэтгэлгээний төрөлд өндөр үр дүнтэй.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-xl flex items-start gap-2.5">
                      <Flame className="w-5 h-5 text-orange-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">5. Мотортой Машин, Мотоцикл</div>
                        <p className="text-[11.5px] text-[#4d4436] mt-0.5">
                          <span className="font-semibold">"bi motortoi mashin motorcycle nuud sonirhodog"</span> — Хөдөлгүүрийн бүтэц, моторын ажиллагаанд дуртай.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-xl flex items-start gap-2.5">
                      <Flag className="w-5 h-5 text-red-800 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">6. Картинг Уралдаан</div>
                        <p className="text-[11.5px] text-[#4d4436] mt-0.5">
                          <span className="font-semibold">"bi kartingaar uralddg odoo uraldaan bolno"</span> — Картингийн спортлог замаар хурдалдаг, удахгүй уралдаанд орно.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-xl flex items-start gap-2.5">
                      <Trophy className="w-5 h-5 text-yellow-800 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">7. Formula 1 &amp; Max Verstappen</div>
                        <p className="text-[11.5px] text-[#4d4436] mt-0.5">
                          <span className="font-semibold">"bi formula 1 iin max verstappen demjdeg"</span> — F1 уралдааныг алгасалгүй үзэж, дэлхийн аваргыг дэмждэг.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-xl flex items-start gap-2.5">
                      <Languages className="w-5 h-5 text-blue-800 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">8. Англи хэл B1 түвшин</div>
                        <p className="text-[11.5px] text-[#4d4436] mt-0.5">
                          <span className="font-semibold">"bi b1 englishiin tuvsun"</span> — Англи хэлээр ном, техникийн бичиг баримт ойлгох чадвартай.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-xl flex items-start gap-2.5 sm:col-span-2">
                      <Gamepad2 className="w-5 h-5 text-purple-800 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">9. Roblox Rivals &amp; Ангийн хамт олон</div>
                        <p className="text-[11.5px] text-[#4d4436] mt-0.5">
                          <span className="font-semibold">"bi roblox deer rivals togloh durtai"</span> бөгөөд <span className="font-semibold">"manai angi bolvol goy shuu hyatad solongos hel"</span> — Roblox дээр Rivals тоглох дуртай, анги хамт олноороо Хятад болон Солонгос хэлний хичээл үздэг.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Formula 1 Image banner from html */}
                <div className="rounded-xl border-2 border-[var(--line)] overflow-hidden bg-[#e4decd]">
                  <img
                    src="https://www.apple.com/newsroom/images/2025/10/apple-is-the-exclusive-new-broadcast-partner-for-formula-1-in-the-us/tile/Apple-exclusive-F1-partner-lp.jpg.landing-big_2x.jpg"
                    alt="Formula 1 Racing"
                    className="w-full h-36 object-cover"
                  />
                  <div className="p-2 text-center text-[11px] font-bold text-[#3d372c]">
                    🏎️ Formula 1 Racing · Speed, Aerodynamics &amp; Mechanical Engineering
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: СОНИРХОЛ БА ХОЛБООСУУД */}
            {activeTab === 'interests' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#e8e2d0] border-2 border-[var(--line)] rounded-xl">
                  <h4 className="font-bold text-sm text-[var(--ink)] uppercase flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-800" />
                    Сонирхол ба хэрэгцээт холбоосууд
                  </h4>
                  <p className="text-xs text-[#554d3e] mt-0.5">
                    Энхлүүний анхны 'minii tuhai' вэб хуудсанд байсан бүх эх холбоосууд
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href="https://www.nu.edu/blog/types-of-engineering/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl flex items-center justify-between group hover:bg-[#ede7d8] transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--ink)] group-hover:text-amber-900 transition-colors">
                        What does engineering do?
                      </div>
                      <div className="text-[11px] text-[#696150] mt-0.5 font-mono">
                        Инженерийн төрлүүд ба үүрэг
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#696150] group-hover:text-[var(--ink)]" />
                  </a>

                  <a
                    href="https://www.fiakarting.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl flex items-center justify-between group hover:bg-[#ede7d8] transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--ink)] group-hover:text-amber-900 transition-colors">
                        FIA Karting Official
                      </div>
                      <div className="text-[11px] text-[#696150] mt-0.5 font-mono">
                        Олон улсын картингийн холбоо
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#696150] group-hover:text-[var(--ink)]" />
                  </a>

                  <a
                    href="https://www.formula1.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl flex items-center justify-between group hover:bg-[#ede7d8] transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--ink)] group-hover:text-amber-900 transition-colors">
                        Formula 1 Official
                      </div>
                      <div className="text-[11px] text-[#696150] mt-0.5 font-mono">
                        F1 уралдааны мэдээ, оноо
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#696150] group-hover:text-[var(--ink)]" />
                  </a>

                  <a
                    href="https://en.wikipedia.org/wiki/Max_Verstappen"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl flex items-center justify-between group hover:bg-[#ede7d8] transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--ink)] group-hover:text-amber-900 transition-colors">
                        Max Verstappen tuhai
                      </div>
                      <div className="text-[11px] text-[#696150] mt-0.5 font-mono">
                        Дэлхийн аваргын намтар, рекорд
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#696150] group-hover:text-[var(--ink)]" />
                  </a>

                  <a
                    href="https://eb-7c34ee.netlify.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl flex items-center justify-between group hover:bg-[#ede7d8] transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--ink)] group-hover:text-amber-900 transition-colors">
                        Minii taniltsuulga site
                      </div>
                      <div className="text-[11px] text-[#696150] mt-0.5 font-mono">
                        https://eb-7c34ee.netlify.app/
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#696150] group-hover:text-[var(--ink)]" />
                  </a>

                  <a
                    href="https://js-practicee.netlify.app"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl flex items-center justify-between group hover:bg-[#ede7d8] transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--ink)] group-hover:text-amber-900 transition-colors">
                        My JS Project
                      </div>
                      <div className="text-[11px] text-[#696150] mt-0.5 font-mono">
                        https://js-practicee.netlify.app
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#696150] group-hover:text-[var(--ink)]" />
                  </a>
                </div>
              </div>
            )}

            {/* TAB 4: ХОЛБОО БАРИХ */}
            {activeTab === 'contact' && (
              <div className="space-y-4">
                <div className="p-4 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl text-center">
                  <div className="w-12 h-12 bg-[#ded7c5] border-2 border-[var(--line)] rounded-full flex items-center justify-center mx-auto mb-3">
                    <Mail className="w-6 h-6 text-[var(--ink)]" />
                  </div>
                  <h4 className="text-lg font-bold text-[var(--ink)] uppercase font-serif">
                    Холбоо барих
                  </h4>
                  <p className="text-xs text-[#5e5545] max-w-md mx-auto mt-1 leading-relaxed">
                    Механик инженерчлэл, LEGO загварууд, Картинг болон Вэб програмчлалын чиглэлээр санал солилцох эсвэл хамтран бүтээхэд үргэлж нээлттэй!
                  </p>

                  <div className="mt-4 p-3 bg-[#e8e1cf] border-2 border-[var(--line)] rounded-xl max-w-sm mx-auto flex items-center justify-between">
                    <div className="text-xs font-mono font-bold text-[var(--ink)] select-all">
                      benkhluun69@gmail.com
                    </div>
                    <button
                      type="button"
                      onClick={copyEmail}
                      className="px-2.5 py-1 bg-[var(--line)] text-stone-100 rounded text-[11px] font-bold flex items-center gap-1 hover:opacity-85 transition-opacity cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Хуулагдлаа!' : 'Хуулах'}</span>
                    </button>
                  </div>

                  <div className="mt-4 flex justify-center gap-3">
                    <a
                      href="mailto:benkhluun69@gmail.com"
                      className="pill px-6 py-2.5 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Имэйл бичих
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t-2 border-[var(--line)] flex justify-between items-center text-xs text-[#706857]">
              <span className="font-mono text-[11px]">
                Enkhluun · Mechanical Engineer &amp; Web Developer
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setPreviewUrl(null);
                }}
                className="px-4 py-1.5 border border-[var(--line)] rounded-lg bg-[#ded7c5] hover:bg-[#d0c8b4] font-bold text-xs uppercase cursor-pointer"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
