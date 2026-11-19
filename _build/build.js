// Static site generator for gokarnasamudra.com
// Usage: cd _build && npm install && node build.js   (then: node qa.js)
// Facts marked {{LIKE_THIS}} are placeholders still to confirm. Replace here, rebuild.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const NM = process.env.NODE_PATH || path.join(__dirname, 'node_modules');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const Terser = require('terser');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.gokarnasamudra.com';
const BOOK = 'https://bookings.resavenue.com/engine-ibe/search?regCode=TVAX0330';
const GA = 'G-PHPQ95T1L6';
const INDEXNOW_KEY = 'ba66530f64d27573ce9c85ea005cad99';
const TODAY = '2026-11-18';
const TODAY_H = '18 November 2026';
const WA = 'https://wa.me/917760850555';
const TEL = 'tel:+917760850555';
const MAIL = 'mailto:reservations@gokarnasamudra.com';
const FB = 'https://www.facebook.com/share/1A2BehUjQD/';
const IG = 'https://www.instagram.com/gsbresort.gokarna';
const MAPS_Q = 'Gokarna Samudra Beach Resort, Belehittal Rd, Dandebagh, Gokarna, Karnataka 581326';
const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(MAPS_Q);
const MAP_EMBED = 'https://maps.google.com/maps?q=' + encodeURIComponent(MAPS_Q) + '&z=15&output=embed';
const TA_URL = 'https://www.tripadvisor.in/Search?q=' + encodeURIComponent('Gokarna Samudra Beach Resort');
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const waText = t => WA + '?text=' + encodeURIComponent(t);

// ---------- FACTS: fill these to publish them. Empty = hidden from every page and from JSON-LD ----------
// Distances read best as phrases, e.g. DIST_MAIN_BEACH: '200 m', DIST_TEMPLE: 'a 6-minute walk'.
const FACTS = {
  DIST_MAIN_BEACH: '', DIST_TEMPLE: '', DIST_GOKARNA_ROAD_STATION: '',
  ROOM_COUNT: '', PRICE_FROM: '', LAT: '', LNG: '', HALL_CAPACITY: '', RESTAURANT_HOURS: '',
  CANCELLATION_POLICY: '', PAYMENT_METHODS: '', ID_POLICY: '', COUPLES_POLICY: '', ABOUT_STORY: '',
  ROOM_SIZE_STANDARD: '', BED_STANDARD: '', MAX_OCCUPANCY_STANDARD: '', AC_STANDARD: '', VIEW_STANDARD: '', PRICE_FROM_STANDARD: '',
  ROOM_SIZE_DELUXE: '', BED_DELUXE: '', MAX_OCCUPANCY_DELUXE: '', AC_DELUXE: '', PRICE_FROM_DELUXE: '',
  ROOM_SIZE_COTTAGE: '', BED_COTTAGE: '', MAX_OCCUPANCY_COTTAGE: '', AC_COTTAGE: '', PRICE_FROM_COTTAGE: '',
  TESTIMONIAL_1_TEXT: '', TESTIMONIAL_1_NAME: '', TESTIMONIAL_1_MONTH: '',
  TESTIMONIAL_2_TEXT: '', TESTIMONIAL_2_NAME: '', TESTIMONIAL_2_MONTH: '',
  TESTIMONIAL_3_TEXT: '', TESTIMONIAL_3_NAME: '', TESTIMONIAL_3_MONTH: '',
  GBP_URL: '', TRIPADVISOR_URL: '', BOOKING_COM_URL: '',
};
// {{KEY}} = value; {{?KEY}} = "show only if KEY is filled". Anything still unfilled drops its sentence/row/item/section.
const UNF = /\{\{/;
const LOG = [];
const names = t => [...new Set([...t.matchAll(/\{\{\??([A-Z0-9_]+)\}\}/g)].map(m => m[1]))].join('+');
function fill(t) {
  return String(t)
    .replace(/\s*\(\{\{(DIST_MAIN_BEACH|DIST_TEMPLE)\}\}\)/g, (m, k) => FACTS[k] ? ` (${FACTS[k]})` : '')
    .replace(/about \{\{(DIST_MAIN_BEACH|DIST_TEMPLE)\}\}/g, (m, k) => FACTS[k] ? `about ${FACTS[k]}` : 'a short walk')
    .replace(/\{\{\?([A-Z0-9_]+)\}\}/g, (m, k) => FACTS[k] ? '' : m)
    .replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => FACTS[k] || m);
}
const keep = (kind, t) => { if (UNF.test(t)) { LOG.push(`${kind}(${names(t)})`); return false; } return true; };
const sentences = t => fill(t).split(/(?<=[.!?])\s+/).filter(x => keep('sentence', x)).join(' ');

// ---------- helpers ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ext = (href, text, cls = 'link', label = '') => `<a class="${cls}" href="${href}" target="_blank" rel="noopener noreferrer"${label ? ` aria-label="${label}"` : ''}>${text}</a>`;
const A = (href, text) => `<a class="link" href="${href}">${text}</a>`;
const BTN = (href, text, cls = '') => /^https?:/.test(href) && !href.includes('resavenue') ? ext(href, text, ('btn ' + cls).trim()) : `<a class="btn ${cls}" href="${href}">${text}</a>`;
const P = (...s) => { const k = s.map(fill).filter(x => keep('sentence', x)); return k.length ? `<p>${k.join(' ')}</p>` : ''; };
const UL = items => { const k = items.map(fill).filter(i => keep('list item', i)); return k.length ? `<ul class="list">${k.map(i => `<li>${i}</li>`).join('')}</ul>` : ''; };
const S = (id, h2, inner, cls = '') => !inner.replace(/<[^>]+>/g, '').trim() ? (LOG.push(`section(#${id})`), '') : `<section id="${id}" class="section ${cls}" aria-labelledby="${id}-title"><div class="container"><h2 id="${id}-title">${h2}</h2>${inner}</div></section>`;
const H3 = (id, t) => `<h3 id="${id}">${t}</h3>`;
const table = (head, rows, caption) => {
  rows = rows.map(r => r.map(fill));
  let cols = rows[0] ? rows[0].map((_, i) => i) : [];
  if (head) {
    cols = cols.filter(i => i === 0 || rows.every(r => keep('table column ' + head[i], r[i])));
    if (cols.length < 2) { LOG.push('table(' + (caption || '') + ')'); return ''; }
  } else rows = rows.filter(r => keep('table row ' + r[0], r.join(' ')));
  if (!rows.length) return '';
  const pick = r => cols.map(i => r[i]);
  return `<div class="table-wrap"><table>${caption ? `<caption>${caption}</caption>` : ''}${head ? `<thead><tr>${pick(head).map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${pick(r).map((c, i) => i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
};

function icon(name, brand) {
  const f = brand ? path.join(NM, 'simple-icons/icons', name + '.svg') : path.join(NM, 'lucide-static/icons', name + '.svg');
  const raw = fs.readFileSync(f, 'utf8');
  const inner = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '').replace(/\s+/g, ' ').trim();
  return brand
    ? `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${inner}</svg>`
    : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

// ---------- images ----------
const ALT = {
  'pool-front-cottage-gokarna': 'Swimming pool and pool front cottages',
  'night-pool-gokarna-samudra': 'Swimming pool lit up at night under the moon',
  'deluxe-room-gokarna': 'Deluxe Room bed with warm ceiling lights',
  'standard-room-gokarna': 'Standard Room bed with wooden floor and ceiling lights',
  'guest-room-headboard-gokarna': 'Guest room bed with a red shell-shaped headboard',
  'guest-room-bed-gokarna': 'Bed with a red headboard and yellow cushions',
  'room-wardrobe-gokarna': 'Room wardrobe with a safe and luggage space',
  'lobby-lounge-gokarna-samudra': 'Lounge with sofa seating and a Ganesha idol',
  'ocean-deck-restaurant-gokarna': 'Dining tables inside Ocean Deck Restaurant',
  'ocean-deck-entrance-gokarna': 'Glass entrance of Ocean Deck Restaurant',
  'ocean-deck-dish-gokarna': 'Plated dish served at Ocean Deck Restaurant',
};
const SUFFIX = ' at Gokarna Samudra Beach Resort, Gokarna';
const altOf = (slug, custom) => esc((custom || ALT[slug]) + SUFFIX);
const I = '/assets/img/';
function img(slug, o = {}) {
  const alt = altOf(slug, o.alt);
  const lazy = o.eager ? '' : ' loading="lazy" decoding="async"';
  const fp = o.priority ? ' fetchpriority="high"' : '';
  const cls = o.cls ? ` class="${o.cls}"` : '';
  if (o.v === 'hero') return `<img${cls} src="${I}${slug}-1600.webp" srcset="${I}${slug}-hero-800.webp 800w, ${I}${slug}-1600.webp 1600w" sizes="100vw" width="1600" height="1000" alt="${alt}"${fp}${lazy}>`;
  if (o.v === 'deferred') return `<img src="${GIF}" data-src="${I}${slug}-1600.webp" data-srcset="${I}${slug}-hero-800.webp 800w, ${I}${slug}-1600.webp 1600w" sizes="100vw" width="1600" height="1000" alt="${alt}" aria-hidden="true">`;
  return `<img${cls} src="${I}${slug}-800.webp" srcset="${I}${slug}-400.webp 400w, ${I}${slug}-800.webp 800w" sizes="${o.sizes || '(max-width: 640px) 100vw, 400px'}" width="800" height="600" alt="${alt}"${fp}${lazy}>`;
}
const figure = (slug, alt) => `<figure class="media">${img(slug, { alt, sizes: '(max-width: 768px) 100vw, 560px' })}</figure>`;
const split = (text, slug, alt, rev) => `<div class="split${rev ? ' rev' : ''}"><div>${text}</div>${figure(slug, alt)}</div>`;
const card = (slug, alt, h, text, href, linkText) => `<article class="card">${img(slug, { alt })}<div class="card-body"><h3>${h}</h3><p>${text}</p><a class="btn" href="${href}">${linkText}</a></div></article>`;

// ---------- FAQ bank (40-60 words, sentences <=15 words) ----------
const FAQ = {
  'pool-beach': ['Is there a resort in Gokarna with a swimming pool close to Main Beach?', 'Yes. Gokarna Samudra Beach Resort has an on-site swimming pool. The resort is a short walk ({{DIST_MAIN_BEACH}}) from Gokarna Main Beach. Pool Front Cottages have a private sit-out overlooking the pool. You can swim at the resort and walk to the beach on the same day.'],
  'temple': ['Can I stay here to visit Mahabaleshwar Temple?', 'Yes. The resort is about {{DIST_TEMPLE}} from Mahabaleshwar Temple. It suits pilgrims and families who want to stay close to the temple. You can rest by the pool after darshan. Jain food is available on request at Ocean Deck Restaurant. Book early for festival dates such as Shivaratri.'],
  'family': ['Is Gokarna Samudra a family resort with a restaurant?', 'Yes. Deluxe Rooms are spacious, with a balcony and scenic views, and suit families. Ocean Deck Restaurant is on site. It serves Indian, South Indian, Chinese, Continental and Pan-Asian food. The resort also has a swimming pool, free Wi-Fi, room service and free parking.'],
  'hall': ['Do you have an event hall for a wedding or meeting?', 'Yes. Samudra Hall is an air-conditioned event space at the resort. It has fast Wi-Fi, a projector and AV equipment. It suits weddings, meetings, family functions and parties. Seating capacity is {{HALL_CAPACITY}}. Call or WhatsApp +91 77608 50555 to check dates and plan your event. Rooms and Ocean Deck Restaurant are on site for your guests.'],
  'jain': ['Can I get Jain food in Gokarna at Ocean Deck?', 'Yes. Ocean Deck Restaurant prepares Jain food on request. Please tell the team about your needs when you book or arrive. The menu also covers Indian, South Indian, Chinese, Continental and Pan-Asian dishes. You can dine with a view of the beach and pool.'],
  'checkin': ['What are the check-in and check-out times?', 'Check-in is at 12:00 noon. Check-out is at 11:00 am. Pets are not allowed at the resort. For ID requirements at check-in, see our policy: {{ID_POLICY}}. For special timing requests, call or WhatsApp +91 77608 50555 before you arrive. The team will tell you what is possible. Free parking is available on site.'],
  'cancel': ['What is the cancellation policy?', 'Our cancellation policy is: {{CANCELLATION_POLICY}}. Please read it before you confirm your booking. Rates booked through third-party sites may follow their own rules. For help with a change or cancellation, email reservations@gokarnasamudra.com. You can also call or WhatsApp +91 77608 50555.'],
  'payment': ['Which payment methods do you accept?', 'We accept the following payment methods: {{PAYMENT_METHODS}}. Online bookings go through our official booking engine. For group or event payments, please email reservations@gokarnasamudra.com. The team will share payment details for your stay. You can also call +91 77608 50555 with any billing question.'],
  'couple': ['Is it a couple friendly resort in Gokarna?', 'Our policy for couples is: {{COUPLES_POLICY}}. Standard Rooms are cozy and suit couples and solo travellers. Pool Front Cottages add a private sit-out overlooking the pool. Please carry the ID documents listed in our policy. Contact us before booking if you have any questions.'],
  'station': ['How far is the resort from Gokarna Road railway station?{{?DIST_GOKARNA_ROAD_STATION}}', 'The resort is about {{DIST_GOKARNA_ROAD_STATION}} from Gokarna Road railway station. The station is on the Konkan Railway line. Plan a taxi or auto for the last stretch to Gokarna town. Message us on WhatsApp at +91 77608 50555 for directions. Kumta and Ankola stations are other options on the same line.'],
  'parking': ['Is there free parking at the resort?', 'Yes. Free parking is available for guests at Gokarna Samudra Beach Resort. This makes it a practical Gokarna hotel with parking for road trips. Guests driving from Bengaluru, Goa or Mumbai can park on site. Ask the team in advance if you are bringing a bus or large vehicle.'],
  'book': ['How do I book direct with the resort?', 'Use the Book Now button on any page. It opens our official booking engine to check rates and availability. You can also call or WhatsApp +91 77608 50555. Or email reservations@gokarnasamudra.com with your dates and number of guests. Booking direct lets you speak to the resort team about your needs.'],
  'pets': ['Are pets allowed at the resort?', 'No. Pets are not allowed at Gokarna Samudra Beach Resort. This applies to all room types, including Pool Front Cottages. Please plan pet care before you travel. If you have an assistance animal, contact the team before booking. Call +91 77608 50555 or email reservations@gokarnasamudra.com.'],
  'wifi': ['Is Wi-Fi free for guests?', 'Yes. Free Wi-Fi is available for guests at the resort. Samudra Hall also has fast Wi-Fi for meetings and events. Room service is available too, so you can stay in and relax. Ask the front desk for the network details when you check in.'],
  'room-types': ['Which room types are available?', 'We offer three room types. Standard Rooms are cozy, with modern amenities, for solo travellers and couples. Deluxe Rooms have premium furniture, a balcony and scenic views, for families. Pool Front Cottages have a private sit-out overlooking the pool. Compare them on our rooms page.'],
  'ac': ['Do you have AC rooms in Gokarna?', 'Air-conditioning by room type: Standard Room {{AC_STANDARD}}, Deluxe Room {{AC_DELUXE}}, Pool Front Cottage {{AC_COTTAGE}}. Samudra Hall, our event space, is air-conditioned. Free Wi-Fi and room service are available for all guests. Check room details on the booking page before you confirm.'],
  'budget': ['Is Gokarna Samudra a budget resort in Gokarna?', 'Rates start from {{PRICE_FROM}} per night. Standard Rooms are cozy and have modern amenities. Prices can change with season and dates. Compare all room types on the booking page. You will see the exact rate before you confirm. Booking direct also lets you ask the team about rates.'],
  'family-rooms': ['Which room suits families?', 'The Deluxe Room suits families. It is spacious, with premium furniture, a balcony and scenic views. Maximum occupancy is {{MAX_OCCUPANCY_DELUXE}} guests. Families can also use the pool and Ocean Deck Restaurant on site. Free parking helps if you are driving with children and luggage. Jain food is available on request.'],
  'std-couples': ['Is the Standard Room a good room for couples in Gokarna?', 'Yes. The Standard Room is cozy, with modern amenities. It suits couples and solo travellers. Maximum occupancy is {{MAX_OCCUPANCY_STANDARD}}. Bed type: {{BED_STANDARD}}. You can use the pool, free Wi-Fi and room service during your stay. Ocean Deck Restaurant is on site for meals.'],
  'std-beach': ['How far is the Standard Room from the beach?', 'The resort is a short walk ({{DIST_MAIN_BEACH}}) from Gokarna Main Beach. All rooms, including the Standard Room, share this location. You can walk to the beach in the morning or evening. The pool and Ocean Deck Restaurant are on site. Free parking is available if you drive.'],
  'std-price': ['What does the Standard Room cost?{{?PRICE_FROM_STANDARD}}', 'Standard Room rates start from {{PRICE_FROM_STANDARD}} per night. Rates can change with season and dates. Looking for a budget room near Gokarna beach? Compare it with other room types on the booking page. You will see the final rate before you confirm. Booking direct lets you ask the team questions.'],
  'std-amenities': ['What amenities come with the Standard Room?', 'The Standard Room has modern amenities and free Wi-Fi. Room service is available during your stay. You can use the swimming pool and dine at Ocean Deck Restaurant. Free parking is on site. Check-in is at 12:00 noon and check-out is at 11:00 am.'],
  'dlx-balcony': ['Does the Deluxe Room have a balcony?', 'Yes. The Deluxe Room has a balcony with scenic views. It is spacious and has premium furniture. It suits families and guests who want extra space. Room size is {{ROOM_SIZE_DELUXE}}. Bed type: {{BED_DELUXE}}. Book the room direct to secure your dates. Free Wi-Fi and room service are available. The pool is on site too.'],
  'dlx-guests': ['How many guests can stay in a Deluxe Room?', 'Maximum occupancy for the Deluxe Room is {{MAX_OCCUPANCY_DELUXE}} guests. Ask the team about extra beds before you book. Larger groups can book more than one room. Rooms are a short walk from Gokarna Main Beach. The pool and Ocean Deck Restaurant are on site.'],
  'cot-what': ['What is a pool front cottage in Gokarna?', 'A Pool Front Cottage is a room with a private sit-out overlooking the pool. You can sit outside and enjoy the pool view. It suits guests who want a pool view room in Gokarna. Cottage size is {{ROOM_SIZE_COTTAGE}}. Maximum occupancy is {{MAX_OCCUPANCY_COTTAGE}}. Ocean Deck Restaurant is on site, and Gokarna Main Beach is a short walk away.'],
  'cot-beach': ['Are the cottages close to the beach?', 'Yes. The resort is a short walk ({{DIST_MAIN_BEACH}}) from Gokarna Main Beach. You get a pool view from your sit-out and the beach nearby. Mahabaleshwar Temple is about {{DIST_TEMPLE}} away. Ocean Deck Restaurant is on site for meals. Free parking is available for guests who drive.'],
  'cot-couples': ['Are the cottages good for couples?', 'Pool Front Cottages have a private sit-out overlooking the pool. This suits couples who want their own space outside the room. Our couples policy is: {{COUPLES_POLICY}}. Please check it before booking. Bed type: {{BED_COTTAGE}}. Rates start from {{PRICE_FROM_COTTAGE}} per night.'],
  'od-cuisines': ['What cuisines does Ocean Deck serve?', 'Ocean Deck is a multi-cuisine restaurant in Gokarna. It serves Indian, South Indian, Chinese, Continental and Pan-Asian dishes. Jain food is available on request. You can eat with a view of the beach and the pool. Opening hours: {{RESTAURANT_HOURS}}. Room service is also available.'],
  'od-poolside': ['Is Ocean Deck a poolside restaurant in Gokarna?', 'Ocean Deck is the in-house restaurant at Gokarna Samudra Beach Resort. It has views of the pool and the beach. You can walk there from your room. The menu covers Indian, South Indian, Chinese, Continental and Pan-Asian dishes. Jain food is available on request.'],
  'od-hours': ['What are the restaurant timings?', 'Ocean Deck Restaurant hours are {{RESTAURANT_HOURS}}. Room service is also available for in-house guests. Call +91 77608 50555 to check timings on the day. You can also WhatsApp the team to book a table. Jain meals can be requested in advance.'],
  'hall-equipment': ['What equipment does Samudra Hall have?', 'Samudra Hall has fast Wi-Fi, a projector and AV equipment. The hall is air-conditioned. This makes it a practical meeting room with projector in Gokarna. Tell us your seating and AV needs in advance. The team will confirm the set-up before your event.'],
  'hall-capacity': ['How many guests can Samudra Hall hold?{{?HALL_CAPACITY}}', 'Samudra Hall holds up to {{HALL_CAPACITY}} guests. The final number depends on your seating layout. Theatre, classroom and banquet layouts each use space differently. Share your guest count when you enquire. The team can advise on a layout that fits. Rooms are available for guests who want to stay.'],
  'hall-offsite': ['Can I book Samudra Hall for a corporate offsite?', 'Yes. Samudra Hall suits a corporate offsite in Gokarna. You get an air-conditioned hall with Wi-Fi, projector and AV. Team members can stay in our rooms and cottages. Ask about group meals at Ocean Deck Restaurant. Email reservations@gokarnasamudra.com with your dates and group size.'],
  'koti': ['Is this a hotel near Koti Tirtha?', 'Koti Tirtha is the sacred temple tank in Gokarna town. It lies close to Mahabaleshwar Temple. Our resort is about {{DIST_TEMPLE}} from the temple. Families coming for rituals can stay here and travel into town as needed. Ask the team for directions when you arrive.'],
  'pinda': ['Can families stay here for pinda pradana in Gokarna?', 'Yes. Families often travel to Gokarna for pinda pradana and other rites. Our Deluxe Rooms suit families and have a balcony. Ocean Deck Restaurant can prepare Jain food on request. Speak to your priest about ritual timings. Then plan check-in at 12:00 and check-out at 11:00 around them.'],
  'shivaratri': ['Should I book early for a Shivaratri stay in Gokarna?', 'Yes, book as early as you can. Maha Shivaratri draws large crowds to Mahabaleshwar Temple. Rooms across Gokarna fill up fast around the festival. Our resort is about {{DIST_TEMPLE}} from the temple. Check dates and book direct on our booking engine.'],
  'reach-bangalore': ['How do I reach Gokarna from Bangalore?', 'You can travel by overnight bus, train or car. Check trains to Gokarna Road or Kumta on the Konkan line. Overnight buses run to Gokarna and nearby Kumta. By car, plan a full day\'s drive with rest breaks. Our 2-day Gokarna itinerary from Bangalore has a simple plan.'],
  'airport': ['Which is the nearest airport to Gokarna?', 'Goa has two airports, Dabolim and Mopa. Hubballi Airport and Mangaluru International Airport are other options. Each needs a long road transfer to Gokarna. Choose based on flight times and fares from your city. You can also continue by train to Gokarna Road station.'],
  'best-time': ['What is the best time to visit Gokarna?', 'October to March is the most popular season. The weather is drier and the sea is calmer. April and May are hot and humid. The monsoon runs roughly from June to September, with heavy rain. Plan temple visits around festival dates if you want to see them.'],
  'beaches': ['Which are the main beaches in Gokarna?', 'Gokarna Main Beach sits next to the town and temple. Kudle Beach and Om Beach lie to the south. Half Moon Beach and Paradise Beach are further along the coast. You can reach them by trek or by boat. Check sea conditions before you swim.'],
  'trek': ['What is the Gokarna beach trek?', 'This coastal trail links Kudle, Om, Half Moon and Paradise beaches. The trail follows cliffs and rocky paths along the coast. Start early, carry water and wear good shoes. Avoid the trail in heavy rain. Some travellers walk one way and return by boat.'],
  'monsoon': ['Is Gokarna good to visit in monsoon?', 'The monsoon brings green hills, quiet streets and heavy rain. The sea is rough and swimming is unsafe. Many beach shacks close for the season. Temple visits and short town walks are still possible. Pack rain gear and check the forecast before you travel.'],
  'monsoon-swim': ['Is it safe to swim in the sea during the monsoon?', 'No. Swimming in the sea is unsafe during the monsoon. Currents are strong and waves are high. Follow any flags, signs and local warnings. Our swimming pool is a safer way to cool off. Check pool timings with the front desk when you arrive.'],
  'monsoon-months': ['Which months are monsoon in Gokarna?', 'The monsoon usually runs from June to September. June and July are often the wettest months. Rain can start in late May and ease in October. Check the forecast before you travel. Roads and trails can be slippery after heavy rain.'],
  'monsoon-things': ['What can I do in Gokarna during the rains?', 'Visit Mahabaleshwar Temple and walk around Koti Tirtha. Watch the waves from Main Beach at a safe distance. Enjoy a meal at Ocean Deck Restaurant with a pool view. Relax in your room with a book on rainy afternoons. Take short drives on clear days, but avoid flooded roads.'],
  'blog-enough': ['Is 2 days enough for Gokarna?', 'Two days are enough for the temple, Main Beach, Kudle Beach and Om Beach. Add a third day if you want Half Moon and Paradise beaches. A slower pace also leaves time for the pool. Travelling overnight from Bangalore saves daytime hours.'],
  'blog-stay': ['Where should I stay in Gokarna for 2 days?', 'Stay close to Gokarna Main Beach and the temple to save travel time. Gokarna Samudra Beach Resort is a short walk ({{DIST_MAIN_BEACH}}) from Main Beach. It has a pool, free Wi-Fi, free parking and Ocean Deck Restaurant. Check-in is at 12:00 and check-out at 11:00.'],
  'gsb': ['Is GSB Resort Gokarna the same as Gokarna Samudra?', 'Yes. GSB Resort is a short name for Gokarna Samudra Beach Resort. Our Instagram handle is gsbresort.gokarna. The resort is on Belehittal Rd, Dandebagh, Gokarna, Karnataka 581326. You can reach us on +91 77608 50555. Email reservations@gokarnasamudra.com for bookings. You can also message us on WhatsApp.'],
  'reviews': ['Where can I read Gokarna Samudra reviews?', 'You can read Gokarna Samudra reviews on Google and TripAdvisor. Links to both are on our home and about pages. We only show real guest feedback on this website. After your stay, please share honest feedback on Google. It helps other travellers plan their trip.'],
  'contact-number': ['What is the Gokarna Samudra contact number?', 'The Gokarna Samudra contact number is +91 77608 50555. The same number works on WhatsApp. Email reservations@gokarnasamudra.com for bookings and event enquiries. Our address is Belehittal Rd, Dandebagh, Gokarna, Karnataka 581326. Directions and a map are on our contact page. Check-in is at 12:00 noon.'],
  'gal-what': ['What do the photos show?', 'The gallery shows the pool by day and at night. It also shows guest rooms, a wardrobe and the lounge. You can see Ocean Deck Restaurant, its entrance and a plated dish. Tap any photo to open a larger view. Press Escape or the close button to exit.'],
  'gal-room': ['Can I see more of a room before booking?', 'Each room page has photos, a facts table and booking links. Compare Standard Rooms, Deluxe Rooms and Pool Front Cottages on our rooms page. For more photos, message us on WhatsApp at +91 77608 50555. You can ask the team for more pictures of your room type.'],
  'priv-data': ['What data does this website collect?', 'This website does not store form messages on our server. When you send an enquiry, the form opens WhatsApp with your message. We use Google Analytics to count visits and clicks. Analytics uses cookies and collects device and usage data. Contact us to ask about your data.'],
  'priv-cookies': ['Do you use cookies?', 'Google Analytics sets cookies to measure visits. The Google Map on our pages may set Google cookies when it loads. We do not use advertising cookies on this website. You can block cookies in your browser settings. The site will still work without them.'],
  'priv-ask': ['How do I ask about my data?', 'Email reservations@gokarnasamudra.com with your question. Tell us which booking or message it relates to. The team will reply and explain what data it holds. You can ask us to delete messages you sent by WhatsApp or email. Booking data is also handled by our booking engine provider.'],
};

// ---------- shared blocks ----------
const NAV = [['/rooms/', 'Rooms'], ['/ocean-deck-restaurant/', 'Dining'], ['/samudra-hall/', 'Events'], ['/gallery/', 'Gallery'], ['/gokarna-travel-guide/', 'Travel Guide'], ['/about/', 'About'], ['/contact/', 'Contact']];
const FOOT_A = [['/rooms/', 'Rooms &amp; Cottages'], ['/ocean-deck-restaurant/', 'Ocean Deck Restaurant'], ['/samudra-hall/', 'Samudra Hall Events'], ['/stay-near-mahabaleshwar-temple/', 'Stay Near the Temple'], ['/gallery/', 'Photo Gallery']];
const FOOT_B = [['/gokarna-travel-guide/', 'Gokarna Travel Guide'], ['/blog/', 'Travel Blog'], ['/faq/', 'FAQ'], ['/about/', 'About Us'], ['/contact/', 'Contact &amp; Directions'], ['/privacy-policy/', 'Privacy Policy']];

const header = cur => `<header class="site-header"><a class="brand" href="/" aria-label="Gokarna Samudra Beach Resort home"><img src="${I}gokarna-samudra-logo-96.webp" width="48" height="48" alt="Logo of Gokarna Samudra Beach Resort, Gokarna"><div><div class="brand-name">Gokarna Samudra</div><div class="brand-tag">Beach Resort — Relax | Refresh | Relive</div></div></a><button class="burger" id="burger" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu">${icon('menu')}</button><nav class="site-nav" id="site-nav" aria-label="Main"><div class="nav-inner"><ul class="nav-links">${NAV.map(([h, t]) => `<li><a href="${h}"${cur.startsWith(h) ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}</ul><a class="btn book-btn" href="${BOOK}">Book Now</a></div></nav></header>`;

const footer = `<footer class="site-footer"><div class="footer-container"><div class="footer-brand"><img src="${I}gokarna-samudra-logo-96.webp" width="50" height="50" loading="lazy" decoding="async" alt="Logo of Gokarna Samudra Beach Resort, Gokarna"><p class="footer-name">Gokarna Samudra Beach Resort</p><p>Relax | Refresh | Rejuvenate</p></div><div class="footer-col"><h2>Explore</h2><ul>${FOOT_A.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}</ul></div><div class="footer-col"><h2>Plan Your Trip</h2><ul>${FOOT_B.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}</ul></div><div class="footer-col footer-contact"><h2>Contact</h2><address><strong>Gokarna Samudra Beach Resort</strong><br>Belehittal Rd, Dandebagh,<br>Gokarna, Karnataka 581326, India</address><p><a href="${TEL}">+91 77608 50555</a></p><p><a href="${MAIL}">reservations@gokarnasamudra.com</a></p><div class="footer-social">${ext(FB, icon('facebook', 1), 'social', 'Gokarna Samudra on Facebook')}${ext(IG, icon('instagram', 1), 'social', 'Gokarna Samudra on Instagram')}${ext(WA, icon('whatsapp', 1), 'social', 'WhatsApp Gokarna Samudra')}</div></div></div><div class="footer-bottom"><p>&copy; <span data-year>2026</span> Gokarna Samudra Beach Resort. All rights reserved.</p></div></footer>`;

const waFloat = `<a class="whatsapp-float" href="${WA}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Gokarna Samudra on WhatsApp">${icon('whatsapp', 1)}<span>Chat</span></a>`;

const form = id => `<form id="${id}" class="form" data-whatsapp toolname="send_enquiry" tooldescription="Send a booking enquiry to Gokarna Samudra Beach Resort"><label for="${id}-name">Your name<input id="${id}-name" name="name" type="text" autocomplete="name" required toolparamdescription="Full name of the guest sending the enquiry"></label><label for="${id}-email">Email<input id="${id}-email" name="email" type="email" autocomplete="email" required toolparamdescription="Email address where the resort can reply"></label><div class="form-row"><label for="${id}-checkin">Check-in date<input id="${id}-checkin" name="checkin" type="date" toolparamdescription="Arrival date in YYYY-MM-DD format; check-in time is 12:00"></label><label for="${id}-checkout">Check-out date<input id="${id}-checkout" name="checkout" type="date" toolparamdescription="Departure date in YYYY-MM-DD format; check-out time is 11:00"></label></div><label for="${id}-guests">Guests<input id="${id}-guests" name="guests" type="number" min="1" step="1" inputmode="numeric" toolparamdescription="Total number of guests staying"></label><label for="${id}-message">Message<textarea id="${id}-message" name="message" rows="4" required toolparamdescription="Questions or requests, such as room type, Samudra Hall events or Jain meals"></textarea></label><button class="btn" type="submit">Send Enquiry on WhatsApp</button></form>`;

const contactInfo = `<div class="contact-info"><h3>Contact Details</h3><p><strong>Address:</strong> Belehittal Rd, Dandebagh, Gokarna, Karnataka 581326, India</p><p><strong>Phone and WhatsApp:</strong> <a class="link" href="${TEL}">Call +91 77608 50555</a></p><p><strong>Email:</strong> <a class="link" href="${MAIL}">Email the reservations team</a></p><p><strong>Check-in:</strong> 12:00 | <strong>Check-out:</strong> 11:00</p><p><strong>Pets:</strong> Not allowed</p></div>`;

const mapFrame = `<div class="map"><iframe src="${MAP_EMBED}" title="Map showing Gokarna Samudra Beach Resort on Belehittal Rd, Gokarna" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`;

const reviews = (q => q ? `<div class="testimonials">${q}</div>` : '')([1, 2, 3].map(n => fill(`<blockquote><p>{{TESTIMONIAL_${n}_TEXT}}</p><cite>{{TESTIMONIAL_${n}_NAME}}, {{TESTIMONIAL_${n}_MONTH}}</cite></blockquote>`)).filter(h => keep('testimonial', h)).join(''));
LOG.length = 0;
const reviewLinks = (g, t) => `<div class="btn-row">${ext(MAPS_URL, g, 'btn btn-dark')}${ext(TA_URL, t, 'btn btn-ghost')}</div>`;

const facility = (ic, h, t) => `<div class="facility-card">${icon(ic)}<h3>${h}</h3><p>${t}</p></div>`;
const facilities = `<section id="facilities" class="section facilities" aria-labelledby="facilities-title"><div class="container"><h2 id="facilities-title">Our Facilities</h2><div class="facility-container">${facility('waves', 'Swimming Pool', 'Relax and refresh in our on-site swimming pool.')}${facility('utensils', 'Ocean Deck Restaurant', 'Multi-cuisine dishes, with Jain food on request.')}${facility('wifi', 'Free Wi-Fi', 'Stay connected with free Wi-Fi during your stay.')}${facility('concierge-bell', 'Room Service', 'Room service for the days you want to stay in.')}${facility('presentation', 'Samudra Hall', 'Air-conditioned event space with fast Wi-Fi, projector and AV.')}${facility('car', 'Free Parking', 'Free on-site parking for guests who drive in.')}</div></div></section>`;

const updated = `<p class="updated">Last updated <time datetime="${TODAY}">${TODAY_H}</time> · By Gokarna Samudra Beach Resort</p>`;

// ---------- pages ----------
const pages = [];
const add = p => { p.hidden = LOG.splice(0); pages.push(p); };

// HOME
add({
  path: '/', title: 'Pool Resort Near Gokarna Beach | Gokarna Samudra',
  desc: 'Resort with pool, pool-front cottages & Ocean Deck restaurant, a short walk from Gokarna Main Beach & Mahabaleshwar Temple. Book direct.',
  h1: 'Gokarna Samudra Beach Resort - Pool Resort Near Gokarna Main Beach',
  lead: 'Gokarna Samudra Beach Resort is a resort in Gokarna with swimming pool and on-site dining. Choose from rooms and pool front cottages. We are a short walk ({{DIST_MAIN_BEACH}}) from Gokarna Main Beach. Mahabaleshwar Temple is about {{DIST_TEMPLE}} away. Ocean Deck Restaurant is on site.',
  home: true, og: 'pool-front-cottage-gokarna', type: 'home',
  kw: ['resort in Gokarna with swimming pool', 'Gokarna beach resort', 'resorts near Gokarna beach', 'hotel near Gokarna Main Beach', 'Gokarna resort booking', 'where to stay in Gokarna', 'family resort in Gokarna', 'resorts near Kumta'],
  faqTitle: 'Questions About Staying With Us', faqs: ['pool-beach', 'temple', 'family', 'checkin', 'book'],
  body: [
    S('about', 'A Gokarna Beach Resort Close to the Sea and the Temple', split(
      P('Gokarna Samudra Beach Resort is on Belehittal Rd, Dandebagh, in Gokarna, Karnataka.', 'Gokarna Main Beach is a short walk away.', 'Mahabaleshwar Temple and Koti Tirtha are close by too.', 'You can mix beach time, temple visits and pool time in one easy stay.') +
      P('Comparing resorts near Gokarna beach?', 'Location, a pool and on-site food are worth checking.', 'We offer all three, along with free parking and free Wi-Fi.', 'Call or WhatsApp us for directions or help choosing a room.') +
      P(A('/about/', 'Meet the team and read our story'))
    , 'lobby-lounge-gokarna-samudra')),
    S('rooms', 'Choose Your Room or Cottage',
      P('All guests can use the swimming pool and dine at Ocean Deck Restaurant.', 'Pick the room type that fits your trip.') +
      `<div class="cards">${card('standard-room-gokarna', null, 'Standard Room', 'Cozy room with modern amenities. A good fit for solo travellers and couples.', '/rooms/standard-room/', 'See the Standard Room')}${card('deluxe-room-gokarna', null, 'Deluxe Room', 'Spacious room with premium furniture, a balcony and scenic views. Ideal for families.', '/rooms/deluxe-room/', 'Explore the Deluxe Room')}${card('pool-front-cottage-gokarna', 'Pool front cottages beside the swimming pool', 'Pool Front Cottages', 'Cottages with a private sit-out overlooking the swimming pool.', '/rooms/pool-front-cottages/', 'View the Pool Front Cottages')}</div>` +
      P(A('/rooms/', 'Compare all rooms and cottages side by side')), 'alt'),
    S('guests', 'Stays for Families, Couples and Pilgrims',
      P('Families can book the spacious Deluxe Room with its balcony and scenic views.', 'The cozy Standard Room suits couples and solo travellers.', 'Pool Front Cottages give you a private sit-out overlooking the pool.') +
      P('Pilgrims can stay close to Mahabaleshwar Temple and relax by the pool after darshan.', 'Want a family resort in Gokarna with food on site?', 'Ocean Deck Restaurant is part of the resort, and Jain food is available on request.') +
      P(A('/stay-near-mahabaleshwar-temple/', 'Plan a stay near Mahabaleshwar Temple'))),
    facilities,
    S('dining', 'Dine at Ocean Deck Restaurant', split(
      P('Ocean Deck is our in-house, multi-cuisine restaurant.', 'The menu covers Indian, South Indian, Chinese, Continental and Pan-Asian dishes.', 'Jain food is available on request.', 'Enjoy your meal with a view of the beach and the pool.') +
      `<div class="btn-row">${BTN(waText('Hello! I would like to reserve a table at Ocean Deck Restaurant.'), 'Reserve a Table')}<a class="link" href="/ocean-deck-restaurant/">Discover Ocean Deck Restaurant</a></div>`
    , 'ocean-deck-dish-gokarna', null, true), 'alt'),
    S('events', 'Samudra Hall for Meetings and Celebrations',
      P('Samudra Hall is an air-conditioned event space inside the resort.', 'It has fast Wi-Fi, a projector and AV equipment.', 'Use it for meetings, workshops, birthdays or family functions.', 'Your guests can stay, dine and meet in one place.') +
      P(A('/samudra-hall/', 'Explore Samudra Hall for your event'))),
    S('location', 'Where to Stay in Gokarna: Our Location',
      P('Wondering where to stay in Gokarna?', 'Staying near the beach and the old town saves travel time.', 'Our resort is a handy hotel near Gokarna Main Beach.', 'Mahabaleshwar Temple is about {{DIST_TEMPLE}} away.', 'Kudle Beach and Om Beach lie further south, by road or trek.') +
      P('Searching for resorts near Kumta?', 'Gokarna is in Kumta taluk, Uttara Kannada district.', 'Gokarna Road railway station is on the Konkan Railway line.') +
      `<div class="btn-row">${A('/gokarna-travel-guide/', 'Read the full Gokarna travel guide')}${A('/contact/', 'Get directions and contact details')}</div>` + mapFrame, 'alt'),
    S('booking', 'Gokarna Resort Booking, Direct and Simple',
      P('Book direct on our official booking engine.', 'You can check room types, rates and availability for your dates.', 'Rates start from {{PRICE_FROM}} per night.') +
      P('Check-in is at 12:00 noon.', 'Check-out is at 11:00 am.', 'Pets are not allowed.') +
      `<div class="btn-row">${BTN(BOOK, 'Book Your Stay Direct')}${A('/faq/', 'Read answers to common questions')}</div>`),
    S('reviews', 'Guest Reviews', reviews + P('Read feedback from past guests on Google and TripAdvisor.', 'After your stay, please share your own review.') + reviewLinks('Read Gokarna Samudra reviews on Google', 'See reviews on TripAdvisor'), 'alt'),
    S('contact', 'Send an Enquiry', P('Share your dates and number of guests.', 'The form opens WhatsApp with your message ready to send.') + `<div class="contact-grid">${contactInfo}<div class="contact-form"><h3>Send Us a Message</h3>${form('home-enquiry')}</div></div>`),
  ].join(''),
});

// ROOMS
const roomRow = (n, size, bed, occ, ac, view, price) => [n, size, bed, occ, ac, view, price];
add({
  path: '/rooms/', title: 'Rooms and Cottages in Gokarna | Gokarna Samudra',
  desc: 'Standard rooms, deluxe balcony rooms and pool front cottages near Gokarna Main Beach. Compare and book direct.',
  h1: 'Rooms and Cottages in Gokarna', hero: 'deluxe-room-gokarna', heroAlt: 'Rooms and cottages in Gokarna: Deluxe Room bed with warm ceiling lights', og: 'deluxe-room-gokarna', type: 'room',
  lead: 'Choose from three types of rooms and cottages in Gokarna at Gokarna Samudra Beach Resort. Standard Rooms suit couples. Deluxe Rooms have a balcony. Pool Front Cottages overlook the pool. All are a short walk from Gokarna Main Beach.',
  crumbs: [['Rooms', '/rooms/']],
  kw: ['rooms and cottages in Gokarna', 'Gokarna room booking', 'AC rooms in Gokarna', 'family rooms in Gokarna', 'budget resort in Gokarna'],
  faqTitle: 'Questions About Our Rooms', faqs: ['room-types', 'ac', 'budget', 'family-rooms', 'pets'],
  extraSchema: () => [{ '@type': 'ItemList', '@id': SITE + '/rooms/#list', name: 'Room types at Gokarna Samudra Beach Resort', itemListElement: [['Standard Room', '/rooms/standard-room/'], ['Deluxe Room', '/rooms/deluxe-room/'], ['Pool Front Cottage', '/rooms/pool-front-cottages/']].map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, url: SITE + u })) }],
  body: [
    (CMP => CMP ? S('compare', 'Compare Room Types', P('Use this table to compare each room type.', 'Then open a room page for photos and details.') + CMP) : '')(table(['Room type', 'Size', 'Beds', 'Max occupancy', 'AC', 'View', 'Price from'], [
        roomRow('Standard Room', '{{ROOM_SIZE_STANDARD}}', '{{BED_STANDARD}}', '{{MAX_OCCUPANCY_STANDARD}}', '{{AC_STANDARD}}', '{{VIEW_STANDARD}}', '{{PRICE_FROM_STANDARD}}'),
        roomRow('Deluxe Room', '{{ROOM_SIZE_DELUXE}}', '{{BED_DELUXE}}', '{{MAX_OCCUPANCY_DELUXE}}', '{{AC_DELUXE}}', 'Scenic views from the balcony', '{{PRICE_FROM_DELUXE}}'),
        roomRow('Pool Front Cottage', '{{ROOM_SIZE_COTTAGE}}', '{{BED_COTTAGE}}', '{{MAX_OCCUPANCY_COTTAGE}}', '{{AC_COTTAGE}}', 'Pool view from a private sit-out', '{{PRICE_FROM_COTTAGE}}'),
      ], 'Room types at Gokarna Samudra Beach Resort')),
    S('types', 'Standard Rooms, Deluxe Rooms and Pool Front Cottages', `<div class="cards">${card('standard-room-gokarna', null, 'Standard Room', 'Cozy, with modern amenities. Suits solo travellers and couples.', '/rooms/standard-room/', 'Standard Room photos and details')}${card('deluxe-room-gokarna', null, 'Deluxe Room', 'Spacious, with premium furniture, a balcony and scenic views.', '/rooms/deluxe-room/', 'Deluxe Room photos and details')}${card('pool-front-cottage-gokarna', 'Pool front cottages beside the swimming pool', 'Pool Front Cottage', 'A private sit-out overlooking the swimming pool.', '/rooms/pool-front-cottages/', 'Pool Front Cottage photos and details')}</div>`, 'alt'),
    S('families', 'Family Rooms in Gokarna and Stays for Couples',
      P('The Deluxe Room is our pick for families.', 'It is spacious, with premium furniture, a balcony and scenic views.', 'The cozy Standard Room suits couples and solo travellers.', 'Pool Front Cottages add a private sit-out overlooking the swimming pool.') +
      P('Need AC rooms in Gokarna?{{?AC_STANDARD}}{{?AC_DELUXE}}{{?AC_COTTAGE}}', 'See the AC column in the table above, or ask our team.{{?AC_STANDARD}}{{?AC_DELUXE}}{{?AC_COTTAGE}}', 'On a budget?', 'Compare the rate for each room type on the booking page.')),
    S('facilities-list', 'Facilities for Every Guest', UL(['Swimming pool', 'Free Wi-Fi', 'Room service', 'Free parking', 'Ocean Deck Restaurant, with Jain food on request', 'Samudra Hall for meetings and events', 'Check-in 12:00, check-out 11:00', 'Pets are not allowed']), 'alt'),
    S('how-to-book', 'Gokarna Room Booking in Three Steps',
      `<ol class="list"><li>Pick your dates on our booking engine.</li><li>Choose a Standard Room, Deluxe Room or Pool Front Cottage.</li><li>Confirm your stay on the booking engine.</li></ol>` +
      `<div class="btn-row">${BTN(BOOK, 'See Rates and Availability')}</div>` +
      `<div class="btn-row">${A('/ocean-deck-restaurant/', 'See what Ocean Deck serves')}${A('/stay-near-mahabaleshwar-temple/', 'Stay close to Mahabaleshwar Temple')}${A('/faq/', 'Read our stay policies')}</div>`),
  ].join(''),
});

// ROOM PAGES
function roomPage(o) {
  add({
    path: o.path, title: o.title, desc: o.desc, h1: o.h1, hero: o.hero, heroAlt: o.heroAlt, og: o.hero, type: 'room',
    lead: o.lead, crumbs: [['Rooms', '/rooms/'], [o.name, o.path]], kw: o.kw, faqTitle: o.faqTitle, faqs: o.faqs,
    extraSchema: () => [{
      '@type': 'HotelRoom', '@id': SITE + o.path + '#room', name: o.name, description: o.schemaDesc, url: SITE + o.path,
      image: SITE + I + o.hero + '-og.jpg',
      bed: { '@type': 'BedDetails', typeOfBed: o.bed },
      occupancy: { '@type': 'QuantitativeValue', maxValue: o.occ, unitCode: 'C62' },
      floorSize: { '@type': 'QuantitativeValue', value: o.size },
      amenityFeature: o.amen.map(n => ({ '@type': 'LocationFeatureSpecification', name: n, value: true })),
      containedInPlace: { '@id': SITE + '/#resort' },
    }],
    body: [
      S('facts', o.name + ' Facts', table(null, o.facts, o.name + ' at a glance') + `<div class="btn-row">${BTN(BOOK, o.cta)}</div>`),
      S('about-room', o.aboutH2, split(o.aboutText, o.img2, o.img2Alt), 'alt'),
      S('nearby', 'Around the Resort', o.nearby),
      S('good-to-know', 'Good to Know', UL(['Check-in is from 12:00 noon and check-out is by 11:00 am.', 'Pets are not allowed.', 'Free parking is available on site.', 'Jain meals can be requested at Ocean Deck Restaurant.']) + (o.extra || ''), 'alt'),
      S('how-to-book', 'How to Book', P('Book direct on our official booking engine.', `Pick your dates and choose the ${o.name}.`, 'You can also call or WhatsApp +91 77608 50555.', 'Or email reservations@gokarnasamudra.com with your dates and number of guests.')),
    ].join(''),
  });
}
const commonFacts = [['Wi-Fi', 'Free'], ['Room service', 'Available'], ['Check-in / check-out', '12:00 / 11:00'], ['Pets', 'Not allowed']];
roomPage({
  path: '/rooms/standard-room/', name: 'Standard Room', title: 'Standard Room in Gokarna Near Beach | Gokarna Samudra',
  desc: 'Cozy standard room near Gokarna Main Beach with modern amenities and free Wi-Fi. Ideal for couples and solo travellers.',
  h1: 'Standard Room in Gokarna', hero: 'standard-room-gokarna', heroAlt: 'Standard room in Gokarna with a double bed and wooden floor',
  lead: 'Book a standard room in Gokarna at Gokarna Samudra Beach Resort. It is cozy, with modern amenities and free Wi-Fi. It suits couples and solo travellers. The resort is a short walk from Gokarna Main Beach, with a pool and restaurant.',
  kw: ['standard room in Gokarna', 'budget room near Gokarna beach', 'room for couples in Gokarna'],
  faqTitle: 'Standard Room Questions', faqs: ['std-couples', 'std-beach', 'std-price', 'std-amenities', 'pets'],
  bed: '{{BED_STANDARD}}', occ: '{{MAX_OCCUPANCY_STANDARD}}', size: '{{ROOM_SIZE_STANDARD}}', schemaDesc: 'Cozy room with modern amenities, ideal for solo travellers and couples.',
  amen: ['Free Wi-Fi', 'Room service', 'Swimming pool access', 'Free parking'],
  facts: [['Room type', 'Standard Room'], ['Size', '{{ROOM_SIZE_STANDARD}}'], ['Bed', '{{BED_STANDARD}}'], ['Max occupancy', '{{MAX_OCCUPANCY_STANDARD}}'], ['Air-conditioning', '{{AC_STANDARD}}'], ['View', '{{VIEW_STANDARD}}'], ['Price from', '{{PRICE_FROM_STANDARD}}'], ...commonFacts, ['Ideal for', 'Solo travellers and couples']],
  cta: 'Book the Standard Room',
  aboutH2: 'A Cozy Room for Couples and Solo Travellers',
  aboutText: P('The Standard Room keeps things simple and comfortable.', 'It has modern amenities and free Wi-Fi.', 'Room service is available when you want to stay in.', 'Step out to the pool, or walk down to Gokarna Main Beach.') +
    P('Looking for a room for couples in Gokarna?', 'This room is a practical base for beach days and temple visits.', 'Ocean Deck Restaurant is on site for meals.') +
    P('Looking for a budget room near Gokarna beach?', 'Compare rates for each room type on the booking page.'),
  img2: 'lobby-lounge-gokarna-samudra', img2Alt: null,
  extra: P('Mornings can start with a walk to the beach.', 'Afternoons are for the pool or a temple visit.', 'Evenings end with dinner at Ocean Deck.'),
  nearby: P('Gokarna Main Beach is a short walk ({{DIST_MAIN_BEACH}}) away.', 'Mahabaleshwar Temple is about {{DIST_TEMPLE}} from the resort.', 'Ocean Deck Restaurant serves Indian, South Indian, Chinese, Continental and Pan-Asian food.', 'Free parking is on site.') +
    `<div class="btn-row">${A('/rooms/deluxe-room/', 'Compare with the Deluxe Room')}${A('/rooms/pool-front-cottages/', 'See the Pool Front Cottages')}${A('/gokarna-travel-guide/', 'Plan your trip with our Gokarna guide')}${A('/rooms/', 'Back to all rooms and cottages')}</div>`,
});
roomPage({
  path: '/rooms/deluxe-room/', name: 'Deluxe Room', title: 'Deluxe Room with Balcony, Gokarna | Gokarna Samudra',
  desc: 'Spacious deluxe room with balcony and scenic views in Gokarna. Ideal for families. Pool, restaurant and parking on site.',
  h1: 'Deluxe Room with Balcony', hero: 'deluxe-room-gokarna', heroAlt: 'Deluxe room with balcony, Gokarna, with a double bed and warm ceiling lights',
  lead: 'Looking for a deluxe room with balcony? Gokarna Samudra Beach Resort has spacious Deluxe Rooms with premium furniture and scenic views. They are ideal for families. The resort is a short walk from Gokarna Main Beach.',
  kw: ['deluxe room with balcony Gokarna', 'family deluxe room in Gokarna', 'spacious room in Gokarna'],
  faqTitle: 'Deluxe Room Questions', faqs: ['dlx-balcony', 'dlx-guests', 'family-rooms', 'temple'],
  bed: '{{BED_DELUXE}}', occ: '{{MAX_OCCUPANCY_DELUXE}}', size: '{{ROOM_SIZE_DELUXE}}', schemaDesc: 'Spacious room with premium furniture, a balcony and scenic views, ideal for families.',
  amen: ['Balcony', 'Free Wi-Fi', 'Room service', 'Swimming pool access', 'Free parking'],
  facts: [['Room type', 'Deluxe Room'], ['Size', '{{ROOM_SIZE_DELUXE}}'], ['Bed', '{{BED_DELUXE}}'], ['Max occupancy', '{{MAX_OCCUPANCY_DELUXE}}'], ['Air-conditioning', '{{AC_DELUXE}}'], ['Balcony', 'Yes'], ['View', 'Scenic views from the balcony'], ['Price from', '{{PRICE_FROM_DELUXE}}'], ...commonFacts, ['Ideal for', 'Families and guests who want extra space']],
  cta: 'Book the Deluxe Room',
  aboutH2: 'A Family Deluxe Room in Gokarna',
  aboutText: P('The Deluxe Room gives families more space to spread out.', 'Premium furniture adds comfort after a long day at the beach.', 'Step onto the balcony for scenic views.', 'Free Wi-Fi and room service are available.') +
    P('Need a spacious room in Gokarna for a longer stay?', 'The Deluxe Room is a good fit.', 'The pool is on site for a swim after the beach.'),
  img2: 'guest-room-bed-gokarna', img2Alt: 'Guest room bed with a red headboard and yellow cushions',
  extra: P('A typical family day here mixes beach, temple and pool time.', 'Return to the balcony for a quiet break between outings.', 'Ocean Deck Restaurant can serve Jain food on request.', 'Mahabaleshwar Temple is about {{DIST_TEMPLE}} away.'),
  nearby: P('Gokarna Main Beach is a short walk ({{DIST_MAIN_BEACH}}) away.', 'Mahabaleshwar Temple is about {{DIST_TEMPLE}} from the resort.', 'Ocean Deck Restaurant offers Jain food on request.', 'Free parking makes family road trips easier.') +
    `<div class="btn-row">${A('/rooms/standard-room/', 'Compare with the Standard Room')}${A('/rooms/pool-front-cottages/', 'Look at the pool front cottages')}${A('/ocean-deck-restaurant/', 'Ocean Deck cuisines and Jain food')}${A('/rooms/', 'Back to the rooms overview')}</div>`,
});
roomPage({
  path: '/rooms/pool-front-cottages/', name: 'Pool Front Cottage', title: 'Pool Front Cottages in Gokarna | Gokarna Samudra',
  desc: 'Cottages with a private sit-out overlooking the pool, a short walk from Gokarna Main Beach. Book your cottage direct.',
  h1: 'Pool Front Cottages in Gokarna', hero: 'pool-front-cottage-gokarna', heroAlt: 'Pool front cottage Gokarna view across the swimming pool',
  lead: 'Book a pool front cottage. Gokarna Samudra Beach Resort\'s cottages each have a private sit-out overlooking the pool. Gokarna Main Beach is a short walk away. Ocean Deck Restaurant and free parking are on site.',
  kw: ['pool front cottage Gokarna', 'cottages in Gokarna', 'pool view room in Gokarna', 'poolside cottage in Gokarna'],
  faqTitle: 'Pool Front Cottage Questions', faqs: ['cot-what', 'cot-beach', 'cot-couples', 'pool-beach'],
  bed: '{{BED_COTTAGE}}', occ: '{{MAX_OCCUPANCY_COTTAGE}}', size: '{{ROOM_SIZE_COTTAGE}}', schemaDesc: 'Cottage with a private sit-out overlooking the swimming pool.',
  amen: ['Private sit-out', 'Pool view', 'Free Wi-Fi', 'Room service', 'Free parking'],
  facts: [['Room type', 'Pool Front Cottage'], ['Size', '{{ROOM_SIZE_COTTAGE}}'], ['Bed', '{{BED_COTTAGE}}'], ['Max occupancy', '{{MAX_OCCUPANCY_COTTAGE}}'], ['Air-conditioning', '{{AC_COTTAGE}}'], ['Outdoor space', 'Private sit-out'], ['View', 'Overlooks the swimming pool'], ['Price from', '{{PRICE_FROM_COTTAGE}}'], ...commonFacts, ['Ideal for', 'Guests who want a pool view']],
  cta: 'Check Cottage Availability',
  aboutH2: 'A Poolside Cottage in Gokarna',
  aboutText: P('These cottages in Gokarna face the swimming pool.', 'Use your private sit-out for morning tea or evening downtime.', 'It is a pool view room in Gokarna with its own outdoor space.') +
    P('At night, the pool lights up in front of the cottages.', 'Room service and free Wi-Fi are available during your stay.'),
  img2: 'night-pool-gokarna-samudra', img2Alt: 'Poolside cottage in Gokarna with the pool lit up at night',
  extra: P('Pool Front Cottages suit guests who like to sit outside.', 'Read a book on the sit-out while others swim.', 'Step into the pool when the afternoon gets warm.', 'The beach is a short walk away for sunset.'),
  nearby: P('Gokarna Main Beach is a short walk ({{DIST_MAIN_BEACH}}) away.', 'Mahabaleshwar Temple is about {{DIST_TEMPLE}} from the resort.', 'Ocean Deck Restaurant has views of the pool and the beach.', 'Free parking is on site.') +
    `<div class="btn-row">${A('/rooms/', 'See every room type side by side')}${A('/rooms/deluxe-room/', 'Compare the Deluxe Room')}${A('/gallery/', 'Browse pool and room photos')}${A('/stay-near-mahabaleshwar-temple/', 'Plan a temple visit from the resort')}</div>`,
});

// OCEAN DECK
add({
  path: '/ocean-deck-restaurant/', title: 'Ocean Deck - Restaurant Near Gokarna Beach',
  desc: 'Multi-cuisine restaurant in Gokarna: Indian, South Indian, Chinese, Continental and Pan-Asian. Jain food on request.',
  h1: 'Ocean Deck Restaurant, Gokarna', hero: 'ocean-deck-restaurant-gokarna', heroAlt: 'Restaurant near Gokarna beach with wooden ceiling and dining tables inside Ocean Deck', og: 'ocean-deck-restaurant-gokarna', type: 'venue',
  lead: 'Ocean Deck is a restaurant near Gokarna beach, inside Gokarna Samudra Beach Resort. It serves Indian, South Indian, Chinese, Continental and Pan-Asian food. Jain food is available on request. Dine with a view of the beach and the pool.',
  crumbs: [['Ocean Deck Restaurant', '/ocean-deck-restaurant/']],
  kw: ['restaurant near Gokarna beach', 'multi-cuisine restaurant in Gokarna', 'Jain food in Gokarna', 'poolside restaurant in Gokarna', 'where to eat in Gokarna'],
  faqTitle: 'Questions About Ocean Deck', faqs: ['od-cuisines', 'jain', 'od-poolside', 'od-hours', 'family'],
  extraSchema: () => [{ '@type': 'Restaurant', '@id': SITE + '/ocean-deck-restaurant/#restaurant', name: 'Ocean Deck Restaurant', url: SITE + '/ocean-deck-restaurant/', image: SITE + I + 'ocean-deck-restaurant-gokarna-og.jpg', servesCuisine: ['Indian', 'South Indian', 'Chinese', 'Continental', 'Pan-Asian', 'Jain (on request)'], telephone: '+91-77608-50555', address: ADDRESS(), openingHours: '{{RESTAURANT_HOURS}}', containedInPlace: { '@id': SITE + '/#resort' } }],
  body: [
    S('cuisines', 'A Multi-Cuisine Restaurant in Gokarna', split(
      P('The Ocean Deck menu brings five cuisines together in one place.', 'Order Indian and South Indian dishes, or try Chinese, Continental and Pan-Asian plates.', 'Families with mixed tastes can all find something they like.', 'Room service is available for guests who prefer to eat in.')
    , 'ocean-deck-entrance-gokarna')),
    S('jain', 'Jain Food in Gokarna, on Request',
      P('Ocean Deck prepares Jain food on request.', 'Let the team know your needs when you book or check in.', 'This helps pilgrims and families visiting Mahabaleshwar Temple.', 'Jain meals can be planned ahead for pilgrim groups.') +
      `<div class="btn-row">${BTN(waText('Hello! I would like to reserve a table at Ocean Deck Restaurant.'), 'Reserve a Table')}</div>`, 'alt'),
    S('views', 'Pool and Beach Views', split(
      P('Ocean Deck looks out over the beach and the pool.', 'It is an easy spot for a meal after a swim.', 'Look for the wooden Ocean Deck sign above the glass doors.')
    , 'ocean-deck-dish-gokarna', null, true)),
    S('where-to-eat', 'Where to Eat in Gokarna After a Beach Day',
      P('Gokarna has small cafes, temple-town eateries and beach shacks.', 'For a sit-down meal with varied choices, Ocean Deck is close at hand.', 'Opening hours: {{RESTAURANT_HOURS}}.', 'Call +91 77608 50555 to check the day\'s timings.') +
      `<div class="btn-row">${A('/rooms/', 'Stay in our rooms and cottages')}${A('/samudra-hall/', 'Host a group meal or event at Samudra Hall')}${A('/gokarna-travel-guide/', 'Plan nearby beach visits')}${A('/gallery/', 'See photos of Ocean Deck')}</div>`, 'alt'),
  ].join(''),
});

// SAMUDRA HALL
add({
  path: '/samudra-hall/', title: 'Event Hall in Gokarna | Samudra Hall Banquets & Meetings',
  desc: 'Air-conditioned event hall in Gokarna with Wi-Fi, projector and AV for weddings, meetings and parties. Enquire now.',
  h1: 'Samudra Hall - Event Hall in Gokarna', type: 'venue',
  lead: 'Samudra Hall is an event hall in Gokarna at Gokarna Samudra Beach Resort. It is air-conditioned, with fast Wi-Fi, a projector and AV equipment. Host meetings, parties or family functions near Gokarna Main Beach.',
  crumbs: [['Samudra Hall', '/samudra-hall/']],
  kw: ['event hall in Gokarna', 'banquet hall in Gokarna', 'conference hall in Gokarna', 'wedding venue in Gokarna', 'corporate offsite in Gokarna', 'meeting room with projector'],
  faqTitle: 'Samudra Hall Questions', faqs: ['hall', 'hall-equipment', 'hall-capacity', 'hall-offsite'],
  extraSchema: () => [{ '@type': 'EventVenue', '@id': SITE + '/samudra-hall/#venue', name: 'Samudra Hall', url: SITE + '/samudra-hall/', description: 'Air-conditioned event space with fast Wi-Fi, projector and AV equipment.', maximumAttendeeCapacity: '{{HALL_CAPACITY}}', amenityFeature: ['Air-conditioning', 'Fast Wi-Fi', 'Projector', 'AV equipment'].map(n => ({ '@type': 'LocationFeatureSpecification', name: n, value: true })), address: ADDRESS(), telephone: '+91-77608-50555', containedInPlace: { '@id': SITE + '/#resort' } }],
  body: [
    S('hall-facts', 'Samudra Hall Facts', table(null, [['Venue', 'Samudra Hall'], ['Capacity', '{{HALL_CAPACITY}}'], ['Air-conditioning', 'Yes'], ['Wi-Fi', 'Fast Wi-Fi'], ['Projector', 'Yes'], ['AV equipment', 'Yes'], ['Location', 'Inside Gokarna Samudra Beach Resort'], ['On site', 'Rooms, Ocean Deck Restaurant, swimming pool, free parking']], 'Samudra Hall at a glance') +
      `<div class="btn-row">${BTN(waText('Hello! I would like to enquire about Samudra Hall for an event.'), 'Enquire About Samudra Hall')}</div>`),
    S('celebrations', 'A Banquet Hall in Gokarna for Weddings and Parties',
      P('Samudra Hall works as a banquet hall in Gokarna for birthdays and family functions.', 'Couples can also use it as a wedding venue in Gokarna.', 'Guests can stay in our rooms and cottages on site.', 'Ask about meals from Ocean Deck Restaurant for your event.'), 'alt'),
    S('business', 'A Conference Hall in Gokarna for Teams',
      P('Samudra Hall also works as a conference hall in Gokarna.', 'Fast Wi-Fi, a projector and AV equipment support talks and presentations.', 'Plan a corporate offsite in Gokarna with sessions by day and the beach by evening.', 'Free parking helps teams arriving by car.', 'Ask about rooms for speakers and attendees.', 'Share your event date early.')),
    S('stay-dine-meet', 'Stay, Dine and Meet in One Place',
      split(P('Book rooms for your guests in the same resort.', 'Choose from Standard Rooms, Deluxe Rooms and Pool Front Cottages.', 'Ocean Deck serves Indian, South Indian, Chinese, Continental and Pan-Asian food.', 'Jain food is available on request.'), 'pool-front-cottage-gokarna', 'Pool and cottages at the resort with Samudra Hall, an event hall in Gokarna') +
      `<div class="btn-row">${A('/rooms/', 'Book rooms for event guests')}${A('/ocean-deck-restaurant/', 'Group dining at Ocean Deck')}${A('/contact/', 'Directions for your attendees')}${A('/faq/', 'More answers in our FAQ')}</div>`, 'alt'),
  ].join(''),
});

// TEMPLE
add({
  path: '/stay-near-mahabaleshwar-temple/', title: 'Stay Near Mahabaleshwar Temple, Gokarna',
  desc: 'Rooms a short walk from Mahabaleshwar Temple and Gokarna Main Beach. Ideal for pilgrims and families.',
  h1: 'Stay Near Mahabaleshwar Temple', type: 'article', article: true,
  lead: 'Plan a stay near Mahabaleshwar Temple. Gokarna Samudra Beach Resort is about {{DIST_TEMPLE}} from the temple. Gokarna Main Beach is a short walk away. Pilgrims and families can rest by the pool and eat at Ocean Deck Restaurant.',
  crumbs: [['Stay Near Mahabaleshwar Temple', '/stay-near-mahabaleshwar-temple/']],
  kw: ['stay near Mahabaleshwar Temple Gokarna', 'rooms near Gokarna temple', 'pinda pradana', 'Shivaratri Gokarna stay', 'hotel near Koti Tirtha'],
  faqTitle: 'Temple Stay Questions', faqs: ['temple', 'koti', 'pinda', 'shivaratri'],
  body: [
    S('temple', 'About Mahabaleshwar Temple',
      P('Mahabaleshwar Temple is a major Shiva temple in Gokarna\'s old town.', 'Devotees believe it holds the Atmalinga of Lord Shiva.', 'The temple stands close to Gokarna Main Beach.', 'Many visitors take a holy dip in the sea before darshan.', 'Check temple timings and dress rules before you go.')),
    S('rituals', 'Rooms Near Gokarna Temple for Rituals',
      P('Gokarna is known for ancestral rites.', 'Rituals are often held near Koti Tirtha, the sacred temple tank.', 'Our rooms near Gokarna temple let families rest between ceremonies.', 'Ask your priest for ritual timings, then plan check-in and check-out around them.') +
      P('Looking for a hotel near Koti Tirtha?', 'The tank is in the old town, close to the temple.'), 'alt'),
    S('festivals', 'Planning a Shivaratri Gokarna Stay',
      P('Maha Shivaratri is a major festival at Mahabaleshwar Temple.', 'It usually falls in February or March.', 'Crowds are large and rooms in town fill early.', 'Book direct as soon as your dates are fixed.') +
      `<div class="btn-row">${BTN(BOOK, 'Book a Temple Stay')}</div>`),
    S('after-darshan', 'Rest After Darshan',
      split(P('After the temple, return to a swimming pool, free Wi-Fi and room service.', 'Ocean Deck Restaurant prepares Jain food on request.', 'Free parking is useful if your family drives in.', 'Check-in is at 12:00 noon and check-out is at 11:00 am.'), 'deluxe-room-gokarna', 'Deluxe Room for families planning a stay near Mahabaleshwar Temple, Gokarna,') +
      `<div class="btn-row">${A('/rooms/deluxe-room/', 'Family-friendly Deluxe Rooms')}${A('/ocean-deck-restaurant/', 'Jain meals at Ocean Deck')}${A('/gokarna-travel-guide/', 'Gokarna beaches and temple guide')}${A('/contact/', 'How to reach the resort')}</div>`, 'alt'),
  ].join(''),
});

// TRAVEL GUIDE
add({
  path: '/gokarna-travel-guide/', title: 'Gokarna Travel Guide: Beaches, How to Reach, Best Time',
  desc: 'Gokarna beaches, things to do, how to reach from Bangalore, Goa and Mumbai, and the best time to visit.',
  h1: 'Gokarna Travel Guide', hero: 'night-pool-gokarna-samudra', heroAlt: 'Gokarna travel guide cover: the resort pool lit up at night', og: 'night-pool-gokarna-samudra', type: 'guide', article: true,
  lead: 'This Gokarna travel guide covers beaches, things to do and how to reach. It also covers the best time to visit and a 2-day itinerary. We are a short walk from Gokarna Main Beach.',
  crumbs: [['Gokarna Travel Guide', '/gokarna-travel-guide/']],
  kw: ['Gokarna travel guide', 'things to do in Gokarna', 'Gokarna beach trek', 'how to reach Gokarna', 'Gokarna Road railway station', 'nearest airport to Gokarna', 'best time to visit Gokarna', 'Gokarna in monsoon', 'Gokarna 2-day itinerary'],
  faqTitle: 'Gokarna Travel Questions', faqs: ['beaches', 'trek', 'reach-bangalore', 'airport', 'best-time'],
  body: [
    S('beaches', 'Beaches in Gokarna',
      P('Gokarna has five well-known beaches along a short stretch of coast.', 'Each has a different feel, from busy town sand to quiet coves.') +
      H3('main-beach', 'Gokarna Main Beach') + P('Gokarna Main Beach sits right next to the town and Mahabaleshwar Temple.', 'Pilgrims often bathe here before visiting the temple.', 'It is a short walk ({{DIST_MAIN_BEACH}}) from our resort.', 'Evenings here are popular with families.') +
      H3('kudle-beach', 'Kudle Beach') + P('Kudle Beach lies south of the town, over a small headland.', 'It has a long curve of sand with cafes and guesthouses.', 'You can reach it by road or on foot from the town.', 'Many travellers stay on for the sunset.') +
      H3('om-beach', 'Om Beach') + P('Om Beach is named for its shape, which looks like the Om symbol from above.', 'It is one of the most visited beaches in Gokarna.', 'Boat rides are often offered in season.', 'Swim only where it is marked safe.') +
      H3('half-moon-beach', 'Half Moon Beach') + P('Half Moon Beach is a small crescent cove south of Om Beach.', 'You reach it by a trek over rocks or by boat.', 'Facilities are basic, so carry water and snacks.') +
      H3('paradise-beach', 'Paradise Beach') + P('Paradise Beach lies beyond Half Moon Beach.', 'It is rocky and remote, and easiest to reach by boat.', 'A longer trek also leads there.', 'Plan to return well before dark.')),
    S('things-to-do', 'Things to Do in Gokarna',
      P('Here are simple things to do in Gokarna across two or three days.', 'Mix temple visits, beach walks and slow evenings.') +
      H3('temple-visit', 'Visit Mahabaleshwar Temple and Koti Tirtha') + P('Start in the old town at Mahabaleshwar Temple.', 'Then walk to Koti Tirtha, the sacred temple tank.', 'Check dress rules and timings before you go.', 'Our page on how to ' + A('/stay-near-mahabaleshwar-temple/', 'stay near Mahabaleshwar Temple') + ' has more tips.') +
      H3('beach-trek', 'Walk the Gokarna Beach Trek') + P('This coastal trail links Kudle, Om, Half Moon and Paradise beaches.', 'The path climbs over headlands and rocky sections.', 'Start early, wear good shoes and carry water.', 'Many walkers trek one way and return by boat.') +
      H3('boat-ride', 'Take a Boat Ride') + P('Boats often run between Om, Half Moon and Paradise beaches in season.', 'Agree the fare and return time before you board.', 'Skip boats when the sea is rough.') +
      H3('town-walk', 'Explore the Temple Town') + P('Walk Car Street, the main street of old Gokarna.', 'You will find small shops, puja stalls and local snacks.', 'Evenings are lively around the temple.') +
      H3('day-trips', 'Day Trips: Mirjan Fort and Yana') + P('Mirjan Fort is a historic laterite fort near Kumta.', 'Yana is known for its tall black limestone rock formations.', 'Both make good half-day or full-day trips by road.')),
    S('how-to-reach', 'How to Reach Gokarna',
      P('Gokarna is on the Karnataka coast in Uttara Kannada district.', 'Most routes combine rail or air with a final road leg.') +
      H3('from-bangalore', 'From Bangalore') + P('Bengaluru to Gokarna is a long overnight journey.', 'Overnight buses run to Gokarna and nearby Kumta.', 'Check trains from Bengaluru to Gokarna Road or Kumta.', 'By car, plan a full day with breaks.', 'Use a maps app for the latest route.', 'See our ' + A('/blog/gokarna-2-day-itinerary-from-bangalore/', '2-day plan for Bangalore travellers') + '.') +
      H3('from-goa', 'From Goa') + P('From Goa, drive south on NH66 through Karwar and Ankola.', 'Konkan Railway trains link Madgaon with Gokarna Road.', 'Check which trains stop there before you book.', 'Buses also run from Goa towards Karwar and Gokarna.') +
      H3('from-mumbai', 'From Mumbai') + P('From Mumbai, Konkan Railway trains run down the coast towards Gokarna Road, Kumta and Ankola.', 'Check which trains stop at your station.', 'You can also fly to Goa and continue by road or rail.') +
      H3('from-hubli', 'From Hubli') + P('Hubballi has a domestic airport and a major railway junction.', 'From Hubballi, travel west to the coast by bus, taxi or car.') +
      H3('by-train', 'By Train: Gokarna Road Railway Station') + P('Gokarna Road railway station is on the Konkan Railway.', 'It lies outside the town, so plan a taxi or auto for the last stretch.', 'Our resort is about {{DIST_GOKARNA_ROAD_STATION}} from the station.', 'Kumta and Ankola stations are useful options too.') +
      H3('by-air', 'By Air: Nearest Airport to Gokarna') + P('There is no airport in Gokarna itself.', 'The main options are Goa (Dabolim and Mopa), Hubballi and Mangaluru.', 'Each needs a road or rail transfer to Gokarna.'), 'alt'),
    S('best-time', 'Best Time to Visit Gokarna',
      H3('oct-mar', 'October to March') + P('This is the most popular season.', 'Skies are clearer, the sea is calmer and beach cafes are open.', 'Book early for weekends, Christmas and New Year.') +
      H3('apr-may', 'April and May') + P('Days are hot and humid.', 'Plan beach time for early mornings and evenings.', 'A pool helps on the hottest afternoons.') +
      H3('jun-sep', 'June to September: Gokarna in Monsoon') + P('Heavy rain turns the hills green.', 'The sea is rough and swimming is unsafe.', 'Read our guide to ' + A('/blog/gokarna-in-monsoon/', 'what to expect in the rainy season') + '.') +
      H3('festivals', 'Festivals') + P('Maha Shivaratri at Mahabaleshwar Temple usually falls in February or March.', 'Expect large crowds and book rooms well ahead.')),
    S('itinerary', 'Gokarna 2-Day Itinerary',
      H3('day-1', 'Day 1: Temple, Town and Main Beach') + P('Arrive in the morning and ask the front desk about an early bag drop.', 'Visit Mahabaleshwar Temple and Koti Tirtha before the midday heat.', 'Check in at 12:00 and cool off in the pool.', 'Walk to Gokarna Main Beach for the evening.', 'End the day with dinner at Ocean Deck Restaurant.') +
      H3('day-2', 'Day 2: Kudle, Om and the Coast') + P('Start early with the trek from Kudle Beach to Om Beach.', 'Return in time to check out by 11:00.', 'Spend the afternoon at Kudle or Om, or take a boat to Half Moon.', 'Head home on an evening bus or train.'), 'alt'),
    S('where-to-stay', 'Stay Close to the Beach and Temple',
      P('A central base saves time in Gokarna.', 'Our resort is a short walk from Gokarna Main Beach.', 'It has a swimming pool, free Wi-Fi, room service and free parking.', 'Ocean Deck Restaurant and Samudra Hall are on site.') +
      `<div class="btn-row">${BTN(BOOK, 'Plan Your Stay')}${A('/rooms/', 'Compare our rooms and cottages')}${A('/ocean-deck-restaurant/', 'Eat at Ocean Deck')}</div>`),
  ].join(''),
});

// ABOUT
add({
  path: '/about/', title: 'About Gokarna Samudra Beach Resort',
  desc: 'The story, team and values behind Gokarna Samudra Beach Resort, a pool resort near Gokarna Main Beach.',
  h1: 'About Gokarna Samudra Beach Resort', hero: 'lobby-lounge-gokarna-samudra', heroAlt: 'Lounge and Ganesha idol inside Gokarna Samudra Beach Resort', og: 'lobby-lounge-gokarna-samudra', type: 'about', pageType: 'AboutPage',
  lead: 'Gokarna Samudra Beach Resort is a pool resort on Belehittal Rd, Dandebagh, in Gokarna. It is a short walk from Gokarna Main Beach. We offer rooms, pool front cottages, Ocean Deck Restaurant and Samudra Hall.',
  crumbs: [['About', '/about/']],
  kw: ['Gokarna Samudra Beach Resort', 'Gokarna Samudra reviews', 'GSB Resort Gokarna', 'Gokarna hotel with parking'],
  faqTitle: 'About the Resort', faqs: ['gsb', 'reviews', 'pets'],
  body: [
    S('story', 'Our Story', P('{{ABOUT_STORY}}')) + S('location-fit', 'Why Our Location Works', P('Our location suits beach lovers, pilgrims and event groups.', 'Gokarna Main Beach is a short walk away.', 'Mahabaleshwar Temple is about {{DIST_TEMPLE}} from the resort.', 'Gokarna Road railway station is about {{DIST_GOKARNA_ROAD_STATION}} away.')),
    S('what-we-offer', 'What You Will Find Here', UL([
      A('/rooms/', 'Standard Rooms, Deluxe Rooms and Pool Front Cottages'),
      'A swimming pool, free Wi-Fi, room service and free parking',
      A('/ocean-deck-restaurant/', 'Ocean Deck, our multi-cuisine restaurant') + ', with Jain food on request',
      A('/samudra-hall/', 'Samudra Hall, an air-conditioned event space'),
      'Check-in at 12:00 and check-out at 11:00',
    ]), 'alt'),
    S('values', 'How We Like to Host',
      P('We keep our information clear and honest.', 'The photos on this site show the resort itself.', 'Our check-in times and house rules are listed up front.', 'We only publish real guest reviews.', 'Questions are welcome on the phone, by email or on WhatsApp.', 'Tell us about any special needs before you arrive.', 'Thank you for choosing to stay with us.')),
    S('find-us', 'Find Us in Gokarna',
      P('You may also see us called GSB Resort Gokarna, after our Instagram handle.', 'We are on Belehittal Rd, Dandebagh, Gokarna, Karnataka 581326.', 'Driving in? We are a Gokarna hotel with parking on site, free for guests.', 'We look forward to hosting you.') +
      `<div class="btn-row">${A('/contact/', 'Contact us and get directions')}${A('/gallery/', 'See photos of the resort')}</div>`, 'alt'),
    S('reviews', 'Guest Reviews', reviews + P('Read what past guests say on Google and TripAdvisor.', 'We do not write or edit these reviews.') + reviewLinks('Read our Google reviews', 'Read our TripAdvisor reviews')),
  ].join(''),
});

// FAQ
const FAQ_GROUPS = [
  ['location-faq', 'Location and Getting Here', ['pool-beach', 'temple', 'station', 'reach-bangalore', 'parking']],
  ['rooms-faq', 'Rooms and Stay Policies', ['room-types', 'ac', 'checkin', 'couple', 'pets', 'wifi']],
  ['food-events-faq', 'Food, Pool and Events', ['family', 'jain', 'hall']],
  ['booking-faq', 'Booking, Payment and Contact', ['book', 'payment', 'cancel', 'contact-number', 'gsb', 'best-time']],
];
add({
  path: '/faq/', title: 'Gokarna Samudra Resort FAQ - Check-in, Pool, Parking',
  desc: 'Answers on check-in, pool, parking, food, payment, cancellation, couples, events and how to reach the resort.',
  h1: 'Frequently Asked Questions', type: 'faq',
  lead: 'Find quick answers about Gokarna Samudra Beach Resort. Topics include check-in, the pool, parking, food, payment and cancellation. We also cover couples, events and how to reach us. Still have a question? Call or WhatsApp +91 77608 50555.',
  crumbs: [['FAQ', '/faq/']],
  kw: ['Gokarna Samudra Beach Resort', 'Gokarna Samudra contact number', 'Gokarna hotel with parking', 'GSB Resort Gokarna'],
  faqs: FAQ_GROUPS.flatMap(g => g[2]), faqGroups: FAQ_GROUPS,
  body: '%%FAQ%%' + S('more-help', 'Need More Help?', P('Can\'t find your answer here?', A('/contact/', 'Send us a message or call'), 'and the team will help.') + `<div class="btn-row">${A('/rooms/', 'Compare room types')}${A('/gokarna-travel-guide/', 'Read the Gokarna travel guide')}${A('/samudra-hall/', 'Plan an event at Samudra Hall')}</div>`),
});

// GALLERY
const gItem = (slug, alt, first) => `<button class="gallery-item" type="button" data-full="${I}${slug}-full.webp" aria-label="Enlarge photo: ${esc(alt || ALT[slug])}">${img(slug, { alt, sizes: '(max-width: 600px) 100vw, 300px', eager: first })}</button>`;
add({
  path: '/gallery/', title: 'Photos of Gokarna Samudra Beach Resort',
  desc: 'See the pool, rooms, cottages, Ocean Deck restaurant and Samudra Hall at Gokarna Samudra Beach Resort.',
  h1: 'Gokarna Samudra Beach Resort Photo Gallery', og: 'night-pool-gokarna-samudra', type: 'gallery', pageType: 'CollectionPage', lightbox: true,
  lead: 'Browse photos of Gokarna Samudra Beach Resort. See the pool by day and night, guest rooms, the lounge and Ocean Deck Restaurant. Tap any photo to view it larger.',
  crumbs: [['Gallery', '/gallery/']],
  kw: ['photos of Gokarna Samudra Beach Resort'],
  faqTitle: 'Gallery Questions', faqs: ['gal-what', 'gal-room', 'pool-beach'],
  body: [
    S('pool-photos', 'Pool and Cottages', P('The swimming pool sits in front of the cottages.', A('/rooms/pool-front-cottages/', 'Read about the Pool Front Cottages') + '.') + `<div class="gallery-grid">${gItem('pool-front-cottage-gokarna', null, true)}${gItem('night-pool-gokarna-samudra', null, true)}</div>`),
    S('room-photos', 'Rooms', P('Photos of our guest rooms, beds and storage.', A('/rooms/', 'See room details and rates') + '.') + `<div class="gallery-grid">${gItem('standard-room-gokarna')}${gItem('deluxe-room-gokarna')}${gItem('guest-room-headboard-gokarna')}${gItem('guest-room-bed-gokarna')}${gItem('room-wardrobe-gokarna')}</div>`, 'alt'),
    S('dining-photos', 'Ocean Deck Restaurant', P('Inside Ocean Deck, at the entrance and on the plate.', A('/ocean-deck-restaurant/', 'Ocean Deck cuisines and Jain food') + '.') + `<div class="gallery-grid">${gItem('ocean-deck-restaurant-gokarna')}${gItem('ocean-deck-entrance-gokarna')}${gItem('ocean-deck-dish-gokarna')}</div>`),
    S('lounge-photos', 'Lounge', P('The lounge has sofa seating and a Ganesha idol.', A('/contact/', 'Plan your visit') + '.') + `<div class="gallery-grid">${gItem('lobby-lounge-gokarna-samudra')}</div>`, 'alt'),
  ].join(''),
});

// CONTACT
add({
  path: '/contact/', title: 'Contact & Directions | Gokarna Samudra Beach Resort',
  desc: 'Address, phone, WhatsApp, map and directions to Gokarna Samudra Beach Resort, Belehittal Rd, Gokarna 581326.',
  h1: 'Contact and Directions', type: 'contact', pageType: 'ContactPage', og: 'ocean-deck-entrance-gokarna',
  lead: 'Gokarna Samudra Beach Resort is on Belehittal Rd, Dandebagh, Gokarna, Karnataka 581326. Call or WhatsApp +91 77608 50555. Email reservations@gokarnasamudra.com. We are a short walk from Gokarna Main Beach.',
  crumbs: [['Contact', '/contact/']],
  kw: ['Gokarna Samudra Beach Resort', 'Gokarna Samudra contact number', 'Gokarna hotel with parking'],
  faqTitle: 'Contact and Travel Questions', faqs: ['contact-number', 'station', 'parking', 'airport'],
  body: [
    S('enquiry', 'Send a Booking Enquiry', P('Share your dates and number of guests.', 'The form opens WhatsApp with your message ready to send.') + `<div class="contact-grid">${contactInfo}<div class="contact-form"><h3>Booking Enquiry Form</h3>${form('contact-enquiry')}</div></div>`),
    S('map', 'Map and Directions',
      mapFrame +
      UL(['<strong>By road:</strong> The resort is on Belehittal Rd in Dandebagh, Gokarna.', '<strong>By rail:</strong> Gokarna Road station is about {{DIST_GOKARNA_ROAD_STATION}} away.', '<strong>By air:</strong> Goa, Hubballi and Mangaluru airports are the main options.']) +
      `<div class="btn-row">${ext(MAPS_URL, 'Open the resort in Google Maps', 'btn')}${A('/gokarna-travel-guide/', 'How to reach Gokarna by bus, train or air')}${A('/rooms/', 'Choose a room before you travel')}${A('/faq/', 'Check our FAQ')}</div>`, 'alt'),
  ].join(''),
});

// BLOG INDEX
const posts = [
  ['/blog/gokarna-2-day-itinerary-from-bangalore/', 'Gokarna 2-Day Itinerary from Bangalore', 'Travel overnight, see the temple and beaches, and head home on Sunday night.', 'Read the 2-day itinerary', 'pool-front-cottage-gokarna', 'Pool and cottages featured on the Gokarna travel blog'],
  ['/blog/gokarna-in-monsoon/', 'Gokarna in Monsoon: What to Expect', 'Weather, beach safety and things to do in Gokarna during the rains.', 'Read the monsoon guide', 'ocean-deck-restaurant-gokarna', 'Indoor dining at Ocean Deck, from the Gokarna travel blog'],
];
add({
  path: '/blog/', title: 'Gokarna Travel Blog | Gokarna Samudra',
  desc: 'Tips, itineraries and seasonal guides for planning a stay in Gokarna.',
  h1: 'Gokarna Travel Blog by Gokarna Samudra', type: 'blog', pageType: 'CollectionPage',
  lead: 'Read tips, itineraries and seasonal guides for your Gokarna trip. Each post comes from the team at Gokarna Samudra Beach Resort. Start with our full Gokarna travel guide.',
  crumbs: [['Blog', '/blog/']],
  kw: ['Gokarna travel blog'],
  faqTitle: 'Trip Planning Questions', faqs: ['best-time', 'reach-bangalore', 'monsoon'],
  extraSchema: () => [{ '@type': 'ItemList', '@id': SITE + '/blog/#posts', itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + p[0], name: p[1] })) }],
  body: [
    S('posts', 'Latest Posts', `<div class="cards">${posts.map(p => `<article class="card">${img(p[4], { alt: p[5] })}<div class="card-body"><h3>${p[1]}</h3><p>${p[2]}</p><p><time datetime="${TODAY}">${TODAY_H}</time></p><a class="btn" href="${p[0]}">${p[3]}</a></div></article>`).join('')}</div>`),
    S('plan', 'Plan Your Trip', P('New to Gokarna?', A('/gokarna-travel-guide/', 'Start with our complete Gokarna travel guide') + '.', 'Visiting for darshan?', A('/stay-near-mahabaleshwar-temple/', 'See our temple stay tips') + '.', 'Ready to book?', A('/rooms/', 'Compare rooms and cottages') + '.'), 'alt'),
  ].join(''),
});

// BLOG: ITINERARY
add({
  path: '/blog/gokarna-2-day-itinerary-from-bangalore/', title: 'Gokarna 2-Day Itinerary from Bangalore',
  desc: 'A simple 2-day Gokarna plan from Bangalore: travel, beaches, temple visit and where to stay.',
  h1: 'Gokarna 2-Day Itinerary from Bangalore', type: 'post', article: true, og: 'pool-front-cottage-gokarna',
  lead: 'This Gokarna 2-day itinerary from Bangalore keeps travel simple. Leave on a Friday night, explore for two days and head home on Sunday night. It covers the temple, Main Beach, Kudle, Om and a short trek.',
  crumbs: [['Blog', '/blog/'], ['Gokarna 2-Day Itinerary from Bangalore', '/blog/gokarna-2-day-itinerary-from-bangalore/']],
  kw: ['Gokarna 2-day itinerary', 'Gokarna 2-day itinerary from Bangalore', 'how to reach Gokarna from Bangalore', 'Gokarna beach trek'],
  faqTitle: 'Itinerary Questions', faqs: ['blog-enough', 'blog-stay', 'reach-bangalore', 'trek'],
  body: [
    S('before-you-go', 'Before You Go',
      P('Gokarna is a small temple town with a string of beaches.', 'Two days give you a good taste of both.', 'Book your bus or train early for long weekends.', 'Reserve your room before you travel, especially in peak season.') +
      UL(['Book overnight travel for Friday and Sunday nights.', 'Pack light clothes, a hat, sunscreen and sturdy shoes.', 'Carry modest clothes for the temple.', 'Keep some cash for small shops and boat rides.'])),
    S('getting-there', 'Getting There from Bangalore',
      P('Overnight buses run from Bengaluru to Gokarna and nearby Kumta.', 'Trains are another option, to Gokarna Road or Kumta stations.', 'Check current timetables before you book.', 'Driving takes a full day, so start early and take breaks.') +
      P('Wondering how to reach Gokarna from Bangalore?', 'Pick a bus, a train or your own car.') +
      P('From Gokarna Road station, plan a taxi or auto to town.', 'Our resort is about {{DIST_GOKARNA_ROAD_STATION}} from the station.', 'Free parking is available if you drive.'), 'alt'),
    S('day-1', 'Day 1: Temple, Town and Main Beach',
      H3('day-1-morning', 'Morning') + P('Arrive early and freshen up.', 'Have a light South Indian breakfast in town.', 'Ask the front desk about leaving bags before check-in.', 'Walk to Mahabaleshwar Temple for darshan.', 'Then see Koti Tirtha, the sacred tank nearby.') +
      H3('day-1-afternoon', 'Afternoon') + P('Check in at 12:00 noon.', 'Have lunch at Ocean Deck Restaurant.', 'Rest in your room or cool off in the pool.') +
      H3('day-1-evening', 'Evening') + P('Stroll down Car Street and browse the small shops.', 'Walk to Gokarna Main Beach for the evening breeze.', 'Return for dinner with a pool view.')),
    S('day-2', 'Day 2: Kudle, Om and the Beach Trek',
      H3('day-2-morning', 'Early Morning') + P('Start around sunrise, when it is cooler.', 'Pack snacks, sunscreen and a hat.', 'Take a short ride to Kudle Beach.', 'Walk the coastal path over the headland to Om Beach.', 'Carry water and wear shoes with grip.') +
      H3('day-2-late-morning', 'Late Morning') + P('Head back to the resort to pack.', 'Check-out is at 11:00 am.', 'Ask the front desk about storing bags for the day.') +
      H3('day-2-afternoon', 'Afternoon and Evening') + P('Return to Kudle or Om Beach for lunch and the sunset.', 'Confident walkers can continue along the coastal path to Half Moon Beach.', 'Boats can bring you back in season.', 'Catch your evening bus or train home.'), 'alt'),
    S('third-day', 'Add a Third Day',
      P('A third day lets you slow down.', 'Take a boat from Om Beach to Half Moon and Paradise beaches.', 'Or drive to Mirjan Fort near Kumta for a half-day trip.', 'Yana and its rock formations are a longer day out.', 'Return to the pool in the afternoon.')),
    S('eating-out', 'Eating Out', P('Ocean Deck Restaurant serves Indian, South Indian, Chinese, Continental and Pan-Asian food.', 'Jain food is available on request.', 'In town, small eateries serve South Indian breakfasts and thalis.', 'Beach cafes at Kudle and Om open in season.'), 'alt'),
    S('where-to-stay', 'Where to Stay',
      split(P('Stay near Main Beach and the temple to save time.', 'Our resort is a short walk ({{DIST_MAIN_BEACH}}) from Gokarna Main Beach.', 'It has a swimming pool, free Wi-Fi, room service and free parking.', 'Free parking helps if you drive.'), 'pool-front-cottage-gokarna', 'Swimming pool and cottages, a base for a Gokarna 2-day itinerary') +
      `<div class="btn-row">${BTN(BOOK, 'Book Your Weekend Stay')}${A('/rooms/', 'Pick a room for your trip')}${A('/gokarna-travel-guide/', 'Read the complete travel guide')}${A('/blog/gokarna-in-monsoon/', 'Travelling in the rains? Read our monsoon tips')}</div>`),
    S('tips', 'Quick Tips',
      UL(['Swim only where it is marked safe, and never after dark.', 'Start treks early to avoid the midday sun.', 'Respect temple customs and local dress norms.', 'Carry a reusable water bottle.', 'Wear shoes you can get wet on boat landings.', 'Charge your phone before the trek.', 'Download offline maps before you travel.', 'Save the resort number: +91 77608 50555.'])),
  ].join(''),
});

// BLOG: MONSOON
add({
  path: '/blog/gokarna-in-monsoon/', title: 'Gokarna in Monsoon: What to Expect',
  desc: 'Weather, beaches, safety and things to do in Gokarna during the monsoon months.',
  h1: 'Gokarna in Monsoon: What to Expect', type: 'post', article: true, og: 'night-pool-gokarna-samudra',
  lead: 'Gokarna in monsoon is green, wet and quiet. Heavy rain usually falls from June to September. The sea turns rough, so beaches are for walks, not swims. Here is what to expect and how to plan.',
  crumbs: [['Blog', '/blog/'], ['Gokarna in Monsoon', '/blog/gokarna-in-monsoon/']],
  kw: ['Gokarna in monsoon', 'things to do in Gokarna'],
  faqTitle: 'Monsoon Questions', faqs: ['monsoon-months', 'monsoon-swim', 'monsoon-things', 'monsoon'],
  body: [
    S('weather', 'Weather and Rainfall',
      P('The monsoon reaches the Karnataka coast in early June.', 'Rain is heavy through June and July.', 'August and September bring breaks between showers.', 'Skies clear in October, when the main season begins.') +
      P('Expect warm, humid days and cooler, wet evenings.', 'Strong winds can come with the rain.', 'Check the forecast and weather alerts before you travel.', 'Humidity stays high, so clothes dry slowly.', 'Pack extra clothes and a few plastic bags.') +
      table(['Month', 'What to expect'], [['June', 'Monsoon arrives, with heavy rain and rough seas'], ['July', 'Often the wettest month of the year'], ['August', 'Heavy rain with some dry breaks'], ['September', 'Showers ease towards the end of the month'], ['October', 'Clearer skies as the main season begins']], 'Monsoon months at a glance')),
    S('beaches', 'Beaches in the Rain',
      P('The beaches look dramatic in the monsoon.', 'Waves are big and the sand is often empty.', 'Many beach shacks close from June to September.', 'Boat rides usually stop for the season.') +
      P('Gokarna Main Beach is easy to reach from town.', 'Kudle Beach and Om Beach have viewpoints on the road above.', 'Enjoy the views from a safe distance.', 'Sunsets are rare, but stormy skies make striking photos.'), 'alt'),
    S('safety', 'Safety Tips',
      UL(['Do not swim in the sea during the monsoon.', 'Stay away from rocks and cliff edges in rough weather.', 'Skip the coastal trek after heavy rain, as paths get slippery.', 'Avoid driving through flooded roads.', 'Follow local warnings and lifeguard advice.', 'Watch for sudden high waves at Main Beach.', 'Tell the front desk your plans if you head out in bad weather.', 'Keep your phone charged and save +91 77608 50555.'])),
    S('things-to-do', 'Things to Do in Gokarna in the Rains',
      P('The monsoon is a calm time for temple visits.', 'Mahabaleshwar Temple and Koti Tirtha are quieter than in peak season.', 'Walk Car Street between showers and try local snacks.', 'Small shrines around town are worth a slow visit.') +
      P('On clear days, short drives show off green hills and paddy fields.', 'Yana and its rock formations are a longer trip inland.', 'Ask locally about road conditions before you set out.'), 'alt'),
    S('getting-there', 'Getting to Gokarna in the Rains',
      P('Konkan Railway trains run through the monsoon.', 'Delays can happen after heavy rain.', 'Ghat roads inland can see landslides, so check the news before you drive.', 'Buses usually keep running, but allow extra time.', 'Gokarna Road station is about {{DIST_GOKARNA_ROAD_STATION}} from the resort.')),
    S('right-for-you', 'Is the Monsoon Right for You?',
      P('Choose the monsoon if you like rain, green views and fewer crowds.', 'Skip it if you want swimming, water sports or long beach treks.', 'Families with small children may prefer the dry season.', 'Pilgrims can still visit the temple through the rains.'), 'alt'),
    S('stay-in', 'Staying at the Resort in the Rain',
      split(P('Rainy days are good for slow mornings.', 'Order room service and stay in with a book.', 'Free Wi-Fi keeps you connected.', 'Ocean Deck Restaurant has views of the pool and the beach.', 'Free parking is on site if you drive.', 'Samudra Hall can host indoor events when it rains.') +
      P('Hot South Indian breakfasts and filter coffee suit rainy mornings.', 'Ocean Deck also serves Chinese, Continental and Pan-Asian dishes.', 'Jain food is available on request.'), 'ocean-deck-restaurant-gokarna', 'Ocean Deck dining room, a dry spot to eat during Gokarna in monsoon') +
      `<div class="btn-row">${BTN(BOOK, 'Book a Monsoon Getaway')}${A('/ocean-deck-restaurant/', 'See the Ocean Deck menu styles')}${A('/rooms/', 'Choose a room or cottage')}</div>`),
    S('packing', 'What to Pack',
      UL(['A light rain jacket or poncho', 'Quick-dry clothes and a spare pair of shoes', 'Sandals with good grip', 'Waterproof pouches for your phone and cash', 'Mosquito repellent']) +
      P('Planning a dry-season visit too?', A('/gokarna-travel-guide/', 'Read our full Gokarna travel guide'), 'or', A('/blog/gokarna-2-day-itinerary-from-bangalore/', 'follow our weekend plan from Bangalore') + '.'), 'alt'),
  ].join(''),
});

// PRIVACY
add({
  path: '/privacy-policy/', title: 'Privacy Policy | Gokarna Samudra',
  desc: 'How Gokarna Samudra Beach Resort handles data sent through this website.',
  h1: 'Privacy Policy for Gokarna Samudra', type: 'legal',
  lead: 'This privacy policy explains how Gokarna Samudra Beach Resort handles data sent through this website. It covers enquiry forms, analytics, maps and bookings. It was last updated on 18 November 2026.',
  crumbs: [['Privacy Policy', '/privacy-policy/']], kw: [],
  faqTitle: 'Privacy Questions', faqs: ['priv-data', 'priv-cookies', 'priv-ask'],
  body: [
    S('who-we-are', 'Who We Are', P('This website belongs to Gokarna Samudra Beach Resort.', 'Our address is Belehittal Rd, Dandebagh, Gokarna, Karnataka 581326, India.', 'You can email us at reservations@gokarnasamudra.com.'), 'prose'),
    S('enquiries', 'Enquiry Form and WhatsApp', P('Our enquiry form does not send data to our server.', 'When you submit it, your browser opens WhatsApp with your message.', 'You choose whether to send it.', 'Messages sent on WhatsApp are handled under WhatsApp\'s own privacy policy.'), 'prose alt'),
    S('bookings', 'Bookings', P('The Book Now buttons open our booking engine, run by a third party.', 'Booking and payment details you enter there are handled under its policy.', 'We receive the details needed to manage your stay.'), 'prose'),
    S('analytics', 'Analytics and Cookies', P('We use Google Analytics to understand how visitors use this site.', 'It sets cookies and collects data such as pages viewed, device type and approximate location.', 'We also record clicks on booking, phone and WhatsApp links.', 'You can block cookies in your browser settings.'), 'prose alt'),
    S('maps', 'Google Maps', P('Some pages show an embedded Google Map.', 'It loads from Google, which may set its own cookies.'), 'prose'),
    S('logs', 'Server Logs', P('Our web host may keep standard server logs.', 'These can include IP address, browser type, pages requested and time of visit.'), 'prose alt'),
    S('rights', 'Your Choices and Rights', P('You may have rights under India\'s Digital Personal Data Protection Act, 2023.', 'To ask about, correct or delete your data, email reservations@gokarnasamudra.com.') +
      `<div class="btn-row">${A('/contact/', 'Contact the resort')}${A('/faq/', 'Read guest FAQs')}${A('/', 'Return to the home page')}</div>`, 'prose'),
  ].join(''),
});

// 404
add({
  path: '/404.html', title: 'Page Not Found | Gokarna Samudra', desc: 'This page could not be found on the Gokarna Samudra Beach Resort website.',
  h1: 'Page Not Found at Gokarna Samudra', type: '404', noindex: true,
  lead: 'Sorry, we could not find that page. It may have moved after our website update. Use the links below to find what you need.',
  kw: [], faqs: [],
  body: S('helpful-links', 'Helpful Links', `<div class="btn-row">${A('/', 'Go to the home page')}${A('/rooms/', 'Browse rooms and cottages')}${A('/gokarna-travel-guide/', 'Read the Gokarna travel guide')}${A('/contact/', 'Contact the resort')}</div>`),
});


// ---------- resolve FAQs (drop items whose question needs a missing fact, or whose answer falls under 40 words) ----------
const wc = t => t.split(/\s+/).filter(Boolean).length;
const RESOLVED = {};
for (const [id, [q, a]] of Object.entries(FAQ)) { const qq = fill(q); const aa = fill(a).split(/(?<=[.!?])\s+/).filter(x => !UNF.test(x)).join(' '); RESOLVED[id] = !UNF.test(qq) && wc(aa) >= 40 ? [qq, aa] : null; }
for (const p of pages) {
  for (const id of p.faqs || []) if (!RESOLVED[id]) p.hidden.push(`FAQ(${id}: ${names(FAQ[id].join(' '))})`);
  p.faqs = (p.faqs || []).filter(id => RESOLVED[id]);
  if (p.faqGroups) p.faqGroups = p.faqGroups.map(([i, t, ids]) => [i, t, ids.filter(id => RESOLVED[id])]).filter(g => g[2].length);
}
const SCHEMA_LOG = [];
const ATOMIC = ['GeoCoordinates', 'QuantitativeValue', 'BedDetails'];
function prune(o, key) {
  if (Array.isArray(o)) return o.map(x => prune(x, key)).filter(x => x !== undefined);
  if (o && typeof o === 'object') {
    const out = {}; let lost = false;
    for (const [k, v] of Object.entries(o)) { const r = prune(v, k); if (r === undefined) { lost = true; continue; } out[k] = r; }
    if (lost && ATOMIC.includes(o['@type'])) { SCHEMA_LOG.push(key); return undefined; }
    if (o['@type'] && !Object.keys(out).some(k => k !== '@type' && k !== 'unitCode')) { SCHEMA_LOG.push(key); return undefined; }
    return out;
  }
  if (typeof o === 'string') { const f = fill(o); if (UNF.test(f)) { SCHEMA_LOG.push(key); return undefined; } return f; }
  return o;
}
// ---------- schema ----------
function ADDRESS() { return { '@type': 'PostalAddress', streetAddress: 'Belehittal Rd, Dandebagh', addressLocality: 'Gokarna', addressRegion: 'Karnataka', postalCode: '581326', addressCountry: 'IN' }; }
const RESORT = {
  '@type': 'Resort', '@id': SITE + '/#resort', name: 'Gokarna Samudra Beach Resort', alternateName: 'GSB Resort Gokarna', url: SITE + '/',
  logo: { '@type': 'ImageObject', url: SITE + I + 'gokarna-samudra-logo-512.png', width: 512, height: 512 },
  image: ['pool-front-cottage-gokarna', 'night-pool-gokarna-samudra', 'deluxe-room-gokarna', 'ocean-deck-restaurant-gokarna'].map(s => SITE + I + s + '-og.jpg'),
  description: 'Pool resort a short walk from Gokarna Main Beach and Mahabaleshwar Temple, with Standard Rooms, Deluxe Rooms, Pool Front Cottages, Ocean Deck Restaurant and Samudra Hall.',
  telephone: '+91-77608-50555', email: 'reservations@gokarnasamudra.com', address: ADDRESS(),
  geo: { '@type': 'GeoCoordinates', latitude: '{{LAT}}', longitude: '{{LNG}}' }, hasMap: MAPS_URL,
  checkinTime: '12:00', checkoutTime: '11:00', numberOfRooms: '{{ROOM_COUNT}}', priceRange: 'From INR {{PRICE_FROM}}', petsAllowed: false,
  paymentAccepted: '{{PAYMENT_METHODS}}',
  amenityFeature: ['Swimming pool', 'Free Wi-Fi', 'Room service', 'Free parking', 'On-site restaurant (Ocean Deck)', 'Air-conditioned event hall (Samudra Hall)'].map(n => ({ '@type': 'LocationFeatureSpecification', name: n, value: true })),
  potentialAction: { '@type': 'ReserveAction', target: { '@type': 'EntryPoint', urlTemplate: BOOK, actionPlatform: ['http://schema.org/DesktopWebPlatform', 'http://schema.org/MobileWebPlatform'] }, result: { '@type': 'LodgingReservation', name: 'Room reservation at Gokarna Samudra Beach Resort' } },
  sameAs: [FB, IG, '{{GBP_URL}}', '{{TRIPADVISOR_URL}}', '{{BOOKING_COM_URL}}'],
};
const WEBSITE = { '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: 'Gokarna Samudra Beach Resort', alternateName: 'Gokarna Samudra', publisher: { '@id': SITE + '/#resort' }, inLanguage: 'en-IN' };
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function schema(p) {
  const url = SITE + p.path;
  const og = SITE + I + (p.og || 'pool-front-cottage-gokarna') + '-og.jpg';
  const g = [RESORT, WEBSITE, {
    '@type': p.pageType || 'WebPage', '@id': url + '#webpage', url, name: p.title, description: p.desc, inLanguage: 'en-IN',
    isPartOf: { '@id': SITE + '/#website' }, about: { '@id': SITE + '/#resort' }, primaryImageOfPage: { '@type': 'ImageObject', url: og },
    dateModified: TODAY, ...(p.crumbs ? { breadcrumb: { '@id': url + '#breadcrumb' } } : {}),
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.hero .lead', '.faq-answer'] },
  }];
  if (p.crumbs) g.push({ '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [['Home', '/'], ...p.crumbs].map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) });
  if (p.article) g.push({ '@type': 'Article', '@id': url + '#article', headline: p.h1, description: p.desc, image: og, author: { '@id': SITE + '/#resort' }, publisher: { '@id': SITE + '/#resort' }, datePublished: TODAY, dateModified: TODAY, mainEntityOfPage: { '@id': url + '#webpage' }, inLanguage: 'en-IN' });
  if (p.faqs && p.faqs.length) g.push({ '@type': 'FAQPage', '@id': url + '#faq', mainEntity: p.faqs.map(id => ({ '@type': 'Question', name: RESOLVED[id][0], acceptedAnswer: { '@type': 'Answer', text: RESOLVED[id][1] } })) });
  if (p.extraSchema) g.push(...p.extraSchema());
  const pruned = prune({ '@context': 'https://schema.org', '@graph': g });
  return JSON.stringify(pruned).replace(/</g, '\\u003c');
}

// ---------- render ----------
const faqItems = ids => ids.map(id => { if (!FAQ[id]) throw new Error('FAQ ' + id); return `<div class="faq-item"><h3 id="q-${id}">${esc(RESOLVED[id][0])}</h3><div class="faq-answer"><p>${esc(RESOLVED[id][1])}</p></div></div>`; }).join('');
const faqSection = p => {
  if (p.faqGroups) return p.faqGroups.map(([id, t, ids], i) => S(id, t, faqItems(ids), i % 2 ? 'alt faq' : 'faq')).join('');
  if (!p.faqs.length) return '';
  return S('faq', p.faqTitle, faqItems(p.faqs), 'alt faq');
};
const crumbsHtml = p => p.crumbs ? `<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li>${p.crumbs.map(([n, u], i) => i === p.crumbs.length - 1 ? `<li aria-current="page">${esc(n)}</li>` : `<li><a href="${u}">${esc(n)}</a></li>`).join('')}</ol></nav>` : '';

function heroHtml(p) {
  if (p.home) {
    const slides = img('pool-front-cottage-gokarna', { v: 'hero', eager: true, priority: true, cls: 'active', alt: 'Resort in Gokarna with swimming pool and pool front cottages' }) + img('night-pool-gokarna-samudra', { v: 'deferred' }) + img('deluxe-room-gokarna', { v: 'deferred' });
    const car = ['standard-room-gokarna', 'deluxe-room-gokarna', 'pool-front-cottage-gokarna'].map((s, i) => img(s, { eager: true, sizes: '320px', cls: i ? '' : 'active', alt: i === 2 ? 'Pool front cottages beside the swimming pool' : null })).join('');
    return `<section id="home" class="hero hero-home" aria-labelledby="page-title"><div class="hero-media" data-rotate>${slides}</div><div class="hero-inner"><div class="hero-left"><span class="eyebrow">Gokarna, Karnataka · Book Direct</span><h1 id="page-title">${p.h1}</h1><p class="lead">${sentences(p.lead)}</p><div class="hero-actions">${BTN(BOOK, 'Check Availability')}<a class="btn btn-outline" href="/rooms/">View Rooms</a></div></div><div class="hero-right"><div class="room-carousel" data-rotate>${car}</div></div></div></section>`;
  }
  const media = p.hero ? `<div class="hero-media">${img(p.hero, { v: 'hero', eager: true, priority: true, cls: 'active', alt: p.heroAlt })}</div>` : '';
  return `<section id="hero" class="hero page-hero${p.hero ? '' : ' no-img'}" aria-labelledby="page-title">${media}<div class="hero-inner">${crumbsHtml(p)}<h1 id="page-title">${p.h1}</h1><p class="lead">${sentences(p.lead)}</p>${p.article ? updated : ''}</div></section>`;
}

function layout(p, cssV, jsV, crit) {
  const url = SITE + p.path;
  const og = SITE + I + (p.og || 'pool-front-cottage-gokarna') + '-og.jpg';
  const heroSlug = p.home ? 'pool-front-cottage-gokarna' : p.hero;
  const preload = heroSlug ? `<link rel="preload" as="image" href="${I}${heroSlug}-1600.webp" imagesrcset="${I}${heroSlug}-hero-800.webp 800w, ${I}${heroSlug}-1600.webp 1600w" imagesizes="100vw" fetchpriority="high">` : '';
  const faq = faqSection(p);
  const body = p.body.includes('%%FAQ%%') ? p.body.replace('%%FAQ%%', faq) : p.body + faq;
  const ogAlt = esc((ALT[p.og || 'pool-front-cottage-gokarna']) + SUFFIX);
  return `<!DOCTYPE html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(p.title)}</title><meta name="description" content="${esc(p.desc)}"><meta name="robots" content="${p.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}"><link rel="canonical" href="${url}"><meta property="og:type" content="${p.article ? 'article' : 'website'}"><meta property="og:site_name" content="Gokarna Samudra Beach Resort"><meta property="og:locale" content="en_IN"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${ogAlt}">${p.article ? `<meta property="article:published_time" content="${TODAY}"><meta property="article:modified_time" content="${TODAY}">` : ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(p.desc)}"><meta name="twitter:image" content="${og}"><meta name="theme-color" content="#002B3D"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml">${preload}<style>${crit}</style><link rel="preload" href="/assets/css/style.css?v=${cssV}" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="/assets/css/style.css?v=${cssV}"></noscript><script type="application/ld+json">${schema(p)}</script><script async src="https://www.googletagmanager.com/gtag/js?id=${GA}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA}');</script><script defer src="/assets/js/main.js?v=${jsV}"></script></head><body><a class="skip-link" href="#main">Skip to content</a>${header(p.path)}<main id="main">${heroHtml(p)}${body}</main>${footer}${waFloat}${p.lightbox ? `<dialog id="lightbox" class="lightbox" aria-label="Photo viewer"><button class="lb-close" type="button" aria-label="Close photo">&times;</button><img src="${GIF}" width="1600" height="1200" alt="Enlarged photo at Gokarna Samudra Beach Resort, Gokarna"></dialog>` : ''}</body></html>`;
}

// ---------- build ----------
(async () => {
  const CSS = require('./styles.js');
  const css = new CleanCSS({ level: 2 }).minify(CSS.critical + CSS.rest).styles;
  const crit = new CleanCSS({ level: 2 }).minify(CSS.critical).styles;
  const js = (await Terser.minify(fs.readFileSync(path.join(__dirname, 'main.src.js'), 'utf8'))).code;
  const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
  fs.mkdirSync(path.join(ROOT, 'assets/css'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'assets/js'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'assets/css/style.css'), css);
  fs.writeFileSync(path.join(ROOT, 'assets/js/main.js'), js);
  const cssV = hash(css), jsV = hash(js);
  const opts = { collapseWhitespace: true, removeComments: true, minifyCSS: false, minifyJS: true, collapseBooleanAttributes: true, removeRedundantAttributes: true, useShortDoctype: true, removeScriptTypeAttributes: false, decodeEntities: false, sortClassName: false };
  for (const p of pages) {
    const html = await minify(layout(p, cssV, jsV, crit), opts);
    if (UNF.test(html)) throw new Error('Unfilled placeholder reached ' + p.path + ': ' + names(html));
    const out = p.path.endsWith('.html') ? path.join(ROOT, p.path) : path.join(ROOT, p.path, 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
  }
  // technical files
  const live = pages.filter(p => !p.noindex);
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${live.map(p => `  <url><loc>${SITE}${p.path}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Google-Extended', 'ClaudeBot', 'Bingbot'];
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /dev/\n\n${bots.map(b => `User-agent: ${b}\nAllow: /\nDisallow: /dev/`).join('\n\n')}\n\nSitemap: ${SITE}/sitemap.xml\n`);
  fs.writeFileSync(path.join(ROOT, INDEXNOW_KEY + '.txt'), INDEXNOW_KEY);
  fs.writeFileSync(path.join(ROOT, 'site.webmanifest'), JSON.stringify({ name: 'Gokarna Samudra Beach Resort', short_name: 'Gokarna Samudra', start_url: '/', display: 'browser', background_color: '#FAF7F3', theme_color: '#002B3D', icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }] }, null, 1));
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), `# Gokarna Samudra Beach Resort

> Pool resort on Belehittal Rd, Dandebagh, Gokarna, Karnataka 581326, India. A short walk from Gokarna Main Beach and Mahabaleshwar Temple. Rooms, pool front cottages, Ocean Deck multi-cuisine restaurant and Samudra Hall event space. Book direct.

- Name: Gokarna Samudra Beach Resort (also GSB Resort Gokarna)
- Address: Belehittal Rd, Dandebagh, Gokarna, Karnataka 581326, India
- Phone and WhatsApp: +91 77608 50555
- Email: reservations@gokarnasamudra.com
- Check-in: 12:00. Check-out: 11:00. Pets: not allowed.
- Rooms: Standard Room (cozy, modern amenities; solo travellers and couples); Deluxe Room (premium furniture, balcony, scenic views; families); Pool Front Cottages (private sit-out overlooking the pool)
- Restaurant: Ocean Deck. Indian, South Indian, Chinese, Continental and Pan-Asian. Jain food on request. Beach and pool view.
- Events: Samudra Hall. Air-conditioned, fast Wi-Fi, projector, AV equipment.
- Facilities: swimming pool, free Wi-Fi, room service, free parking
- Book direct: ${BOOK}
- Social: ${FB} | ${IG}

## Key pages

${live.map(p => `- [${p.h1}](${SITE}${p.path}): ${p.desc}`).join('\n')}
`);
  fs.writeFileSync(path.join(ROOT, '.htaccess'), require('./htaccess.js'));
  fs.writeFileSync(path.join(__dirname, 'pages.json'), JSON.stringify(pages.map(p => ({ path: p.path, type: p.type, kw: p.kw, faqs: (p.faqs || []).map(id => RESOLVED[id]) })), null, 1));
  for (const f of ['llms.txt', 'sitemap.xml', 'robots.txt', 'site.webmanifest', '.htaccess']) if (UNF.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))) throw new Error('Placeholder in ' + f);
  for (const p of pages) if (p.hidden.length) console.log('HIDDEN', p.path, [...new Set(p.hidden)].join(', '));
  console.log('SCHEMA OMITTED', [...new Set(SCHEMA_LOG)].join(', '));
  console.log(`Built ${pages.length} pages. css ${css.length}B crit ${crit.length}B js ${js.length}B`);
})().catch(e => { console.error(e); process.exit(1); });
