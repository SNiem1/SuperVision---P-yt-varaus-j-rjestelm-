import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';

const app = express();
const PORT = 3000;

app.use(express.json());

// Transporter cache
let transporterCache: any = null;

// Get SMTP Transporter (real or test Ethereal fallback)
async function getTransporter() {
  if (transporterCache) return transporterCache;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    console.log('Using configured SMTP transporter:', host);
    transporterCache = nodemailer.createTransport({
      host,
      port: port ? parseInt(port, 10) : 587,
      secure: port === '465',
      auth: {
        user,
        pass,
      },
    });
  } else {
    console.log('No SMTP configuration found. Creating an ephemeral Ethereal SMTP test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log('Created Ethereal SMTP test account user:', testAccount.user);
      transporterCache = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      console.error('Failed to create Ethereal SMTP test account', err);
      // Fallback: dummy transporter
      transporterCache = {
        sendMail: async (mailOptions: any) => {
          console.log('Dummy SMTP sendMail called with:', mailOptions.to);
          return { messageId: 'dummy-message-id' };
        }
      };
    }
  }
  return transporterCache;
}

// Send booking confirmation email
async function sendBookingConfirmation(booking: Booking): Promise<string | null> {
  if (!booking.email) {
    console.log('No email address provided for booking:', booking.id);
    return null;
  }

  try {
    const mailTransporter = await getTransporter();
    const fromAddress = process.env.SMTP_FROM || '"Kulinaria Restaurant" <no-reply@kulinaria-booking.com>';
    
    const subject = `Varausvahvistus / Booking Confirmation - ${booking.name}`;
    
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #f3f4f6; border-radius: 12px; background-color: #ffffff; color: #1f2937; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #ef4444; padding-bottom: 16px;">
          <h1 style="color: #ef4444; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">VARAUSVAHVISTUS</h1>
          <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">Kulinaria Table Booking</p>
        </div>
        
        <div style="margin-bottom: 24px;">
          <p style="font-size: 15px; line-height: 1.5; margin: 0 0 12px 0;">Hei <strong>${booking.name}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px 0;">Pöytävarauksesi on vastaanotettu ja vahvistettu! Alla on yhteenveto varauksen tiedoista:</p>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: -12px 0 24px 0; font-style: italic;">Your table booking has been received and confirmed! Below is a summary of your booking details:</p>
        </div>

        <div style="background-color: #fafafa; border: 1px solid #eaeaea; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #666666; font-weight: 600; width: 150px; border-bottom: 1px solid #f3f4f6;">Päivämäärä / Date:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 700; border-bottom: 1px solid #f3f4f6;">${booking.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666666; font-weight: 600; border-bottom: 1px solid #f3f4f6;">Aika / Time:</td>
              <td style="padding: 8px 0; color: #ef4444; font-weight: 700; border-bottom: 1px solid #f3f4f6;">${booking.time ? `${booking.time}` : 'Vapaa selaus / Free browse'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666666; font-weight: 600; border-bottom: 1px solid #f3f4f6;">Henkilömäärä / Party:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 700; border-bottom: 1px solid #f3f4f6;">${booking.partySize} ${booking.partySize === 1 ? 'henkilö / person' : 'henkilöä / people'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666666; font-weight: 600; border-bottom: 1px solid #f3f4f6;">Pöytä / Table:</td>
              <td style="padding: 8px 0; color: #ef4444; font-weight: 700; border-bottom: 1px solid #f3f4f6;">${booking.tableNameFi}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666666; font-weight: 600; border-bottom: 1px solid #f3f4f6;">Puhelin / Phone:</td>
              <td style="padding: 8px 0; color: #111827; border-bottom: 1px solid #f3f4f6;">${booking.phone || '-'}</td>
            </tr>
            ${booking.wishes ? `
            <tr>
              <td style="padding: 8px 0; color: #666666; font-weight: 600; vertical-align: top;">Erityistoiveet / Wishes:</td>
              <td style="padding: 8px 0; color: #111827; font-style: italic; white-space: pre-wrap;">${booking.wishes}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; font-size: 11px; color: #9ca3af; text-align: center;">
          <p style="margin: 0 0 4px 0;">Tämä on automaattinen vahvistus. Älä vastaa tähän viestiin.</p>
          <p style="margin: 0;">This is an automated confirmation. Please do not reply to this email.</p>
        </div>
      </div>
    `;

    const textContent = `
VARAUSVAHVISTUS / BOOKING CONFIRMATION
====================================

Hei ${booking.name},

Pöytävarauksesi on vastaanotettu ja vahvistettu! Alla on yhteenveto varauksen tiedoista:
Your table booking has been received and confirmed! Below is a summary of your booking details:

Päivämäärä / Date: ${booking.date}
Aika / Time: ${booking.time ? `${booking.time}` : 'Vapaa selaus / Free browse'}
Henkilömäärä / Party: ${booking.partySize} henkilöä / people
Pöytä / Table: ${booking.tableNameFi} (${booking.tableNameEn})
Puhelin / Phone: ${booking.phone || '-'}
Erityistoiveet / Wishes: ${booking.wishes || '-'}

Ystävällisin terveisin / Best regards,
Kulinaria Ravintolatiimi / Kulinaria Restaurant Team
    `;

    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: booking.email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log('Confirmation email sent successfully, messageId: %s', info.messageId);
    
    // Check for Ethereal test email preview link
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('Ethereal email preview link: %s', previewUrl);
      return previewUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to send booking confirmation email:', error);
    return null;
  }
}

// Table definitions
interface Table {
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

interface Booking {
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
}

const TABLES: Table[] = [
  {
    id: 'T1',
    nameFi: 'Pöytä 1 (Suuri seuruepöytä)',
    nameEn: 'Table 1 (Large Group Table)',
    capacity: 8,
    atmosphereFi: 'Upea, tilava ja viihtyisä kahdeksan hengen pöytä alakerrassa.',
    atmosphereEn: 'Beautiful, spacious, and comfortable table for eight people downstairs.',
    descriptionFi: 'Erinomainen valinta suuremmalle seurueelle tai juhla-illalliselle.',
    descriptionEn: 'An excellent choice for a larger party or celebratory dinner.',
    matterportLink: 'https://my.matterport.com/show/?m=ivxGArkqDsu&play=1&ss=1&sr=-2.82,.77'
  },
  {
    id: 'T2',
    nameFi: 'Pöytä 2 (Alakerran looshi)',
    nameEn: 'Table 2 (Downstairs Booth)',
    capacity: 4,
    atmosphereFi: 'Valoisa ja mukava neljän hengen loossipöytä ravintolan sydämessä alakerrassa.',
    atmosphereEn: 'Bright and comfortable booth for four in the heart of the restaurant downstairs.',
    descriptionFi: 'Miellyttävät istuimet ja rento ravintolatunnelma seurueellesi.',
    descriptionEn: 'Comfortable seating and a relaxed atmosphere for your group.',
    matterportLink: 'https://my.matterport.com/show/?m=ivxGArkqDsu&play=1&ss=5&sr=-2.46,-.11'
  },
  {
    id: 'T3',
    nameFi: 'Pöytä 3 (Ikkunapöytä)',
    nameEn: 'Table 3 (Window Table)',
    capacity: 4,
    atmosphereFi: 'Viihtyisä neljän hengen ikkunapöytä kauniilla katu- ja puistonäkymällä.',
    atmosphereEn: 'Cozy four-person table by the window overlooking the scenic view.',
    descriptionFi: 'Pehmeää luonnonvaloa ja rauhallinen sijainti alakerrassa ikkunan äärellä.',
    descriptionEn: 'Soft natural light and a peaceful location downstairs by the window.',
    matterportLink: 'https://my.matterport.com/show/?m=ivxGArkqDsu&play=1&ss=4&sr=-1.32,1.16'
  },
  {
    id: 'T4',
    nameFi: 'Pöytä 4 (Romanttinen 2h looshi)',
    nameEn: 'Table 4 (Romantic Booth for 2)',
    capacity: 2,
    atmosphereFi: 'Intiimi ja tunnelmallinen kahden hengen loossi kynttilänvalossa.',
    atmosphereEn: 'Intimate and cozy booth for two with soft candlelight.',
    descriptionFi: 'Täydellinen valinta romanttiselle illalliselle tai treffeille.',
    descriptionEn: 'Perfect choice for a romantic dinner or date night.'
  },
  {
    id: 'T5',
    nameFi: 'Pöytä 5 (Marmori-ikkunapöytä)',
    nameEn: 'Table 5 (Marble Window Table)',
    capacity: 2,
    atmosphereFi: 'Aito marmoripintainen 2 hengen ikkunapöytä valoisassa nurkkauksessa.',
    atmosphereEn: 'Genuine marble top 2-person window table in a bright corner.',
    descriptionFi: 'Suosittu paikka kahden keskeiselle lounaalle ja illalliselle ikkunan vieressä.',
    descriptionEn: 'Popular spot for a two-person lunch or dinner by the window.'
  },
  {
    id: 'T6',
    nameFi: 'Pöytä 6 (Baarin VIP-pöytä)',
    nameEn: 'Table 6 (Bar VIP Table)',
    capacity: 4,
    atmosphereFi: 'Sykkeessä baarimestarin ja cocktailloungen lähellä.',
    atmosphereEn: 'In the vibe near the master bartender and cocktail lounge.',
    descriptionFi: 'Erinomainen aperitiiveista ja iloisesta ravintolatunnelmasta nauttiville.',
    descriptionEn: 'Great for guests who enjoy aperitifs and vibrant restaurant energy.'
  },
  {
    id: 'T7',
    nameFi: 'Pöytä 7 (Pääsalongin keskipöytä)',
    nameEn: 'Table 7 (Main Salon Central Table)',
    capacity: 6,
    atmosphereFi: 'Tyylikäs kuuden hengen pöytä avarassa ja klassisessa pääsalongissa.',
    atmosphereEn: 'Elegant six-person table in the open and classic main salon.',
    descriptionFi: 'Perheille ja ystäväporukoille suunniteltu tilava illallispöytä.',
    descriptionEn: 'Spacious dining table designed for families and friend groups.'
  },
  {
    id: 'T8',
    nameFi: 'Pöytä 8 (Viinikellarin kulmalooshi)',
    nameEn: 'Table 8 (Wine Cellar Corner Booth)',
    capacity: 4,
    atmosphereFi: 'Holvitiiliseinäinen kulmalooshi viinitelineiden katveessa.',
    atmosphereEn: 'Vaulted brick-wall corner booth nestled among wine racks.',
    descriptionFi: 'Ihanan suojainen ilmapiiri ja laadukas sommelier-kokemus.',
    descriptionEn: 'Wonderfully sheltered atmosphere and premium sommelier experience.'
  },
  {
    id: 'T9',
    nameFi: 'Pöytä 9 (Yläkerran parvekepöytä)',
    nameEn: 'Table 9 (Upstairs Balcony Table)',
    capacity: 2,
    atmosphereFi: 'Aitiopaikka yläkerran parvekkeella, josta näkymä alas saliin.',
    atmosphereEn: 'Front-row seat on the upstairs balcony overlooking the main hall.',
    descriptionFi: 'Uniikki korkea näköala ja erittäin rauhallinen oma rauha.',
    descriptionEn: 'Unique elevated view and exceptional peace and privacy.'
  },
  {
    id: 'T10',
    nameFi: 'Pöytä 10 (Juhla- ja kokouskabinetti)',
    nameEn: 'Table 10 (Gala & Private Cabinet)',
    capacity: 12,
    atmosphereFi: 'Ravintolan suurin edustuspöytä omassa ilmastoidussa kabinetissaan.',
    atmosphereEn: 'The restaurant’s largest executive table in a private cabinet.',
    descriptionFi: 'Täydellinen perhejuhlille, yritysillallisille ja kabinettikokouksille.',
    descriptionEn: 'Perfect for family celebrations, corporate dinners, and cabinet meetings.'
  },
  {
    id: 'T11',
    nameFi: 'Pöytä 11 (Katuikkunalooshi)',
    nameEn: 'Table 11 (Street Window Booth)',
    capacity: 4,
    atmosphereFi: 'Pehmustettu neljän hengen looshi suoraan puistokadulle päin.',
    atmosphereEn: 'Padded four-person booth facing directly onto the boulevard.',
    descriptionFi: 'Yhdistää looshin mukavuuden ja ikkunapöydän kauniit näkymät.',
    descriptionEn: 'Combines booth comfort with scenic window views.'
  },
  {
    id: 'T12',
    nameFi: 'Pöytä 12 (Pääsalongin kulmapöytä)',
    nameEn: 'Table 12 (Main Salon Corner Table)',
    capacity: 2,
    atmosphereFi: 'Huomaamaton ja hiljainen kahden hengen pöytä pääsalin nurkassa.',
    atmosphereEn: 'Discreet and quiet two-person table in the corner of the main hall.',
    descriptionFi: 'Sopii erityisesti liikelounaille tai keskittymistä vaativille keskusteluille.',
    descriptionEn: 'Especially suited for business lunches or focused conversations.'
  },
  {
    id: 'T13',
    nameFi: 'Pöytä 13 (Aatelin pyöreä pöytä)',
    nameEn: 'Table 13 (Round Baron Table)',
    capacity: 5,
    atmosphereFi: 'Jalo viiden hengen pyöreä pöytä, jossa kaikilla on yhtäläinen kontakti.',
    atmosphereEn: 'Noble five-person round table offering easy conversation for all guests.',
    descriptionFi: 'Suosittu pöytämuoto rennoille ja seurallisille illallisryhmille.',
    descriptionEn: 'Popular table shape for relaxed and sociable dining groups.'
  },
  {
    id: 'T14',
    nameFi: 'Pöytä 14 (Kirjastonurkkaus)',
    nameEn: 'Table 14 (Library Nook)',
    capacity: 4,
    atmosphereFi: 'Antiikkisten kirjahyllyjen ja pehmeän valaistuksen ympäröimä pöytä.',
    atmosphereEn: 'Table surrounded by antique bookshelves and warm ambient lighting.',
    descriptionFi: 'Lämmin puutunnelma ja rauhallinen akustiikka nautiskeluun.',
    descriptionEn: 'Warm wooden ambiance and quiet acoustics for relaxed enjoyment.'
  },
  {
    id: 'T15',
    nameFi: 'Pöytä 15 (Chef’s Table Avokeittiö)',
    nameEn: 'Table 15 (Chef’s Table Open Kitchen)',
    capacity: 6,
    atmosphereFi: 'Keittiömestarin erikoispöytä suoralla näkymällä avokeittiön työskentelyyn.',
    atmosphereEn: 'Executive chef’s special table with direct views into the open kitchen.',
    descriptionFi: 'Aito kulinaarinen elämys ruoanvalmistuksen ja makuartitistien keskellä.',
    descriptionEn: 'A true culinary experience amidst live food preparation and artistry.'
  },
  {
    id: 'T16',
    nameFi: 'Pöytä 16 (Lounge-sohvalooshi)',
    nameEn: 'Table 16 (Lounge Sofa Booth)',
    capacity: 4,
    atmosphereFi: 'Pehmeillä nahkasohvilla varustettu laadukas loossipöytä.',
    atmosphereEn: 'Premium booth table equipped with plush leather lounge sofas.',
    descriptionFi: 'Rentoa ja korkeatasoista iltapalaseuraa varten loungen rauhassa.',
    descriptionEn: 'Designed for relaxed high-end dining in the quiet lounge area.'
  },
  {
    id: 'T17',
    nameFi: 'Pöytä 17 (Lasiterassin ikkunapöytä)',
    nameEn: 'Table 17 (Glass Veranda Window Table)',
    capacity: 2,
    atmosphereFi: 'Katetun ja lämmitetyn lasiterassin romanttinen 2h ikkunapöytä.',
    atmosphereEn: 'Romantic 2-person window table on the covered, heated glass veranda.',
    descriptionFi: 'Säänkestävä ja elämyksellinen paikka puutarhanäkymin.',
    descriptionEn: 'All-weather experiential spot with garden views.'
  },
  {
    id: 'T18',
    nameFi: 'Pöytä 18 (Parvisalongin kulmapöytä)',
    nameEn: 'Table 18 (Mezzanine Corner Table)',
    capacity: 2,
    atmosphereFi: 'Parven rauhallisin 2 hengen kulmapöytä hämärässä iltavalossa.',
    atmosphereEn: 'The quietest 2-person corner table on the mezzanine in soft evening light.',
    descriptionFi: 'Omistettu rauhaa ja hiljaisuutta arvostaville asiakkaille.',
    descriptionEn: 'Dedicated to guests who appreciate tranquility and quiet.'
  },
  {
    id: 'T19',
    nameFi: 'Pöytä 19 (Puistonäkymän looshi)',
    nameEn: 'Table 19 (Parkview Booth)',
    capacity: 6,
    atmosphereFi: 'Suuri kuuden hengen ikkuna- ja loossipöytä puiston suuntaan.',
    atmosphereEn: 'Large six-person window booth looking toward the park.',
    descriptionFi: 'Avara, valoisa ja erittäin mukava loossi isolle perheelle.',
    descriptionEn: 'Spacious, bright, and highly comfortable booth for large families.'
  },
  {
    id: 'T20',
    nameFi: 'Pöytä 20 (Takkatulen hirsipöytä)',
    nameEn: 'Table 20 (Fireplace Hearth Table)',
    capacity: 8,
    atmosphereFi: 'Aidon avotakan loimussa sijaitseva lämminhenkinen hirsipöytä.',
    atmosphereEn: 'Heartwarming timber table situated by the glow of an open fireplace.',
    descriptionFi: 'Lämmin ja mieleenpainuva ilmapiiri syys- ja talvi-iltojen illallisille.',
    descriptionEn: 'Warm and memorable atmosphere for autumn and winter evening dinners.'
  }
];

const TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00'
];

function timeToMinutes(t: string): number {
  const [hours, minutes] = t.split(':').map((s) => parseInt(s, 10));
  return hours * 60 + minutes;
}

function timesOverlap(time1: string, time2: string): boolean {
  const t1 = timeToMinutes(time1);
  const t2 = timeToMinutes(time2);
  return t1 < t2 + 120 && t2 < t1 + 120;
}

const BOOKINGS_FILE = path.join(process.cwd(), 'bookings.json');

// 2 days (48 hours) data retention limit in milliseconds
const RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

function getBookingStartTimestamp(booking: Booking): number {
  try {
    const [year, month, day] = booking.date.split('-').map((s) => parseInt(s, 10));
    const [hours, minutes] = (booking.time || '00:00').split(':').map((s) => parseInt(s, 10));
    return new Date(year, month - 1, day, hours, minutes).getTime();
  } catch {
    return Date.now();
  }
}

function getBookingEndTimestamp(booking: Booking): number {
  try {
    const startMs = getBookingStartTimestamp(booking);
    const durationMs = (booking.duration || 120) * 60 * 1000;
    return startMs + durationMs;
  } catch {
    return Date.now();
  }
}

// Purge all customer and booking records older than 2 days (48 hours after end time)
function purgeExpiredBookings(bookings: Booking[]): { active: Booking[]; purgedCount: number } {
  const now = Date.now();
  let purgedCount = 0;

  const active = bookings.filter((booking) => {
    const endMs = getBookingEndTimestamp(booking);
    // If more than 2 days (48 hours) have elapsed since the booking ended, permanently delete
    if (now > endMs + RETENTION_MS) {
      purgedCount++;
      return false; // delete customer data & booking completely from database
    }
    return true;
  });

  return { active, purgedCount };
}

// Helper to load bookings with automated 2-day retention purge
function loadBookings(): Booking[] {
  try {
    if (fs.existsSync(BOOKINGS_FILE)) {
      const data = fs.readFileSync(BOOKINGS_FILE, 'utf-8');
      const parsed: Booking[] = JSON.parse(data);
      const mapped = parsed.map((b) => ({
        ...b,
        duration: b.duration || 120
      }));

      // Automatically purge customer data and bookings older than 2 days
      const { active, purgedCount } = purgeExpiredBookings(mapped);
      if (purgedCount > 0) {
        console.log(`[GDPR Auto-Purge] Automatically deleted ${purgedCount} expired booking/customer records older than 2 days.`);
        saveBookings(active);
      }
      return active;
    }
  } catch (err) {
    console.error('Error reading bookings file, returning empty array', err);
  }
  
  // Seed initial bookings if file does not exist
  const seeded = seedBookings().map((b) => ({
    ...b,
    duration: b.duration || 120
  }));
  saveBookings(seeded);
  return seeded;
}

// Helper to save bookings
function saveBookings(bookings: Booking[]) {
  try {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing bookings file', err);
  }
}

// Background automatic data retention purge task running every 10 minutes
setInterval(() => {
  try {
    loadBookings();
  } catch (err) {
    console.error('Error in scheduled 2-day data retention purge:', err);
  }
}, 10 * 60 * 1000);

// Generate seeded bookings for sample testing
function seedBookings(): Booking[] {
  const list: Booking[] = [];
  const today = new Date();

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Seed only a few sample tables for tomorrow so other tables stay free
  list.push({
    id: `seed-tomorrow-T1-1800`,
    name: 'Matti Meikäläinen',
    partySize: 8,
    date: tomorrowStr,
    time: '18:00',
    tableId: 'T1',
    tableNameFi: TABLES[0].nameFi,
    tableNameEn: TABLES[0].nameEn,
    wishes: 'Seeded booking',
    createdAt: new Date().toISOString(),
    duration: 120
  });

  list.push({
    id: `seed-tomorrow-T2-2000`,
    name: 'Liisa Lempinen',
    partySize: 4,
    date: tomorrowStr,
    time: '20:00',
    tableId: 'T2',
    tableNameFi: TABLES[1].nameFi,
    tableNameEn: TABLES[1].nameEn,
    wishes: 'Seeded booking',
    createdAt: new Date().toISOString(),
    duration: 120
  });

  const day3 = new Date(today);
  day3.setDate(today.getDate() + 3);
  const day3Str = day3.toISOString().split('T')[0];
  
  list.push({
    id: `seed-day3-T10-1800`,
    name: 'Pekka Virtanen',
    partySize: 12,
    date: day3Str,
    time: '18:00',
    tableId: 'T10',
    tableNameFi: TABLES[9].nameFi,
    tableNameEn: TABLES[9].nameEn,
    wishes: 'Seeded booking',
    createdAt: new Date().toISOString(),
    duration: 120
  });

  return list;
}

function getTableAllowedDurationForSlot(
  tableId: string,
  bookingsForDate: Booking[],
  time: string
): number {
  const startMin = timeToMinutes(time);
  
  // Find table bookings
  const tableBookings = bookingsForDate.filter((b) => {
    if (!b.tableId) return false;
    const ids = b.tableId.split(',').map((s) => s.trim());
    return ids.includes(tableId);
  });
  
  // Check if there is an overlapping booking in the minimum 90-minute window [startMin, startMin + 90)
  const hasMinOverlap = tableBookings.some((b) => {
    const bStart = timeToMinutes(b.time);
    const bDuration = b.duration || 120;
    const bEnd = bStart + bDuration;
    // Overlaps if: bStart < startMin + 90 AND startMin < bEnd
    return bStart < startMin + 90 && startMin < bEnd;
  });
  
  if (hasMinOverlap) {
    return 0; // Table is not free for at least 90 minutes
  }
  
  // Find the earliest start time of any booking starting after startMin
  let nextBookingStart = startMin + 120; // Default is the standard 120 mins duration
  tableBookings.forEach((b) => {
    const bStart = timeToMinutes(b.time);
    if (bStart > startMin && bStart < nextBookingStart) {
      nextBookingStart = bStart;
    }
  });
  
  const allowedDuration = nextBookingStart - startMin;
  if (allowedDuration < 90) {
    return 0; // Below minimum duration
  }
  
  return allowedDuration;
}

// Check availability function
// Returns list of time slots with availability and assigned table
function checkAvailabilityForDate(
  bookings: Booking[],
  date: string,
  partySize: number,
  specificTableId?: string
): { time: string; available: boolean; duration?: number; assignedTableId?: string; assignedTableNameFi?: string; assignedTableNameEn?: string }[] {
  // Filter active bookings for this date
  const bookingsForDate = bookings.filter((b) => b.date === date);

  return TIME_SLOTS.map((time) => {
    const specificTableIds = specificTableId 
      ? specificTableId.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    if (specificTableIds.length > 0) {
      const selectedTables = TABLES.filter((t) => specificTableIds.includes(t.id));
      if (selectedTables.length === 0) {
        return { time, available: false };
      }
      
      const totalCapacity = selectedTables.reduce((sum, t) => sum + t.capacity, 0);
      if (totalCapacity < partySize) {
        return { time, available: false };
      }

      // Calculate allowed duration for each selected table
      let minAllowedDuration = 120;
      for (const table of selectedTables) {
        const dur = getTableAllowedDurationForSlot(table.id, bookingsForDate, time);
        if (dur < 90) {
          minAllowedDuration = 0;
          break;
        }
        if (dur < minAllowedDuration) {
          minAllowedDuration = dur;
        }
      }

      if (minAllowedDuration === 0) {
        return { time, available: false };
      }

      return {
        time,
        available: true,
        duration: minAllowedDuration,
        assignedTableId: specificTableIds.join(','),
        assignedTableNameFi: selectedTables.map((t) => t.nameFi).join(' + '),
        assignedTableNameEn: selectedTables.map((t) => t.nameEn).join(' + ')
      };
    }

    // Find single table that can accommodate this partySize
    let eligibleTables = TABLES.filter((t) => t.capacity >= partySize);
    
    const candidateTables = eligibleTables
      .map((t) => {
        const dur = getTableAllowedDurationForSlot(t.id, bookingsForDate, time);
        return { table: t, duration: dur };
      })
      .filter((c) => c.duration >= 90);

    if (candidateTables.length === 0) {
      return { time, available: false };
    }

    // Sort: smallest capacity first, then largest duration first
    candidateTables.sort((a, b) => {
      if (a.table.capacity !== b.table.capacity) {
        return a.table.capacity - b.table.capacity;
      }
      return b.duration - a.duration;
    });

    const bestCandidate = candidateTables[0];

    return {
      time,
      available: true,
      duration: bestCandidate.duration,
      assignedTableId: bestCandidate.table.id,
      assignedTableNameFi: bestCandidate.table.nameFi,
      assignedTableNameEn: bestCandidate.table.nameEn
    };
  });
}

// --- API ROUTES ---

// 1. Get all tables
app.get('/api/tables', (req, res) => {
  res.json(TABLES);
});

// 2. Get calendar availability for a given month and party size
// Returns a list of days in the requested month with 'available' or 'full' status
app.get('/api/availability/month', (req, res) => {
  const { year, month, partySize, tableId } = req.query;
  
  if (!year || !month || !partySize) {
    return res.status(400).json({ error: 'Missing required parameters: year, month, partySize' });
  }

  const y = parseInt(year as string, 10);
  const m = parseInt(month as string, 10); // 1-indexed (1-12)
  const size = parseInt(partySize as string, 10);
  const specificTableId = tableId ? (tableId as string) : undefined;

  const bookings = loadBookings();

  // Generate all dates in that month
  const daysInMonth = new Date(y, m, 0).getDate();
  const results = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = m.toString().padStart(2, '0');
    const dateStr = `${y}-${monthStr}-${dayStr}`;

    const slots = checkAvailabilityForDate(bookings, dateStr, size, specificTableId);
    const hasAnyFreeSlot = slots.some((s) => s.available);

    results.push({
      date: dateStr,
      status: hasAnyFreeSlot ? 'available' : 'full',
      freeSlotsCount: slots.filter((s) => s.available).length
    });
  }

  res.json(results);
});

// 3. Get exact time slot availabilities for a specific date
app.get('/api/availability/slots', (req, res) => {
  const { date, partySize, tableId } = req.query;

  if (!date || !partySize) {
    return res.status(400).json({ error: 'Missing required parameters: date, partySize' });
  }

  const size = parseInt(partySize as string, 10);
  const specificTableId = tableId ? (tableId as string) : undefined;
  const bookings = loadBookings();

  const slots = checkAvailabilityForDate(bookings, date as string, size, specificTableId);
  res.json(slots);
});

// 4. Create a booking
app.post('/api/bookings', (req, res) => {
  const { name, email, phone, partySize, date, time, tableId, wishes } = req.body;

  if (!name || !partySize || !date || !time) {
    return res.status(400).json({ error: 'Missing required fields: name, partySize, date, time' });
  }

  const size = parseInt(partySize, 10);
  const bookings = loadBookings();

  // Validate date/time availability
  const slots = checkAvailabilityForDate(bookings, date, size, tableId);
  const slot = slots.find((s) => s.time === time);

  if (!slot || !slot.available) {
    return res.status(400).json({ error: 'Selected time slot is no longer available.' });
  }

  // If a specific table was requested, ensure we booked exactly that.
  // Otherwise, use the automatically assigned table.
  const finalTableId = tableId || slot.assignedTableId;
  
  // Support comma-separated table IDs
  const finalTableIds = finalTableId 
    ? finalTableId.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const matchedTables = TABLES.filter((t) => finalTableIds.includes(t.id));

  if (matchedTables.length === 0) {
    return res.status(400).json({ error: 'Table assignment failed.' });
  }

  const newBooking: Booking = {
    id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    email,
    phone,
    partySize: size,
    date,
    time,
    duration: slot.duration || 120,
    tableId: finalTableId,
    tableNameFi: matchedTables.map(t => t.nameFi).join(' + '),
    tableNameEn: matchedTables.map(t => t.nameEn).join(' + '),
    wishes,
    createdAt: new Date().toISOString()
  };

  bookings.push(newBooking);
  saveBookings(bookings);

  // Send confirmation email and capture any test email preview URL
  sendBookingConfirmation(newBooking)
    .then((previewUrl) => {
      res.status(201).json({
        success: true,
        booking: newBooking,
        emailPreviewUrl: previewUrl || undefined
      });
    })
    .catch((err) => {
      console.error('Error in sendBookingConfirmation:', err);
      res.status(201).json({
        success: true,
        booking: newBooking
      });
    });
});

// 5. Admin: Fetch all bookings (with status and retention info)
app.get('/api/admin/bookings', (req, res) => {
  const bookings = loadBookings();
  const now = Date.now();

  const enriched = bookings.map((b) => {
    const startMs = getBookingStartTimestamp(b);
    const endMs = getBookingEndTimestamp(b);
    const isPast = now >= endMs;
    const isOngoing = now >= startMs && now < endMs;
    const purgeTimeMs = endMs + RETENTION_MS;
    const hoursUntilPurge = Math.max(0, Math.round((purgeTimeMs - now) / (1000 * 60 * 60)));

    return {
      ...b,
      isPast,
      isOngoing,
      expiresAt: new Date(purgeTimeMs).toISOString(),
      hoursUntilPurge
    };
  });

  // Sort by date and time
  enriched.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.time.localeCompare(b.time);
  });

  // If status=active requested, return only upcoming or ongoing
  if (req.query.status === 'active') {
    return res.json(enriched.filter((b) => !b.isPast));
  }

  res.json(enriched);
});

// Admin: Manually trigger 2-day retention database purge
app.post('/api/admin/purge-expired', (req, res) => {
  const bookings = loadBookings();
  res.json({ success: true, count: bookings.length });
});

// 6. Admin: Cancel booking
app.delete('/api/admin/bookings/:id', (req, res) => {
  const { id } = req.params;
  let bookings = loadBookings();
  const initialLength = bookings.length;
  bookings = bookings.filter((b) => b.id !== id);

  if (bookings.length === initialLength) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  saveBookings(bookings);
  res.json({ success: true, message: 'Booking successfully canceled.' });
});

// Admin: Update booking time / duration / date
app.put('/api/admin/bookings/:id/time', (req, res) => {
  const { id } = req.params;
  const { time, duration, date } = req.body;
  const bookings = loadBookings();
  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (time !== undefined) {
    booking.time = time;
  }
  if (duration !== undefined) {
    booking.duration = duration;
  }
  if (date !== undefined) {
    booking.date = date;
  }

  saveBookings(bookings);
  res.json({ success: true, booking });
});

// 7. Admin: Reset to seeded bookings (useful feature for demonstrations)
app.post('/api/admin/reset', (req, res) => {
  const seeded = seedBookings();
  saveBookings(seeded);
  res.json({ success: true, bookings: seeded });
});


// Serve Vite or static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
