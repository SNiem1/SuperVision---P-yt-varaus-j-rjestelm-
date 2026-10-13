import { Language } from '../types';

interface LanguageToggleProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export default function LanguageToggle({ language, onLanguageChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
      <button
        type="button"
        onClick={() => onLanguageChange('fi')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          language === 'fi'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        SUOMI
      </button>
      <button
        type="button"
        onClick={() => onLanguageChange('en')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          language === 'en'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        ENGLISH
      </button>
    </div>
  );
}
