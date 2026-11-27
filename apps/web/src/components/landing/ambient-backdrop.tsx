"use client";

import { useEffect, useRef } from "react";

interface RgbTuple {
  r: number;
  g: number;
  b: number;
}

interface PaletteTokens {
  fg: RgbTuple;
  muted: RgbTuple;
  accent: RgbTuple;
  isDark: boolean;
}

const GRID_STEP = 56;
const INFLUENCE_RADIUS = 235;
const MAX_DISPLACEMENT = 3.6;
const LERP_FACTOR = 0.14;

function parseCssColor(raw: string, fallback: RgbTuple): RgbTuple {
  const value = raw.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt(hex.charAt(0) + hex.charAt(0), 16);
      const g = Number.parseInt(hex.charAt(1) + hex.charAt(1), 16);
      const b = Number.parseInt(hex.charAt(2) + hex.charAt(2), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return { r, g, b };
      }
    }
    if (hex.length === 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return { r, g, b };
      }
    }
  }

  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  return fallback;
}

function rgba(color: RgbTuple, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha.toFixed(4)})`;
}

function readPaletteTokens(): PaletteTokens {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const isDark = root.getAttribute("data-theme") === "dark";

  const fgFallback: RgbTuple = isDark ? { r: 243, g: 245, b: 248 } : { r: 4, g: 13, b: 67 };
  const mutedFallback: RgbTuple = isDark ? { r: 139, g: 147, b: 171 } : { r: 83, g: 89, b: 131 };
  const accentFallback: RgbTuple = isDark ? { r: 29, g: 134, b: 255 } : { r: 60, g: 44, b: 218 };

  return {
    fg: parseCssColor(styles.getPropertyValue("--pp-fg"), fgFallback),
    muted: parseCssColor(styles.getPropertyValue("--pp-muted"), mutedFallback),
    accent: parseCssColor(
      styles.getPropertyValue(isDark ? "--pp-support" : "--pp-brand"),
      accentFallback,
    ),
    isDark,
  };
}

/**
 * Minimal architectural coordinate lattice for the landing page static space.
 * Illuminates nearby grid hairlines and shifts intersection crosshairs subtly
 * around the pointer while sleeping completely when idle or under reduced motion.
 */
export function AmbientBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let palette = readPaletteTokens();

    let targetX = width * 0.5;
    let targetY = height * 0.3;
    let currentX = targetX;
    let currentY = targetY;
    let targetPresence = 0;
    let currentPresence = 0;
    let scrollY = window.scrollY;
    let introStartMs: number | null = reducedMotionQuery.matches ? null : performance.now();
    let introProgress = reducedMotionQuery.matches ? 1 : 0;
    let rafId: number | null = null;

    function syncSize() {
      if (!canvas || !ctx) {
        return;
      }
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawFrame() {
      if (!ctx) {
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const offsetX = (width % GRID_STEP) / 2;
      const rawScrollOffset =
        ((((height % GRID_STEP) / 2 - scrollY) % GRID_STEP) + GRID_STEP) % GRID_STEP;
      const offsetY = rawScrollOffset;

      const restingLineAlpha = palette.isDark ? 0.042 : 0.032;
      const restingDotAlpha = palette.isDark ? 0.2 : 0.16;

      // 1. Resting hairline grid across the static canvas
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(palette.fg, restingLineAlpha);
      ctx.beginPath();
      for (let x = offsetX; x <= width; x += GRID_STEP) {
        const crispX = Math.round(x) + 0.5;
        ctx.moveTo(crispX, 0);
        ctx.lineTo(crispX, height);
      }
      for (let y = offsetY; y <= height; y += GRID_STEP) {
        const crispY = Math.round(y) + 0.5;
        ctx.moveTo(0, crispY);
        ctx.lineTo(width, crispY);
      }
      ctx.stroke();

      const activePresence = reducedMotionQuery.matches ? 0 : currentPresence;
      const introActive = !reducedMotionQuery.matches && introProgress < 1;

      // 1b. Non-blocking initial page-entry architectural scan wave
      if (introActive) {
        const originX = width * 0.34;
        const originY = height * 0.28;
        const maxRadius = Math.hypot(width, height) * 0.72;
        const waveRadius = Math.max(24, maxRadius * introProgress);
        const waveAlpha = (1 - introProgress) * (palette.isDark ? 0.16 : 0.11);

        const ring = ctx.createRadialGradient(
          originX,
          originY,
          Math.max(0, waveRadius - 120),
          originX,
          originY,
          waveRadius + 30,
        );
        ring.addColorStop(0, rgba(palette.accent, 0));
        ring.addColorStop(0.65, rgba(palette.accent, waveAlpha));
        ring.addColorStop(1, rgba(palette.accent, 0));
        ctx.fillStyle = ring;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Subtle atmospheric lens wash + illuminated grid band around smoothed cursor
      if (activePresence > 0.005) {
        const washAlpha = (palette.isDark ? 0.05 : 0.035) * activePresence;
        const wash = ctx.createRadialGradient(
          currentX,
          currentY,
          0,
          currentX,
          currentY,
          INFLUENCE_RADIUS * 1.15,
        );
        wash.addColorStop(0, rgba(palette.accent, washAlpha));
        wash.addColorStop(0.55, rgba(palette.accent, washAlpha * 0.32));
        wash.addColorStop(1, rgba(palette.accent, 0));
        ctx.fillStyle = wash;
        ctx.fillRect(
          currentX - INFLUENCE_RADIUS * 1.2,
          currentY - INFLUENCE_RADIUS * 1.2,
          INFLUENCE_RADIUS * 2.4,
          INFLUENCE_RADIUS * 2.4,
        );

        // Illuminated hairline grid clipped softly by a radial gradient stroke
        const gridStroke = ctx.createRadialGradient(
          currentX,
          currentY,
          0,
          currentX,
          currentY,
          INFLUENCE_RADIUS,
        );
        const gridPeakAlpha = (palette.isDark ? 0.2 : 0.14) * activePresence;
        gridStroke.addColorStop(0, rgba(palette.accent, gridPeakAlpha));
        gridStroke.addColorStop(0.6, rgba(palette.accent, gridPeakAlpha * 0.4));
        gridStroke.addColorStop(1, rgba(palette.accent, 0));

        ctx.strokeStyle = gridStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const startX = Math.max(
          offsetX,
          offsetX + Math.floor((currentX - INFLUENCE_RADIUS - offsetX) / GRID_STEP) * GRID_STEP,
        );
        const endX = Math.min(width, currentX + INFLUENCE_RADIUS);
        const startY = Math.max(
          offsetY,
          offsetY + Math.floor((currentY - INFLUENCE_RADIUS - offsetY) / GRID_STEP) * GRID_STEP,
        );
        const endY = Math.min(height, currentY + INFLUENCE_RADIUS);

        for (let x = startX; x <= endX; x += GRID_STEP) {
          const crispX = Math.round(x) + 0.5;
          ctx.moveTo(crispX, Math.max(0, currentY - INFLUENCE_RADIUS));
          ctx.lineTo(crispX, Math.min(height, currentY + INFLUENCE_RADIUS));
        }
        for (let y = startY; y <= endY; y += GRID_STEP) {
          const crispY = Math.round(y) + 0.5;
          ctx.moveTo(Math.max(0, currentX - INFLUENCE_RADIUS), crispY);
          ctx.lineTo(Math.min(width, currentX + INFLUENCE_RADIUS), crispY);
        }
        ctx.stroke();
      }

      // 3. Lattice intersections: calm micro-dots at rest, subtle displaced crosshairs near cursor
      const restingDotColor = rgba(palette.muted, restingDotAlpha);
      const radiusSq = INFLUENCE_RADIUS * INFLUENCE_RADIUS;

      for (let x = offsetX; x <= width; x += GRID_STEP) {
        for (let y = offsetY; y <= height; y += GRID_STEP) {
          if (activePresence > 0.005) {
            const dx = x - currentX;
            const dy = y - currentY;
            const distSq = dx * dx + dy * dy;

            if (distSq < radiusSq) {
              const dist = Math.sqrt(distSq);
              const normalized = 1 - dist / INFLUENCE_RADIUS;
              const falloff = normalized * normalized;
              const strength = falloff * activePresence;

              const dirX = dist > 0.001 ? dx / dist : 0;
              const dirY = dist > 0.001 ? dy / dist : 0;
              const px = x + dirX * MAX_DISPLACEMENT * strength;
              const py = y + dirY * MAX_DISPLACEMENT * strength;

              // Crosshair arm scales smoothly from 1.5px to 4.5px near the cursor
              const arm = 1.4 + strength * 3.1;
              const crossAlpha = restingDotAlpha + strength * (palette.isDark ? 0.42 : 0.34);

              ctx.strokeStyle = rgba(palette.accent, crossAlpha);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(px - arm, py);
              ctx.lineTo(px + arm, py);
              ctx.moveTo(px, py - arm);
              ctx.lineTo(px, py + arm);
              ctx.stroke();
              continue;
            }
          }

          ctx.fillStyle = restingDotColor;
          ctx.fillRect(Math.round(x) - 0.5, Math.round(y) - 0.5, 1.5, 1.5);
        }
      }
    }

    function step() {
      rafId = null;

      if (reducedMotionQuery.matches || coarsePointerQuery.matches) {
        currentPresence = 0;
        introProgress = 1;
        introStartMs = null;
        drawFrame();
        return;
      }

      if (introStartMs !== null) {
        const elapsed = performance.now() - introStartMs;
        const t = Math.min(1, elapsed / 920);
        // Cubic ease-out for calm outward reveal
        introProgress = 1 - Math.pow(1 - t, 3);
        if (t >= 1) {
          introStartMs = null;
        }
      }

      currentX += (targetX - currentX) * LERP_FACTOR;
      currentY += (targetY - currentY) * LERP_FACTOR;
      currentPresence += (targetPresence - currentPresence) * 0.1;

      drawFrame();

      const dx = Math.abs(targetX - currentX);
      const dy = Math.abs(targetY - currentY);
      const dp = Math.abs(targetPresence - currentPresence);

      if (dx > 0.15 || dy > 0.15 || dp > 0.005 || introProgress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    }

    function scheduleFrame() {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(step);
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === "touch" || reducedMotionQuery.matches) {
        return;
      }
      targetX = event.clientX;
      targetY = event.clientY;
      if (targetPresence === 0) {
        currentX = event.clientX;
        currentY = event.clientY;
      }
      targetPresence = 1;
      scheduleFrame();
    }

    function handlePointerLeave() {
      targetPresence = 0;
      scheduleFrame();
    }

    function handleScroll() {
      scrollY = window.scrollY;
      scheduleFrame();
    }

    function handleResize() {
      syncSize();
      scheduleFrame();
    }

    function handleReducedMotionChange() {
      if (reducedMotionQuery.matches) {
        targetPresence = 0;
        currentPresence = 0;
      }
      scheduleFrame();
    }

    const themeObserver = new MutationObserver(() => {
      palette = readPaletteTokens();
      scheduleFrame();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    syncSize();
    drawFrame();
    if (!reducedMotionQuery.matches && !coarsePointerQuery.matches) {
      scheduleFrame();
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("blur", handlePointerLeave);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      themeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        maskImage:
          "radial-gradient(ellipse 96% 88% at 50% 42%, black 55%, rgba(0, 0, 0, 0.35) 100%)",
      }}
    >
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}
