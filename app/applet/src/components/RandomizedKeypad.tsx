import React, { useState, useEffect } from 'react';
import { Delete } from 'lucide-react';

interface RandomizedKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  className?: string;
}

export const RandomizedKeypad: React.FC<RandomizedKeypadProps> = ({ 
  value, 
  onChange, 
  onSubmit, 
  maxLength = 10,
  className = ""
}) => {
  const [keys, setKeys] = useState<number[]>([]);

  // Shuffle keys every time the component mounts
  useEffect(() => {
    const shuffleArray = () => {
      const array = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };
    setKeys(shuffleArray());
  }, []);

  const handleKeyPress = (num: number) => {
    if (value.length < maxLength) {
      onChange(value + num.toString());
    }
  };

  const handleDelete = () => {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  if (keys.length === 0) return null;

  return (
    <div className={`w-full max-w-[280px] mx-auto mt-4 ${className}`}>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {keys.slice(0, 9).map((num) => (
          <button
            key={`key-${num}`}
            type="button"
            onClick={(e) => { e.preventDefault(); handleKeyPress(num); }}
            className="h-12 sm:h-14 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 rounded-xl text-xl font-bold text-slate-800 dark:text-slate-100 transition-colors shadow-sm cursor-pointer flex items-center justify-center"
          >
            {num}
          </button>
        ))}
        {/* Empty Space */}
        <div className="h-12 sm:h-14" />
        
        {/* 10th Number */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); handleKeyPress(keys[9]); }}
          className="h-12 sm:h-14 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 rounded-xl text-xl font-bold text-slate-800 dark:text-slate-100 transition-colors shadow-sm cursor-pointer flex items-center justify-center"
        >
          {keys[9]}
        </button>
        
        {/* Delete Button */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); handleDelete(); }}
          className="h-12 sm:h-14 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 active:bg-red-200 dark:active:bg-red-900/60 rounded-xl text-red-600 dark:text-red-400 transition-colors shadow-sm cursor-pointer flex items-center justify-center"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
