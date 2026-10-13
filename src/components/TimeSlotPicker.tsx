import { useState } from 'react';
import { Clock, Check, ChevronRight, X } from 'lucide-react';
import { Language, TimeSlot } from '../types';
import { translations } from '../translations';

interface TimeSlotPickerProps {
  language: Language;
  slots: TimeSlot[];
  selectedTime: string; // HH:MM
  onSelectTime: (time: string) => void;
  isLoading: boolean;
  dateSelected: boolean;
}

export default function TimeSlotPicker({
  language,
  slots,
  selectedTime,
  onSelectTime,
  isLoading,
  dateSelected
}: TimeSlotPickerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const t = translations[language];

  if (!dateSelected) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 font-mono text-xs flex flex-col items-center justify-center gap-2 bg-gray-50/20">
        <Clock className="w-5 h-5 text-gray-300" />
        <p>{t.selectDateFirst}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-6 text-xs font-mono text-gray-400 animate-pulse flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 animate-spin text-red-500" />
        <span>{t.loadingSlots}</span>
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  if (availableSlots.length === 0) {
    return (
      <div className="border border-red-100 rounded-xl p-6 text-center text-red-600/80 font-mono text-xs bg-red-50/10">
        <p>{t.noSlots}</p>
      </div>
    );
  }

  const renderSlotButtons = (onSlotClick?: (time: string) => void) => (
    slots.map((slot) => {
      const isSelected = selectedTime === slot.time;
      const isAvailable = slot.available;

      let btnClass = "py-3 px-3 rounded-xl font-mono text-sm border font-medium transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ";
      
      if (!isAvailable) {
        btnClass += "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed line-through ";
      } else if (isSelected) {
        btnClass += "text-white shadow-md bg-gradient-to-r from-red-600 to-orange-500 border-none scale-102 font-bold ring-2 ring-red-300 ";
      } else {
        btnClass += "bg-white border-gray-200 text-gray-700 hover:border-red-400 hover:text-red-600 ";
      }

      return (
        <button
          key={slot.time}
          type="button"
          disabled={!isAvailable}
          onClick={() => {
            onSelectTime(slot.time);
            if (onSlotClick) onSlotClick(slot.time);
          }}
          className={btnClass}
        >
          <span>{slot.time}</span>
          {isAvailable && !isSelected && (
            <span className="text-[9px] text-green-500 font-sans tracking-wide">
              {language === 'fi' ? 'Vapaa' : 'Available'}
              {slot.duration === 90 && ` (${language === 'fi' ? '1.5 h' : '1.5 h'})`}
            </span>
          )}
          {isAvailable && isSelected && (
            <span className="text-[9px] text-white/90 font-sans tracking-wide font-normal">
              {language === 'fi' ? 'Valittu' : 'Selected'}
              {slot.duration === 90 && ` (${language === 'fi' ? '1.5 h' : '1.5 h'})`}
            </span>
          )}
          {!isAvailable && (
            <span className="text-[9px] text-gray-400 font-sans tracking-wide normal-case no-underline font-normal">
              {language === 'fi' ? 'Varattu' : 'Booked'}
            </span>
          )}
        </button>
      );
    })
  );

  return (
    <div>
      {/* Mobile Trigger Button (sm:hidden) */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all active:scale-98 text-left ${
            selectedTime
              ? 'bg-gradient-to-r from-red-50 to-orange-50/50 border-red-300 shadow-2xs'
              : 'bg-white border-gray-200 hover:border-red-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              selectedTime ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-gray-500 uppercase font-bold tracking-wider">
                {language === 'fi' ? 'Kellonaika' : 'Time Slot'}
              </span>
              <span className="text-sm font-sans font-extrabold text-gray-900">
                {selectedTime 
                  ? `${language === 'fi' ? 'Valittu aika: ' : 'Selected: '}${selectedTime}` 
                  : (language === 'fi' ? 'Avaa ajankohdan valinta...' : 'Open time selection...')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
              selectedTime
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}>
              {selectedTime ? (language === 'fi' ? 'Muuta' : 'Change') : (language === 'fi' ? 'Valitse' : 'Select')}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </button>
      </div>

      {/* Mobile Popup Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-sans font-extrabold text-sm text-gray-900">
                  {language === 'fi' ? 'Valitse kellonaika' : 'Select Time'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 font-sans shrink-0">
              {language === 'fi' 
                ? 'Klikkaa sopivaa kellonaikaa alta varauksen tekemiseksi:' 
                : 'Click your preferred time slot below:'}
            </p>

            <div className="grid grid-cols-2 gap-2 overflow-y-auto p-1 flex-1">
              {renderSlotButtons(() => setIsModalOpen(false))}
            </div>

            <div className="pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-sans font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-2xs"
              >
                {language === 'fi' ? 'Sulje' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Grid View (hidden sm:grid) */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-2">
        {renderSlotButtons()}
      </div>
    </div>
  );
}
