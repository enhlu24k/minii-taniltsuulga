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
  Flag,
  Play,
  ArrowRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import EmojiQuizWindow, { GameMode } from './components/EmojiQuizWindow';
import Leaderboard from './components/Leaderboard';
import { Lang, loadLang, saveLang } from './utils/i18n';
import { sfx } from './utils/sound';

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
  bushR: [PLANTS, 1528, 908, 499, 405],
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
    bushR: { x: 1370, y: 740, w: 300 },
  },
  port: {
    w: 800, h: 1500,
    wave: { y0: 1300, y1: 430, gap0: 1, gap1: 0.7 },
    ship: { x0: 420, w0: 620, x1: 640, w1: 150 },
    palm: { x: -150, y: -60, w: 560 },
    capt: { x: 20, y: 440, w: 600 },
    chest: { x: 560, y: 830, w: 190 },
    bushL: { x: -40, y: 1330, w: 520 },
    bushR: { x: 570, y: 1340, w: 260 },
  },
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
  { dy: -52, a: 23, k: 1.9, v: 1.15, ph: 1.7, fill: 'var(--paper)' },
];

const FRONT: WaveLayer[] = [
  { dy: 0, a: 25, k: 1.7, v: 1.3, ph: 3.1, fill: 'var(--band2)' },
  { dy: 26, a: 18, k: 2.4, v: 1, ph: 4.4, span: [0.06, 0.44] },
  { dy: 48, a: 22, k: 1.45, v: 1.4, ph: 0.6, fill: 'var(--paper)' },
  { dy: 76, a: 15, k: 2.1, v: 1.2, ph: 5.1, span: [0.52, 0.97] },
  { dy: 104, a: 24, k: 1.8, v: 1.25, ph: 2.2, fill: 'var(--paper)' },
  { dy: 130, a: 14, k: 2.7, v: 1, ph: 1.1, span: [0.0, 0.62] },
  { dy: 158, a: 20, k: 1.6, v: 1.1, ph: 3.8 },
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
    backgroundPosition: `${bgPosX.toFixed(4)}% ${bgPosY.toFixed(4)}%`,
  };
}

type ModalTab = 'projects' | 'games' | 'about' | 'interests' | 'contact';

export default function App() {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('projects');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeGameWindow, setActiveGameWindow] = useState<GameMode | null>(null);
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [soundMuted, setSoundMuted] = useState<boolean>(() => sfx.muted);

  const isEn = lang === 'en';

  const handleLangChange = (nextLang: Lang) => {
    setLang(nextLang);
    saveLang(nextLang);
  };

  const handleToggleSound = () => {
    sfx.toggle();
  };

  useEffect(() => {
    setSoundMuted(sfx.muted);
    return sfx.subscribe(setSoundMuted);
  }, []);

  useEffect(() => {
    let lastHovered: Element | null = null;
    const INTERACTIVE_SELECTOR = 'button:not(:disabled), a[href], .pill, [data-go], .logo';

    const onPointerDown = () => {
      if (!sfx.muted) {
        sfx.init();
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const interactive = target?.closest(INTERACTIVE_SELECTOR);
      if (!interactive) return;
      if (interactive.getAttribute('data-sfx') === 'custom') return;
      sfx.click();
    };

    const onPointerOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const interactive = target?.closest(INTERACTIVE_SELECTOR) ?? null;
      if (interactive !== lastHovered) {
        lastHovered = interactive;
        if (interactive) {
          sfx.hover();
        }
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('pointerover', onPointerOver, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClickCapture, true);
      document.removeEventListener('pointerover', onPointerOver, true);
    };
  }, []);

  useEffect(() => {
    const isGameOpen = activeGameWindow !== null;
    document.documentElement.classList.toggle('ui-game-open', isGameOpen);
    return () => {
      document.documentElement.classList.remove('ui-game-open');
    };
  }, [activeGameWindow]);

  const openModal = (tab: ModalTab = 'projects') => {
    setActiveTab(tab);
    setShowModal(true);
  };

  const openGameInSeparateWindow = (mode: GameMode) => {
    setActiveGameWindow(mode);
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
        [-12, 74, 22, 56, 6],
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

    let isHoverIframe = false;

    const onPointerMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (curX < -50 && curY < -50) {
        curX = mx;
        curY = my;
      }
      const target = e.target as HTMLElement | null;
      isHoverIframe = target?.tagName === 'IFRAME';
      isHoverLink = !!target?.closest('a, button:not(:disabled), .pill, [data-go], .logo');
      if (cur) {
        cur.classList.toggle('hovering', isHoverLink);
        cur.style.opacity = isHoverIframe ? '0' : '1';
      }
    };

    const onPointerLeave = () => {
      if (cur) cur.style.opacity = '0';
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
    document.addEventListener('mouseleave', onPointerLeave);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    // Wheel navigation (disabled when modal or game window is open)
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.articles-modal-backdrop, .game-window-overlay')) return;
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

    // Touch swipe navigation for iPhone & iPad
    let touchStartY = 0;
    let touchStartX = 0;
    let touchIgnored = false;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.articles-modal-backdrop, .game-window-overlay, nav')) {
        touchIgnored = true;
        return;
      }
      touchIgnored = false;
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchIgnored || e.changedTouches.length === 0) return;
      const dy = touchStartY - e.changedTouches[0].clientY;
      const dx = Math.abs(touchStartX - e.changedTouches[0].clientX);
      if (Math.abs(dy) > 42 && Math.abs(dy) > dx) {
        const now = performance.now();
        if (wheelLockedUntil > now) return;
        if (dy > 0) {
          go(1);
          wheelLockedUntil = now + 900;
        } else {
          go(0);
          wheelLockedUntil = now + 900;
        }
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

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

      const DUR = reducedMotion ? 1 : 2100;
      const kTrans = seg(now, pT0, pT0 + DUR);
      p = mix(pFrom, pTo, io(kTrans));

      const t = reducedMotion ? 0 : (now - t0) / 1000;

      backPaths.forEach(({ path, layer }) => {
        path.setAttribute('d', buildWavePath(layer, t, p));
      });
      frontPaths.forEach(({ path, layer }) => {
        path.setAttribute('d', buildWavePath(layer, t, p));
      });

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

      const cloudX = ((((L.w * 0.72 - t * 16) % (L.w + 700)) + (L.w + 700)) % (L.w + 700)) - 400;
      _cloudA.style.left = cloudX.toFixed(1) + 'px';
      _cloudA.style.top = (portrait ? 110 : 150) + 'px';
      _cloudA.style.opacity = (1 - seg(p, 0.3, 0.7)).toFixed(3);

      const intro = out(seg(now, t0 + 200, t0 + 1100));

      _t1.style.opacity = (intro * (1 - seg(p, 0.62, 0.7))).toFixed(3);
      _t1.style.transform = `translateY(${((1 - intro) * 26 - p * 40).toFixed(2)}px)`;
      _t1.style.pointerEvents = p > 0.1 ? 'none' : 'auto';

      _logo.style.opacity = (1 - seg(p, 0.12, 0.3)).toFixed(3);

      const e = io(seg(p, 0.04, 0.92));
      _palm.style.transform = `translate(${mix(-L.palm.w - 80, 0, e).toFixed(2)}px, ${mix(-170, 0, e).toFixed(2)}px) rotate(${(Math.sin(t * 0.8) * 0.7).toFixed(2)}deg)`;
      _capt.style.transform = `translateX(${mix(-L.capt.w - 160, 0, e).toFixed(2)}px) rotate(${(Math.sin(t * 1.1) * 0.5 * p).toFixed(2)}deg)`;
      _chest.style.transform = `translate(${mix(-L.chest.w - 720, 0, e).toFixed(2)}px, ${mix(120, 0, e).toFixed(2)}px)`;

      const b = out(seg(p, 0.5, 1));
      _bushL.style.transform = `translateY(${mix(340, 0, b).toFixed(2)}px)`;
      _bushR.style.transform = `translateY(${mix(300, 0, b).toFixed(2)}px)`;

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

      _shade.style.transform = `translate(${(Math.sin(t * 0.35) * 2.2).toFixed(2)}%, ${(Math.cos(t * 0.27) * 1.6).toFixed(2)}%) rotate(${(Math.sin(t * 0.22) * 0.8).toFixed(2)}deg)`;

      if (cur && isFine) {
        const curScale = isDown ? 0.7 : isHoverLink ? 1.35 : 1;
        const f = 1 - Math.exp(-dt * 22);
        curX += (mx - curX) * f;
        curY += (my - curY) * f;
        cur.style.transform = `translate(${curX.toFixed(1)}px, ${curY.toFixed(1)}px) scale(${curScale})`;
      }

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
      document.removeEventListener('mouseleave', onPointerLeave);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('click', onClick);
      document.documentElement.classList.remove('fine', 'portrait', 'ui-game-open');
    };
  }, []);

  return (
    <>
      <main className="frame" id="frame" ref={frameRef}>
        {/* Top Chrome: Logo + Responsive Nav + Language Switch + Sound Toggle */}
        <header className="top-chrome">
          <div
            className="logo"
            ref={logoRef}
            data-go="0"
            title={isEn ? 'Enkhluun — Home' : 'Энхлүүн — Нүүр хуудас'}
          >
            <svg viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="13" cy="4.5" r="2.8" />
              <path d="M13 7.5V28M7 12h12M2.5 19c.6 5.5 5.5 9 10.5 9s9.9-3.5 10.5-9" />
              <path d="m1 21 1.5-2.5L5 20.5M25 21l-1.5-2.5-2.5 2" />
            </svg>
            <span>Enkhluun</span>
          </div>

          <div className="nav-wrap">
            <nav>
              <a href="#" data-go="0" title={isEn ? 'Home' : 'Нүүр хуудас'}>
                {isEn ? 'Home' : 'Нүүр'}
                <svg viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <circle cx="13" cy="4.5" r="2.8" />
                  <path d="M13 7.5V28M7 12h12M2.5 19c.6 5.5 5.5 9 10.5 9s9.9-3.5 10.5-9" />
                </svg>
              </a>
              <a href="#" data-go="1" title={isEn ? 'About Me' : 'Миний тухай'}>
                {isEn ? 'About' : 'Миний тухай'}
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
                title={isEn ? 'My Projects' : 'Миний бүтээлүүд'}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                {isEn ? 'Projects' : 'Миний бүтээлүүд'}
              </a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  openModal('games');
                }}
                className="flex items-center gap-1.5 font-bold"
                title={isEn ? 'My Games' : 'Миний тоглоом'}
              >
                {isEn ? 'Games' : 'Миний тоглоом'}
                <svg viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <circle cx="13" cy="4.5" r="2.8" />
                  <path d="M13 7.5V28M7 12h12M2.5 19c.6 5.5 5.5 9 10.5 9s9.9-3.5 10.5-9" />
                </svg>
              </a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  openModal('interests');
                }}
                title={isEn ? 'Interests & Links' : 'Сонирхол ба холбоосууд'}
              >
                {isEn ? 'Interests' : 'Сонирхол'}
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
                title={isEn ? 'Contact' : 'Холбоо барих'}
              >
                {isEn ? 'Contact' : 'Холбогдох'}
                <svg viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <circle cx="13" cy="4.5" r="2.8" />
                  <path d="M13 7.5V28M7 12h12M2.5 19c.6 5.5 5.5 9 10.5 9s9.9-3.5 10.5-9" />
                </svg>
              </a>
            </nav>
          </div>

          <div className="nav-controls">
            {/* MN / EN Language Switch */}
            <div
              role="group"
              aria-label={isEn ? 'Language switch' : 'Хэл солих'}
              className="inline-flex items-center p-0.5 rounded-full border-2 border-[var(--line)] bg-[#f8f5ec]"
            >
              {(['mn', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLangChange(code)}
                  className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                    lang === code
                      ? 'bg-[var(--line)] text-[var(--paper)]'
                      : 'text-[var(--ink)] hover:bg-[#e2dcce]'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Global Sound Toggle */}
            <button
              type="button"
              data-sfx="custom"
              onClick={handleToggleSound}
              aria-label={soundMuted ? (isEn ? 'Unmute sound' : 'Дуу асаах') : (isEn ? 'Mute sound' : 'Дуу хаах')}
              title={soundMuted ? (isEn ? 'Unmute sound' : 'Дуу асаах') : (isEn ? 'Mute sound' : 'Дуу хаах')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border-2 border-[var(--line)] bg-[#f8f5ec] hover:bg-[#e2dcce] text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink)] transition-colors cursor-pointer whitespace-nowrap"
            >
              {soundMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-[#6d6657]" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-800" />
              )}
              <span className="hidden xl:inline">
                {soundMuted ? (isEn ? 'Muted' : 'Дуугүй') : (isEn ? 'Sound' : 'Дуутай')}
              </span>
            </button>
          </div>
        </header>

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
            <div className="eb tracking-wider">
              {isEn
                ? '12-Year-Old Builder · Future Mechanical Engineer'
                : '12 Настай Бүтээгч · Ирээдүйн Mechanical Engineer'}
            </div>
            <h1>
              {isEn ? (
                <>
                  Hi there,<br />I&apos;m Enkhluun
                </>
              ) : (
                <>
                  Sain uu,<br />namaig Enkhluun gedeg
                </>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-8 flex-wrap">
              <button
                type="button"
                onClick={() => openModal('projects')}
                className="pill flex items-center gap-2 bg-[#e2dcce] hover:bg-[#d8d0bf] font-bold"
              >
                <Sparkles className="w-4 h-4 text-amber-700" />
                {isEn ? 'My Projects' : 'Миний бүтээлүүд'}
              </button>
              <button
                type="button"
                onClick={() => openModal('games')}
                className="pill flex items-center gap-2 bg-[#ece7d8] hover:bg-[#dfd8c6] font-bold"
              >
                <Gamepad2 className="w-4 h-4 text-stone-800" />
                {isEn ? 'My Games' : 'Миний тоглоом'}
              </button>
              <button
                type="button"
                onClick={() => goRef.current(1)}
                className="pill bg-[#f5f1e6] hover:bg-[#eae3d2]"
              >
                {isEn ? 'Explore About Me' : 'Миний тухай үзэх'}
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
              {isEn ? (
                <>
                  Mechanics &amp;<br />Innovation
                </>
              ) : (
                <>
                  Механик &amp;<br />Инноваци
                </>
              )}
            </h2>
            <p id="p2" ref={p2Ref}>
              {isEn
                ? 'Age 12 · 18+ LEGO Builder · Morin Khuur Player · Kart Racer · Web Coder'
                : '12 нас · 18+ LEGO угсрагч · Морин хуурч · Картинг уралдаанч · Код бүтээгч'}
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
                {isEn ? 'View All Details' : 'Бүх мэдээллийг үзэх'}
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

      {/* Comprehensive Modal: Бүтээлүүд, Миний тоглоом & Миний тухай */}
      {showModal && !activeGameWindow && (
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
            <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-3 border-b-2 border-[var(--line)] pb-4 mb-4">
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] text-[#6d6657] uppercase font-mono">
                  Enkhluun · Personal Portfolio &amp; Projects
                </div>
                <h3 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-[var(--ink)] font-serif mt-0.5">
                  {isEn ? 'Enkhluun · 12-Year-Old Creator' : 'Энхлүүн · 12 Настай Бүтээгч'}
                </h3>
                <p className="text-xs text-[#5a5243] mt-0.5 font-medium">
                  {isEn
                    ? 'Student & coder dreaming of becoming a Mechanical Engineer'
                    : 'Mechanical Engineer болох мөрөөдөлтэй сурагч ба код бүтээгч'}
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 shrink-0">
                <div
                  role="group"
                  aria-label={isEn ? 'Language switch' : 'Хэл солих'}
                  className="inline-flex items-center p-0.5 rounded-lg border-2 border-[var(--line)] bg-[#f8f5ec]"
                >
                  {(['mn', 'en'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleLangChange(code)}
                      className={`px-2 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                        lang === code
                          ? 'bg-[var(--line)] text-[var(--paper)]'
                          : 'text-[var(--ink)] hover:bg-[#e2dcce]'
                      }`}
                    >
                      {code.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  data-sfx="custom"
                  onClick={handleToggleSound}
                  aria-label={soundMuted ? (isEn ? 'Unmute sound' : 'Дуу асаах') : (isEn ? 'Mute sound' : 'Дуу хаах')}
                  title={soundMuted ? (isEn ? 'Unmute sound' : 'Дуу асаах') : (isEn ? 'Mute sound' : 'Дуу хаах')}
                  className="p-1.5 rounded-lg border-2 border-[var(--line)] bg-[#f8f5ec] text-[var(--ink)] hover:bg-[#e2dcce] transition-colors cursor-pointer"
                >
                  {soundMuted ? (
                    <VolumeX className="w-4 h-4 text-[#6d6657]" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-amber-800" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setPreviewUrl(null);
                  }}
                  className="p-1.5 rounded-lg border-2 border-[var(--line)] bg-[#e8e2d2] text-[var(--ink)] hover:bg-[#dbd3be] transition-colors cursor-pointer"
                  aria-label={isEn ? 'Close' : 'Хаах'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-5 p-1.5 bg-[#e4decd] border-2 border-[var(--line)] rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeTab === 'projects'
                    ? 'bg-[var(--line)] text-[var(--paper)] shadow-sm'
                    : 'text-[#4a4235] hover:bg-[#d6cfbc]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                {isEn ? 'My Projects' : 'Миний бүтээлүүд'}
                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-stone-900 rounded-full text-[10px] font-extrabold">
                  2
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('games')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeTab === 'games'
                    ? 'bg-[var(--line)] text-[var(--paper)] shadow-sm'
                    : 'text-[#4a4235] hover:bg-[#d6cfbc]'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                {isEn ? 'My Games' : 'Миний тоглоом'}
                <span className="ml-1 px-1.5 py-0.2 bg-emerald-700 text-emerald-100 rounded-full text-[10px] font-extrabold">
                  2
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('about')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeTab === 'about'
                    ? 'bg-[var(--line)] text-[var(--paper)] shadow-sm'
                    : 'text-[#4a4235] hover:bg-[#d6cfbc]'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                {isEn ? 'About Me' : 'Миний тухай'}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('interests')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeTab === 'interests'
                    ? 'bg-[var(--line)] text-[var(--paper)] shadow-sm'
                    : 'text-[#4a4235] hover:bg-[#d6cfbc]'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                {isEn ? 'Interests & Links' : 'Сонирхол ба Холбоосууд'}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contact')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeTab === 'contact'
                    ? 'bg-[var(--line)] text-[var(--paper)] shadow-sm'
                    : 'text-[#4a4235] hover:bg-[#d6cfbc]'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                {isEn ? 'Contact' : 'Холбоо барих'}
              </button>
            </div>

            {/* TAB 1: МИНИЙ БҮТЭЭЛҮҮД */}
            {activeTab === 'projects' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#e8e2d0] border-2 border-[var(--line)] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--ink)] uppercase flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-700" />
                      {isEn ? 'Projects I Built' : 'Миний хийсэн бүтээлүүд'}
                    </h4>
                    <p className="text-xs text-[#554d3e] mt-0.5">
                      {isEn
                        ? 'Real web projects independently coded by Enkhluun and deployed on Netlify'
                        : 'Энхлүүний бие даан код бичиж Netlify дээр байршуулсан бодит төслүүд'}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-1 bg-[#d5cebc] rounded border border-[var(--line)]">
                    {isEn ? '2 Web Projects' : '2 Веб Төсөл'}
                  </span>
                </div>

                {/* Project 1 */}
                <div className="p-4 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl shadow-sm transition-all hover:border-[#000]">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-800 text-emerald-100 rounded">
                          {isEn ? 'Independent Site' : 'Бие даасан веб'}
                        </span>
                        <span className="text-[11px] text-[#736a57] font-mono">Netlify Deploy</span>
                      </div>
                      <h5 className="text-base font-bold text-[var(--ink)] mt-1.5">
                        {isEn ? 'My Self-Coded Introduction Site' : 'Minii uuruu code bichsen taniltsuulga site'}
                      </h5>
                      <p className="text-xs text-[#4d4436] mt-1 leading-relaxed">
                        {isEn
                          ? 'An online personal introduction website coded by Enkhluun from scratch, showcasing his dreams, hobbies, and story.'
                          : 'Энхлүүний өөрөө код бичиж бүтээсэн онлайн танилцуулга хуудас. Мөрөөдөл, сонирхол, өөрийн тухай бүх мэдээллээ бүтэцтэйгээр кодчилсон бүтээл.'}
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
                        <span>{isEn ? 'Visit Site' : 'Сайтаар зочлох'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(previewUrl === 'https://eb-7c34ee.netlify.app/' ? null : 'https://eb-7c34ee.netlify.app/')}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 border border-[var(--line)] bg-[#ede7d8] rounded-lg text-xs font-medium hover:bg-[#dfd7c4] transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {previewUrl === 'https://eb-7c34ee.netlify.app/'
                            ? isEn
                              ? 'Hide Preview'
                              : 'Урьдчилан харахыг хаах'
                            : isEn
                              ? 'Preview Here'
                              : 'Энд харах'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {previewUrl === 'https://eb-7c34ee.netlify.app/' && (
                    <div className="mt-3 pt-3 border-t border-[var(--line)]">
                      <div className="flex justify-between items-center mb-1.5 text-xs text-[#615949]">
                        <span>{isEn ? 'Live Preview:' : 'Шууд харагдац (Live Preview):'}</span>
                        <a href="https://eb-7c34ee.netlify.app/" target="_blank" rel="noreferrer" className="underline font-mono">
                          https://eb-7c34ee.netlify.app/
                        </a>
                      </div>
                      <iframe
                        src="https://eb-7c34ee.netlify.app/"
                        title="Enkhluun Portfolio Preview"
                        className="w-full h-52 sm:h-72 border-2 border-[var(--line)] rounded-lg bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Project 2 */}
                <div className="p-4 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl shadow-sm transition-all hover:border-[#000]">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-700 text-amber-100 rounded">
                          {isEn ? 'JavaScript Practice' : 'JavaScript дасгал'}
                        </span>
                        <span className="text-[11px] text-[#736a57] font-mono">Netlify Deploy</span>
                      </div>
                      <h5 className="text-base font-bold text-[var(--ink)] mt-1.5">
                        {isEn ? 'My First JavaScript Practice' : 'minii anhnii javascript dasgal'}
                      </h5>
                      <p className="text-xs text-[#4d4436] mt-1 leading-relaxed">
                        {isEn
                          ? 'First interactive JavaScript exercises, calculations, and DOM logic experiments built while learning to code.'
                          : 'JavaScript програмчлалын хэл сурч эхлэхдээ хийсэн анхны дасгал ажил, тооцоолол, интерактив логик туршилтууд.'}
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
                        <span>{isEn ? 'Visit Site' : 'Сайтаар зочлох'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(previewUrl === 'https://js-practicee.netlify.app/' ? null : 'https://js-practicee.netlify.app/')}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 border border-[var(--line)] bg-[#ede7d8] rounded-lg text-xs font-medium hover:bg-[#dfd7c4] transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {previewUrl === 'https://js-practicee.netlify.app/'
                            ? isEn
                              ? 'Hide Preview'
                              : 'Урьдчилан харахыг хаах'
                            : isEn
                              ? 'Preview Here'
                              : 'Энд харах'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {previewUrl === 'https://js-practicee.netlify.app/' && (
                    <div className="mt-3 pt-3 border-t border-[var(--line)]">
                      <div className="flex justify-between items-center mb-1.5 text-xs text-[#615949]">
                        <span>{isEn ? 'Live Preview:' : 'Шууд харагдац (Live Preview):'}</span>
                        <a href="https://js-practicee.netlify.app/" target="_blank" rel="noreferrer" className="underline font-mono">
                          https://js-practicee.netlify.app/
                        </a>
                      </div>
                      <iframe
                        src="https://js-practicee.netlify.app/"
                        title="JS Practice Preview"
                        className="w-full h-52 sm:h-72 border-2 border-[var(--line)] rounded-lg bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Additional Engineering & Creative Highlights */}
                <div className="pt-2">
                  <div className="text-xs uppercase font-bold text-[#635b4b] mb-2 tracking-wider">
                    {isEn ? 'Other Engineering & Creative Highlights' : 'Бусад инженерчлэл & бүтээлч туршлагууд'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 bg-[#e6dfce] border-2 border-[var(--line)] rounded-xl">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        <Boxes className="w-4 h-4 text-rose-700" />
                        {isEn ? '18+ LEGO Builds' : '18+ LEGO загварууд'}
                      </div>
                      <p className="text-[11px] text-[#4d4436] mt-1 leading-normal">
                        {isEn
                          ? 'Completes complex 18+ LEGO mechanical sets in just 1–2 days.'
                          : 'Нарийн төвөгтэй 18+ LEGO загварыг 1-2 хоногт бүрэн угсарч ажиллуулдаг.'}
                      </p>
                    </div>

                    <div className="p-3 bg-[#e6dfce] border-2 border-[var(--line)] rounded-xl">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        <Trophy className="w-4 h-4 text-amber-700" />
                        {isEn ? 'Kart Racing' : 'Картингийн уралдаан'}
                      </div>
                      <p className="text-[11px] text-[#4d4436] mt-1 leading-normal">
                        {isEn
                          ? 'Races go-karts regularly while studying engine power and racing lines.'
                          : 'Картинг спортоор уралдаж, моторын хүч болон траектор судалдаг.'}
                      </p>
                    </div>

                    <div className="p-3 bg-[#e6dfce] border-2 border-[var(--line)] rounded-xl">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        <Music className="w-4 h-4 text-cyan-800" />
                        {isEn ? 'Morin Khuur Music' : 'Морин хуур урлаг'}
                      </div>
                      <p className="text-[11px] text-[#4d4436] mt-1 leading-normal">
                        {isEn
                          ? 'Talented player of the traditional Mongolian horsehead fiddle.'
                          : 'Монгол ардын уламжлалт морин хуур хөгжмийг тоглож чаддаг авьяастай.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: МИНИЙ ТОГЛООМ */}
            {activeTab === 'games' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#e8e2d0] border-2 border-[var(--line)] rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--ink)] uppercase flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4 text-emerald-800" />
                      {isEn ? 'My Games' : 'Миний тоглоомууд'}
                    </h4>
                    <p className="text-xs text-[#554d3e] mt-0.5">
                      {isEn
                        ? 'Click a game to launch it in a dedicated full-screen window'
                        : 'Тоглоом дээр дарахад тусдаа цонхонд нээгдэж тоглоно'}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-1 bg-[#d5cebc] rounded border border-[var(--line)] shrink-0">
                    {isEn ? '2 Games' : '2 Тоглоом'}
                  </span>
                </div>

                {/* Game 1: Anime Guess */}
                <div className="p-4 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl shadow-sm transition-all hover:border-[#000]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-900 text-indigo-100 rounded">
                          {isEn ? 'Dedicated Window' : 'Тусдаа цонхоор тоглох'}
                        </span>
                        <span className="text-[11px] text-[#736a57] font-mono">
                          {isEn ? '4 Modes · 60 Questions' : '4 Ангилал · 60 Асуулт'}
                        </span>
                      </div>
                      <h5 className="text-lg font-bold text-[var(--ink)] mt-1.5 flex items-center gap-2">
                        <span>🍥 Anime Guess</span>
                      </h5>
                      <p className="text-xs text-[#4d4436] mt-1 leading-relaxed">
                        {isEn
                          ? 'Guess characters from Naruto, One Piece, Demon Slayer, Jujutsu Kaisen, and classics from 3 emoji clues in 10 seconds.'
                          : 'Наруто, One Piece, Demon Slayer, Jujutsu Kaisen болон сонгодог анимэ дүрүүдийг 3 эможи сэжүүрээр 10 секундийн дотор таах тоглоом.'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">
                          {isEn ? '3 lives' : '3 амь'}
                        </span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">
                          {isEn ? '10s timer' : '10с хугацаа'}
                        </span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">
                          {isEn ? 'Streak bonus' : 'Streak бонус'}
                        </span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">
                          {isEn ? 'Keys 1–4' : '1–4 товч'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openGameInSeparateWindow('anime')}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--line)] text-stone-100 rounded-xl text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{isEn ? 'Play in Window' : 'Тусдаа цонхонд тоглох'}</span>
                    </button>
                  </div>
                </div>

                {/* Game 2: Sports Emoji Guesser */}
                <div className="p-4 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl shadow-sm transition-all hover:border-[#000]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-800 text-amber-100 rounded">
                          {isEn ? 'Dedicated Window' : 'Тусдаа цонхоор тоглох'}
                        </span>
                        <span className="text-[11px] text-[#736a57] font-mono">
                          {isEn ? '4 Modes · 60 Questions' : '4 Ангилал · 60 Асуулт'}
                        </span>
                      </div>
                      <h5 className="text-lg font-bold text-[var(--ink)] mt-1.5 flex items-center gap-2">
                        <span>🏆 Sports Emoji Guesser</span>
                      </h5>
                      <p className="text-xs text-[#4d4436] mt-1 leading-relaxed">
                        {isEn
                          ? 'Guess top athletes and racers across Football, Basketball, Formula 1, and MotoGP from emoji clues.'
                          : 'Хөлбөмбөг, Сагсан бөмбөг, Formula 1 болон MotoGP-ийн шилдэг тамирчид, нисгэгчдийг эможи сэжүүрээр таах тоглоом.'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">
                          ⚽ {isEn ? 'Football' : 'Хөлбөмбөг'}
                        </span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">
                          🏀 {isEn ? 'Basketball' : 'Сагсан бөмбөг'}
                        </span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">
                          🏎️ F1
                        </span>
                        <span className="px-2 py-0.5 bg-[#e3dccb] text-[#2c261e] rounded text-[10px] font-semibold">
                          🏍️ MotoGP
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openGameInSeparateWindow('sports')}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--line)] text-stone-100 rounded-xl text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{isEn ? 'Play in Window' : 'Тусдаа цонхонд тоглох'}</span>
                    </button>
                  </div>
                </div>

                {/* Live Firestore Leaderboard inside Parchment Scroll */}
                <div className="pt-3 border-t-2 border-[var(--line)]/15">
                  <Leaderboard
                    lang={lang}
                    initialGameFilter="Anime Guess"
                    compact
                    maxEntries={10}
                    title={isEn ? 'Leaderboard' : 'Тэргүүлэгчдийн Самбар'}
                    subtitle={isEn ? "Firestore 'scores' · Live Standings" : "Firestore 'scores' · Шууд эрэмбэ"}
                    onPlayClick={() => openGameInSeparateWindow('anime')}
                    playLabel={isEn ? 'Play Anime Guess' : 'Anime Guess тоглох'}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: МИНИЙ ТУХАЙ (БҮХ МЭДЭЭЛЭЛ) */}
            {activeTab === 'about' && (
              <div className="space-y-5">
                {/* 2-Column Profile Header & Quick Ledger */}
                <div className="bg-[#f8f5ec] border-2 border-[var(--line)] rounded-2xl p-5 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-7">
                      <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#6d6657]">
                        {isEn ? 'Personal Profile · Enkhluun' : 'Хувийн танилцуулга · Энхлүүн'}
                      </div>
                      <h4 className="text-2xl sm:text-3xl font-bold text-[var(--ink)] mt-1.5 font-serif leading-tight">
                        {isEn ? "Hi there, I'm Enkhluun!" : 'Sain uu, namaig Enkhluun gedeg!'}
                      </h4>
                      <p className="text-sm text-[#352f25] font-semibold mt-2">
                        {isEn
                          ? 'I am turning 12 this year, aiming to become a Mechanical Engineer.'
                          : 'Би энэ жил 12 нас хүрнэ. Ирээдүйд Mechanical Engineer болох зорилготой.'}
                      </p>
                      <p className="text-xs text-[#5a5243] mt-2.5 leading-relaxed">
                        {isEn
                          ? 'Passionate about machinery, engines, mathematics, coding, and motorsports. Building new things and assembling intricate mechanisms is my favorite activity.'
                          : 'Техник төхөөрөмж, хөдөлгүүр, математик, код бичих болон авто спортод гүн сонирхолтой. Шинэ зүйл бүтээж, нарийн механизмуудыг угсарч турших нь миний хамгийн дуртай ажил.'}
                      </p>
                    </div>

                    {/* Quick Facts Ledger */}
                    <div className="md:col-span-5 md:border-l-2 md:border-[var(--line)]/15 md:pl-5 space-y-2.5 text-xs">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#6d6657] pb-1 border-b border-[var(--line)]/15">
                        {isEn ? 'Quick Facts' : 'Товч мэдээлэл'}
                      </div>
                      <div className="flex items-center justify-between gap-3 py-1 border-b border-[var(--line)]/10">
                        <span className="text-[#6d6657]">{isEn ? 'Age' : 'Нас'}</span>
                        <span className="font-bold text-[var(--ink)] tabular-nums">
                          {isEn ? '12 years old' : '12 нас'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-1 border-b border-[var(--line)]/10">
                        <span className="text-[#6d6657]">{isEn ? 'Goal' : 'Мөрөөдөл'}</span>
                        <span className="font-bold text-[var(--ink)]">Mechanical Engineer</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-1 border-b border-[var(--line)]/10">
                        <span className="text-[#6d6657]">{isEn ? 'Favorite F1 Driver' : 'Дэмждэг F1'}</span>
                        <span className="font-bold text-[var(--ink)]">Max Verstappen</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-1 border-b border-[var(--line)]/10">
                        <span className="text-[#6d6657]">{isEn ? 'English' : 'Англи хэл'}</span>
                        <span className="font-bold text-[var(--ink)] tabular-nums">
                          {isEn ? 'B1 Level' : 'B1 түвшин'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-1">
                        <span className="text-[#6d6657]">{isEn ? 'Other Languages' : 'Нэмэлт хэл'}</span>
                        <span className="font-bold text-[var(--ink)]">
                          {isEn ? 'Chinese · Korean' : 'Хятад · Солонгос'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3-Column Organized Information Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Pillar 01 */}
                  <div className="p-4 bg-[#ebe5d4] border-2 border-[var(--line)] rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-[var(--line)]/20 pb-2.5 mb-3">
                        <span className="font-mono text-xs font-bold text-[#6d6657]">01</span>
                        <Wrench className="w-4 h-4 text-[var(--ink)]" />
                      </div>
                      <h5 className="text-sm font-extrabold uppercase tracking-wide text-[var(--ink)] mb-3">
                        {isEn ? 'Engineering & Mind' : 'Инженерчлэл & Оюун'}
                      </h5>
                      <ul className="space-y-3 text-xs text-[#3f382c]">
                        <li>
                          <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                            {isEn ? 'Mathematics' : 'Математик'}
                          </div>
                          <p className="text-[#5a5243] mt-0.5 leading-relaxed">
                            {isEn
                              ? 'Strong in math, building analytical problem-solving skills toward a career in mechanical engineering.'
                              : 'Математикийн хичээлдээ сайн, тооцоолол болон логик сэтгэлгээндээ тулгуурлан инженер болохоор бэлддэг.'}
                          </p>
                        </li>
                        <li>
                          <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                            {isEn ? '18+ LEGO Building' : '18+ LEGO угсралт'}
                          </div>
                          <p className="text-[#5a5243] mt-0.5 leading-relaxed">
                            {isEn
                              ? 'Independently assembles complex 18+ LEGO mechanical sets within 1–2 days.'
                              : 'Нарийн бүтэцтэй 18+ LEGO загваруудыг 1–2 хоногийн дотор бие даан угсардаг.'}
                          </p>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Pillar 02 */}
                  <div className="p-4 bg-[#ebe5d4] border-2 border-[var(--line)] rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-[var(--line)]/20 pb-2.5 mb-3">
                        <span className="font-mono text-xs font-bold text-[#6d6657]">02</span>
                        <Flag className="w-4 h-4 text-rose-700" />
                      </div>
                      <h5 className="text-sm font-extrabold uppercase tracking-wide text-[var(--ink)] mb-3">
                        {isEn ? 'Speed & Motorsport' : 'Хурд & Авто Спорт'}
                      </h5>
                      <ul className="space-y-3 text-xs text-[#3f382c]">
                        <li>
                          <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            {isEn ? 'Kart Racing' : 'Картингийн уралдаан'}
                          </div>
                          <p className="text-[#5a5243] mt-0.5 leading-relaxed">
                            {isEn
                              ? 'Races go-karts regularly and is actively training for upcoming competitions.'
                              : 'Картингаар тогтмол уралддаг бөгөөд удахгүй болох уралдаанд оролцохоор бэлтгэж байгаа.'}
                          </p>
                        </li>
                        <li>
                          <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                            <Flag className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                            {isEn ? 'Formula 1 & Motorcycles' : 'Formula 1 & Моторт техник'}
                          </div>
                          <p className="text-[#5a5243] mt-0.5 leading-relaxed">
                            {isEn
                              ? 'Big fan of Max Verstappen in F1, with a strong passion for cars and motorcycles.'
                              : 'F1-ийн Max Verstappen-ийг дэмждэг, мөн мотортой машин ба мотоцикл их сонирхдог.'}
                          </p>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Pillar 03 */}
                  <div className="p-4 bg-[#ebe5d4] border-2 border-[var(--line)] rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-[var(--line)]/20 pb-2.5 mb-3">
                        <span className="font-mono text-xs font-bold text-[#6d6657]">03</span>
                        <Music className="w-4 h-4 text-cyan-900" />
                      </div>
                      <h5 className="text-sm font-extrabold uppercase tracking-wide text-[var(--ink)] mb-3">
                        {isEn ? 'Music, Languages & Code' : 'Урлаг, Хэл & Код'}
                      </h5>
                      <ul className="space-y-3 text-xs text-[#3f382c]">
                        <li>
                          <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                            <Music className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
                            {isEn ? 'Morin Khuur & Languages' : 'Морин хуур & Хэл'}
                          </div>
                          <p className="text-[#5a5243] mt-0.5 leading-relaxed">
                            {isEn
                              ? 'Plays traditional Mongolian Morin Khuur. B1 English, also studying Chinese and Korean.'
                              : 'Монгол морин хуур тоглож чаддаг. Англи B1 түвшинтэй, мөн Хятад, Солонгос хэл сурдаг.'}
                          </p>
                        </li>
                        <li>
                          <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                            <Gamepad2 className="w-3.5 h-3.5 text-indigo-800 shrink-0" />
                            {isEn ? 'Coding & Roblox Rivals' : 'Код & Roblox Rivals'}
                          </div>
                          <p className="text-[#5a5243] mt-0.5 leading-relaxed">
                            {isEn
                              ? 'Codes websites and mini-games, and enjoys playing Rivals on Roblox in free time.'
                              : 'Вэб сайт, тоглоом кодчилдог ба чөлөөт цагаараа Roblox дээр Rivals тоглох дуртай.'}
                          </p>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Quick Navigation Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t-2 border-[var(--line)]/15">
                  <span className="text-xs font-semibold text-[#5a5243]">
                    {isEn ? 'Explore more:' : 'Цааш үзэх:'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('projects')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#e8e2d2] hover:bg-[#ddd5c1] border-2 border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] transition-colors cursor-pointer"
                    >
                      <span>{isEn ? 'My Projects' : 'Миний бүтээлүүд'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('games')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--line)] hover:opacity-90 border-2 border-[var(--line)] rounded-xl text-xs font-bold text-[var(--paper)] transition-opacity cursor-pointer"
                    >
                      <span>{isEn ? 'My Games' : 'Миний тоглоом'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('interests')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#e8e2d2] hover:bg-[#ddd5c1] border-2 border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] transition-colors cursor-pointer"
                    >
                      <span>{isEn ? 'Links' : 'Холбоосууд'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: СОНИРХОЛ БА ХОЛБООСУУД */}
            {activeTab === 'interests' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#e8e2d0] border-2 border-[var(--line)] rounded-xl">
                  <h4 className="font-bold text-sm text-[var(--ink)] uppercase flex items-center gap-2">
                    <Globe className="w-4 h-4 text-amber-800" />
                    {isEn ? 'Topics & Web Links I Enjoy' : 'Миний сонирхдог сэдэв ба вэб холбоосууд'}
                  </h4>
                  <p className="text-xs text-[#554d3e] mt-0.5">
                    {isEn
                      ? 'Curated links about engineering, karting, Formula 1, and my favorite driver'
                      : 'Инженерчлэл, Картинг, Formula 1 болон миний дуртай тамирчны тухай холбоосууд'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      title: 'What does engineering do?',
                      desc: isEn ? 'Types of engineering and mechanics' : 'Инженерчлэлийн төрлүүд ба механикийн тухай',
                      url: 'https://www.nu.edu/blog/types-of-engineering/',
                    },
                    {
                      title: 'FIA Karting',
                      desc: isEn ? 'International kart racing news & events' : 'Олон улсын картинг уралдааны мэдээлэл',
                      url: 'https://www.fiakarting.com/',
                    },
                    {
                      title: 'Formula 1 Official',
                      desc: isEn ? 'F1 race calendar, standings & teams' : 'F1 уралдааны хуваарь ба багууд',
                      url: 'https://www.formula1.com/',
                    },
                    {
                      title: isEn ? 'About Max Verstappen' : 'Max Verstappen тухай',
                      desc: isEn ? 'My favorite F1 World Champion' : 'Миний дэмждэг F1 дэлхийн аварга',
                      url: 'https://en.wikipedia.org/wiki/Max_Verstappen',
                    },
                    {
                      title: 'My JS Project',
                      desc: isEn ? 'My first JavaScript practice site' : 'Миний анхны JavaScript дасгал сайт',
                      url: 'https://js-practicee.netlify.app',
                    },
                    {
                      title: isEn ? 'My Introduction Site' : 'Миний танилцуулга сайт',
                      desc: isEn ? 'Personal intro website I coded myself' : 'Өөрөө код бичиж бүтээсэн танилцуулга веб',
                      url: 'https://eb-7c34ee.netlify.app/',
                    },
                  ].map((item) => (
                    <a
                      key={item.url}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start justify-between gap-2 p-3.5 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl hover:border-[#000] transition-colors"
                    >
                      <div>
                        <div className="font-bold text-sm text-[var(--ink)]">{item.title}</div>
                        <div className="text-xs text-[#5a5243] mt-0.5">{item.desc}</div>
                      </div>
                      <ExternalLink className="w-4 h-4 shrink-0 text-[#4a4235] mt-0.5" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: ХОЛБОО БАРИХ */}
            {activeTab === 'contact' && (
              <div className="space-y-4">
                <div className="p-4 bg-[#f8f5ec] border-2 border-[var(--line)] rounded-xl">
                  <h4 className="font-bold text-base text-[var(--ink)] flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {isEn ? 'Get in Touch' : 'Надтай холбогдох'}
                  </h4>
                  <p className="text-xs text-[#5a5243] mt-1">
                    {isEn
                      ? 'Reach out via email to share feedback about my projects, games, or engineering.'
                      : 'Миний бүтээл, тоглоом эсвэл инженерчлэлийн талаар санал бодлоо хуваалцах бол доорх имэйлээр холбогдоорой.'}
                  </p>

                  <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="flex-1 px-3.5 py-2.5 bg-[#e8e2d2] border-2 border-[var(--line)] rounded-lg font-mono text-sm font-bold text-[var(--ink)]">
                      benkhluun69@gmail.com
                    </div>
                    <button
                      type="button"
                      onClick={copyEmail}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[var(--line)] text-[var(--paper)] rounded-lg text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>
                        {copied ? (isEn ? 'Copied!' : 'Хуулагдлаа!') : isEn ? 'Copy Email' : 'Имэйл хуулах'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Separate Full-Screen Game Window */}
      {activeGameWindow && (
        <EmojiQuizWindow
          mode={activeGameWindow}
          lang={lang}
          onLangChange={handleLangChange}
          onClose={() => setActiveGameWindow(null)}
        />
      )}
    </>
  );
}
