"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(18);
  const [showSlowPill, setShowSlowPill] = useState(false);

  const isNavigatingRef = useRef(false);
  const prevRouteRef = useRef(routeKey);
  const crawlTimerRef = useRef<number | null>(null);
  const slowTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (crawlTimerRef.current !== null) {
      window.clearInterval(crawlTimerRef.current);
      crawlTimerRef.current = null;
    }
    if (slowTimerRef.current !== null) {
      window.clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const finishProgress = useCallback(() => {
    clearTimers();
    isNavigatingRef.current = false;
    setShowSlowPill(false);
    setProgress(100);
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 260);
  }, [clearTimers]);

  const startNavigation = useCallback(() => {
    clearTimers();
    isNavigatingRef.current = true;
    setShowSlowPill(false);
    setVisible(true);
    setProgress(16);

    crawlTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) {
          return prev;
        }
        return prev + Math.max(1.2, (88 - prev) * 0.16);
      });
    }, 160);

    slowTimerRef.current = window.setTimeout(() => {
      if (isNavigatingRef.current) {
        setShowSlowPill(true);
      }
    }, 280);

    safetyTimerRef.current = window.setTimeout(() => {
      if (isNavigatingRef.current) {
        finishProgress();
      }
    }, 12000);
  }, [clearTimers, finishProgress]);

  // Crisp initial page-entry hairline sweep on first mount
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setVisible(false);
      setProgress(0);
      return;
    }

    const t1 = window.setTimeout(() => setProgress(72), 60);
    const t2 = window.setTimeout(() => setProgress(100), 340);
    const t3 = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 620);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  // Complete navigation bar once Next.js commits the new route
  useEffect(() => {
    if (prevRouteRef.current !== routeKey) {
      prevRouteRef.current = routeKey;
      if (isNavigatingRef.current) {
        finishProgress();
      }
    }
  }, [routeKey, finishProgress]);

  // Intercept internal link clicks and browser back/forward navigation
  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");
      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (
        !href ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#")
      ) {
        return;
      }

      let dest: URL;
      try {
        dest = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (dest.origin !== window.location.origin) {
        return;
      }

      // Skip same-page hash jumps or identical URL clicks
      if (dest.pathname === window.location.pathname && dest.search === window.location.search) {
        return;
      }

      startNavigation();
    }

    function handlePopState() {
      startNavigation();
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearTimers();
    };
  }, [startNavigation, clearTimers]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2px] overflow-hidden transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div
          className="h-full bg-brand transition-[width] duration-200 ease-out dark:bg-support"
          style={{ width: `${progress}%` }}
        />
      </div>

      {showSlowPill ? (
        <div
          role="status"
          aria-live="polite"
          className="pp-card-shadow pointer-events-none fixed right-4 bottom-4 z-[70] flex items-center gap-2.5 rounded-full border border-line bg-surface/95 px-3.5 py-2 backdrop-blur-md sm:right-6 sm:bottom-6"
        >
          <span
            className="relative flex size-2 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            <span className="pp-pulse-ring absolute inline-flex size-2 rounded-full bg-brand dark:bg-support" />
            <span className="relative inline-flex size-1.5 rounded-full bg-brand dark:bg-support" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg">
            Loading view
          </span>
        </div>
      ) : null}
    </>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
