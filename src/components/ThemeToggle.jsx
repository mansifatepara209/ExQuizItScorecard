import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-quiz-accent border border-quiz-border hover:border-quiz-gold transition"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {theme === 'dark' ? (
                <Sun size={20} className="text-quiz-gold" />
            ) : (
                <Moon size={20} className="text-quiz-gold" />
            )}
        </button>
    );
}

export default ThemeToggle;