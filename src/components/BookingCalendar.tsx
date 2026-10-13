import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react';
import { Language, DayAvailability } from '../types';
import { translations } from '../translations';

interface BookingCalendarProps {
  language: Language;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  partySize: number;
  tableId?: string;
  className?: string;
}

export default function BookingCalendar({
  language,
  selectedDate,
  onSelectDate,
  partySize,
  tableId,
  className = ''
}: BookingCalendarProps) {
  const t = translations[language];
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    // Start with today or the selectedDate
    if (selectedDate) {
      return new Date(selectedDate);
    }
    return new Date();
  });

  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Fetch monthly availability when month/year, partySize, or tableId changes
  useEffect(() => {
    const fetchAvailability = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          year: year.toString(),
          month: (month + 1).toString(), // 1-indexed in API
          partySize: partySize.toString()
        });
        if (tableId) {
          queryParams.append('tableId', tableId);
        }

        const res = await fetch(`/api/availability/month?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setAvailability(data);
        }
      } catch (err) {
        console.error('Error fetching availability:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();
  }, [year, month, partySize, tableId]);

  // Calendar calculations
  // Get first day of the month (1st)
  // Since we want Monday to be 1st day of week:
  // Date.getDay() returns 0 for Sunday, 1 for Monday, etc.
  // We can convert to 0 for Monday, 6 for Sunday
  const firstDayIndex = () => {
    const firstDay = new Date(year, month, 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = () => {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    return new Date(prevYear, prevMonth + 1, 0).getDate();
  };

  // Switch months
  const handlePrevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    // Don't let users go before current month
    const now = new Date();
    if (prev.getFullYear() < now.getFullYear() || (prev.getFullYear() === now.getFullYear() && prev.getMonth() < now.getMonth())) {
      return;
    }
    setCurrentDate(prev);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Weekday names
  const weekdaysFi = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];
  const weekdaysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekdays = language === 'fi' ? weekdaysFi : weekdaysEn;

  const monthNamesFi = [
    'Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu',
    'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'
  ];
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = language === 'fi' ? monthNamesFi[month] : monthNamesEn[month];

  // Helper to check if a date is in the past
  const isPastDate = (dayNum: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(year, month, dayNum);
    return dateToCheck < today;
  };

  // Render day cells
  const renderDays = () => {
    const cells = [];
    const startIndex = firstDayIndex();
    const prevDays = prevMonthDays();

    // 1. Fill previous month's trailing days
    for (let i = startIndex - 1; i >= 0; i--) {
      const dayNum = prevDays - i;
      cells.push(
        <div
          key={`prev-${dayNum}`}
          className="w-full aspect-square flex items-center justify-center text-gray-300 text-xs sm:text-sm cursor-not-allowed font-light"
        >
          {dayNum}
        </div>
      );
    }

    // 2. Fill current month's days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dayStr = dayNum.toString().padStart(2, '0');
      const monthStr = (month + 1).toString().padStart(2, '0');
      const fullDateStr = `${year}-${monthStr}-${dayStr}`;

      const isPast = isPastDate(dayNum);
      const isSelected = selectedDate === fullDateStr;

      // Find availability for this day
      const dayAvail = availability.find((a) => a.date === fullDateStr);
      const isAvailable = dayAvail ? dayAvail.status === 'available' : true;

      let cellClass = "w-full aspect-square text-xs sm:text-sm flex flex-col items-center justify-center rounded-lg transition-all relative font-medium ";
      let dotClass = "w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full mt-0.5 ";

      if (isPast) {
        cellClass += "text-gray-300 cursor-not-allowed ";
        dotClass += "bg-transparent";
      } else {
        cellClass += "cursor-pointer hover:bg-gray-100 ";
        
        // Dynamic colors based on availability
        if (isAvailable) {
          // Available: subtle green border / indicators
          cellClass += "border border-green-200 bg-green-50/20 text-gray-800 hover:border-green-400 ";
          dotClass += "bg-green-500";
        } else {
          // Fully booked: subtle red border / indicator
          cellClass += "border border-red-200 bg-red-50/20 text-red-700/80 hover:border-red-400 ";
          dotClass += "bg-red-500";
        }

        // Highlight selected
        if (isSelected) {
          cellClass = "w-full aspect-square text-xs sm:text-sm flex flex-col items-center justify-center rounded-lg cursor-pointer font-bold text-white shadow-md bg-gradient-to-r from-red-600 to-orange-500 border-none scale-105 z-10 ";
          dotClass = "bg-white";
        }
      }

      cells.push(
        <button
          key={`curr-${dayNum}`}
          type="button"
          disabled={isPast}
          onClick={() => onSelectDate(fullDateStr)}
          className={cellClass}
          title={isPast ? '' : isAvailable ? t.calendarLegendAvailable : t.calendarLegendFull}
        >
          <span>{dayNum}</span>
          {!isPast && <span className={dotClass}></span>}
        </button>
      );
    }

    // 3. Fill next month's leading days to complete the grid (standard 42 days grid or just finish the week)
    const totalSlots = cells.length;
    const remainingSlots = 42 - totalSlots;
    for (let i = 1; i <= remainingSlots; i++) {
      cells.push(
        <div
          key={`next-${i}`}
          className="w-full aspect-square flex items-center justify-center text-gray-300 text-xs sm:text-sm cursor-not-allowed font-light"
        >
          {i}
        </div>
      );
    }

    return cells;
  };

  // Helper to check if prev month button should be disabled
  const isPrevMonthDisabled = () => {
    const now = new Date();
    return year <= now.getFullYear() && month <= now.getMonth();
  };

  return (
    <div className={`border border-gray-100 rounded-xl p-3 sm:p-4 bg-white shadow-sm max-w-sm w-full box-border min-w-0 mx-auto ${className}`}>
      {/* Month selection header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-sans font-medium text-gray-800 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-red-500" />
          <span>{monthName} {year}</span>
        </h3>
        
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isPrevMonthDisabled() || isLoading}
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {weekdays.map((wd, idx) => (
          <div key={`wd-${idx}`} className="text-xs font-semibold text-gray-400 font-mono py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-20 rounded-lg">
            <span className="text-xs font-mono text-gray-500 bg-white/90 border border-gray-100 px-3 py-1.5 rounded-full shadow-sm animate-pulse">
              {t.loadingAvailability}
            </span>
          </div>
        )}
        <div className="grid grid-cols-7 gap-1">
          {renderDays()}
        </div>
      </div>

      {/* Legend / Info */}
      <div className="flex items-center justify-between border-t border-gray-100 mt-4 pt-3 text-[11px] text-gray-400 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
          <span>{t.calendarLegendAvailable}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
          <span>{t.calendarLegendFull}</span>
        </div>
      </div>
    </div>
  );
}
