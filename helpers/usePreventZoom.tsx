import { useEffect } from 'react';
export function usePreventZoom() {
  useEffect(() => {
    const prevTouchAction = document.body.style.touchAction;
    const touchHandler = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };

    document.body.style.touchAction = 'none';
    document.addEventListener('touchmove', touchHandler, { passive: false });

    return () => {
      document.body.style.touchAction = prevTouchAction;
      document.removeEventListener('touchmove', touchHandler);
    };
  }, []);
}
