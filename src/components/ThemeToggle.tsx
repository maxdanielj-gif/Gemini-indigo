import React, { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
  };

  return (
    <button 
      onClick={toggleTheme} 
      className="px-4 py-2 rounded-lg bg-indigo-600 text-white dark:bg-indigo-500 hover:opacity-90 transition-all"
    >
      {isDark ? '🌙 Dark' : '☀️ Light'}
    </button>
  );
}
