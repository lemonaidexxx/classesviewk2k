'use client';
import { useEffect, useRef } from 'react';
export default function Footer() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const media = window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)');
    let visible = false,
      frame = 0,
      x = 50,
      y = 50,
      tx = 50,
      ty = 50;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const tick = () => {
      if (!visible || media.matches) {
        stop();
        return;
      }
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.setProperty('--pointer-x', `${x}%`);
      el.style.setProperty('--pointer-y', `${y}%`);
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.1) frame = requestAnimationFrame(tick);
      else frame = 0;
    };
    const move = (e: PointerEvent) => {
      if (!visible || media.matches) return;
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const reset = () => {
      tx = ty = 50;
      if (!frame && visible && !media.matches) frame = requestAnimationFrame(tick);
    };
    const change = () => {
      if (media.matches) {
        stop();
        el.style.removeProperty('--pointer-x');
        el.style.removeProperty('--pointer-y');
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) stop();
    });
    observer.observe(el);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    media.addEventListener('change', change);
    return () => {
      stop();
      observer.disconnect();
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
      media.removeEventListener('change', change);
    };
  }, []);
  return (
    <footer ref={ref} className="footer">
      <div className="footer-gradient" aria-hidden="true" />
      <span>Maintained in Google Sheets</span>
    </footer>
  );
}
