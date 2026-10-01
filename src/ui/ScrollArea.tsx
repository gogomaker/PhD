// 스크롤바는 숨기고(SPEC 5장 공통), 넘치는 쪽 가장자리에 그라데이션으로 "더 있음"을 보여준다
import { useCallback, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from 'react';

type Edges = { top: boolean; bottom: boolean; left: boolean; right: boolean };
const NONE: Edges = { top: false, bottom: false, left: false, right: false };

/** 스크롤 상자에서 아직 더 있는 쪽 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  const [edges, setEdges] = useState<Edges>(NONE);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = {
      top: el.scrollTop > 2,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2,
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    };
    setEdges(e => (e.top === next.top && e.bottom === next.bottom && e.left === next.left && e.right === next.right ? e : next));
  }, [ref]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const c of Array.from(el.children)) ro.observe(c);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true });
    el.addEventListener('scroll', measure, { passive: true });
    return () => { ro.disconnect(); mo.disconnect(); el.removeEventListener('scroll', measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);
  return edges;
}

const SIZE = 28;

/** 가장자리 그라데이션 (부모가 position 있는 상자여야 함) */
export function EdgeFades({ edges, color, inset = 0, radius = 0 }: { edges: Edges; color: string; inset?: number; radius?: number }) {
  const base: CSSProperties = { position: 'absolute', pointerEvents: 'none', transition: 'opacity .15s', zIndex: 3 };
  return (
    <>
      <div data-fade="top" style={{ ...base, left: inset, right: inset, top: inset, height: SIZE, background: `linear-gradient(${color}, transparent)`, opacity: edges.top ? 1 : 0, borderRadius: `${radius}px ${radius}px 0 0` }} />
      <div data-fade="bottom" style={{ ...base, left: inset, right: inset, bottom: inset, height: SIZE, background: `linear-gradient(transparent, ${color})`, opacity: edges.bottom ? 1 : 0, borderRadius: `0 0 ${radius}px ${radius}px` }} />
      <div data-fade="left" style={{ ...base, top: inset, bottom: inset, left: inset, width: SIZE * 2, background: `linear-gradient(to left, transparent, ${color})`, opacity: edges.left ? 1 : 0, borderRadius: `${radius}px 0 0 ${radius}px` }} />
      <div data-fade="right" style={{ ...base, top: inset, bottom: inset, right: inset, width: SIZE * 2, background: `linear-gradient(to right, transparent, ${color})`, opacity: edges.right ? 1 : 0, borderRadius: `0 ${radius}px ${radius}px 0` }} />
    </>
  );
}

/**
 * 세로로 넘치는 상자. style = 바깥 상자(배경·모서리·최대 높이·위치), innerStyle = 안쪽(여백·배치).
 * 바깥은 넘치지 않고, 안쪽만 스크롤한다.
 */
export function ScrollArea({ style, innerStyle, fade, radius = 0, children, ...rest }: { style?: CSSProperties; innerStyle?: CSSProperties; fade: string; radius?: number; children: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, 'style'>) {
  const ref = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(ref);
  return (
    <div {...rest} style={{ position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...style }}>
      <div ref={ref} data-scroll style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', ...innerStyle }}>{children}</div>
      <EdgeFades edges={{ ...edges, left: false, right: false }} color={fade} radius={radius} />
    </div>
  );
}
