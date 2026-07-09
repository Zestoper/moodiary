import { useState, useEffect } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {

    return localStorage.getItem('theme') === 'dark';

  });

  useEffect(() => {

    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');

      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');

      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return { isDark, toggleTheme };

}
