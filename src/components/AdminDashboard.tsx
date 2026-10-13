import { useState, useEffect } from 'react';
import { Calendar, Users, Clock, MessageSquare, Trash2, RotateCcw, LayoutGrid, CheckCircle2, User, RefreshCw, Layers, Search, AlertTriangle, ChevronLeft, ChevronRight, Grid, Filter, Hash, Sparkles, ShieldCheck, Hourglass } from 'lucide-react';
import { Booking, Table, Language } from '../types';
import { translations } from '../translations';
import { 
  initAuth, 
  googleSignIn, 
  logout as googleLogout, 
  syncBookingsToCalendar, 
  deleteCalendarEvent 
} from '../googleCalendar';
import { User as FirebaseUser } from 'firebase/auth';

interface AdminDashboardProps {
  language: Language;
  tables: Table[];
  className?: string;
}

export default function AdminDashboard({ language, tables, className = '' }: AdminDashboardProps) {
  const t = translations[language];
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'byTable'>('all');
  const [selectedTableId, setSelectedTableId] = useState<string>('T1');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [tableFilter, setTableFilter] = useState<'all' | 'hasBookings' | 'free'>('all');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 2-day database retention and active/ended view filter
  const [timeFilter, setTimeFilter] = useState<'active' | 'past' | 'all'>('active');
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [isPurging, setIsPurging] = useState<boolean>(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Edit booking states
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');
  const [editDuration, setEditDuration] = useState<number>(120);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [overrideConflict, setOverrideConflict] = useState<boolean>(false);

  const TIME_SLOTS = [
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00'
  ];

  const timeToMinutes = (t: string): number => {
    const [hours, minutes] = t.split(':').map((s) => parseInt(s, 10));
    return hours * 60 + minutes;
  };

  const checkConflict = (tableId: string | undefined, date: string, time: string, duration: number, currentBookingId: string): boolean => {
    if (!tableId) return false;
    const startMin = timeToMinutes(time);
    const endMin = startMin + duration;
    const targetTableIds = tableId.split(',').map((s) => s.trim());

    return bookings.some((b) => {
      if (b.id === currentBookingId) return false;
      if (b.date !== date || !b.tableId) return false;

      const bTableIds = b.tableId.split(',').map((s) => s.trim());
      const sharesTable = targetTableIds.some((id) => bTableIds.includes(id));
      if (!sharesTable) return false;

      const bStart = timeToMinutes(b.time);
      const bDuration = b.duration || 120;
      const bEnd = bStart + bDuration;

      return bStart < endMin && startMin < bEnd;
    });
  };

  const handleUpdateBookingTime = async () => {
    if (!editingBooking) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/bookings/${editingBooking.id}/time`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          time: editTime,
          duration: editDuration,
          date: editDate
        })
      });

      if (res.ok) {
        setMessage({
          text: language === 'fi' ? 'Varauksen aika päivitetty onnistuneesti!' : 'Booking time updated successfully!',
          type: 'success'
        });
        setEditingBooking(null);
        fetchBookings();
        setTimeout(() => setMessage(null), 4000);
      } else {
        const errData = await res.json();
        setMessage({
          text: errData.error || (language === 'fi' ? 'Ajan päivittäminen epäonnistui' : 'Failed to update booking time'),
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Error updating booking time:', err);
      setMessage({
        text: language === 'fi' ? 'Virhe yhteydessä palvelimeen' : 'Server communication error',
        type: 'error'
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/bookings');
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    // Auto-update currentTime every 30 seconds so ended bookings automatically transition and disappear
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const handleConnectCalendar = async () => {
    setIsConnecting(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setMessage({
          text: language === 'fi' ? 'Yhdistetty Google-kalenteriin onnistuneesti!' : 'Connected to Google Calendar successfully!',
          type: 'success'
        });
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err) {
      console.error('Error connecting to Google Calendar:', err);
      setMessage({
        text: language === 'fi' ? 'Virhe yhdistettäessä Google-kalenteriin.' : 'Error connecting to Google Calendar.',
        type: 'error'
      });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      setMessage({
        text: language === 'fi' ? 'Google-kalenteriyhteys katkaistu.' : 'Google Calendar connection disconnected.',
        type: 'success'
      });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error('Error disconnecting Google Calendar:', err);
    }
  };

  const handleSyncBookings = async () => {
    if (!googleToken) return;
    if (bookings.length === 0) {
      setMessage({ text: t.noBookingsToSync, type: 'error' });
      return;
    }

    setIsSyncing(true);
    try {
      const { success, failed } = await syncBookingsToCalendar(bookings, googleToken, language);
      if (failed === 0) {
        setMessage({
          text: t.syncSuccess,
          type: 'success'
        });
      } else {
        setMessage({
          text: language === 'fi' 
            ? `Synkronoitu ${success} varausta. ${failed} epäonnistui.` 
            : `Synced ${success} reservations. ${failed} failed.`,
          type: 'success'
        });
      }
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      console.error('Sync error:', err);
      setMessage({ text: t.syncError, type: 'error' });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCancelBooking = async (id: string) => {
    setIsDeletingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // If Google Calendar is connected, delete the calendar event too!
        if (googleToken) {
          const bookingToDelete = bookings.find(b => b.id === id);
          if (bookingToDelete) {
            await deleteCalendarEvent(id, bookingToDelete.tableId, googleToken, language);
          }
        }

        setMessage({ text: t.cancelSuccess, type: 'success' });
        
        // Wait briefly for a smooth transition before updating state
        setTimeout(() => {
          fetchBookings();
          setConfirmDeleteId(null);
          setIsDeletingId(null);
        }, 600);

        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage({ text: t.errorSubmit, type: 'error' });
        setIsDeletingId(null);
      }
    } catch (err) {
      console.error('Error cancelling booking:', err);
      setMessage({ text: t.errorSubmit, type: 'error' });
      setIsDeletingId(null);
    }
  };

  const handleResetData = async () => {
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      if (res.ok) {
        setMessage({ text: t.resetSuccess, type: 'success' });
        setShowResetConfirm(false);
        fetchBookings();
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err) {
      console.error('Error resetting bookings:', err);
    }
  };

  // Helper to determine real-time status of a booking and time left in 2-day database retention
  const getStatusInfo = (b: Booking) => {
    const now = currentTime;
    let isPast = b.isPast;
    let isOngoing = b.isOngoing;
    let hoursUntilPurge = b.hoursUntilPurge;

    if (isPast === undefined || isOngoing === undefined) {
      try {
        const [y, m, d] = b.date.split('-').map(Number);
        const [hh, mm] = (b.time || '00:00').split(':').map(Number);
        const startMs = new Date(y, m - 1, d, hh, mm).getTime();
        const durationMin = b.duration || 120;
        const endMs = startMs + durationMin * 60 * 1000;
        const purgeMs = endMs + 48 * 3600 * 1000;
        const nowMs = now.getTime();
        isPast = nowMs >= endMs;
        isOngoing = nowMs >= startMs && nowMs < endMs;
        hoursUntilPurge = Math.max(0, Math.round((purgeMs - nowMs) / (3600 * 1000)));
      } catch {
        isPast = false;
        isOngoing = false;
        hoursUntilPurge = 48;
      }
    }

    return { isPast: !!isPast, isOngoing: !!isOngoing, hoursUntilPurge: hoursUntilPurge ?? 48 };
  };

  const handlePurgeExpired = async () => {
    setIsPurging(true);
    try {
      const res = await fetch('/api/admin/purge-expired', { method: 'POST' });
      if (res.ok) {
        setMessage({
          text: t.purgeSuccess,
          type: 'success'
        });
        fetchBookings();
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err) {
      console.error('Error purging expired bookings:', err);
    } finally {
      setIsPurging(false);
    }
  };

  const activeBookingsCount = bookings.filter((b) => !getStatusInfo(b).isPast).length;
  const pastBookingsCount = bookings.filter((b) => getStatusInfo(b).isPast).length;

  // Filter bookings by search query AND active/ended time filter
  // Ended bookings disappear from the active view immediately when the reservation time ends!
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      b.name.toLowerCase().includes(q) ||
      (b.email && b.email.toLowerCase().includes(q)) ||
      (b.phone && b.phone.includes(q)) ||
      (b.tableNameFi && b.tableNameFi.toLowerCase().includes(q)) ||
      (b.tableNameEn && b.tableNameEn.toLowerCase().includes(q));
    if (!matchesSearch) return false;

    const { isPast } = getStatusInfo(b);
    if (timeFilter === 'active') return !isPast; // Disappears from view when time passes!
    if (timeFilter === 'past') return isPast;
    return true;
  });

  // Group bookings by table (matching selected table and search query)
  const tableBookings = filteredBookings.filter((b) => 
    b.tableId ? b.tableId.split(',').map((s) => s.trim()).includes(selectedTableId) : false
  );

  // Filter tables list based on search query and status filter
  const filteredTablesList = tables.filter((table) => {
    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.trim().toLowerCase();
      const numQ = q.replace(/\D/g, '');
      const tableNum = table.id.replace(/\D/g, '');
      const matchesId = table.id.toLowerCase().includes(q) || (numQ.length > 0 && tableNum === numQ);
      const matchesFi = table.nameFi.toLowerCase().includes(q);
      const matchesEn = table.nameEn.toLowerCase().includes(q);
      if (!matchesId && !matchesFi && !matchesEn) return false;
    }

    const dateBookingsCount = bookings.filter((b) => {
      if (b.date !== scheduleDate || !b.tableId) return false;
      return b.tableId.split(',').map((s) => s.trim()).includes(table.id);
    }).length;

    if (tableFilter === 'hasBookings' && dateBookingsCount === 0) return false;
    if (tableFilter === 'free' && dateBookingsCount > 0) return false;

    return true;
  });

  const handlePrevTable = () => {
    if (tables.length === 0) return;
    const currentIndex = tables.findIndex(t => t.id === selectedTableId);
    if (currentIndex > 0) {
      setSelectedTableId(tables[currentIndex - 1].id);
    } else {
      setSelectedTableId(tables[tables.length - 1].id);
    }
  };

  const handleNextTable = () => {
    if (tables.length === 0) return;
    const currentIndex = tables.findIndex(t => t.id === selectedTableId);
    if (currentIndex < tables.length - 1) {
      setSelectedTableId(tables[currentIndex + 1].id);
    } else {
      setSelectedTableId(tables[0].id);
    }
  };

  // Generate quick date options for table schedule view
  const dateOptions = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const valueStr = d.toISOString().split('T')[0];
    const label = i === 0 
      ? (language === 'fi' ? 'Tänään' : 'Today')
      : i === 1 
      ? (language === 'fi' ? 'Huomenna' : 'Tomorrow')
      : d.toLocaleDateString(language === 'fi' ? 'fi-FI' : 'en-US', { weekday: 'short', day: 'numeric', month: 'numeric' });
    return { value: valueStr, label };
  });

  // Helper to format date
  const formatDateStr = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(language === 'fi' ? 'fi-FI' : 'en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className={`w-full p-4 sm:p-6 bg-white rounded-2xl border border-gray-100 shadow-sm max-w-4xl mx-auto ${className}`}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5 mb-6">
        <div>
          <h2 className="font-sans font-semibold text-xl text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-red-500" />
            <span>{t.adminPanel}</span>
          </h2>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {language === 'fi' ? 'Seuraa varauksia ja hallitse pöytien kuormitusta.' : 'Monitor reservations and manage table assignments.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchBookings}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            title={language === 'fi' ? 'Päivitä' : 'Refresh'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          {showResetConfirm ? (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 p-1 rounded-lg animate-in fade-in zoom-in-95 duration-150">
              <span className="text-[10px] font-sans font-bold text-red-700 px-1">
                {language === 'fi' ? 'Palautetaanko esimerkkivaraukset?' : 'Restore demo bookings?'}
              </span>
              <button
                type="button"
                onClick={handleResetData}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-sans font-bold text-[10px] rounded shadow-xs"
              >
                {language === 'fi' ? 'Kyllä' : 'Yes'}
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-sans font-bold text-[10px] rounded"
              >
                {language === 'fi' ? 'Peruuta' : 'Cancel'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-mono rounded-lg transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.resetData}</span>
            </button>
          )}
        </div>
      </div>

      {/* Google Calendar Integration Widget */}
      <div className="mb-6 p-4 bg-gray-50/70 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Calendar className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-xs font-sans font-semibold text-gray-900 flex items-center gap-1.5">
              <span>Google Calendar Sync</span>
              {googleUser && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </h3>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
              {googleUser ? (
                <span>{t.connectedAs} <strong className="text-gray-700">{googleUser.email}</strong></span>
              ) : (
                <span>{language === 'fi' ? 'Yhdistä kalenteri synkronoidaksesi varaukset automaattisesti.' : 'Connect calendar to sync reservations.'}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {googleUser ? (
            <>
              <button
                type="button"
                onClick={handleSyncBookings}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.syncing}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t.syncBookings}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDisconnectCalendar}
                className="px-2.5 py-1.5 border border-gray-200 hover:bg-gray-100 text-gray-600 text-xs font-mono rounded-lg transition-all"
              >
                {t.disconnectGoogleCalendar}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnectCalendar}
              disabled={isConnecting}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-sans font-semibold rounded-lg shadow-sm bg-white transition-all disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>{isConnecting ? t.syncing : t.connectGoogleCalendar}</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg mb-4 text-xs font-mono ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* 2-Day Data Retention & GDPR Privacy Policy Banner */}
      <div className="mb-6 p-4 rounded-xl border border-amber-200/80 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100/80 text-amber-800 rounded-lg shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-sans font-bold text-xs sm:text-sm text-gray-900">
                {language === 'fi' ? 'Automaattinen tietosuoja (GDPR) • 2 päivän säilytysaika' : 'Automated Privacy (GDPR) • 2-Day Data Retention'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200/60 text-amber-900">
                {t.retentionPolicyBadge}
              </span>
            </div>
            <p className="text-xs text-gray-600 font-sans mt-0.5 leading-relaxed">
              {t.autoPurgeNotice}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePurgeExpired}
          disabled={isPurging}
          className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-900 text-xs font-sans font-bold rounded-lg transition-all shadow-2xs shrink-0 self-start sm:self-center flex items-center gap-1.5 disabled:opacity-50"
          title={t.purgeExpiredNow}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPurging ? 'animate-spin text-amber-700' : 'text-amber-700'}`} />
          <span>{isPurging ? (language === 'fi' ? 'Puhdistetaan...' : 'Purging...') : t.purgeExpiredNow}</span>
        </button>
      </div>

      {/* Search Input for Employees */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'fi' ? 'Hae varauksia varaajan nimellä...' : 'Search bookings by booker name...'}
          className="block w-full pl-10 pr-12 py-2.5 border border-gray-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 rounded-xl bg-white text-gray-800 text-xs font-sans font-medium outline-none transition-all placeholder:text-gray-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] font-sans font-bold text-red-500 hover:text-red-700 transition-colors"
          >
            {language === 'fi' ? 'Tyhjennä' : 'Clear'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-4 font-sans text-sm font-medium border-b-2 transition-all ${
            activeTab === 'all'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          {t.allBookings} ({searchQuery ? `${filteredBookings.length}/${bookings.length}` : activeBookingsCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('byTable')}
          className={`pb-3 px-4 font-sans text-sm font-medium border-b-2 transition-all ${
            activeTab === 'byTable'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          {t.tableBookings}
        </button>
      </div>

      {/* Tab: All Bookings */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Active / Ended Sub-filter pills (Ended bookings disappear from active view immediately!) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setTimeFilter('active')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans font-bold transition-all shrink-0 ${
                timeFilter === 'active'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <span>{t.activeAndUpcoming}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                timeFilter === 'active' ? 'bg-red-700 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {activeBookingsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTimeFilter('past')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans font-bold transition-all shrink-0 ${
                timeFilter === 'past'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <span>{t.endedBookings}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                timeFilter === 'past' ? 'bg-amber-700 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {pastBookingsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans font-bold transition-all shrink-0 ${
                timeFilter === 'all'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <span>{t.allWithArchive}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                timeFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {bookings.length}
              </span>
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-xs font-mono text-gray-400 animate-pulse">
              {language === 'fi' ? 'Ladataan varauksia...' : 'Loading bookings...'}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-100 rounded-xl text-gray-400 font-mono text-xs">
              {searchQuery 
                ? (language === 'fi' ? `Ei hakutuloksia haulla "${searchQuery}"` : `No results for "${searchQuery}"`)
                : (timeFilter === 'active' 
                    ? (language === 'fi' ? 'Ei aktiivisia tai tulevia varauksia. Päättyneet varaukset on poistettu näkymästä.' : 'No active or upcoming bookings. Past bookings are hidden.')
                    : (timeFilter === 'past' 
                        ? (language === 'fi' ? 'Ei päättyneitä varauksia 2 pv arkistossa.' : 'No ended bookings in 2-day archive.') 
                        : t.noBookings))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-gray-200/80 bg-gray-50/70 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3.5 px-4 font-extrabold min-w-[150px]">{t.nameLabel}</th>
                    <th className="py-3.5 px-4 font-extrabold min-w-[140px]">{t.dateLabel} & {t.timeLabel}</th>
                    <th className="py-3.5 px-4 font-extrabold min-w-[110px]">{t.partySizeLabel}</th>
                    <th className="py-3.5 px-4 font-extrabold min-w-[130px]">{t.tableLabel}</th>
                    <th className="py-3.5 px-4 font-extrabold min-w-[180px]">{language === 'fi' ? 'Lisätiedot' : 'Contact & Wishes'}</th>
                    <th className="py-3.5 px-4 text-right font-extrabold min-w-[110px]">{language === 'fi' ? 'Toiminto' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-sans">
                  {filteredBookings.map((booking) => {
                    const status = getStatusInfo(booking);
                    return (
                      <tr key={booking.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-4 px-4 font-sans font-extrabold text-sm text-gray-900 tracking-tight">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {booking.name ? booking.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span className="truncate">{booking.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-sans font-bold text-gray-900">{formatDateStr(booking.date)}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5 font-mono">{booking.time} ({booking.duration || 120} min)</div>
                          {status.isOngoing ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-800 border border-green-200 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                              {t.statusOngoing}
                            </span>
                          ) : status.isPast ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 mt-1" title={`${t.purgeNoticeShort} (${status.hoursUntilPurge}h)`}>
                              <Hourglass className="w-2.5 h-2.5 text-amber-600" />
                              <span>{t.statusEnded} • {status.hoursUntilPurge} {t.hoursRemaining}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 mt-1">
                              <Clock className="w-2.5 h-2.5 text-blue-500" />
                              {t.statusUpcoming}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-bold text-gray-900 font-sans">
                          {booking.partySize} {t.people}
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-red-50 text-red-700 font-sans font-bold px-2.5 py-1 rounded-md text-[11px] border border-red-100/80 inline-block">
                            {language === 'fi' ? booking.tableNameFi : booking.tableNameEn}
                          </span>
                        </td>
                        <td className="py-4 px-4 max-w-xs">
                          {booking.email && <div className="text-gray-600 text-[11px] font-mono">{booking.email}</div>}
                          {booking.phone && <div className="text-gray-600 text-[11px] font-mono">{booking.phone}</div>}
                          {booking.wishes ? (
                            <div className="text-gray-500 text-[11px] italic mt-1 flex items-start gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <span className="truncate max-w-[200px]" title={booking.wishes}>{booking.wishes}</span>
                            </div>
                          ) : null}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {confirmDeleteId === booking.id ? (
                            isDeletingId === booking.id ? (
                              <span className="text-[10px] text-red-500 font-bold flex items-center justify-end gap-1 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>{language === 'fi' ? 'Poistetaan...' : 'Deleting...'}</span>
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1 bg-red-50 border border-red-100 p-1 rounded-lg animate-in fade-in zoom-in-95 duration-100 inline-flex">
                                <button
                                  type="button"
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-sans font-bold text-[10px] rounded shadow-xs"
                                >
                                  {language === 'fi' ? 'Kyllä' : 'Yes'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-sans font-bold text-[10px] rounded"
                                >
                                  {language === 'fi' ? 'Ei' : 'No'}
                                </button>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBooking(booking);
                                  setEditDate(booking.date);
                                  setEditTime(booking.time);
                                  setEditDuration(booking.duration || 120);
                                }}
                                className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors inline-flex"
                                title={language === 'fi' ? 'Muokkaa aikaa / kestoa' : 'Edit time / duration'}
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(booking.id)}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                                title={t.cancelBooking}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Grouped by Table */}
      {activeTab === 'byTable' && (
        <div className="space-y-5">
          {/* Top Section: Date Selector (Valitse päivä) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold shadow-2xs">
                  <Calendar className="w-4.5 h-4.5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-sm text-gray-900">
                    {language === 'fi' ? 'Valitse päivä' : 'Select Date'}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-mono">
                    {formatDateStr(scheduleDate)}
                  </p>
                </div>
              </div>

              {/* Date Picker Input */}
              <div className="relative">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-xl text-xs font-sans font-bold text-gray-800 bg-gray-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all cursor-pointer shadow-2xs"
                />
                <Calendar className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Quick Date Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-gray-100 scrollbar-none">
              <span className="text-[11px] font-sans font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1">
                {language === 'fi' ? 'Pikavalinta:' : 'Quick select:'}
              </span>
              {dateOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setScheduleDate(opt.value)}
                  className={`px-3 py-1.5 text-xs font-sans font-bold rounded-xl border transition-all shrink-0 ${
                    scheduleDate === opt.value
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top Section: Table Selector Controls & Grid Map */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200/80 shadow-2xs space-y-3.5">
            {/* Header + Dropdown & Prev/Next Arrows */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200/60 pb-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <LayoutGrid className="w-4.5 h-4.5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-sm text-gray-900">
                    {language === 'fi' ? 'Valitse tarkasteltava pöytä' : 'Select Table to View'}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-mono">
                    {tables.length} {language === 'fi' ? 'pöytää järjestelmässä' : 'tables in system'}
                  </p>
                </div>
              </div>

              {/* Quick Dropdown Select + Stepper Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevTable}
                  className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-gray-700 transition-colors shadow-2xs shrink-0"
                  title={language === 'fi' ? 'Edellinen pöytä' : 'Previous Table'}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="relative flex-1 min-w-[200px] sm:min-w-[260px]">
                  <select
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-3.5 py-2 pr-9 text-xs font-sans font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-2xs cursor-pointer truncate"
                  >
                    {tables.map((t) => {
                      const count = bookings.filter((b) => {
                        if (b.date !== scheduleDate || !b.tableId) return false;
                        return b.tableId.split(',').map((s) => s.trim()).includes(t.id);
                      }).length;
                      const tableName = language === 'fi' ? t.nameFi : t.nameEn;
                      const statusStr = count > 0 ? `• 🔴 ${count} ${language === 'fi' ? 'varaus(ta)' : 'booking(s)'}` : `• 🟢 ${language === 'fi' ? 'Vapaa' : 'Free'}`;
                      return (
                        <option key={t.id} value={t.id}>
                          {tableName} ({t.capacity}p) {statusStr}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronRight className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
                </div>

                <button
                  type="button"
                  onClick={handleNextTable}
                  className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-gray-700 transition-colors shadow-2xs shrink-0"
                  title={language === 'fi' ? 'Seuraava pöytä' : 'Next Table'}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filters Row: Search input + Status Filter Pills */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Search Table Box */}
              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder={language === 'fi' ? 'Etsi pöytää numerolla/nimellä...' : 'Search table by number/name...'}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-7 py-1.5 text-xs font-sans font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 shadow-2xs"
                />
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {tableSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTableSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setTableFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-bold transition-all shrink-0 ${
                    tableFilter === 'all'
                      ? 'bg-gray-900 text-white shadow-2xs'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {language === 'fi' ? 'Kaikki pöydät' : 'All Tables'} ({tables.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('hasBookings')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-bold transition-all shrink-0 ${
                    tableFilter === 'hasBookings'
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-700'
                  }`}
                >
                  🔴 {language === 'fi' ? 'Varatut pöydät' : 'With Bookings'}
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('free')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-bold transition-all shrink-0 ${
                    tableFilter === 'free'
                      ? 'bg-green-600 text-white shadow-2xs'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  🟢 {language === 'fi' ? 'Vapaat pöydät' : 'Free Tables'}
                </button>
              </div>
            </div>

            {/* Compact Grid Map of Tables */}
            <div className="pt-1">
              {filteredTablesList.length === 0 ? (
                <div className="p-4 bg-white border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-400 font-sans">
                  {language === 'fi' ? 'Ei pöytiä hakuehdoilla.' : 'No tables match search filter.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {filteredTablesList.map((table) => {
                    const isSelected = selectedTableId === table.id;
                    const dateBookingsCount = bookings.filter((b) => {
                      if (b.date !== scheduleDate || !b.tableId) return false;
                      return b.tableId.split(',').map((s) => s.trim()).includes(table.id);
                    }).length;

                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => setSelectedTableId(table.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all duration-150 relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-red-600 to-orange-500 text-white border-red-600 shadow-md ring-2 ring-red-300 scale-[1.02]'
                            : 'bg-white text-gray-800 border-gray-200/90 hover:border-red-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className={`font-sans font-extrabold text-xs sm:text-sm truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                            {language === 'fi' ? table.nameFi : table.nameEn}
                          </span>
                          {dateBookingsCount > 0 ? (
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              isSelected ? 'bg-white text-red-600' : 'bg-red-100 text-red-700'
                            }`}>
                              {dateBookingsCount}
                            </span>
                          ) : (
                            <span className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-md shrink-0 ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-green-50 text-green-700'
                            }`}>
                              {language === 'fi' ? 'Vapaa' : 'Free'}
                            </span>
                          )}
                        </div>

                        <div className={`text-[10px] font-mono flex items-center gap-1 ${isSelected ? 'text-white/90' : 'text-gray-500'}`}>
                          <Users className="w-3 h-3 opacity-70" />
                          <span>{table.capacity} {t.people}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Schedule & Bookings for Selected Table */}
          <div className="space-y-5">
            {/* Table Banner & Date Navigation */}
            {(() => {
              const currentTable = tables.find((t) => t.id === selectedTableId);
              if (!currentTable) return null;

              // Bookings for selected table on scheduleDate
              const selectedDateBookings = bookings.filter((b) => {
                if (b.date !== scheduleDate || !b.tableId) return false;
                return b.tableId.split(',').map((s) => s.trim()).includes(selectedTableId);
              }).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

              return (
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                  {/* Table Title Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-sans font-extrabold text-gray-900 text-base sm:text-lg">
                          {language === 'fi' ? currentTable.nameFi : currentTable.nameEn}
                        </h3>
                        <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-100/80 rounded-md font-mono text-xs font-semibold">
                          👥 {currentTable.capacity} {t.people}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-sans mt-0.5">
                        {language === 'fi' ? currentTable.atmosphereFi : currentTable.atmosphereEn}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 bg-gray-50 border border-gray-200/90 rounded-xl text-xs font-sans font-bold text-gray-800 flex items-center gap-2 shadow-2xs">
                        <Calendar className="w-3.5 h-3.5 text-red-600" />
                        <span>{formatDateStr(scheduleDate)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Section Title: Reservations for Selected Date */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-sans font-bold text-gray-900 text-sm flex items-center gap-2">
                        <span>{language === 'fi' ? `Päivän varaukset (${formatDateStr(scheduleDate)})` : `Reservations (${formatDateStr(scheduleDate)})`}</span>
                        <span className="text-xs font-mono font-normal text-gray-500">
                          ({selectedDateBookings.length} {language === 'fi' ? 'varaus' : 'booking'})
                        </span>
                      </h4>
                    </div>

                    {selectedDateBookings.length === 0 ? (
                      <div className="text-center py-8 px-4 bg-green-50/20 border border-dashed border-green-200/80 rounded-2xl text-green-800 font-sans text-xs space-y-1">
                        <div className="font-bold text-sm text-green-900">
                          🟢 {language === 'fi' ? 'Ei varauksia tälle päivälle – Pöytä on vapaa!' : 'No reservations for this date – Table is free!'}
                        </div>
                        <p className="text-gray-500 font-mono text-[11px]">
                          {language === 'fi' ? 'Kaikki ajat (12:00 – 22:00) ovat vapaana varattavaksi.' : 'All slots (12:00 – 22:00) are available.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDateBookings.map((booking) => {
                          const durationMin = booking.duration || 120;
                          const startMin = timeToMinutes(booking.time);
                          const endMin = startMin + durationMin;
                          const endHours = Math.floor(endMin / 60);
                          const endMins = endMin % 60;
                          const endTimeStr = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;

                          return (
                            <div
                              key={booking.id}
                              className="p-4 bg-white border-l-4 border-l-red-600 border border-gray-200/80 rounded-xl shadow-2xs hover:shadow-md transition-all text-left space-y-3"
                            >
                              {/* Header: Name and Time Badge */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                                <div className="space-y-0.5">
                                  <div className="font-sans font-extrabold text-gray-900 text-base sm:text-lg leading-tight">
                                    {booking.name}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-sans text-gray-600">
                                    <span className="font-bold text-gray-800 flex items-center gap-1">
                                      <Users className="w-3.5 h-3.5 text-gray-500" />
                                      {booking.partySize} {t.people}
                                    </span>
                                    <span>•</span>
                                    <span className="text-gray-500 font-mono">
                                      {language === 'fi' ? booking.tableNameFi : booking.tableNameEn}
                                    </span>
                                  </div>
                                </div>

                                {/* Time Badge & Real-time Status */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
                                  {(() => {
                                    const status = getStatusInfo(booking);
                                    if (status.isOngoing) {
                                      return (
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-800 border border-green-200 flex items-center gap-1.5 shadow-2xs">
                                          <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                                          {t.statusOngoing}
                                        </span>
                                      );
                                    }
                                    if (status.isPast) {
                                      return (
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5 shadow-2xs" title={`${t.purgeNoticeShort} (${status.hoursUntilPurge}h)`}>
                                          <Hourglass className="w-3.5 h-3.5 text-amber-600" />
                                          <span>{t.statusEnded}</span>
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                  <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-200/80 rounded-lg font-mono font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs">
                                    <Clock className="w-4 h-4 text-red-600" />
                                    <span>{booking.time} – {endTimeStr}</span>
                                    <span className="text-[10px] font-sans font-normal opacity-80">({durationMin / 60}h)</span>
                                  </span>
                                </div>
                              </div>

                              {/* Details: Contact & Wishes */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans text-gray-600">
                                <div className="space-y-1">
                                  {booking.phone && (
                                    <div className="flex items-center gap-1.5 font-mono text-gray-700 font-medium">
                                      <span className="text-gray-400">📞</span>
                                      <span>{booking.phone}</span>
                                    </div>
                                  )}
                                  {booking.email && (
                                    <div className="flex items-center gap-1.5 font-mono text-gray-500">
                                      <span className="text-gray-400">✉️</span>
                                      <span>{booking.email}</span>
                                    </div>
                                  )}
                                  {booking.wishes && (
                                    <div className="mt-2 p-2 bg-amber-50/80 border border-amber-200/60 rounded-lg text-amber-900 text-xs italic flex items-start gap-1.5">
                                      <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                      <span>"{booking.wishes}"</span>
                                    </div>
                                  )}
                                </div>

                                {/* Quick Actions */}
                                <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 justify-end shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingBooking(booking);
                                      setEditDate(booking.date);
                                      setEditTime(booking.time);
                                      setEditDuration(booking.duration || 120);
                                    }}
                                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-800 text-xs font-sans font-bold rounded-lg transition-colors flex items-center gap-1.5"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>{language === 'fi' ? 'Muokkaa aikaa' : 'Edit time'}</span>
                                  </button>

                                  {confirmDeleteId === booking.id ? (
                                    isDeletingId === booking.id ? (
                                      <span className="text-xs text-red-500 font-bold flex items-center gap-1 animate-pulse px-2">
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        <span>{language === 'fi' ? 'Poistetaan...' : 'Deleting...'}</span>
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-1 bg-red-600 p-1 rounded-lg shadow-xs animate-in zoom-in-95 duration-100">
                                        <button
                                          type="button"
                                          onClick={() => handleCancelBooking(booking.id)}
                                          className="px-2 py-0.5 text-white font-sans font-extrabold text-xs hover:underline"
                                        >
                                          {language === 'fi' ? 'Kyllä' : 'Yes'}
                                        </button>
                                        <span className="text-white/40 text-xs">|</span>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteId(null)}
                                          className="px-2 py-0.5 text-white/80 hover:text-white font-sans font-extrabold text-xs"
                                        >
                                          {language === 'fi' ? 'Ei' : 'No'}
                                        </button>
                                      </div>
                                    )
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(booking.id)}
                                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                      title={t.cancelBooking}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Hourly Timeline Matrix */}
                  <div className="pt-4 border-t border-gray-100">
                    <h5 className="font-sans font-bold text-gray-800 text-xs uppercase tracking-wider mb-3">
                      {language === 'fi' ? 'Päivän aikataulukko (12:00 – 22:00)' : 'Hourly Schedule Matrix'}
                    </h5>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {TIME_SLOTS.map((slot) => {
                        const booking = bookings.find((b) => {
                          if (b.date !== scheduleDate || !b.tableId) return false;
                          const hasTable = b.tableId.split(',').map(s => s.trim()).includes(selectedTableId);
                          if (!hasTable) return false;
                          
                          const bStart = timeToMinutes(b.time);
                          const bDuration = b.duration || 120;
                          const slotStart = timeToMinutes(slot);
                          return slotStart >= bStart && slotStart < bStart + bDuration;
                        });

                        return (
                          <div
                            key={slot}
                            className={`p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-1.5 ${
                              booking
                                ? 'bg-red-50/90 border-red-200 shadow-2xs'
                                : 'bg-gray-50/60 border-gray-200/70 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-gray-900">{slot}</span>
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                booking ? 'bg-red-600 text-white' : 'bg-green-100 text-green-800'
                              }`}>
                                {booking ? (language === 'fi' ? 'Varattu' : 'Booked') : (language === 'fi' ? 'Vapaa' : 'Free')}
                              </span>
                            </div>

                            {booking ? (
                              <div className="mt-1 pt-1 border-t border-red-200/80">
                                <div className="font-sans font-bold text-xs text-gray-900 truncate" title={booking.name}>
                                  {booking.name}
                                </div>
                                <div className="text-[10px] font-mono text-gray-600 flex items-center justify-between mt-0.5">
                                  <span>{booking.partySize} {language === 'fi' ? 'hlö' : 'pers.'}</span>
                                  <span className="text-[9px] text-red-700 font-semibold">{booking.time}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] font-sans text-gray-400 italic mt-1">
                                {language === 'fi' ? 'Aika vapaana' : 'Available'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h3 className="font-sans font-bold text-gray-900 text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-600 animate-pulse" />
                <span>{language === 'fi' ? 'Muokkaa varausaikaa' : 'Modify Reservation Time'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors font-sans text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {/* Booking info card */}
              <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100 font-sans text-xs text-gray-600 space-y-1">
                <div>
                  {language === 'fi' ? 'Asiakas' : 'Customer'}: <strong className="text-gray-900 font-semibold">{editingBooking.name}</strong>
                </div>
                <div>
                  {language === 'fi' ? 'Pöytä' : 'Table'}: <strong className="text-gray-900 font-semibold">{language === 'fi' ? editingBooking.tableNameFi : editingBooking.tableNameEn}</strong>
                </div>
                <div>
                  {language === 'fi' ? 'Seurueen koko' : 'Party Size'}: <strong className="text-gray-900 font-semibold">{editingBooking.partySize} {t.people}</strong>
                </div>
              </div>

              {/* Edit Date */}
              <div>
                <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">
                  {language === 'fi' ? 'Päivämäärä' : 'Date'}
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full text-sm font-sans px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400"
                />
              </div>

              {/* Edit Time and Duration Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'fi' ? 'Kellonaika' : 'Time'}
                  </label>
                  <select
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full text-sm font-sans px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 bg-white"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'fi' ? 'Kesto' : 'Duration'}
                  </label>
                  <select
                    value={editDuration}
                    onChange={(e) => setEditDuration(parseInt(e.target.value, 10))}
                    className="w-full text-sm font-sans px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 bg-white font-semibold text-gray-800"
                  >
                    <option value={90}>1.5 h (90 min)</option>
                    <option value={120}>2.0 h (120 min)</option>
                    <option value={150}>2.5 h (150 min)</option>
                    <option value={180}>3.0 h (180 min)</option>
                    <option value={240}>4.0 h (240 min)</option>
                  </select>
                </div>
              </div>

              {/* Quick adjustments */}
              <div>
                <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                  {language === 'fi' ? 'Pikasäädöt' : 'Quick Adjustments'}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Shift time forward by 30 mins
                      const currentMin = timeToMinutes(editTime);
                      const nextMin = currentMin + 30;
                      const nextHours = Math.floor(nextMin / 60);
                      const nextMins = nextMin % 60;
                      const nextTimeStr = `${nextHours.toString().padStart(2, '0')}:${nextMins.toString().padStart(2, '0')}`;
                      if (TIME_SLOTS.includes(nextTimeStr)) {
                        setEditTime(nextTimeStr);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 text-[11px] font-medium font-sans rounded-lg transition-colors"
                  >
                    {language === 'fi' ? 'Siirrä +30 min' : 'Delay +30 min'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDuration((prev) => prev + 30)}
                    className="px-2.5 py-1.5 bg-red-50 border border-red-100 hover:bg-red-100/50 text-red-700 text-[11px] font-medium font-sans rounded-lg transition-colors"
                  >
                    {language === 'fi' ? 'Pidennä +30 min' : 'Extend +30 min'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDuration((prev) => prev + 60)}
                    className="px-2.5 py-1.5 bg-red-50 border border-red-100 hover:bg-red-100/50 text-red-700 text-[11px] font-medium font-sans rounded-lg transition-colors"
                  >
                    {language === 'fi' ? 'Pidennä +60 min' : 'Extend +60 min'}
                  </button>
                </div>
              </div>

              {/* Conflict Notice & Double-Booking Protection */}
              {(() => {
                const isConflicting = checkConflict(editingBooking.tableId, editDate, editTime, editDuration, editingBooking.id);
                if (isConflicting) {
                  return (
                    <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl font-sans space-y-2.5">
                      <div className="flex items-center gap-2 font-bold text-red-700">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 animate-bounce" />
                        <span>{language === 'fi' ? 'PÄÄLLEKKÄINEN VARAUS (ESTE DETEKTOITU)!' : 'OVERLAPPING BOOKING DETECTED!'}</span>
                      </div>
                      <p className="text-gray-700 text-[11px] leading-relaxed">
                        {language === 'fi' 
                          ? 'Tämä pöytä on jo varattu toiselle asiakkaalle kyseisenä ajankohtana. Vahinkojen ja tuplavarauksien estämiseksi tallennus on lukittu.' 
                          : 'This table is already booked for another customer at this time. Save is disabled to prevent accidental double bookings.'}
                      </p>
                      <label className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-gray-800 cursor-pointer border-t border-red-200/80">
                        <input
                          type="checkbox"
                          checked={overrideConflict}
                          onChange={(e) => setOverrideConflict(e.target.checked)}
                          className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                        />
                        <span>{language === 'fi' ? 'Salli päällekkäinen varaus silti (Ohita este)' : 'Allow overlapping reservation anyway'}</span>
                      </label>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBooking(null);
                    setOverrideConflict(false);
                  }}
                  className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-sans font-semibold rounded-xl transition-all"
                >
                  {language === 'fi' ? 'Peruuta' : 'Cancel'}
                </button>
                {(() => {
                  const isConflicting = checkConflict(editingBooking.tableId, editDate, editTime, editDuration, editingBooking.id);
                  const isBlocked = isConflicting && !overrideConflict;

                  return (
                    <button
                      type="button"
                      disabled={isSavingEdit || isBlocked}
                      onClick={handleUpdateBookingTime}
                      className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-sans font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-1"
                      title={isBlocked ? (language === 'fi' ? 'Valitse ohitus ruksittamalla laatikko yllä' : 'Check override box to unlock save') : ''}
                    >
                      {isSavingEdit ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{language === 'fi' ? 'Tallennetaan...' : 'Saving...'}</span>
                        </>
                      ) : (
                        <span>{language === 'fi' ? 'Tallenna' : 'Save'}</span>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
