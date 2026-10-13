import { useState, useRef, useEffect, WheelEvent } from 'react';
import { Info, User, Users, Star, Check, Compass, Calendar as CalendarIcon, Clock, Filter, Eye, EyeOff, ChevronDown, ChevronUp, Search, Hash, Plus, Minus, X } from 'lucide-react';
import { Table, Language, Booking } from '../types';
import { translations } from '../translations';

interface TableSelectionModalProps {
  language: Language;
  tables: Table[];
  selectedTableId?: string;
  initialDate?: string;
  initialTime?: string;
  onSelectTable: (tableId: string | undefined, date?: string, time?: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

// MATTERPORT TILAESITTELY-LINKKI (VOIT VAIHTAA TÄHÄN OMAN MATTERPORT-KIERROKSESI EMBED-LINKIN)
const MATTERPORT_TOUR_URL = "https://my.matterport.com/show/?m=ivxGArkqDsu&play=1&qs=1&brand=0&dh=0&gt=0&hr=0&title=0";

const ensureAutoplay = (url?: string): string => {
  const base = url || MATTERPORT_TOUR_URL;
  let params = "play=1&qs=1&brand=0&dh=0&gt=0&hr=0&title=0";
  if (base.includes('play=1')) {
    if (!base.includes('brand=0')) params = "brand=0&dh=0&gt=0&hr=0&title=0";
    else return base;
  }
  return base.includes('?') ? `${base}&${params}` : `${base}?${params}`;
};
const TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00'
];

const timeToMinutes = (t: string): number => {
  const [hours, minutes] = t.split(':').map((s) => parseInt(s, 10));
  return hours * 60 + minutes;
};

const timesOverlap = (time1: string, time2: string): boolean => {
  const t1 = timeToMinutes(time1);
  const t2 = timeToMinutes(time2);
  return t1 < t2 + 120 && t2 < t1 + 120;
};

export default function TableSelectionModal({
  language,
  tables,
  selectedTableId,
  initialDate,
  initialTime,
  onSelectTable,
  isOpen,
  onClose
}: TableSelectionModalProps) {
  const t = translations[language];
  const [activeTourUrl, setActiveTourUrl] = useState(MATTERPORT_TOUR_URL);
  const [localSelectedTableIds, setLocalSelectedTableIds] = useState<string[]>([]);
  const [isFullscreenTourOpen, setIsFullscreenTourOpen] = useState(false);
  const [isTouchActive, setIsTouchActive] = useState(false);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const handleWheelOnNonScrollable = (e: WheelEvent) => {
    e.preventDefault();
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollTop += e.deltaY;
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Search parameters inside the modal
  const [searchDate, setSearchDate] = useState<string>('');
  const [searchTime, setSearchTime] = useState<string>('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState<boolean>(false);

  // Filter states
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(true);
  const [useDateTimeFilter, setUseDateTimeFilter] = useState<boolean>(false);
  const [isCapacityFilterActive, setIsCapacityFilterActive] = useState<boolean>(false); // Harmaana ja pois päältä oletuksena
  const [minCapacity, setMinCapacity] = useState<number>(2); // Oletusarvo kun aktivoidaan
  const [selectedFeature, setSelectedFeature] = useState<string>('all'); // 'all' | 'window' | 'booth' | 'downstairs'
  const [isBoothInfoOpen, setIsBoothInfoOpen] = useState<boolean>(false); // Looshi-infon modaaliikkuna
  const [tableNumberQuery, setTableNumberQuery] = useState<string>('');

  // Ref & drag state for party size slider (ensures 100% exact ball-to-number alignment)
  const capacityTrackRef = useRef<HTMLDivElement>(null);
  const [isDraggingCapacity, setIsDraggingCapacity] = useState<boolean>(false);

  const handleCapacityPointer = (clientX: number) => {
    if (!capacityTrackRef.current) return;
    const rect = capacityTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const val = Math.round(ratio * 11) + 1;
    setMinCapacity(val);
  };

  // Sync selected tables, dates & times when modal is opened - ensure no filter is active initially
  useEffect(() => {
    if (isOpen) {
      setLocalSelectedTableIds([]);
      
      // Mikään haku ei ole valmiiksi päällä
      setSearchDate('');
      setSearchTime('');
      setUseDateTimeFilter(false);
      setIsCapacityFilterActive(false); // Koko henkilömääräkohta on harmaana ja pois päältä alkuun
      setMinCapacity(2);
      setSelectedFeature('all');
      setTableNumberQuery('');
    }
  }, [isOpen]);

  // Fetch bookings in real-time when modal is open to calculate free/busy tables
  useEffect(() => {
    if (isOpen) {
      setIsLoadingBookings(true);
      fetch('/api/admin/bookings')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setBookings(data);
          setIsLoadingBookings(false);
        })
        .catch((err) => {
          console.error('Error fetching bookings:', err);
          setIsLoadingBookings(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Check if a specific table is booked at the selected search date and time (minimum 1.5h slot)
  const isTableBooked = (tableId: string, date: string, time: string) => {
    if (!useDateTimeFilter) return false;
    if (!date || !time) return false;
    
    const startMin = timeToMinutes(time);
    
    return bookings.some((b: Booking) => {
      if (b.date === date && b.tableId) {
        const isThisTable = b.tableId
          .split(',')
          .map((s: string) => s.trim())
          .includes(tableId);
          
        if (isThisTable) {
          const bStart = timeToMinutes(b.time);
          const bDuration = b.duration || 120;
          const bEnd = bStart + bDuration;
          
          // Overlaps with [startMin, startMin + 90)
          return bStart < startMin + 90 && startMin < bEnd;
        }
      }
      return false;
    });
  };

  // Get allowed booking duration for a specific table (returns duration in minutes, or 0 if not available)
  const getTableAllowedDuration = (tableId: string, date: string, time: string): number => {
    if (!date || !time) return 120;
    
    const startMin = timeToMinutes(time);
    
    // First, verify if it is booked/overlapping for the minimum 90 minutes
    if (isTableBooked(tableId, date, time)) {
      return 0;
    }
    
    const tableBookings = bookings.filter((b: Booking) => {
      if (b.date !== date || !b.tableId) return false;
      return b.tableId.split(',').map((s) => s.trim()).includes(tableId);
    });
    
    // Find the earliest start time of any booking starting after startMin
    let nextBookingStart = startMin + 120; // Default to standard 120 mins
    tableBookings.forEach((b: Booking) => {
      const bStart = timeToMinutes(b.time);
      if (bStart > startMin && bStart < nextBookingStart) {
        nextBookingStart = bStart;
      }
    });
    
    const allowedDuration = nextBookingStart - startMin;
    return allowedDuration < 90 ? 0 : allowedDuration;
  };

  // Get count of free tables for a given time slot on the current search date
  const getFreeTablesCountForSlot = (time: string) => {
    if (!searchDate) return tables.length;
    const bookedCount = tables.filter((t) => isTableBooked(t.id, searchDate, time)).length;
    return tables.length - bookedCount;
  };

  // Filter tables based on user criteria
  const filteredTables = tables.filter((table) => {
    // 0. Table number/name query filter
    if (tableNumberQuery.trim()) {
      const q = tableNumberQuery.trim().toLowerCase();
      const queryNum = q.replace(/\D/g, '');
      const tableIdNum = table.id.replace(/\D/g, '');
      
      const matchesIdExact = table.id.toLowerCase() === q;
      const matchesIdNum = queryNum.length > 0 && tableIdNum === queryNum;
      const matchesFi = table.nameFi.toLowerCase().includes(q);
      const matchesEn = table.nameEn.toLowerCase().includes(q);
      
      if (!matchesIdExact && !matchesIdNum && !matchesFi && !matchesEn) {
        return false;
      }
    }

    // 1. Minimum capacity filter (vain jos henkilömäärän rajaus on aktivoitu)
    if (isCapacityFilterActive && table.capacity < minCapacity) return false;

    // 2. Feature filter mapping
    const combinedTxt = `${table.nameFi} ${table.descriptionFi} ${table.atmosphereFi} ${table.nameEn} ${table.descriptionEn}`.toLowerCase();
    if (selectedFeature === 'window' && !combinedTxt.includes('ikkuna') && !combinedTxt.includes('window') && !combinedTxt.includes('veranta') && table.id !== 'T3') return false;
    if (selectedFeature === 'booth' && !combinedTxt.includes('loo') && !combinedTxt.includes('booth') && !combinedTxt.includes('sohva') && table.id !== 'T2') return false;
    if (selectedFeature === 'downstairs' && !combinedTxt.includes('alakerta') && !combinedTxt.includes('downstairs') && table.id !== 'T1' && table.id !== 'T2') return false;

    // 3. Hide tables that are booked for the searched date and time
    if (useDateTimeFilter && searchDate && searchTime) {
      if (isTableBooked(table.id, searchDate, searchTime)) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    // Kaikki pöydät näkyvät luonnollisessa numerojärjestyksessä: Pöytä 1, 2, 3... 10
    const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
    if (numA !== numB) {
      return numA - numB;
    }
    return a.nameFi.localeCompare(b.nameFi);
  });

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 py-3 sm:py-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[86dvh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in duration-200">
        
        {/* Header */}
        <div onWheel={handleWheelOnNonScrollable} className="p-2.5 sm:p-5 px-3 sm:px-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div>
            <h3 className="font-sans font-semibold text-gray-900 text-xs sm:text-lg">
              {t.virtualTourTitle}
            </h3>
            <p className="text-[9px] sm:text-xs text-gray-500 font-mono mt-0.5">
              {t.virtualTourSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-mono text-[10px] sm:text-xs border border-gray-200 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-white transition-all hover:bg-gray-50"
          >
            {t.close}
          </button>
        </div>

        {/* Content Area */}
        <div ref={contentContainerRef} className="overflow-y-auto flex-1 p-3 sm:p-5 space-y-4 sm:space-y-6">
          
          {/* Quick 3D Tour CTA Banner (Placed right at the top of modal content) */}
          <div 
            onClick={() => {
              const tourUrl = ensureAutoplay(MATTERPORT_TOUR_URL);
              setActiveTourUrl(tourUrl);
              setIsTouchActive(true);

              const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024));

              if (isMobile) {
                setIsFullscreenTourOpen(true);
              } else {
                iframeContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 group hover:border-slate-700 hover:shadow-md transition-all cursor-pointer active:scale-[0.99] relative overflow-hidden"
          >
            <div className="flex items-center gap-3.5 z-10">
              <div className="w-11 h-11 rounded-xl bg-red-600/90 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                <Compass className="w-6 h-6 animate-spin-slow" />
              </div>
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="font-sans font-extrabold text-sm sm:text-base text-white group-hover:text-slate-200 transition-colors">
                  {language === 'fi' 
                    ? 'Tutustu ravintolan tunnelmaan virtuaaliesittelyssä ja valitse mieluisa pöytä' 
                    : 'Explore the restaurant in 3D and pick your favorite table'}
                </h4>
              </div>
            </div>

            <button
              type="button"
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-sm transition-all group-hover:bg-red-500 z-10 w-full sm:w-auto justify-center"
            >
              <Compass className="w-4 h-4" />
              <span>{language === 'fi' ? 'Avaa 3D-kierros' : 'Open 3D Tour'}</span>
            </button>
          </div>

          {/* SEARCH AVAILABILITY & FILTERS PANEL */}
          <div className="bg-gradient-to-b from-red-50/50 via-white to-gray-50/50 border-2 border-red-500/40 rounded-2xl p-3 sm:p-5 shadow-sm relative mt-3.5 w-full max-w-full box-border">
            <div className="absolute -top-3 left-4 bg-red-600 text-white text-[9px] font-mono font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1 z-20">
              <Filter className="w-2.5 h-2.5 stroke-[3px]" />
              <span>{language === 'fi' ? 'Haku & Rajaus' : 'Search & Filters'}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={`w-full text-left group focus:outline-none transition-all pt-1.5 ${
                isFiltersExpanded ? 'border-b border-gray-200/80 pb-3 mb-3' : ''
              }`}
            >
              <div className="flex items-start sm:items-center justify-between gap-2.5">
                {/* Left Title & Icon */}
                <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                  <Filter className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform shrink-0 mt-0.5 sm:mt-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-sans font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wider leading-snug sm:leading-normal">
                      {language === 'fi' ? 'Etsi sopiva pöytä ajan, henkilömäärän ja toiveiden mukaan' : 'Find a table by time, capacity & features'}
                    </span>
                    {isLoadingBookings && (
                      <span className="text-[10px] text-red-500 font-mono animate-pulse font-bold">
                        ({language === 'fi' ? 'Päivitetään...' : 'Updating...'})
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Controls: Expand / Collapse Toggle + Selected Status */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isFiltersExpanded && (
                    <span className="hidden sm:inline-block text-[10px] bg-red-100/90 text-red-800 border border-red-200 px-2 py-0.5 rounded-md font-mono font-bold truncate max-w-[140px]">
                      {useDateTimeFilter 
                        ? (searchDate && searchTime ? `${searchDate} @ ${searchTime}` : (searchDate || searchTime || (language === 'fi' ? 'Valitse aika/pvä' : 'Select time/date'))) 
                        : (language === 'fi' ? 'Vapaa selaus' : 'Free browse')}
                    </span>
                  )}
                  <div className="flex items-center gap-1 bg-white sm:bg-transparent px-2 py-1 sm:p-0 rounded-lg border sm:border-0 border-gray-200 shadow-2xs sm:shadow-none text-gray-600 group-hover:text-gray-900 transition-colors">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold">
                      {isFiltersExpanded 
                        ? (language === 'fi' ? 'Piilota' : 'Hide') 
                        : (language === 'fi' ? 'Avaa' : 'Expand')}
                    </span>
                    {isFiltersExpanded ? (
                      <ChevronUp className="w-4 h-4 text-red-600 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Summary Badge when collapsed */}
              {!isFiltersExpanded && (
                <div className="mt-2.5 sm:hidden flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] font-mono">
                  <span className="text-gray-500 font-bold">{language === 'fi' ? 'Nykytila:' : 'Status:'}</span>
                  <span className="bg-red-100/90 text-red-800 border border-red-200 px-2.5 py-0.5 rounded-md font-bold truncate max-w-[200px]">
                    {useDateTimeFilter 
                      ? (searchDate && searchTime ? `${searchDate} @ ${searchTime}` : (searchDate || searchTime || (language === 'fi' ? 'Valitse aika/pvä' : 'Select time/date'))) 
                      : (language === 'fi' ? 'Vapaa selaus' : 'Free browse')}
                  </span>
                </div>
              )}
            </button>

            {isFiltersExpanded && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200 pt-1 w-full max-w-full min-w-0">
                {/* Sub-section 1: Date & Time slot selection */}
                <div className={`grid grid-cols-1 md:grid-cols-12 gap-4 transition-all duration-250 w-full max-w-full min-w-0 ${
                  useDateTimeFilter ? 'opacity-100' : 'opacity-60'
                }`}>
                  {/* Date Input */}
                  <div className="md:col-span-4 space-y-1.5 w-full max-w-full min-w-0 flex flex-col items-center sm:items-start">
                    <label className="text-[11px] font-mono font-bold text-gray-700 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1 w-full text-center sm:text-left">
                      <CalendarIcon className="w-3.5 h-3.5 text-red-500" />
                      <span>{language === 'fi' ? 'Valitse päivä' : 'Choose Date'}</span>
                    </label>
                    <div className="w-full max-w-[260px] xs:max-w-[280px] sm:max-w-full mx-auto sm:mx-0 box-border overflow-hidden rounded-xl">
                      <input
                        type="date"
                        min={todayStr}
                        value={searchDate}
                        onChange={(e) => {
                          setSearchDate(e.target.value);
                          setUseDateTimeFilter(true);
                          setLocalSelectedTableIds([]);
                        }}
                        className="w-full box-border min-w-0 px-3 py-2 bg-white border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-xl text-xs font-sans font-bold outline-none transition-all text-gray-900 shadow-2xs text-center sm:text-left block appearance-none"
                      />
                    </div>
                  </div>

                  {/* Time Slots Button Grid */}
                  <div className="md:col-span-8 space-y-1.5">
                    <label className="text-[11px] font-mono font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-red-500" />
                      <span>{language === 'fi' ? 'Pöytien varaustilanne valittuna päivänä' : 'Table statuses for selected day'}</span>
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {TIME_SLOTS.map((time) => {
                        const isSelected = searchTime === time && useDateTimeFilter;
                        const freeCount = getFreeTablesCountForSlot(time);
                        const isFullyBooked = freeCount === 0;

                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => {
                              setSearchTime(time);
                              setUseDateTimeFilter(true);
                              setLocalSelectedTableIds([]);
                            }}
                            className={`py-2 px-1 rounded-xl border text-center transition-all flex flex-col items-center justify-center relative ${
                              isSelected
                                ? 'border-red-600 bg-red-600 text-white shadow-xs ring-2 ring-red-300'
                                : isFullyBooked
                                ? 'border-red-100 bg-red-50/50 text-red-300 cursor-not-allowed'
                                : 'border-gray-200 bg-white hover:border-red-400 hover:bg-red-50/30 text-gray-800'
                            }`}
                          >
                            <span className="text-[11px] font-extrabold font-mono">{time}</span>
                            <span className={`text-[8px] font-bold uppercase mt-0.5 tracking-tighter ${
                              isSelected 
                                ? 'text-red-100' 
                                : isFullyBooked 
                                ? 'text-red-300' 
                                : 'text-green-600'
                            }`}>
                              {isFullyBooked 
                                ? (language === 'fi' ? 'Täynnä' : 'Full') 
                                : `${freeCount} ${language === 'fi' ? 'vapaa' : 'free'}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {useDateTimeFilter && (
                      <p className="text-[10px] text-gray-500 font-sans mt-2 flex items-center gap-1.5 px-0.5 font-medium">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block"></span>
                        {language === 'fi' 
                          ? 'Pöytävarauksen normaali kesto on 2 tuntia (minimikesto 1,5 tuntia).' 
                          : 'Standard booking duration is 2 hours (minimum of 1.5 hours).'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Sub-section 2: Checkbox AFTER time selection if date/time doesn't matter yet */}
                <label
                  htmlFor="no-datetime-filter"
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none ${
                    !useDateTimeFilter 
                      ? 'bg-amber-50/60 border-amber-300/80 shadow-2xs' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <input
                      id="no-datetime-filter"
                      type="checkbox"
                      checked={!useDateTimeFilter}
                      onChange={(e) => {
                        setUseDateTimeFilter(!e.target.checked);
                      }}
                      className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-400 focus:ring-offset-0 focus:ring-1 cursor-pointer shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-sans font-extrabold text-gray-900 leading-snug">
                        {language === 'fi' 
                          ? 'Ajalla tai päivämäärällä ei ole vielä väliä' 
                          : 'Date or time doesn\'t matter yet'}
                      </span>
                      <span className="text-[11px] text-gray-500 font-sans leading-tight mt-0.5">
                        {language === 'fi'
                          ? 'Näytä kaikkien pöytien vapaa selaus'
                          : 'Show free browsing for all tables'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end shrink-0 pl-7 sm:pl-0">
                    <span className={`text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      !useDateTimeFilter 
                        ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {!useDateTimeFilter ? (language === 'fi' ? 'Vapaa selaus' : 'Free browse') : (language === 'fi' ? 'Aika asetettu' : 'Time active')}
                    </span>
                  </div>
                </label>

                {/* Sub-section 2: Feature Filters & Capacity */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 border-t border-gray-200/80 pt-3">
                  {/* Party Size / Henkilömäärä Filter - Harmaana oletuksena ja aktivoituu painalluksesta */}
                  {!isCapacityFilterActive ? (
                    /* Harmaa / Inaktiivinen tila */
                    <div
                      onClick={() => setIsCapacityFilterActive(true)}
                      className="sm:col-span-7 space-y-2.5 p-3 sm:p-3.5 rounded-2xl border border-dashed border-gray-300 bg-gray-100/75 opacity-65 hover:opacity-95 hover:border-gray-400 hover:bg-gray-100 transition-all cursor-pointer group select-none shadow-2xs"
                      title={language === 'fi' ? 'Klikkaa aktivoidaksesi henkilömäärän rajaus' : 'Click to activate party size filter'}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-mono font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 cursor-pointer">
                            <Users className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                            <span>{language === 'fi' ? 'Henkilömäärä / Seurue' : 'Party Size'}</span>
                          </label>
                          <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-200/90 border border-gray-300/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {language === 'fi' ? 'Harmaana (kaikki koot)' : 'Inactive (all sizes)'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCapacityFilterActive(true);
                          }}
                          className="text-[11px] font-sans font-extrabold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/80 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer group-hover:bg-red-600 group-hover:text-white group-hover:border-red-600"
                        >
                          <span>{language === 'fi' ? 'Paina aktivoidaksesi' : 'Click to activate'}</span>
                        </button>
                      </div>

                      {/* Passive slider preview */}
                      <div className="bg-gray-50/70 p-3.5 border border-gray-200/80 rounded-xl space-y-2.5 pointer-events-none opacity-60">
                        <div className="relative mx-3.5 h-6 flex items-center">
                          <div className="w-full h-2.5 bg-gray-200 rounded-full border border-gray-300/50" />
                          <div
                            style={{ left: `${((minCapacity - 1) / 11) * 100}%` }}
                            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-400 border-2 border-white shadow-xs flex items-center justify-center z-10"
                          >
                            <div className="w-1.5 h-1.5 bg-white rounded-full opacity-80" />
                          </div>
                        </div>
                        <div className="relative mx-3.5 h-5">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                            const pct = ((num - 1) / 11) * 100;
                            return (
                              <div
                                key={num}
                                style={{ left: `${pct}%` }}
                                className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                              >
                                <span className="w-0.5 h-1.5 rounded-full mb-0.5 bg-gray-300" />
                                <span className="text-[10px] font-mono font-medium text-gray-400 leading-none">
                                  {num}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center gap-1 pt-0.5 text-center">
                        <p className="text-[10px] font-sans font-medium text-gray-500 flex items-center justify-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                          <span>
                            {language === 'fi'
                              ? 'Kaikki pöytäkoot näkyvät järjestyksessä. Paina tästä rajataksesi seurueen koon mukaan.'
                              : 'All table sizes shown in order. Click here to filter by party size.'}
                          </span>
                        </p>
                        <p className="text-[10px] font-sans text-gray-400">
                          {language === 'fi'
                            ? 'Isompi seurue kuin 12, ole yhteydessä asiakaspalveluun.'
                            : 'For parties larger than 12, please contact customer service.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Aktivoitu / Käytössä oleva tila */
                    <div className="sm:col-span-7 space-y-2.5 p-3 sm:p-3.5 rounded-2xl border border-red-200 bg-white shadow-2xs ring-1 ring-red-100/80 transition-all select-none animate-in fade-in duration-150">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-mono font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-red-500" />
                            <span>{language === 'fi' ? 'Henkilömäärä / Seurue' : 'Party Size'}</span>
                          </label>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={minCapacity <= 1}
                              onClick={() => setMinCapacity(prev => Math.max(1, prev - 1))}
                              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 flex items-center justify-center font-bold disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                              title={language === 'fi' ? 'Vähennä' : 'Decrease'}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-[11px] font-mono font-extrabold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                              {`${minCapacity} ${minCapacity === 1 ? (language === 'fi' ? 'henkilö' : 'guest') : (language === 'fi' ? 'henkilöä' : 'guests')}`}
                            </span>
                            <button
                              type="button"
                              disabled={minCapacity >= 12}
                              onClick={() => setMinCapacity(prev => Math.min(12, prev + 1))}
                              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 flex items-center justify-center font-bold disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                              title={language === 'fi' ? 'Lisää' : 'Increase'}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsCapacityFilterActive(false)}
                          className="text-[10px] font-sans font-bold text-gray-500 hover:text-red-700 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                          title={language === 'fi' ? 'Palauta harmaaksi (näytä kaikki pöydät)' : 'Reset to grey (show all tables)'}
                        >
                          <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                          <span>{language === 'fi' ? 'Pois päältä (harmaa)' : 'Turn off (grey)'}</span>
                        </button>
                      </div>

                      {/* Range Slider 1-12 with 100% exact ball-to-number alignment */}
                      <div className="bg-white p-3.5 border border-gray-200 rounded-xl shadow-2xs space-y-2.5">
                        {/* Interactive Track and Ball Container */}
                        <div
                          ref={capacityTrackRef}
                          role="slider"
                          tabIndex={0}
                          aria-valuenow={minCapacity}
                          aria-valuemin={1}
                          aria-valuemax={12}
                          aria-label={language === 'fi' ? 'Henkilömäärä' : 'Party size'}
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            setIsDraggingCapacity(true);
                            handleCapacityPointer(e.clientX);
                          }}
                          onPointerMove={(e) => {
                            if (isDraggingCapacity) {
                              handleCapacityPointer(e.clientX);
                            }
                          }}
                          onPointerUp={(e) => {
                            setIsDraggingCapacity(false);
                            try {
                              e.currentTarget.releasePointerCapture(e.pointerId);
                            } catch (_) {}
                          }}
                          onPointerCancel={() => setIsDraggingCapacity(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                              e.preventDefault();
                              setMinCapacity((prev) => Math.max(1, prev - 1));
                            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                              e.preventDefault();
                              setMinCapacity((prev) => Math.min(12, prev + 1));
                            } else if (e.key === 'Home') {
                              e.preventDefault();
                              setMinCapacity(1);
                            } else if (e.key === 'End') {
                              e.preventDefault();
                              setMinCapacity(12);
                            }
                          }}
                          className="relative mx-3.5 h-6 cursor-pointer touch-none select-none flex items-center focus:outline-none group"
                        >
                          {/* Background Track Bar */}
                          <div className="w-full h-2.5 bg-gray-100 rounded-full border border-gray-200/80 overflow-hidden relative">
                            {/* Active Fill Track */}
                            <div
                              className={`h-full bg-red-600 rounded-full ${isDraggingCapacity ? '' : 'transition-all duration-100'}`}
                              style={{ width: `${((minCapacity - 1) / 11) * 100}%` }}
                            />
                          </div>

                          {/* The Ball ("Pallo" / Thumb) - exactly aligned with the ratio and the number beneath */}
                          <div
                            style={{ left: `${((minCapacity - 1) / 11) * 100}%` }}
                            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-red-600 border-2 border-white shadow-md ring-2 ring-red-300/70 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 ${
                              isDraggingCapacity ? 'scale-110' : 'transition-all duration-100 group-hover:scale-105'
                            }`}
                          >
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                        </div>

                        {/* Numbers row (1-12) - shares the exact same mx-3.5 wrapper and left percentage formula */}
                        <div className="relative mx-3.5 h-5">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                            const pct = ((num - 1) / 11) * 100;
                            const isSelected = minCapacity === num;
                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setMinCapacity(num)}
                                style={{ left: `${pct}%` }}
                                className="absolute top-0 -translate-x-1/2 flex flex-col items-center group/btn cursor-pointer py-0.5"
                                title={`${num} ${language === 'fi' ? 'henkilöä' : 'guests'}`}
                              >
                                <span
                                  className={`w-0.5 rounded-full mb-0.5 transition-all ${
                                    isSelected
                                      ? 'bg-red-600 h-2'
                                      : 'bg-gray-300 group-hover/btn:bg-red-400 h-1.5'
                                  }`}
                                />
                                <span
                                  className={`text-[10px] font-mono font-bold leading-none transition-all ${
                                    isSelected
                                      ? 'text-red-600 font-extrabold scale-110'
                                      : 'text-gray-400 group-hover/btn:text-gray-800'
                                  }`}
                                >
                                  {num}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <p className="text-[11px] font-sans text-gray-500 text-center pt-0.5">
                        {language === 'fi'
                          ? 'Isompi seurue kuin 12, ole yhteydessä asiakaspalveluun.'
                          : 'For parties larger than 12, please contact customer service.'}
                      </p>
                    </div>
                  )}

                  {/* Type / Location Filter */}
                  <div className="sm:col-span-5 flex flex-col justify-between space-y-2">
                    <label className="text-[11px] font-mono font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-red-500" />
                      <span>{language === 'fi' ? 'Pöydän sijainti / tyyppi' : 'Table Location / Type'}</span>
                    </label>
                    <div className="bg-white p-3 sm:p-3.5 border border-gray-200 rounded-xl shadow-2xs flex-1 flex items-center justify-center">
                      <div className="grid grid-cols-2 gap-1.5 w-full">
                        {[
                          { id: 'all', fi: 'Kaikki', en: 'All' },
                          { id: 'window', fi: 'Ikkuna', en: 'Window' },
                          { id: 'booth', fi: 'Looshi', en: 'Booth' },
                          { id: 'downstairs', fi: 'Alakerta', en: 'Downstairs' }
                        ].map((feat) => {
                          const isSelected = selectedFeature === feat.id;
                          return (
                            <button
                              key={feat.id}
                              type="button"
                              onClick={() => setSelectedFeature(feat.id)}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-sans font-extrabold transition-all text-center flex items-center justify-center gap-1.5 ${
                                isSelected
                                  ? 'border-gray-900 bg-gray-900 text-white shadow-2xs'
                                  : 'border-gray-200 bg-gray-50/50 hover:border-red-400 hover:bg-red-50/40 text-gray-700'
                              }`}
                            >
                              <span>{language === 'fi' ? feat.fi : feat.en}</span>
                              {feat.id === 'booth' && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsBoothInfoOpen(true);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setIsBoothInfoOpen(true);
                                    }
                                  }}
                                  className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-mono font-bold border transition-colors cursor-pointer shrink-0 ${
                                    isSelected
                                      ? 'border-gray-400 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white'
                                      : 'border-gray-300 bg-white text-gray-500 hover:border-red-500 hover:text-red-600 hover:bg-red-50'
                                  }`}
                                  title={language === 'fi' ? 'Mikä on looshi? Avaa selitys' : 'What is a booth? Open info'}
                                  aria-label={language === 'fi' ? 'Mikä on looshi?' : 'What is a booth?'}
                                >
                                  ?
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-section 3: Search Specific Table Number */}
                <div className="border-t border-gray-200/80 pt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 border border-gray-200 rounded-xl shadow-2xs">
                    <label className="text-[11px] font-mono font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                      <Hash className="w-4 h-4 text-red-500" />
                      <span>{language === 'fi' ? 'Hae pöytää numerolla' : 'Search table by number'}</span>
                    </label>
                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        placeholder={language === 'fi' ? 'Esim. 1, 2, T5...' : 'E.g. 1, 2, T5...'}
                        value={tableNumberQuery}
                        onChange={(e) => setTableNumberQuery(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-2xs pr-8"
                      />
                      {tableNumberQuery ? (
                        <button
                          type="button"
                          onClick={() => setTableNumberQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold transition-colors"
                          title={language === 'fi' ? 'Tyhjennä haku' : 'Clear search'}
                        >
                          ✕
                        </button>
                      ) : (
                        <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Table Selector Grid Header */}
          <div className="border-t border-gray-100 pt-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="font-sans font-extrabold text-gray-900 text-sm uppercase tracking-wider mb-0.5">
                {language === 'fi' ? 'Hakutulokset: Pöydät' : 'Search Results: Tables'}
              </h4>
              <p className="text-[11px] text-gray-500 font-mono">
                {useDateTimeFilter ? (
                  language === 'fi' 
                    ? `Varausaika: ${searchDate} klo ${searchTime}. Klikkaa pöytää valitaksesi.` 
                    : `Booking time: ${searchDate} at ${searchTime}. Click table to select.`
                ) : (
                  language === 'fi'
                    ? 'Pöytien selailu ilman tiettyä aikaa. Klikkaa pöytää valitaksesi.'
                    : 'Browsing tables without slot filters. Click table to select.'
                )}
              </p>
            </div>
            <div className="text-[10px] bg-red-50 text-red-700 font-mono px-3 py-1 rounded-lg border border-red-200 flex items-center gap-1.5 uppercase font-extrabold shadow-2xs">
              <span>{filteredTables.length} / {tables.length} {language === 'fi' ? 'Löydetty' : 'Found'}</span>
            </div>
          </div>

          {/* Content - Table Grid */}
          {filteredTables.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <Info className="w-8 h-8 text-red-500 mx-auto animate-pulse" />
              <p className="font-sans font-bold text-gray-800 text-sm">
                {language === 'fi' ? 'Ei hakukriteerejä vastaavia pöytiä' : 'No tables match your criteria'}
              </p>
              <p className="text-xs text-gray-500 font-mono max-w-md mx-auto">
                {language === 'fi'
                  ? 'Kokeile vaihtaa hakuaikaa, tyhjentämään suodattimia tai valitsemaan toinen päivämäärä.'
                  : 'Try changing the search time, clearing capacity filters, or picking another date.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTables.map((table) => {
                const isBooked = isTableBooked(table.id, searchDate, searchTime);
                const isSelected = localSelectedTableIds.includes(table.id);
                const name = language === 'fi' ? table.nameFi : table.nameEn;
                const atmosphere = language === 'fi' ? table.atmosphereFi : table.atmosphereEn;
                const description = language === 'fi' ? table.descriptionFi : table.descriptionEn;
                const allowedDur = useDateTimeFilter && !isBooked && searchDate && searchTime ? getTableAllowedDuration(table.id, searchDate, searchTime) : 120;

                return (
                  <div
                    key={table.id}
                    onClick={() => {
                      if (isBooked) return; // Prevent selecting booked tables
                      if (isSelected) {
                        setLocalSelectedTableIds(prev => prev.filter(id => id !== table.id));
                      } else {
                        setLocalSelectedTableIds(prev => [...prev, table.id]);
                      }
                    }}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between h-full group relative ${
                      isBooked
                        ? 'border-gray-200 bg-gray-50/75 opacity-70 cursor-not-allowed'
                        : isSelected
                        ? 'border-red-500 bg-red-50/10 ring-1 ring-red-500 shadow-sm'
                        : 'border-gray-200 hover:border-red-300 hover:bg-gray-50/50'
                    }`}
                  >
                    {/* Real-time Status Ribbon */}
                    <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1">
                      {isSelected ? (
                        <span className="bg-red-600 text-white text-[9px] font-extrabold font-mono px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wider flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                          <Check className="w-2.5 h-2.5 stroke-[3px]" />
                          <span>{language === 'fi' ? 'Valittu' : 'Selected'}</span>
                        </span>
                      ) : !useDateTimeFilter ? (
                        null
                      ) : isBooked ? (
                        <span className="bg-red-500 text-white text-[9px] font-extrabold font-mono px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wider">
                          {language === 'fi' ? 'Varattu' : 'Booked'}
                        </span>
                      ) : (
                        <>
                          <span className="bg-green-500 text-white text-[9px] font-extrabold font-mono px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wider">
                            {language === 'fi' ? 'Vapaa' : 'Free'}
                          </span>
                          {allowedDur === 90 && (
                            <span className="bg-amber-500 text-white text-[9px] font-extrabold font-mono px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wider">
                              {language === 'fi' ? 'Vain 1.5 h' : 'Max 1.5 h'}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="w-full">
                      <div className="flex flex-col mb-2 pr-12">
                        <span className={`font-sans font-semibold text-sm ${isBooked ? 'text-gray-400 line-through' : 'text-gray-900 group-hover:text-red-600 transition-colors'}`}>
                          {name}
                        </span>
                        <span className="flex items-center gap-1 bg-gray-100 text-gray-600 font-mono text-[10px] px-2 py-0.5 rounded-md mt-1 w-fit">
                          <User className="w-3 h-3" />
                          <span>Max {table.capacity} {t.people}</span>
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 font-mono line-clamp-2 mb-2 leading-relaxed pr-12">
                        {atmosphere}
                      </p>
                      
                      <p className="text-[11px] text-gray-400 italic mb-4 pr-12">
                        {description}
                      </p>

                      {/* Matterport Link Button */}
                      <div className="mb-4 w-full flex justify-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent selection / closing
                            const tourUrl = ensureAutoplay(table.matterportLink || MATTERPORT_TOUR_URL);
                            setActiveTourUrl(tourUrl);
                            setIsTouchActive(true);

                            // Detect mobile device or phone screen size
                            const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024));

                            if (isMobile) {
                              setIsFullscreenTourOpen(true);
                            } else {
                              setTimeout(() => {
                                iframeContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }, 50);
                            }
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-red-50/50 hover:bg-red-50 border border-red-100 hover:border-red-200 text-red-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98 font-sans"
                          title={language === 'fi' ? 'Näytä pöytä 3D-kierroksessa' : 'Show table in 3D tour'}
                        >
                          <Compass className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                          <span>{language === 'fi' ? 'Katso pöytää 3D:nä' : 'View Table in 3D'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-auto">
                      <span className="text-[10px] text-red-500 uppercase tracking-wider font-semibold font-mono flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{table.id}</span>
                      </span>
                      
                      {isBooked ? (
                        <span className="text-xs font-semibold text-red-400 font-mono">
                          {language === 'fi' ? 'Ei varattavissa' : 'Unavailable'}
                        </span>
                      ) : (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-md transition-all ${
                          isSelected
                            ? 'bg-red-500 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-600 group-hover:bg-gradient-to-r group-hover:from-red-600 group-hover:to-orange-500 group-hover:text-white'
                        }`}>
                          {isSelected ? (
                            <span className="flex items-center gap-1 text-[11px] font-mono">
                              <Check className="w-3 h-3 stroke-[3px]" />
                              <span>VALITTU</span>
                            </span>
                          ) : (
                            <span>{language === 'fi' ? 'Valitse' : 'Select'}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Virtual Tour Interactive Embedded Iframe (AT THE VERY BOTTOM - HIDDEN ON MOBILE) */}
          <div className="hidden sm:block border-t border-gray-200/80 pt-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-red-600 animate-spin-slow" />
                <h4 className="font-sans font-extrabold text-gray-900 text-sm uppercase tracking-wider">
                  {language === 'fi' ? '3D-Virtuaalikierros ravintolassamme' : '3D Virtual Tour of Our Restaurant'}
                </h4>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">
                {language === 'fi' ? 'Tutustu tiloihin interaktiivisesti ennen varausta' : 'Explore spaces interactively before booking'}
              </span>
            </div>



            <div ref={iframeContainerRef} className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-md border border-gray-200 group scroll-mt-6">
              {/* Touch activation overlay on mobile if touch is not active yet */}
              {!isTouchActive && (
                <div 
                  onClick={() => setIsTouchActive(true)}
                  className="absolute inset-0 z-20 bg-black/30 backdrop-blur-[1px] hover:bg-black/20 transition-all flex flex-col items-center justify-center p-4 cursor-pointer text-center text-white space-y-2 group"
                >
                  <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Compass className="w-6 h-6 animate-pulse" />
                  </div>
                  <p className="text-xs text-gray-200 font-mono bg-black/50 px-3 py-1 rounded-full shadow-sm">
                    {language === 'fi' ? 'Klikkaa tai kosketa aloittaaksesi liikkumisen' : 'Click or touch to start navigating'}
                  </p>
                </div>
              )}

              <iframe 
                src={activeTourUrl}
                title="Kulinaria Matterport Tour"
                className={`w-full h-[320px] sm:h-[400px] border-none transition-all ${isTouchActive ? 'pointer-events-auto' : 'pointer-events-none sm:pointer-events-auto'}`}
                allowFullScreen
                allow="autoplay; fullscreen; vr; xr-spatial-tracking; gyro; accelerometer; magnetometer; touch-action"
              />
              
              <div className="absolute bottom-3 right-3 z-30 flex flex-wrap gap-2 justify-end">
                {isTouchActive && (
                  <button
                    type="button"
                    onClick={() => setIsTouchActive(false)}
                    className="bg-gray-900/90 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    {language === 'fi' ? 'Lukitse sivun selaus' : 'Lock Page Scroll'}
                  </button>
                )}
                {activeTourUrl !== MATTERPORT_TOUR_URL && (
                  <button
                    type="button"
                    onClick={() => setActiveTourUrl(MATTERPORT_TOUR_URL)}
                    className="bg-gray-900/90 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    {language === 'fi' ? 'Palauta yleisnäkymä' : 'Reset View'}
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsFullscreenTourOpen(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{language === 'fi' ? 'Avaa koko näytölle (Koko Ruutu)' : 'Fullscreen 3D Mode'}</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* FULLSCREEN 3D OVERLAY MODAL FOR EASY MOBILE / TOUCH INTERACTION */}
        {isFullscreenTourOpen && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
            <div className="p-3 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-red-500 animate-spin-slow" />
                <div>
                  <h3 className="font-sans font-bold text-sm sm:text-base">
                    {language === 'fi' ? '3D-Virtuaalikierros (Koko näyttö)' : '3D Virtual Tour (Fullscreen)'}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono">
                    {language === 'fi' ? 'Liiku tilassa pyörittämällä ja koskettamalla' : 'Navigate space by dragging and tapping'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeTourUrl !== MATTERPORT_TOUR_URL && (
                  <button
                    type="button"
                    onClick={() => setActiveTourUrl(MATTERPORT_TOUR_URL)}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  >
                    {language === 'fi' ? 'Nollaa näkymä' : 'Reset View'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullscreenTourOpen(false)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1"
                >
                  <span>{language === 'fi' ? 'Sulje koko näyttö ×' : 'Close Fullscreen ×'}</span>
                </button>
              </div>
            </div>
            <div className="flex-1 w-full h-full relative bg-black">
              <iframe
                src={activeTourUrl}
                title="Kulinaria Matterport Tour Fullscreen"
                className="w-full h-full border-none"
                allowFullScreen
                allow="autoplay; fullscreen; vr; xr-spatial-tracking; gyro; accelerometer; magnetometer; touch-action"
              />
            </div>
          </div>
        )}

        {/* Footer Summary & Book Button */}
        <div onWheel={handleWheelOnNonScrollable} className="p-2.5 sm:p-5 px-3 sm:px-5 border-t border-gray-100 bg-gray-50/90 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0">
          <div className="flex-1">
            {localSelectedTableIds.length > 0 ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-[10px] sm:text-xs font-extrabold font-mono shrink-0 border border-red-200/40 px-1 text-center truncate">
                  {localSelectedTableIds.join('+')}
                </div>
                <div>
                  <div className="font-sans font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span>
                      {localSelectedTableIds.length === 1 
                        ? (language === 'fi' ? '1 pöytä valittu' : '1 table selected')
                        : (language === 'fi' ? `${localSelectedTableIds.length} pöytää valittu` : `${localSelectedTableIds.length} tables selected`)}
                    </span>
                    <span className="bg-red-500 text-white text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold font-mono flex items-center gap-0.5 shadow-xs">
                      <Check className="w-2.5 h-2.5 stroke-[3px]" />
                      <span>{language === 'fi' ? 'Vahvistettu' : 'Confirmed'}</span>
                    </span>
                  </div>
                  <div className="text-[9px] sm:text-[11px] text-gray-500 font-mono flex items-center gap-1 sm:gap-1.5 mt-0.5 flex-wrap">
                    <User className="w-3 h-3 text-gray-400 shrink-0" />
                    <span>
                      {language === 'fi' ? 'Yhteiskapasiteetti' : 'Total capacity'}:{' '}
                      <strong>
                        {tables
                          .filter(tb => localSelectedTableIds.includes(tb.id))
                          .reduce((sum, tb) => sum + tb.capacity, 0)}{' '}
                        {t.people}
                      </strong>
                    </span>
                    {useDateTimeFilter && searchDate && searchTime && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span>
                          {language === 'fi' ? 'Kesto' : 'Duration'}:{' '}
                          <strong className={(() => {
                            let dur = 120;
                            for (const id of localSelectedTableIds) {
                              const tableDur = getTableAllowedDuration(id, searchDate, searchTime);
                              if (tableDur > 0 && tableDur < dur) {
                                dur = tableDur;
                              }
                            }
                            return dur === 90;
                          })() ? "text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100 font-bold" : ""}>
                            {(() => {
                              let dur = 120;
                              for (const id of localSelectedTableIds) {
                                const tableDur = getTableAllowedDuration(id, searchDate, searchTime);
                                if (tableDur > 0 && tableDur < dur) {
                                  dur = tableDur;
                                }
                              }
                              return dur / 60;
                            })()} h
                          </strong>
                        </span>
                      </>
                    )}
                    <span className="text-gray-300">•</span>
                    <span className="truncate max-w-[120px] sm:max-w-[300px]">
                      {tables
                        .filter(tb => localSelectedTableIds.includes(tb.id))
                        .map(tb => language === 'fi' ? tb.nameFi : tb.nameEn)
                        .join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-500 font-mono py-1">
                <Info className="w-3.5 h-3.5 text-red-500 shrink-0 animate-bounce" />
                <span>
                  {language === 'fi' 
                    ? 'Klikkaa pöytiä yläpuolelta merkitäksesi ne valituksi ja siirtääksesi ne varaukseen.' 
                    : 'Select tables above to view the summary and apply them to your reservation.'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {localSelectedTableIds.length > 0 && (
              <button
                type="button"
                onClick={() => setLocalSelectedTableIds([])}
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-700 text-[10px] sm:text-xs font-semibold font-mono transition-all active:scale-97"
              >
                {language === 'fi' ? 'Tyhjennä' : 'Clear'}
              </button>
            )}
            <button
              type="button"
              disabled={localSelectedTableIds.length === 0}
              onClick={() => {
                onSelectTable(
                  localSelectedTableIds.join(','), 
                  useDateTimeFilter ? searchDate : undefined, 
                  useDateTimeFilter ? searchTime : undefined
                );
                onClose();
              }}
              className="flex-1 sm:flex-initial py-2 sm:py-2.5 px-4 sm:px-6 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 hover:shadow-md text-white font-sans font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all transform active:scale-97 disabled:from-gray-100 disabled:to-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {localSelectedTableIds.length >= 2
                ? (language === 'fi' ? 'Varaa pöydät' : 'Book Tables')
                : (language === 'fi' ? 'Varaa pöytä' : 'Book Table')}
            </button>
          </div>
        </div>

      </div>

      {/* Looshi-selitysikkuna / Booth info dialog */}
      {isBoothInfoOpen && (
        <div 
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsBoothInfoOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-gray-100 space-y-3.5 animate-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center font-bold font-mono text-sm shrink-0">
                  ?
                </div>
                <div>
                  <h4 className="text-sm font-bold font-sans text-gray-900 leading-tight">
                    {language === 'fi' ? 'Mikä on looshi?' : 'What is a booth?'}
                  </h4>
                  <span className="text-[10px] font-mono text-red-600 font-semibold uppercase tracking-wider">
                    {language === 'fi' ? 'Pöytätyyppi' : 'Table type'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBoothInfoOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                title={language === 'fi' ? 'Sulje' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-gray-600 leading-relaxed space-y-2 font-sans bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
              <p>
                {language === 'fi'
                  ? 'Looshi (booth) on kiinteillä, pehmeillä sohvilla tai korkeaselkäisillä penkeillä rajattu viihtyisä pöytätila.'
                  : 'A booth is a cozy dining section enclosed by cushioned benches or high-backed banquettes.'}
              </p>
              <p>
                {language === 'fi'
                  ? 'Se tarjoaa tavanomaista pöytää enemmän omaa rauhaa, akustista mukavuutta ja yksityisyyttä – loistava valinta rauhalliselle illalliselle, seurueelle tai treffeille.'
                  : 'It offers more privacy, sound dampening, and relaxing comfort than standard open tables—ideal for date nights or cozy group dinners.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedFeature('booth');
                  setIsBoothInfoOpen(false);
                }}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-sans font-bold text-xs shadow-2xs transition-colors cursor-pointer"
              >
                {language === 'fi' ? 'Näytä looshit' : 'Show booths'}
              </button>
              <button
                type="button"
                onClick={() => setIsBoothInfoOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-bold text-xs transition-colors cursor-pointer"
              >
                {language === 'fi' ? 'Sulje' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
