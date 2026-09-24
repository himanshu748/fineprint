'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export function RevealRoot({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    node.setAttribute('data-reveal-ready', 'true');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    node.querySelectorAll('[data-reveal]').forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="fp-reveal-root" ref={root}>
      {children}
    </div>
  );
}

export function Ticker({ value }: { value: number }) {
  const node = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = node.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    let frame = 0;
    element.textContent = '0';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / 1100);
          element.textContent = String(Math.round(value * (1 - Math.pow(1 - progress, 3))));
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.textContent = String(value);
    };
  }, [value]);
  return (
    <span ref={node} className="fp-ticker" style={{ minWidth: `${String(value).length}ch` }}>
      {value}
    </span>
  );
}
