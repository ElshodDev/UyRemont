import React, { useEffect, useRef, useState } from 'react';

// A4 o'lchami ekranda (96 dpi): 210 x 297 mm
const SHEET_WIDTH_PX = 793.7;
const SHEET_HEIGHT_PX = 1122.5;

/**
 * Chop etiladigan A4 varaq: ekranda konteyner kengligiga sig'diriladi, printerda asl o'lchamda chiqadi.
 * Ichidagi ranglar doim yorug' (tungi rejimga bog'liq emas) - faqat aniq ranglar (hex) ishlatilsin.
 */
export default function PrintSheet({ label, children }) {
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const update = () => setScale(Math.min(1, node.clientWidth / SHEET_WIDTH_PX));
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="print-frame" style={{ height: SHEET_HEIGHT_PX * scale }}>
      <div className="print-sheet" style={{ transform: `scale(${scale})` }} role="region" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
