import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Measure before first paint on the client; useEffect only during SSR, where
// there is nothing to measure anyway.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Pixel size of an element, measured on mount and kept current by a ResizeObserver. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (width: number, height: number) =>
      setSize(s => (s.w === width && s.h === height ? s : { w: width, h: height }));
    const r = el.getBoundingClientRect();
    apply(r.width, r.height);
    const ro = new ResizeObserver(entries => {
      const c = entries[0]?.contentRect;
      if (c) apply(c.width, c.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}
