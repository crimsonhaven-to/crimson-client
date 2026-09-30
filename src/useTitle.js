import { useEffect } from 'react';

export function useTitle(title) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title ? `${title} | Crimsonhaven` : 'Crimsonhaven | Your Anime Sanctuary';
    return () => {
      document.title = prevTitle;
    };
  }, [title]);
}
