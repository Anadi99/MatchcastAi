interface LanguageOption {
  code: string;
  label: string;
  ariaLabel: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'hi', label: 'हिंदी', ariaLabel: 'Hindi' },
  { code: 'ta', label: 'தமிழ்', ariaLabel: 'Tamil' },
  { code: 'te', label: 'తెలుగు', ariaLabel: 'Telugu' },
  { code: 'mr', label: 'मराठी', ariaLabel: 'Marathi' },
];

interface LanguageToggleProps {
  language: string;
  onSelect: (lang: string) => void;
}

export default function LanguageToggle({
  language,
  onSelect,
}: LanguageToggleProps) {
  return (
    <div
      role="group"
      aria-label="Select commentary language"
      className="flex items-center gap-1"
    >
      {LANGUAGES.map((lang) => {
        const isActive = lang.code === language;

        return (
          <button
            key={lang.code}
            onClick={() => onSelect(lang.code)}
            aria-pressed={isActive}
            aria-label={`Switch to ${lang.ariaLabel} commentary`}
            className={[
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent-pulse text-white'
                : 'text-text-muted hover:text-text-primary hover:bg-white/10',
            ].join(' ')}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
