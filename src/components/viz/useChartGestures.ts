/**
 * useChartGestures — Pinch-to-zoom hook for chart zoom level changes.
 */

import { useState, useCallback } from 'react';
import { ZoomLevel } from './types';

const ZOOM_ORDER: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];

export function useChartGestures(initialZoom: ZoomLevel) {
  const [activeZoom, setActiveZoom] = useState<ZoomLevel>(initialZoom);

  const zoomIn = useCallback(() => {
    setActiveZoom((prev) => {
      const idx = ZOOM_ORDER.indexOf(prev);
      return idx > 0 ? ZOOM_ORDER[idx - 1] : prev;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setActiveZoom((prev) => {
      const idx = ZOOM_ORDER.indexOf(prev);
      return idx < ZOOM_ORDER.length - 1 ? ZOOM_ORDER[idx + 1] : prev;
    });
  }, []);

  const handlePinchScale = useCallback((scale: number) => {
    if (scale > 1.3) {
      zoomIn();
    } else if (scale < 0.7) {
      zoomOut();
    }
  }, [zoomIn, zoomOut]);

  return {
    activeZoom,
    setActiveZoom,
    zoomIn,
    zoomOut,
    handlePinchScale,
  };
}
