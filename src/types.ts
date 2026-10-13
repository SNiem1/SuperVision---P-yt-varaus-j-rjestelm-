export interface Table {
  id: string;
  nameFi: string;
  nameEn: string;
  capacity: number;
  atmosphereFi: string;
  atmosphereEn: string;
  descriptionFi: string;
  descriptionEn: string;
  matterportLink?: string;
}

export interface Booking {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  tableId: string;
  tableNameFi: string;
  tableNameEn: string;
  wishes?: string;
  createdAt: string;
  duration?: number; // duration in minutes (e.g., 90 or 120)
  isPast?: boolean;
  isOngoing?: boolean;
  expiresAt?: string;
  hoursUntilPurge?: number;
}

export type Language = 'fi' | 'en';

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  status: 'available' | 'full'; // 'available' = green, 'full' = red
  freeSlotsCount: number;
}

export interface TimeSlot {
  time: string; // HH:MM
  available: boolean;
  assignedTableId?: string;
  duration?: number; // duration in minutes
}
