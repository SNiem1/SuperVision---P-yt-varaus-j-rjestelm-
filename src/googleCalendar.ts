import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Booking } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Calendar scopes
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on dashboard load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Convert booking ID to a safe Google Calendar Event ID (base32hex lowercase matching a-v and 0-9)
export const getEventId = (bookingId: string) => {
  const clean = bookingId.toLowerCase().replace(/[^a-v0-9]/g, 'x');
  return `kulinaria${clean}`.substring(0, 100);
};

// Cache to map tableId (e.g. "T1") to Google Calendar ID (string)
let calendarCache: { [tableId: string]: string } = {};

// Helper to get the numerical value from a table ID (e.g., "T4" -> 4)
const getTableNumber = (tableId: string): number => {
  return parseInt(tableId.replace(/[^0-9]/g, ''), 10) || 1;
};

// Get a Google Calendar color ID from 1 to 24 corresponding to the table
const getTableColorId = (tableId: string): string => {
  const num = getTableNumber(tableId);
  // Google CalendarList entry supports color IDs "1" to "24"
  return (((num - 1) % 24) + 1).toString();
};

// Create a new calendar for a specific table and set its color
const createTableCalendar = async (tableId: string, token: string, language: 'fi' | 'en'): Promise<string> => {
  const num = getTableNumber(tableId);
  const summary = language === 'fi' ? `Kulinaria - Pöytä ${num}` : `Kulinaria - Table ${num}`;

  // 1. Create the secondary calendar
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ summary })
  });

  if (!res.ok) {
    throw new Error(`Failed to create calendar for table ${tableId}`);
  }

  const data = await res.json();
  const calendarId = data.id;

  // 2. Set the custom color for the calendar on the user's calendar list
  try {
    const colorId = getTableColorId(tableId);
    await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList/${calendarId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ colorId })
    });
  } catch (err) {
    console.error(`Error setting color for calendar ${calendarId}:`, err);
  }

  return calendarId;
};

// Retrieve or create a calendar ID for a given tableId
export const getOrCreateCalendarForTable = async (
  tableId: string,
  token: string,
  language: 'fi' | 'en'
): Promise<string> => {
  if (calendarCache[tableId]) {
    return calendarCache[tableId];
  }

  try {
    // Fetch the list of calendars from Google
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];

      // Populate calendar cache with any matching calendars
      for (const item of items) {
        const summary = item.summary || '';
        if (summary.startsWith('Kulinaria - Pöytä ') || summary.startsWith('Kulinaria - Table ')) {
          const match = summary.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            calendarCache[`T${num}`] = item.id;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching calendar list:', err);
  }

  // If now cached, return it
  if (calendarCache[tableId]) {
    return calendarCache[tableId];
  }

  // Not found, create it!
  try {
    const calendarId = await createTableCalendar(tableId, token, language);
    calendarCache[tableId] = calendarId;
    return calendarId;
  } catch (err) {
    console.error(`Error during calendar creation for ${tableId}:`, err);
    return 'primary'; // Fallback to primary if fails
  }
};

// Sync a single booking to its dedicated Google Calendar
export const syncSingleBooking = async (booking: Booking, token: string, language: 'fi' | 'en'): Promise<boolean> => {
  const eventId = getEventId(booking.id);
  const startLocal = `${booking.date}T${booking.time}:00`;
  const startDate = new Date(startLocal);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Helsinki';

  const summary = language === 'fi' 
    ? `Varaus: ${booking.name} (${booking.partySize} hlö)` 
    : `Reservation: ${booking.name} (${booking.partySize} guests)`;

  const description = language === 'fi'
    ? `Pöytä: ${booking.tableNameFi}
Henkilömäärä: ${booking.partySize} hlö
Asiakas: ${booking.name}
Sähköposti: ${booking.email || '-'}
Puhelin: ${booking.phone || '-'}
Erityistoiveet: ${booking.wishes || '-'}

Päivitetty automaattisesti Kulinaria-varausjärjestelmästä.`
    : `Table: ${booking.tableNameEn}
Party size: ${booking.partySize} guests
Customer name: ${booking.name}
Email: ${booking.email || '-'}
Phone: ${booking.phone || '-'}
Special wishes: ${booking.wishes || '-'}

Automatically updated from Kulinaria Booking System.`;

  const eventBody = {
    id: eventId,
    summary,
    description,
    start: {
      dateTime: startDate.toISOString(),
      timeZone
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone
    }
  };

  try {
    // 1. Find or create the table-specific calendar
    const calendarId = await getOrCreateCalendarForTable(booking.tableId, token, language);

    // 2. Attempt POST to create
    let res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventBody)
    });

    if (res.status === 409) {
      // Event already exists, use PUT to update
      res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventBody)
      });
    }

    return res.ok;
  } catch (err) {
    console.error(`Error syncing booking ${booking.id}:`, err);
    return false;
  }
};

// Sync multiple bookings to Google Calendar
export const syncBookingsToCalendar = async (
  bookings: Booking[],
  token: string,
  language: 'fi' | 'en'
): Promise<{ success: number; failed: number }> => {
  let successCount = 0;
  let failedCount = 0;

  // Let's pre-load/fetch the calendar list to fill cache and make the loops faster
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];
      for (const item of items) {
        const summary = item.summary || '';
        if (summary.startsWith('Kulinaria - Pöytä ') || summary.startsWith('Kulinaria - Table ')) {
          const match = summary.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            calendarCache[`T${num}`] = item.id;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error pre-fetching calendar list:', err);
  }

  for (const booking of bookings) {
    const ok = await syncSingleBooking(booking, token, language);
    if (ok) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  return { success: successCount, failed: failedCount };
};

// Delete a booking from Google Calendar
export const deleteCalendarEvent = async (
  bookingId: string,
  tableId: string,
  token: string,
  language: 'fi' | 'en'
): Promise<boolean> => {
  const eventId = getEventId(bookingId);
  try {
    const calendarId = await getOrCreateCalendarForTable(tableId, token, language);
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return res.ok || res.status === 404; // 404 means already deleted
  } catch (err) {
    console.error(`Error deleting event ${eventId} from calendar ${tableId}:`, err);
    return false;
  }
};
