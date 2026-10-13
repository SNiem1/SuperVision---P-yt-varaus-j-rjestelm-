import { useState, useEffect } from 'react';
import { ShieldCheck, FileText, Cookie, Eye, X, Lock, CheckCircle2 } from 'lucide-react';
import { Language } from '../types';

export type LegalDocType = 'privacy' | 'terms' | 'cookies' | 'accessibility';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  initialDoc?: LegalDocType;
}

export default function LegalModal({ isOpen, onClose, language, initialDoc = 'privacy' }: LegalModalProps) {
  const [activeDoc, setActiveDoc] = useState<LegalDocType>(initialDoc);

  useEffect(() => {
    if (isOpen && initialDoc) {
      setActiveDoc(initialDoc);
    }
  }, [isOpen, initialDoc]);

  if (!isOpen) return null;

  const isFi = language === 'fi';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="font-sans font-extrabold text-base sm:text-lg text-gray-900 tracking-tight">
                {isFi ? 'Lakisääteiset Tiedot & Tietoasiakirjat' : 'Legal & Statutory Documentation'}
              </h2>
              <p className="text-xs font-mono text-gray-500">
                {isFi ? 'GDPR, EU-sääntely ja saavutettavuusohjeistus' : 'GDPR, EU Regulation & Accessibility Standards'}
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center transition-colors font-bold text-sm shadow-2xs"
            title={isFi ? 'Sulje' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-gray-100/80 border-b border-gray-200/60 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveDoc('privacy')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-sans font-bold transition-all shrink-0 ${
              activeDoc === 'privacy'
                ? 'bg-white text-red-600 shadow-2xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isFi ? 'Tietosuojaseloste' : 'Privacy Policy'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDoc('terms')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-sans font-bold transition-all shrink-0 ${
              activeDoc === 'terms'
                ? 'bg-white text-red-600 shadow-2xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isFi ? 'Käyttöehdot' : 'Terms of Service'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDoc('cookies')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-sans font-bold transition-all shrink-0 ${
              activeDoc === 'cookies'
                ? 'bg-white text-red-600 shadow-2xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>{isFi ? 'Evästekäytäntö' : 'Cookie Policy'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDoc('accessibility')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-sans font-bold transition-all shrink-0 ${
              activeDoc === 'accessibility'
                ? 'bg-white text-red-600 shadow-2xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isFi ? 'Saavutettavuus' : 'Accessibility'}</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-gray-700 text-xs sm:text-sm leading-relaxed font-sans">
          
          {/* 1. TIETOSUOJASELOSTE / PRIVACY POLICY */}
          {activeDoc === 'privacy' && (
            <div className="space-y-4">
              <div className="bg-red-50/60 border border-red-100 p-4 rounded-xl space-y-1">
                <h3 className="font-sans font-extrabold text-sm sm:text-base text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-red-600" />
                  {isFi ? 'Tietosuojaseloste (GDPR EU 2016/679)' : 'Privacy Policy (EU GDPR 2016/679)'}
                </h3>
                <p className="text-xs text-gray-600 font-mono">
                  {isFi ? 'Päivitetty: 2026-07-28 • Rekisteriseloste pöytävarauspalvelulle' : 'Updated: 2026-07-28 • Customer Reservation Registry'}
                </p>
              </div>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '1. Rekisterinpitäjä' : '1. Data Controller'}
                </h4>
                <p>
                  {isFi
                    ? 'Ravintolan Pöytävarausjärjestelmä ("Rekisterinpitäjä"). Ota yhteyttä tietosuoja-asioissa asiakaspalveluumme sähköpostitse osoitteeseen info@ravintola.fi.'
                    : 'Restaurant Reservation System ("Data Controller"). Contact us regarding privacy matters at info@restaurant.com.'}
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '2. Henkilötietojen käsittelyn tarkoitus ja peruste' : '2. Purpose and Legal Basis for Processing'}
                </h4>
                <p>
                  {isFi
                    ? 'Käsittelemme henkilötietoja ravintolapöytävarauksien hallinnointiin, varausvahvistusten lähettämiseen, asiakaspalveluun sekä erityisruokavalioiden ja toiveiden huomioimiseen varauksen yhteydessä. Käsittelyn perusteena on asiakkaan ja ravintolan välinen sopimus (varauksen toteuttaminen) sekä rekisterinpitäjän lakisääteiset velvoitteet.'
                    : 'Personal data is processed to manage restaurant table reservations, send booking confirmations, deliver customer support, and accommodate dietary restrictions or special requests. Processing is based on the performance of a contract (reservation execution) and legal compliance.'}
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '3. Kerättävät henkilötiedot' : '3. Personal Data Collected'}
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>{isFi ? 'Etunimi ja sukunimi' : 'First and last name'}</li>
                  <li>{isFi ? 'Sähköpostiosoite (varausvahvistusta varten)' : 'Email address (for booking confirmations)'}</li>
                  <li>{isFi ? 'Puhelinnumero (mahdollisia varausmuutoksia varten)' : 'Phone number (for urgent booking updates)'}</li>
                  <li>{isFi ? 'Varauksen ajankohta, henkilömäärä ja valittu pöytä' : 'Reservation date, time, party size, and table choice'}</li>
                  <li>{isFi ? 'Vapaaehtoiset erityistoiveet ja allergiat' : 'Optional special requests or dietary requirements'}</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '4. Tietojen säilytysaika ja luovutus (2 päivän automaattinen poisto)' : '4. Data Retention and Disclosures (2-Day Automatic Purge)'}
                </h4>
                <p>
                  {isFi
                    ? 'Henkilötietoja ja varaustietoja säilytetään tietokannassa ainoastaan kaksi (2) vuorokautta (48 tuntia) varauksen päättymisen jälkeen. Tämän jälkeen kaikki asiakastiedot (nimi, sähköposti, puhelinnumero, erityistoiveet) ja varaustiedot poistetaan tietokannasta automaattisesti ja pysyvästi (tietojen minimointi ja GDPR Art. 5(1)(e)). Päättyneet varaukset poistuvat ravintolan aktiivisesta hallintanäkymästä välittömästi varauksen päätyttyä. Tietoja ei luovuteta EU/ETA-alueen ulkopuolelle eikä myydä kolmansille osapuolille.'
                    : 'Personal and reservation data is retained in the database for exactly two (2) days (48 hours) following the conclusion of the reservation. Thereafter, all customer details (name, email, phone number, special requests) and booking records are permanently and automatically purged from the database (GDPR Art. 5(1)(e) data minimization). Ended reservations disappear from the restaurant’s active management view immediately upon completion. We do not sell data or transfer it outside the EU/EEA.'}
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '5. Rekisteröidyn oikeudet (GDPR Art. 15-22)' : '5. Data Subject Rights (GDPR Art. 15-22)'}
                </h4>
                <p>
                  {isFi
                    ? 'Asiakkaalla on oikeus tarkastaa itseään koskevat tiedot, vaatia virheellisen tiedon oikaisemista tai poistamista ("oikeus tulla unohdetuksi") sekä rajoittaa tai vastustaa tietojensa käsittelyä ottamalla yhteyttä rekisterinpitäjään.'
                    : 'Customers have the right to access, rectify, or request deletion of their personal data ("right to be forgotten"), as well as restrict or object to processing by contacting us.'}
                </p>
              </section>
            </div>
          )}

          {/* 2. KÄYTTÖEHDOT / TERMS OF SERVICE */}
          {activeDoc === 'terms' && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
                <h3 className="font-sans font-extrabold text-sm sm:text-base text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-600" />
                  {isFi ? 'Pöytävarauksen Käyttöehdot' : 'Reservation Terms of Service'}
                </h3>
                <p className="text-xs text-gray-600 font-mono">
                  {isFi ? 'Voimassa kaikissa ravintolan varauksissa' : 'Applicable to all restaurant table bookings'}
                </p>
              </div>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '1. Varauksen kesto ja voimassaolo' : '1. Reservation Duration'}
                </h4>
                <p>
                  {isFi
                    ? 'Pöytävaraus on voimassa kaksi (2) tuntia varaushetkestä alkaen, ellei varauksentoteutuksen yhteydessä ole toisin kirjallisesti sovittu. Pöytää pidetään varattuna 15 minuuttia ilmoitetun varausajan alkamisesta, minkä jälkeen myöhästyneestä varauksesta pöytä voidaan luovuttaa muille asiakkaille.'
                    : 'Standard table reservations are valid for two (2) hours from the reserved start time unless otherwise arranged. Reserved tables are held for 15 minutes past the start time before being released.'}
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '2. Peruutus ja muutokset' : '2. Cancellations and Modifications'}
                </h4>
                <p>
                  {isFi
                    ? 'Asiakas voi peruuttaa varauksensa maksutta varausvahvistuksessa olevan peruutustoiminnon kautta tai ottamalla suoraan yhteyttä ravintolaan. Yli 6 henkilön seurueiden peruutukset tulee tehdä viimeistään 24 tuntia ennen varauksen alkua.'
                    : 'Cancellations are free of charge and can be completed via the cancellation option or by contacting the restaurant directly. Groups larger than 6 guests should notify us at least 24 hours in advance.'}
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '3. Erityisruokavaliot ja toiveet' : '3. Dietary Preferences & Special Requests'}
                </h4>
                <p>
                  {isFi
                    ? 'Ravintola pyrkii parhaansa mukaan huomioimaan varauksen yhteydessä esitetyt erityistoiveet ja allergiat. Erityisruokavaliot pyydetään ilmoittamaan etukäteen varauksen toivekentässä.'
                    : 'We make every effort to accommodate special seating requests and dietary requirements submitted with your reservation.'}
                </p>
              </section>
            </div>
          )}

          {/* 3. EVÄSTEKÄYTÄNTÖ / COOKIE POLICY */}
          {activeDoc === 'cookies' && (
            <div className="space-y-4">
              <div className="bg-amber-50/60 border border-amber-100 p-4 rounded-xl space-y-1">
                <h3 className="font-sans font-extrabold text-sm sm:text-base text-gray-900 flex items-center gap-2">
                  <Cookie className="w-4 h-4 text-amber-600" />
                  {isFi ? 'Evästeet ja Paikallinen Tallennus (ePrivacy Directive)' : 'Cookie & Local Storage Policy (EU ePrivacy)'}
                </h3>
                <p className="text-xs text-gray-600 font-mono">
                  {isFi ? 'Tietoa sivuston käyttämistä evästeistä' : 'Information about cookies and browser storage'}
                </p>
              </div>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '1. Välttämättömät toiminnalliset evästeet' : '1. Strictly Necessary Functional Storage'}
                </h4>
                <p>
                  {isFi
                    ? 'Tämä verkkosovellus käyttää ainoastaan teknisesti välttämättömiä selaimen muistitietoja (localStorage), jotka mahdollistavat kielivalinnan säilyttämisen, teeman mukauttamisen ja varausprosessin sujuvan toiminnan. Nämä tiedot ovat välttämättömiä palvelun tarjoamiseksi.'
                    : 'This application utilizes strictly necessary browser storage (localStorage) to persist user language preferences, custom styling, and session reservation context. These are essential for core site functionality.'}
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '2. Ei kolmannen osapuolen seurantaevästeitä' : '2. No Third-Party Tracking Cookies'}
                </h4>
                <p>
                  {isFi
                    ? 'Sivustomme ei käytä kolmannen osapuolen mainosevästeitä, sosiaalisen median seurantatageja eikä kävijäseuruetta yksilöiviä kaupallisia evästeitä.'
                    : 'We do not employ third-party advertising cookies, social media tracking pixels, or commercial profiling scripts.'}
                </p>
              </section>
            </div>
          )}

          {/* 4. SAAVUTETTAVUUSSELOSTE / ACCESSIBILITY */}
          {activeDoc === 'accessibility' && (
            <div className="space-y-4">
              <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-xl space-y-1">
                <h3 className="font-sans font-extrabold text-sm sm:text-base text-gray-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  {isFi ? 'Saavutettavuusseloste (WCAG 2.1 AA)' : 'Accessibility Statement (WCAG 2.1 AA)'}
                </h3>
                <p className="text-xs text-gray-600 font-mono">
                  {isFi ? 'EU Saavutettavuusdirektiivi 2016/2102' : 'EU Accessibility Directive 2016/2102 Standard'}
                </p>
              </div>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '1. Saavutettavuuden tila' : '1. Conformance Status'}
                </h4>
                <p>
                  {isFi
                    ? 'Pyrimme takaamaan pöytävarausjärjestelmän saavutettavuuden digitaalisten palvelujen tarjoamisesta annetun lain mukaisesti. Palvelu täyttää WCAG 2.1 AA -tason saavutettavuusvaatimukset erinomaisesti.'
                    : 'We are committed to ensuring digital accessibility for people with disabilities according to WCAG 2.1 Level AA standards.'}
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '2. Toteutetut saavutettavuusominaisuudet' : '2. Implemented Accessibility Features'}
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>{isFi ? 'Selkeät värikontrastit ja luettava typografia' : 'High color contrast and clear readable typography'}</li>
                  <li>{isFi ? 'Täysi näppäimistönavigointituki ja kohdistusindikaattorit' : 'Full keyboard navigation support with focus indicators'}</li>
                  <li>{isFi ? 'Ruudunlukijayhteensopivat ARIA-merkinnät ja lomakeselitteet' : 'Screen reader compatible ARIA labels and form descriptions'}</li>
                  <li>{isFi ? 'Lomake-elementtien selkeä rakenne ja helppo kosketusalue' : 'Structured form elements with accessible touch targets (min 44px)'}</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider font-mono">
                  {isFi ? '3. Saavutettavuuspalaute' : '3. Feedback & Contact'}
                </h4>
                <p>
                  {isFi
                    ? 'Huomasitko saavutettavuuspuutteen? Voit lähettää saavutettavuuspalautetta sähköpostitse osoitteeseen saavutettavuus@ravintola.fi.'
                    : 'Notice an accessibility barrier? Please send your feedback to accessibility@restaurant.com.'}
                </p>
              </section>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-mono text-gray-400">
            {isFi ? 'Lakisääteiset ehdot v1.4' : 'Statutory Terms v1.4'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-sans font-bold text-xs rounded-xl transition-all shadow-2xs"
          >
            {isFi ? 'Ymmärrän & Sulje' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}
