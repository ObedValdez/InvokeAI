import { useEffect, useState } from 'react';

const MOBILE_LAYOUT_MAX_WIDTH_PX = 1024;
const MOBILE_LAYOUT_QUERY = `(max-width: ${MOBILE_LAYOUT_MAX_WIDTH_PX}px)`;

const getIsMobileLayout = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
};

export const useIsMobileLayout = () => {
  const [isMobileLayout, setIsMobileLayout] = useState(getIsMobileLayout);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };

    const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobileLayout(event.matches);
    };

    setIsMobileLayout(mediaQuery.matches);

    // Safari versions without MediaQueryList#addEventListener
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange as (event: MediaQueryListEvent) => void);
      return () => {
        mediaQuery.removeEventListener('change', onChange as (event: MediaQueryListEvent) => void);
      };
    }

    if (typeof legacyMediaQuery.addListener === 'function') {
      legacyMediaQuery.addListener(onChange as (event: MediaQueryListEvent) => void);
      return () => {
        legacyMediaQuery.removeListener?.(onChange as (event: MediaQueryListEvent) => void);
      };
    }

    return undefined;
  }, []);

  return isMobileLayout;
};
