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

    const onChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches);
    };

    setIsMobileLayout(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);

    return () => {
      mediaQuery.removeEventListener('change', onChange);
    };
  }, []);

  return isMobileLayout;
};
