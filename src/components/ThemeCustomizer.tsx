import React, { useState, useEffect } from 'react';
import { Palette, Type, Sparkles, Check, RotateCcw, X, Layers, Sliders, Shield } from 'lucide-react';

export interface ThemeConfig {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string; // Body font
  headingFontFamily: string; // Heading / Display font
  borderRadius: string;
}

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  config: ThemeConfig;
  onChange: (newConfig: ThemeConfig) => void;
  language: 'fi' | 'en';
}

export const COLOR_PRESETS = [
  {
    id: 'red-orange',
    nameFi: 'Klassinen Punainen & Oranssi',
    nameEn: 'Classic Red & Orange',
    primary: '#dc2626',
    secondary: '#f97316',
  },
  {
    id: 'emerald-teal',
    nameFi: 'Metsä & Smaragdi (Vihreä)',
    nameEn: 'Emerald & Teal Green',
    primary: '#059669',
    secondary: '#10b981',
  },
  {
    id: 'royal-blue',
    nameFi: 'Kuninkaallinen Sininen & Indigo',
    nameEn: 'Royal Blue & Indigo',
    primary: '#2563eb',
    secondary: '#4f46e5',
  },
  {
    id: 'gold-amber',
    nameFi: 'Luksus Kulta & Meripihka',
    nameEn: 'Luxury Gold & Amber',
    primary: '#d97706',
    secondary: '#b45309',
  },
  {
    id: 'purple-magenta',
    nameFi: 'Elegantti Purppura & Lila',
    nameEn: 'Elegant Purple & Magenta',
    primary: '#9333ea',
    secondary: '#c026d3',
  },
  {
    id: 'slate-charcoal',
    nameFi: 'Moderni Tumma & Hiili',
    nameEn: 'Modern Dark & Slate',
    primary: '#1e293b',
    secondary: '#475569',
  },
  {
    id: 'rose-champagne',
    nameFi: 'Ruusu & Roosa',
    nameEn: 'Rose & Pink Champagne',
    primary: '#e11d48',
    secondary: '#f43f5e',
  },
];

export const FONT_PRESETS = [
  { id: 'Space Grotesk', name: 'Space Grotesk (Trendikäs & Rohkea)', googleFont: 'Space+Grotesk:wght@500;700' },
  { id: 'Playfair Display', name: 'Playfair Display (Luksus & Fine Dining)', googleFont: 'Playfair+Display:ital,wght@0,600;0,800;1,600' },
  { id: 'Cinzel', name: 'Cinzel (Tyylikäs & Historiallinen)', googleFont: 'Cinzel:wght@600;800' },
  { id: 'Cormorant Garamond', name: 'Cormorant Garamond (Klassinen Eleganssi)', googleFont: 'Cormorant+Garamond:wght@600;700' },
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans (Raikas Skandinaavinen)', googleFont: 'Plus+Jakarta+Sans:wght@500;700;800' },
  { id: 'Inter', name: 'Inter (Selkeä & Moderni)', googleFont: 'Inter:wght@400;600;800' },
  { id: 'Montserrat', name: 'Montserrat (Ammattimainen & Vahva)', googleFont: 'Montserrat:wght@500;700;800' },
];

export const FONT_COMBOS = [
  {
    id: 'fine-dining',
    nameFi: '🍸 Fine Dining Luksus',
    nameEn: '🍸 Fine Dining Luxury',
    descFi: 'Serif-otsikko + Raikas leipäteksti',
    descEn: 'Serif heading + Fresh body text',
    headingFont: 'Playfair Display',
    bodyFont: 'Plus Jakarta Sans',
  },
  {
    id: 'classic-garamond',
    nameFi: '🍷 Klassinen Eleganssi',
    nameEn: '🍷 Classic Elegance',
    descFi: 'Perinteinen serif-otsikko + Selkeä Inter',
    descEn: 'Traditional serif header + Clean Inter',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Inter',
  },
  {
    id: 'royal-cinzel',
    nameFi: '👑 Majesteettinen Lounge',
    nameEn: '👑 Royal Lounge',
    descFi: 'Tyylikäs Cinzel-otsikko + Montserrat',
    descEn: 'Majestic Cinzel header + Montserrat',
    headingFont: 'Cinzel',
    bodyFont: 'Montserrat',
  },
  {
    id: 'modern-grotesk',
    nameFi: '⚡ Urbaani & Trendikäs',
    nameEn: '⚡ Urban & Trendy',
    descFi: 'Rohkea Space Grotesk + Inter',
    descEn: 'Bold Space Grotesk + Inter',
    headingFont: 'Space Grotesk',
    bodyFont: 'Inter',
  },
  {
    id: 'scandi-fresh',
    nameFi: '🌿 Raikas Skandinaavinen',
    nameEn: '🌿 Scandi Fresh',
    descFi: 'Vahva Plus Jakarta + Inter',
    descEn: 'Strong Plus Jakarta + Inter',
    headingFont: 'Plus Jakarta Sans',
    bodyFont: 'Inter',
  },
  {
    id: 'minimal-inter',
    nameFi: '✨ Yhtenäinen Selkeä',
    nameEn: '✨ Unified Clean',
    descFi: 'Moderni Inter koko sivulle',
    descEn: 'Modern Inter for all text',
    headingFont: 'Inter',
    bodyFont: 'Inter',
  },
];

export const BRAND_PRESETS = [
  {
    nameFi: '🍸 Fine Dining & Viinibaari',
    nameEn: '🍸 Fine Dining & Wine Bar',
    brandName: 'Bistro Le Gourmet',
    primaryColor: '#d97706',
    secondaryColor: '#b45309',
    fontFamily: 'Plus Jakarta Sans',
    headingFontFamily: 'Playfair Display',
    borderRadius: '0.5rem',
  },
  {
    nameFi: '🍕 Pizzeria & Trattoria',
    nameEn: '🍕 Pizzeria & Trattoria',
    brandName: 'Trattoria Bella',
    primaryColor: '#dc2626',
    secondaryColor: '#f97316',
    fontFamily: 'Inter',
    headingFontFamily: 'Plus Jakarta Sans',
    borderRadius: '1rem',
  },
  {
    nameFi: '🥗 Raikas Bistro & Cafe',
    nameEn: '🥗 Fresh Bistro & Cafe',
    brandName: 'Green Garden Bistro',
    primaryColor: '#059669',
    secondaryColor: '#10b981',
    fontFamily: 'Inter',
    headingFontFamily: 'Plus Jakarta Sans',
    borderRadius: '0.75rem',
  },
  {
    nameFi: '🍣 Sushibar & Lounge',
    nameEn: '🍣 Sushibar & Lounge',
    brandName: 'Haru Sushi & Lounge',
    primaryColor: '#1e293b',
    secondaryColor: '#334155',
    fontFamily: 'Montserrat',
    headingFontFamily: 'Cinzel',
    borderRadius: '0.375rem',
  },
  {
    nameFi: '⚡ Moderni Cocktailbar',
    nameEn: '⚡ Modern Cocktail Bar',
    brandName: 'Velvet Lounge',
    primaryColor: '#9333ea',
    secondaryColor: '#c026d3',
    fontFamily: 'Inter',
    headingFontFamily: 'Space Grotesk',
    borderRadius: '1rem',
  },
];

export const DEFAULT_THEME: ThemeConfig = {
  brandName: 'Sinun Logo',
  primaryColor: '#dc2626',
  secondaryColor: '#f97316',
  fontFamily: 'Inter',
  headingFontFamily: 'Space Grotesk',
  borderRadius: '0.75rem',
};

export function applyThemeConfig(config: ThemeConfig) {
  if (typeof document === 'undefined') return;

  const headingFont = config.headingFontFamily || config.fontFamily || 'Space Grotesk';
  const bodyFont = config.fontFamily || 'Inter';

  // 1. Load both Google Fonts
  [headingFont, bodyFont].forEach((fontName) => {
    const fontObj = FONT_PRESETS.find((f) => f.id === fontName);
    if (fontObj && fontObj.googleFont) {
      const linkId = `google-font-${fontObj.id.replace(/\s+/g, '-').toLowerCase()}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontObj.googleFont}&display=swap`;
        document.head.appendChild(link);
      }
    }
  });

  const root = document.documentElement;
  root.style.setProperty('--font-sans', `'${bodyFont}', ui-sans-serif, system-ui, sans-serif`);
  root.style.setProperty('--font-display', `'${headingFont}', serif, sans-serif`);
  root.style.fontFamily = `'${bodyFont}', ui-sans-serif, system-ui, sans-serif`;

  // Primary & Gradient Colors
  root.style.setProperty('--brand-primary', config.primaryColor);
  root.style.setProperty('--brand-secondary', config.secondaryColor);
  
  // Tailwind v4 color variables
  root.style.setProperty('--color-red-600', config.primaryColor);
  root.style.setProperty('--color-red-500', config.primaryColor);
  root.style.setProperty('--color-red-700', config.primaryColor);
  root.style.setProperty('--color-orange-500', config.secondaryColor);
  root.style.setProperty('--color-red-50', `${config.primaryColor}15`);
}

export default function ThemeCustomizer({
  isOpen,
  onClose,
  config,
  onChange,
  language,
}: ThemeCustomizerProps) {
  if (!isOpen) return null;

  const isFi = language === 'fi';

  // Apply quick preset
  const applyPreset = (preset: typeof BRAND_PRESETS[0]) => {
    onChange({
      brandName: preset.brandName,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      fontFamily: preset.fontFamily,
      headingFontFamily: preset.headingFontFamily,
      borderRadius: preset.borderRadius,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop overlay click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-gray-100 overflow-hidden font-sans">
        {/* Drawer Header */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white flex items-center justify-center shadow-sm">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base leading-tight">
                {isFi ? 'Brändin Räätälöinti & Teema' : 'Brand Customizer & Theme'}
              </h3>
              <p className="text-xs text-gray-500">
                {isFi ? 'White Label esittelytyökalu asiakkaalle' : 'White Label sales preview tool'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Quick Preset Buttons */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{isFi ? 'Pikavalinnat (Eri toimialat)' : 'Quick Industry Presets'}</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {BRAND_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="p-2.5 text-left border border-gray-200 rounded-xl hover:border-red-400 hover:bg-red-50/20 transition-all flex items-center justify-between text-xs font-sans group"
                >
                  <span className="font-bold text-gray-800 group-hover:text-red-700">
                    {isFi ? p.nameFi : p.nameEn}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: p.primaryColor }} />
                    <span className="text-[10px] font-mono text-gray-400">{p.headingFontFamily}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Brand Name Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-gray-600" />
              <span>{isFi ? 'Asiakkaan Logon Teksti' : 'Brand Logo Text'}</span>
            </label>
            <input
              type="text"
              value={config.brandName}
              onChange={(e) => onChange({ ...config, brandName: e.target.value })}
              placeholder="e.g. Ravintola Kulinaria"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-2xs"
            />
          </div>

          {/* Color Palettes */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-gray-600" />
              <span>{isFi ? 'Pääväripaletti' : 'Primary Color Palette'}</span>
            </label>

            <div className="grid grid-cols-1 gap-2">
              {COLOR_PRESETS.map((preset) => {
                const isSelected = config.primaryColor === preset.primary;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChange({
                      ...config,
                      primaryColor: preset.primary,
                      secondaryColor: preset.secondary,
                    })}
                    className={`p-2.5 border rounded-xl flex items-center justify-between text-xs transition-all ${
                      isSelected
                        ? 'border-red-600 bg-red-50/50 shadow-2xs font-bold'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center -space-x-1">
                        <span className="w-5 h-5 rounded-full border border-white shadow-xs shrink-0" style={{ backgroundColor: preset.primary }} />
                        <span className="w-5 h-5 rounded-full border border-white shadow-xs shrink-0" style={{ backgroundColor: preset.secondary }} />
                      </div>
                      <span className="text-gray-800">{isFi ? preset.nameFi : preset.nameEn}</span>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Color Pickers */}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                  {isFi ? 'Oma pääväri' : 'Custom Primary'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => onChange({ ...config, primaryColor: e.target.value })}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-gray-300 p-0.5 bg-white"
                  />
                  <span className="font-mono text-xs uppercase text-gray-600">{config.primaryColor}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                  {isFi ? 'Oma gradientti/pääväri 2' : 'Custom Gradient Color'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => onChange({ ...config, secondaryColor: e.target.value })}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-gray-300 p-0.5 bg-white"
                  />
                  <span className="font-mono text-xs uppercase text-gray-600">{config.secondaryColor}</span>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Typography & Font Combinations */}
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Type className="w-4 h-4 text-gray-600" />
              <span>{isFi ? 'Fonttikombot (Otsikko + Leipäteksti)' : 'Font Combinations'}</span>
            </label>

            {/* Curated Font Combos */}
            <div className="grid grid-cols-1 gap-2">
              {FONT_COMBOS.map((combo) => {
                const isSelected = config.headingFontFamily === combo.headingFont && config.fontFamily === combo.bodyFont;
                return (
                  <button
                    key={combo.id}
                    type="button"
                    onClick={() => onChange({
                      ...config,
                      headingFontFamily: combo.headingFont,
                      fontFamily: combo.bodyFont,
                    })}
                    className={`w-full text-left p-3 border rounded-xl text-xs transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'border-red-600 bg-red-50/50 shadow-2xs text-gray-900'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-gray-900" style={{ fontFamily: `'${combo.headingFont}', serif` }}>
                        {isFi ? combo.nameFi : combo.nameEn}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500" style={{ fontFamily: `'${combo.bodyFont}', sans-serif` }}>
                      <span>{isFi ? combo.descFi : combo.descEn}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Manual Independent Font Selection */}
            <div className="pt-2 space-y-3 bg-gray-50/60 p-3.5 border border-gray-200/80 rounded-xl">
              <span className="text-[11px] font-extrabold uppercase text-gray-600 block tracking-wider">
                {isFi ? '🛠️ Yksittäinen Fonttivalinta' : '🛠️ Custom Font Selection'}
              </span>

              {/* Heading Font */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  {isFi ? 'Otsikot (H1, H2, Paikan nimi)' : 'Headings (H1, H2, Hero)'}
                </label>
                <select
                  value={config.headingFontFamily || 'Space Grotesk'}
                  onChange={(e) => onChange({ ...config, headingFontFamily: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-red-500 shadow-2xs"
                >
                  {FONT_PRESETS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Body Font */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  {isFi ? 'Leipäteksti & Painikkeet' : 'Body Text & Buttons'}
                </label>
                <select
                  value={config.fontFamily || 'Inter'}
                  onChange={(e) => onChange({ ...config, fontFamily: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-red-500 shadow-2xs"
                >
                  {FONT_PRESETS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_THEME)}
            className="px-3.5 py-2 border border-gray-300 hover:bg-white text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isFi ? 'Nollaa oletukset' : 'Reset Defaults'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-md"
          >
            {isFi ? 'Valmis' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

