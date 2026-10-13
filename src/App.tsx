import { useState, useEffect, FormEvent } from 'react';
import { Calendar as CalendarIcon, Users, Clock, HelpCircle, Utensils, Sparkles, CheckCircle, Info, ChevronRight, LayoutGrid, Award, Heart, Mail, Phone, ListCollapse, Palette, Plus, Minus, Lock, Unlock, KeyRound, ShieldCheck, LogOut, ArrowLeft } from 'lucide-react';
import { Table, Booking, Language, TimeSlot } from './types';
import { translations } from './translations';
import LanguageToggle from './components/LanguageToggle';
import BookingCalendar from './components/BookingCalendar';
import TimeSlotPicker from './components/TimeSlotPicker';
import TableSelectionModal from './components/TableSelectionModal';
import AdminDashboard from './components/AdminDashboard';
import ThemeCustomizer, { ThemeConfig, DEFAULT_THEME, applyThemeConfig } from './components/ThemeCustomizer';
import LegalModal, { LegalDocType } from './components/LegalModal';

export default function App() {
  const [language, setLanguage] = useState<Language>('fi');
  const [view, setView] = useState<'booking' | 'admin'>('booking');
  const [tables, setTables] = useState<Table[]>([]);
  
  // Form states
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [partySize, setPartySize] = useState<number>(2);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [wishes, setWishes] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);

  // Preselected Table state (can be set via URL or manual demo trigger)
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(undefined);
  const [isPreselectedFromUrl, setIsPreselectedFromUrl] = useState<boolean>(false);

  // API states
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);

  // Modals & Secret Admin state
  const [isTablesModalOpen, setIsTablesModalOpen] = useState<boolean>(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<boolean>(false);
  
  // Legal & Statutory pages state
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType>('privacy');

  const openLegalDoc = (doc: LegalDocType) => {
    setActiveLegalDoc(doc);
    setIsLegalModalOpen(true);
  };

  const handleVerifyAdminPin = (e?: FormEvent) => {
    if (e) e.preventDefault();
    // Default PIN code is 1234 or empty/demo bypass
    if (adminPinInput.trim() === '1234' || adminPinInput.trim() === '' || adminPinInput.trim().toLowerCase() === 'admin') {
      setView('admin');
      setIsAdminPinModalOpen(false);
      setAdminPinInput('');
      setAdminPinError(false);
    } else {
      setAdminPinError(true);
    }
  };

  // Theme & White Label Branding state
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem('kulinaria_theme_config');
      return saved ? JSON.parse(saved) : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });
  const [isThemeCustomizerOpen, setIsThemeCustomizerOpen] = useState<boolean>(false);

  useEffect(() => {
    applyThemeConfig(themeConfig);
    try {
      localStorage.setItem('kulinaria_theme_config', JSON.stringify(themeConfig));
    } catch (e) {
      console.error(e);
    }
  }, [themeConfig]);

  const t = translations[language];

  // Fetch tables list on mount
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch('/api/tables');
        if (res.ok) {
          const data = await res.json();
          setTables(data);
        }
      } catch (err) {
        console.error('Error fetching tables:', err);
      }
    };
    fetchTables();
  }, []);

  // Check URL query parameters on load for ?tableId=... and ?view=admin
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableIdParam = params.get('tableId');
    const viewParam = params.get('view');
    const langParam = params.get('lang');

    if (langParam === 'fi' || langParam === 'en') {
      setLanguage(langParam);
    }

    if (viewParam === 'admin') {
      setView('admin');
    } else {
      setView('booking');
    }

    if (tableIdParam) {
      setSelectedTableId(tableIdParam);
      setIsPreselectedFromUrl(true);
    } else {
      setSelectedTableId(undefined);
      setIsPreselectedFromUrl(false);
    }
  }, []);

  // Auto-scroll to selected table banner/form when loaded from URL or pre-selected
  useEffect(() => {
    if (selectedTableId && isPreselectedFromUrl && tables.length > 0) {
      const timer = setTimeout(() => {
        const banner = document.getElementById('selected-tables-banner');
        if (banner) {
          banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          const formStart = document.getElementById('booking-form-start');
          if (formStart) {
            formStart.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selectedTableId, isPreselectedFromUrl, tables]);

  // Listen for window message events (allows Matterport hotspots / iframe tags to select tables dynamically)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data) return;

        // Handle string events (e.g., "select-table:T1")
        if (typeof data === 'string') {
          if (data.startsWith('select-table:')) {
            const id = data.split(':')[1];
            if (id && id.startsWith('T')) {
              setSelectedTableId(id);
              setIsPreselectedFromUrl(true);
              setView('booking');
              setTimeout(() => {
                document.getElementById('booking-form-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }
          }
        }
        // Handle object events (e.g., { type: 'select-table', tableId: 'T1' })
        else if (typeof data === 'object') {
          if (data.type === 'select-table' && data.tableId) {
            setSelectedTableId(data.tableId);
            setIsPreselectedFromUrl(true);
            setView('booking');
            setTimeout(() => {
              document.getElementById('booking-form-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        }
      } catch (err) {
        console.error('Error handling window postMessage:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Fetch available slots when date, partySize, or selectedTableId changes (debounced for smooth slider)
  useEffect(() => {
    if (!selectedDate) {
      setTimeSlots([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoadingSlots(true);
      try {
        const queryParams = new URLSearchParams({
          date: selectedDate,
          partySize: partySize.toString()
        });
        if (selectedTableId) {
          queryParams.append('tableId', selectedTableId);
        }

        const res = await fetch(`/api/availability/slots?${queryParams.toString()}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          setTimeSlots(data);
          
          // Clear selected time if it's no longer available in the new list
          if (selectedTime) {
            const stillAvail = data.find((s: TimeSlot) => s.time === selectedTime && s.available);
            if (!stillAvail) {
              setSelectedTime('');
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching slots:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSlots(false);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedDate, partySize, selectedTableId, view]);

  // Adjust party size slider maximum if specific tables are pre-selected
  const selectedTableIds = selectedTableId ? selectedTableId.split(',').map(id => id.trim()).filter(Boolean) : [];
  const activeTables = tables.filter((tb) => selectedTableIds.includes(tb.id));
  const maxPartySize = activeTables.length > 0 
    ? activeTables.reduce((sum, tb) => sum + tb.capacity, 0)
    : 12;

  // Adjust current partySize if it exceeds the new maximum cap
  useEffect(() => {
    if (partySize > maxPartySize) {
      setPartySize(maxPartySize);
    }
  }, [selectedTableId, maxPartySize]);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !selectedDate || !selectedTime) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          partySize,
          date: selectedDate,
          time: selectedTime,
          tableId: selectedTableId,
          wishes: wishes || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedBooking(data.booking);
        setEmailPreviewUrl(data.emailPreviewUrl || null);
        setIsSuccess(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const err = await res.json();
        alert(err.error || t.errorSubmit);
      }
    } catch (err) {
      console.error('Error submitting booking:', err);
      alert(t.errorSubmit);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPartySize(2);
    setSelectedDate('');
    setSelectedTime('');
    setWishes('');
    setAgreedToTerms(false);
    setIsSuccess(false);
    setCreatedBooking(null);
    setEmailPreviewUrl(null);
  };

  const handleManualTableSelect = (tableId: string | undefined, date?: string, time?: string) => {
    setSelectedTableId(tableId);
    setIsPreselectedFromUrl(false);
    
    if (date !== undefined) {
      setSelectedDate(date);
    }

    if (time !== undefined) {
      setSelectedTime(time);
    }

    if (tableId) {
      setTimeout(() => {
        const banner = document.getElementById('selected-tables-banner');
        if (banner) {
          banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  };

  // Helper to trigger simulated table booking link (for demonstration of preselected pages)
  const navigateToPreselectedTable = (id: string) => {
    setSelectedTableId(id);
    setIsPreselectedFromUrl(true);
    setView('booking');
    setSelectedDate('');
    setSelectedTime('');
  };

  const formatDateStr = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(language === 'fi' ? 'fi-FI' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-white relative text-gray-800 flex flex-col font-sans">
      {/* Absolute background visual pattern */}
      <div className="absolute inset-0 pointer-events-none subtle-pattern z-0" />

      {/* Top Navigation Panel / Selector Area */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-100 py-3.5 px-5 sm:px-6 z-40 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3.5">
          
          {/* Logo & Navigation (White Label Placeholder) */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsThemeCustomizerOpen(true)}
              className="w-9 h-9 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-red-50 hover:border-red-400 flex items-center justify-center text-gray-400 hover:text-red-600 shrink-0 shadow-2xs transition-all group"
              title={language === 'fi' ? 'Muokkaa logoa ja teemaa' : 'Customize logo & theme'}
            >
              <Palette className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
            <div className="flex flex-col text-left">
              <span className="font-sans font-extrabold text-gray-900 text-sm tracking-tight leading-none">
                {themeConfig.brandName}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">
                  White Label
                </span>
                {/* Secret button: small lock trigger next to white label badge */}
                <button
                  type="button"
                  onClick={() => setIsAdminPinModalOpen(true)}
                  className="opacity-30 hover:opacity-100 text-gray-400 hover:text-red-600 transition-all p-0.5 rounded"
                  title={language === 'fi' ? 'Salanappi: Avaa hallinta' : 'Secret: Admin access'}
                >
                  <Lock className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right side: Secret lock button + Language selector */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAdminPinModalOpen(true)}
              className="p-2 text-gray-300 hover:text-red-600 transition-all opacity-30 hover:opacity-100 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200"
              title={language === 'fi' ? 'Salanappi: Ravintolan hallinta' : 'Secret: Restaurant Admin'}
            >
              <Lock className="w-4 h-4" />
            </button>
            <LanguageToggle language={language} onLanguageChange={setLanguage} />
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-10 sm:py-16 relative z-10 flex flex-col justify-center overflow-x-hidden">
        
        {view === 'admin' ? (
          /* ADMIN VIEW WITH EXIT BAR */
          <div className="space-y-6">
            <div className="bg-gray-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-md border border-gray-800 flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold shrink-0 border border-red-500/30">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="font-sans font-extrabold text-xs sm:text-sm text-white tracking-wide block">
                    {language === 'fi' ? 'Ravintolan Hallintapaneeli' : 'Restaurant Admin Panel'}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 block">
                    {language === 'fi' ? 'Aktiivinen hallintatila' : 'Active admin session'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setView('booking')}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-sans font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{language === 'fi' ? 'Palaa asiakasvaraukseen' : 'Return to Customer View'}</span>
              </button>
            </div>

            <AdminDashboard language={language} tables={tables} />
          </div>
        ) : isSuccess && createdBooking ? (
          /* SUCCESS VIEW */
          <div className="max-w-md w-full mx-auto bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-md text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-green-100">
              <CheckCircle className="w-8 h-8" />
            </div>

            <h2 className="font-sans font-bold text-gray-900 text-2xl mb-2">
              {t.successTitle}
            </h2>
            <p className="text-sm text-gray-500 font-mono mb-6 leading-relaxed">
              {t.successMessage}
            </p>

            {/* Receipt details card */}
            <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-5 mb-8 text-left text-xs font-mono space-y-3">
              <div className="text-[10px] uppercase text-gray-400 font-bold tracking-wider border-b border-gray-100 pb-2 mb-2">
                {t.details}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t.nameLabel}:</span>
                <span className="font-semibold text-gray-900">{createdBooking.name}</span>
              </div>
              {createdBooking.email && (
                <div className="flex justify-between">
                  <span className="text-gray-400">{t.emailLabel}:</span>
                  <span className="font-medium text-gray-800">{createdBooking.email}</span>
                </div>
              )}
              {createdBooking.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-400">{t.phoneLabel}:</span>
                  <span className="font-medium text-gray-800">{createdBooking.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">{t.partySizeLabel}:</span>
                <span className="font-bold text-gray-900">{createdBooking.partySize} {t.people}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t.dateLabel}:</span>
                <span className="font-semibold text-gray-900">{formatDateStr(createdBooking.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t.timeLabel}:</span>
                <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[11px] border border-red-100">{createdBooking.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t.tableLabel}:</span>
                <span className="bg-red-50 text-red-700 font-sans font-semibold px-2 py-0.5 rounded text-[10px] border border-red-100">
                  {language === 'fi' ? createdBooking.tableNameFi : createdBooking.tableNameEn}
                </span>
              </div>
              {createdBooking.wishes && (
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <span className="text-gray-400 block mb-1">{t.wishesLabel}:</span>
                  <span className="text-gray-600 block italic leading-relaxed text-[11px]">{createdBooking.wishes}</span>
                </div>
              )}
            </div>

            {createdBooking.email && (
              <div className="mb-6 p-4 rounded-xl bg-red-50/25 border border-red-100 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 text-red-600 font-sans font-bold text-xs uppercase tracking-wider mb-1">
                  <Mail className="w-4 h-4" />
                  <span>{language === 'fi' ? 'SÄHKÖPOSTI LÄHETETTY' : 'EMAIL SENT'}</span>
                </div>
                <p className="text-xs text-gray-600 font-sans leading-relaxed">
                  {language === 'fi' 
                    ? `Vahvistussähköposti on lähetetty osoitteeseen ${createdBooking.email}.`
                    : `A confirmation email has been sent to ${createdBooking.email}.`}
                </p>
                {emailPreviewUrl && (
                  <div className="mt-3 pt-3 border-t border-gray-100/60">
                    <a
                      href={emailPreviewUrl}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-sans font-bold hover:underline transition-all"
                    >
                      <span>👉 {language === 'fi' ? 'Avaa sähköpostin esikatselu tästä' : 'Open email preview here'}</span>
                    </a>
                    <p className="text-[10px] text-gray-400 font-mono mt-1 leading-normal">
                      {language === 'fi'
                        ? 'Kehitysympäristössä sähköposti lähetettiin turvallisesti Ethereal-testipalveluun. Klikkaa linkkiä nähdäksesi miltä sähköposti näyttää!'
                        : 'In development, the email was safely sent to Ethereal SMTP test service. Click the link to view the rendered HTML email!'}
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleResetForm}
              className="w-full py-3.5 px-4 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 text-white font-sans font-semibold hover:shadow-lg transition-all transform active:scale-98"
            >
              {t.backToHome}
            </button>
          </div>
        ) : (
          /* REGULAR BOOKING FORM VIEW */
          <div id="booking-form-start" className="max-w-xl w-full mx-auto">
            
            {/* Minimal Hero Header */}
            <div className="text-center pt-10 sm:pt-0 mb-12 sm:mb-16 px-1 sm:px-0">
              <h1 className="font-display font-extrabold text-gray-900 text-3xl sm:text-5xl tracking-tight leading-none">
                {t.bookTable}
              </h1>
              <p className="font-mono text-[11px] sm:text-xs font-medium text-gray-500 tracking-widest uppercase mt-3.5 mb-14 sm:mb-10 text-center">
                {t.taglinePrefix}
                <span className="font-extrabold text-gray-900">{t.taglineBold}</span>
                {t.taglineSuffix}
              </p>

              {/* Exploration section */}
              <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-6 sm:p-8 max-w-xl mx-auto mb-8 sm:mb-10">
                <p className="text-gray-600 font-medium text-sm sm:text-base mb-5 leading-relaxed whitespace-normal sm:whitespace-nowrap">
                  {language === 'fi' 
                    ? 'Tutustu ravintolaan 3D:nä ja varaa mieleisesi pöytä' 
                    : 'Explore the restaurant in 3D and book your preferred table'}
                </p>
                <button
                  type="button"
                  onClick={() => setIsTablesModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-3.5 sm:py-3 rounded-lg bg-white border border-gray-200 hover:border-red-300 hover:bg-gray-50 text-gray-700 font-sans font-semibold text-xs uppercase tracking-wider transition-all active:scale-98 shadow-sm"
                >
                  <LayoutGrid className="w-4 h-4 text-red-500" />
                  <span>{language === 'fi' ? 'Valitse tietty pöytä' : 'Select a specific table'}</span>
                </button>
              </div>

              {/* Custom divider with "tai" */}
              <div className="relative my-8 sm:my-10 max-w-xs mx-auto">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-100 animate-pulse"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 font-mono text-xs uppercase text-gray-400 font-extrabold tracking-widest">
                    {language === 'fi' ? 'tai' : 'or'}
                  </span>
                </div>
              </div>

              {/* Book any available table title */}
              <div className="text-center mb-8 sm:mb-10">
                <h2 className="font-sans font-extrabold text-gray-900 text-lg sm:text-xl uppercase tracking-wider">
                  {language === 'fi' ? 'Varaa jokin vapaa pöytä' : 'Book any available table'}
                </h2>
                <p className="text-[11px] text-gray-400 font-mono mt-1.5">
                  {language === 'fi' ? 'Täytä alle varauksen tiedot aloittaaksesi' : 'Fill in the booking details below to start'}
                </p>
              </div>
            </div>

            {/* Custom Preselected Table Banner */}
            {selectedTableId && activeTables.length > 0 && (
              <div id="selected-tables-banner" className="mb-8 p-4 bg-red-50/20 border border-red-200/50 rounded-xl relative overflow-hidden flex flex-col sm:flex-row items-start justify-between gap-4 scroll-mt-24">
                <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 text-red-600 font-sans font-bold text-xs uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {activeTables.length > 1
                        ? (language === 'fi' ? 'VALITUT PÖYDÄT' : 'SELECTED TABLES')
                        : t.specificTablePreselected}
                    </span>
                  </div>
                  <h3 className="font-sans font-bold text-gray-900 text-lg mt-1">
                    {activeTables.map(tb => language === 'fi' ? tb.nameFi : tb.nameEn).join(', ')}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono italic mt-1 leading-relaxed">
                    {activeTables.length > 1 
                      ? (language === 'fi' 
                        ? `Yhdistetty kapasiteetti: Max ${maxPartySize} henkilöä.` 
                        : `Combined capacity: Max ${maxPartySize} people.`)
                      : (language === 'fi' ? activeTables[0].atmosphereFi : activeTables[0].atmosphereEn)}
                  </p>
                  
                  {isPreselectedFromUrl && (
                    <p className="text-[10px] text-red-500 font-mono mt-2 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      <span>{t.preselectedTableNote}</span>
                    </p>
                  )}
                </div>

                {/* If arrived from virtual tour or manual pre-select, we can either switch tables or return to generic booking */}
                <button
                  type="button"
                  onClick={() => handleManualTableSelect(undefined)}
                  className="shrink-0 text-xs font-mono font-semibold text-red-600 hover:text-red-700 bg-white border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-xs"
                >
                  {t.orBookAnyAvailable}
                </button>
              </div>
            )}

            {/* Main Interactive Form Card */}
            <form onSubmit={handleFormSubmit} className="space-y-7 sm:space-y-8 bg-white w-full max-w-full box-border">
              
              {/* FIELD 1: Kalenteri (Valitse päivämäärä) */}
              <div className="space-y-3">
                <label className="block text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                  {t.calendarTitle} <span className="text-red-500 font-sans">*</span>
                </label>
                
                <BookingCalendar
                  language={language}
                  selectedDate={selectedDate}
                  onSelectDate={(date) => { setSelectedDate(date); setSelectedTime(''); }}
                  partySize={partySize}
                  tableId={selectedTableId}
                />
              </div>

              {/* FIELD 2: Aika (Valitse kellonaika) */}
              <div className="space-y-3">
                <label className="block text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                  {t.timeTitle} <span className="text-red-500 font-sans">*</span>
                </label>
                
                <TimeSlotPicker
                  language={language}
                  slots={timeSlots}
                  selectedTime={selectedTime}
                  onSelectTime={setSelectedTime}
                  isLoading={isLoadingSlots}
                  dateSelected={!!selectedDate}
                />

                <p className="text-[11px] text-gray-400 font-sans mt-2 flex items-center gap-1.5 px-0.5">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block"></span>
                  {language === 'fi' 
                    ? 'Pöytävarauksen normaali kesto on 2 tuntia (minimikesto 1,5 tuntia, jos seuraava varaus alkaa aiemmin).' 
                    : 'Standard booking duration is 2 hours (minimum of 1.5 hours if a subsequent booking begins earlier).'}
                </p>
              </div>

              {/* FIELD 3: Henkilömäärä: liuku ja pikanapit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                    {t.partySize} <span className="text-red-500 font-sans">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={partySize <= 1}
                      onClick={() => setPartySize(prev => Math.max(1, prev - 1))}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 flex items-center justify-center font-bold disabled:opacity-40 disabled:hover:bg-gray-100 disabled:hover:text-gray-700 transition-colors"
                      title={language === 'fi' ? 'Vähennä' : 'Decrease'}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="bg-red-50 text-red-600 border border-red-100 font-sans font-extrabold text-sm px-3 py-0.5 rounded-lg shrink-0">
                      {partySize} {partySize === 1 ? t.person : t.people}
                    </span>
                    <button
                      type="button"
                      disabled={partySize >= maxPartySize}
                      onClick={() => setPartySize(prev => Math.min(maxPartySize, prev + 1))}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 flex items-center justify-center font-bold disabled:opacity-40 disabled:hover:bg-gray-100 disabled:hover:text-gray-700 transition-colors"
                      title={language === 'fi' ? 'Lisää' : 'Increase'}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                {/* Range Slider & Quick Number Pills */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max={maxPartySize}
                      value={partySize}
                      onChange={(e) => setPartySize(parseInt(e.target.value, 10))}
                      className="w-full h-2.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-none"
                      style={{ touchAction: 'manipulation' }}
                    />
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 pt-1">
                    {Array.from({ length: Math.min(maxPartySize, 12) }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPartySize(num)}
                        className={`w-full py-1.5 rounded-md text-[11px] font-mono font-bold transition-all flex items-center justify-center ${
                          partySize === num
                            ? 'bg-red-600 text-white shadow-2xs scale-105'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info Note about specific table capacities if selected */}
                {selectedTableId && activeTables.length > 0 && (
                  <p className="text-[10px] text-gray-400 font-mono mt-1">
                    {language === 'fi' 
                      ? `* Valittujen pöytien (${activeTables.map(t => t.id).join(' + ')}) yhteiskapasiteetti on ${maxPartySize} henkilöä.` 
                      : `* Combined capacity for selected tables (${activeTables.map(t => t.id).join(' + ')}) is ${maxPartySize} guests.`}
                  </p>
                )}
              </div>

              {/* FIELD 4: Varaajan Nimi */}
              <div className="space-y-2 w-full max-w-full">
                <label className="block text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                  {t.bookerName} <span className="text-red-500 font-sans">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === 'fi' ? 'Kirjoita nimesi tähän...' : 'Enter your name here...'}
                  className="w-full max-w-full box-border min-w-0 px-4 py-3.5 border border-gray-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 rounded-lg bg-white text-gray-800 font-sans font-medium outline-none transition-all placeholder:text-gray-300 placeholder:font-light"
                />
              </div>

              {/* Extra contact fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full max-w-full">
                <div className="space-y-2 min-w-0">
                  <label className="block text-xs font-mono text-gray-400 font-bold uppercase tracking-wider">
                    {t.emailLabel} <span className="text-gray-300 font-sans font-light">({t.optional})</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full max-w-full box-border min-w-0 px-4 py-3.5 border border-gray-200 focus:border-red-400 rounded-lg bg-white text-gray-800 font-sans font-normal outline-none transition-all placeholder:text-gray-300"
                  />
                </div>
                <div className="space-y-2 min-w-0">
                  <label className="block text-xs font-mono text-gray-400 font-bold uppercase tracking-wider">
                    {t.phoneLabel} <span className="text-gray-300 font-sans font-light">({t.optional})</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+358..."
                    className="w-full max-w-full box-border min-w-0 px-4 py-3.5 border border-gray-200 focus:border-red-400 rounded-lg bg-white text-gray-800 font-sans font-normal outline-none transition-all placeholder:text-gray-300"
                  />
                </div>
              </div>

              {/* FIELD 5: Toiveita henkilökunnalle */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                  {t.extraWishes} <span className="text-gray-300 font-sans font-light">({t.optional})</span>
                </label>
                <textarea
                  value={wishes}
                  onChange={(e) => setWishes(e.target.value)}
                  placeholder={t.wishesPlaceholder}
                  rows={3}
                  className="w-full px-4 py-3.5 border border-gray-200 focus:border-red-400 rounded-lg bg-white text-gray-800 font-sans font-normal outline-none transition-all placeholder:text-gray-300 resize-none text-sm"
                />
              </div>

              {/* FIELD 6: Arriving confirmation terms */}
              <div className="space-y-3 bg-red-50/50 p-4 rounded-xl border border-red-100/70 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <div className="relative flex items-center pt-1">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      id="arrive-on-time-terms"
                      className="peer h-4.5 w-4.5 shrink-0 appearance-none rounded-md border border-red-300 bg-white checked:bg-red-600 checked:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition-all cursor-pointer"
                    />
                    <svg
                      className="absolute left-0 top-1 h-4.5 w-4.5 pointer-events-none text-white stroke-[3px] hidden peer-checked:block p-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-700 leading-relaxed font-sans font-medium">
                    {language === 'fi' ? (
                      <>
                        Sitoudun saapumaan seurueeni kanssa ravintolaan viimeistään <strong className="text-red-700 font-bold">15 minuutin</strong> kuluessa varatun ajan alkamisesta. Mikäli saapumisemme viivästyy tästä, sitoudun ilmoittamaan siitä puhelimitse asiakaspalveluumme tai peruuttamaan varauksemme.
                      </>
                    ) : (
                      <>
                        I commit to arriving with my party at the restaurant within <strong className="text-red-700 font-bold">15 minutes</strong> of our scheduled reservation time. If our arrival is delayed beyond this limit, I agree to call customer service or cancel our reservation.
                      </>
                    )}
                    <span className="text-red-500 ml-1 font-bold">*</span>
                  </span>
                </label>
              </div>

              {/* SUBMIT BUTTON - Gradient red to orange, square with slight rounded corners */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !name || !selectedDate || !selectedTime || !agreedToTerms}
                  className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 text-white font-sans font-semibold text-sm uppercase tracking-wider hover:shadow-lg disabled:from-gray-100 disabled:to-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none transition-all transform active:scale-98"
                >
                  {(() => {
                    const selectedSlot = timeSlots.find((s) => s.time === selectedTime);
                    const selectedSlotDuration = selectedSlot ? selectedSlot.duration : 120;
                    if (isSubmitting) {
                      return (
                        <span className="flex items-center justify-center gap-2">
                          <Clock className="w-4 h-4 animate-spin" />
                          <span>{language === 'fi' ? 'Lähetetään...' : 'Submitting...'}</span>
                        </span>
                      );
                    }
                    if (selectedTime && selectedSlotDuration === 90) {
                      return (
                        <span>
                          {language === 'fi' ? 'Vahvista varaus (1.5 h varaus)' : 'Confirm Booking (1.5 h booking)'}
                        </span>
                      );
                    } else if (selectedTime && selectedSlotDuration) {
                      return (
                        <span>
                          {language === 'fi' ? `Vahvista varaus (${selectedSlotDuration / 60} h varaus)` : `Confirm Booking (${selectedSlotDuration / 60} h booking)`}
                        </span>
                      );
                    }
                    return <span>{t.submitButton}</span>;
                  })()}
                </button>
              </div>

            </form>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-6 px-4 mt-12 bg-white relative z-10 text-center text-xs font-mono text-gray-400">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 justify-center">
            <span>&copy; {new Date().getFullYear()} {themeConfig.brandName}. All rights reserved.</span>
            <button
              type="button"
              onClick={() => setIsAdminPinModalOpen(true)}
              className="opacity-0 hover:opacity-100 text-gray-300 hover:text-gray-600 transition-opacity p-1 cursor-default hover:cursor-pointer"
              title="Secret Admin"
            >
              <Lock className="w-3 h-3" />
            </button>
          </div>

          {/* Statutory / Legal Document Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 font-sans text-xs">
            <button
              type="button"
              onClick={() => openLegalDoc('privacy')}
              className="hover:text-red-600 transition-colors underline-offset-2 hover:underline"
            >
              {language === 'fi' ? 'Tietosuojaseloste' : 'Privacy Policy'}
            </button>
            <span className="text-gray-200 hidden sm:inline">&middot;</span>
            <button
              type="button"
              onClick={() => openLegalDoc('terms')}
              className="hover:text-red-600 transition-colors underline-offset-2 hover:underline"
            >
              {language === 'fi' ? 'Käyttöehdot' : 'Terms of Service'}
            </button>
            <span className="text-gray-200 hidden sm:inline">&middot;</span>
            <button
              type="button"
              onClick={() => openLegalDoc('cookies')}
              className="hover:text-red-600 transition-colors underline-offset-2 hover:underline"
            >
              {language === 'fi' ? 'Evästekäytäntö' : 'Cookie Policy'}
            </button>
            <span className="text-gray-200 hidden sm:inline">&middot;</span>
            <button
              type="button"
              onClick={() => openLegalDoc('accessibility')}
              className="hover:text-red-600 transition-colors underline-offset-2 hover:underline"
            >
              {language === 'fi' ? 'Saavutettavuus' : 'Accessibility'}
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Quick Brand & Theme Trigger Button (Only in Admin view) */}
      {view === 'admin' && (
        <button
          type="button"
          onClick={() => setIsThemeCustomizerOpen(true)}
          className="fixed bottom-5 right-5 z-40 px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 hover:opacity-95 text-white font-sans font-extrabold text-xs rounded-2xl shadow-xl flex items-center gap-2 border border-white/30 backdrop-blur-md transition-all hover:scale-105 active:scale-95 group"
        >
          <Palette className="w-4 h-4 text-white animate-pulse" />
          <span>{language === 'fi' ? '🎨 Brändi & Teema' : '🎨 Brand & Theme'}</span>
        </button>
      )}

      {/* Theme & Branding Customizer Drawer */}
      <ThemeCustomizer
        isOpen={isThemeCustomizerOpen}
        onClose={() => setIsThemeCustomizerOpen(false)}
        config={themeConfig}
        onChange={setThemeConfig}
        language={language}
      />

      {/* MODAL: Table virtual selection tour */}
      <TableSelectionModal
        language={language}
        tables={tables}
        selectedTableId={selectedTableId}
        initialDate={selectedDate}
        initialTime={selectedTime}
        onSelectTable={handleManualTableSelect}
        isOpen={isTablesModalOpen}
        onClose={() => setIsTablesModalOpen(false)}
      />

      {/* MODAL: Secret Admin PIN / Unlock Modal */}
      {isAdminPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shadow-2xs">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-sans font-extrabold text-sm text-gray-900">
                    {language === 'fi' ? 'Ylläpidon Salanappi' : 'Secret Admin Access'}
                  </h3>
                  <p className="text-[10px] font-mono text-gray-400">
                    {language === 'fi' ? 'Ravintolan hallintapaneeli' : 'Restaurant Management'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsAdminPinModalOpen(false); setAdminPinError(false); }}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVerifyAdminPin} className="space-y-3">
              <p className="text-xs text-gray-600 font-sans leading-relaxed">
                {language === 'fi'
                  ? 'Syötä ylläpidon PIN-koodi avataksesi ravintolan hallintapaneelin:'
                  : 'Enter admin PIN code to access the restaurant management panel:'}
              </p>

              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder={language === 'fi' ? 'Koodi (esim. 1234)' : 'PIN (e.g. 1234)'}
                  value={adminPinInput}
                  onChange={(e) => { setAdminPinInput(e.target.value); setAdminPinError(false); }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-center font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {adminPinError && (
                  <p className="text-[11px] text-red-600 font-mono mt-1.5 text-center font-bold">
                    {language === 'fi' ? 'Väärä koodi! Kokeile "1234" tai klikkaa Oikotie' : 'Incorrect PIN! Try "1234" or click Bypass'}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-sans font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-2xs active:scale-98"
                >
                  {language === 'fi' ? 'Avaa hallinta' : 'Unlock Dashboard'}
                </button>
                <button
                  type="button"
                  onClick={() => { setView('admin'); setIsAdminPinModalOpen(false); setAdminPinError(false); }}
                  className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-bold text-xs rounded-xl transition-colors shrink-0"
                  title={language === 'fi' ? 'Avaa suoraan (testioikotie)' : 'Direct bypass'}
                >
                  {language === 'fi' ? 'Oikotie 🔓' : 'Bypass 🔓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Legal Documents & Statutory Info */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        language={language}
        initialDoc={activeLegalDoc}
      />
    </div>
  );
}
