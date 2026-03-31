/**
 * Seed script — syncs existing homepage, OfferModal popup, and InquiryModal
 * form into the admin system using the EXACT same design as the React components.
 *
 * Run:  node src/seed/seedExisting.js
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dns from "dns";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { PmLandingPage } from "../models/pmLandingPage.model.js";
import { PmForm } from "../models/pmForm.model.js";
import { dbName } from "../constants.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
const uri = process.env.MONGO_URI;
if (!uri) { console.error("MONGO_URI not set in .env"); process.exit(1); }

let connectionUri = uri;
try {
  const parsed = new URL(uri);
  if (!parsed.pathname || parsed.pathname === "/") connectionUri = `${uri}/${dbName}`;
} catch { connectionUri = `${uri}/${dbName}`; }

await mongoose.connect(connectionUri, { serverSelectionTimeoutMS: 30000, family: 4 });
console.log("MongoDB connected");

// ─── Homepage HTML ─────────────────────────────────────────────────────────────
// Uses Tailwind CDN + exact same classes & images as the React components
const HOMEPAGE_HTML = `
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          navy:    '#1a1a2e',
          primary: '#f97316',
          'primary-dark': '#ea580c',
          green:   '#16a34a',
          'light-blue': '#eff6ff',
        }
      }
    }
  }
</script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Poppins', sans-serif; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>

<!-- Hero -->
<section class="bg-white py-12 md:py-20 px-6 md:px-12 lg:px-24">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-10">
    <div class="flex-1 space-y-6">
      <img src="/images/logo.png" alt="BizCivitas" class="h-10 md:h-12 w-auto">
      <h1 class="text-4xl md:text-5xl font-bold text-navy leading-tight">
        BizCivitas Digital<br>Membership
      </h1>
      <p class="text-gray-500 text-base md:text-lg max-w-lg leading-relaxed">
        You don't need more events or workshops—you need one serious platform where ambitious founders and real deals come to you.
      </p>
      <p class="text-gray-500 text-base md:text-lg max-w-lg">
        That's exactly what BizCivitas Digital Membership is built for.
      </p>
      <button
        onclick="document.dispatchEvent(new CustomEvent('open-inquiry'))"
        class="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-md text-base transition-colors cursor-pointer"
      >
        Join BizCivitas
      </button>
    </div>
    <div class="flex-1 flex justify-center">
      <img src="/images/hero-phones.png" alt="BizCivitas App Preview" class="w-full max-w-[500px] h-auto">
    </div>
  </div>
</section>

<!-- Struggling With -->
<section class="py-16 px-6 md:px-12 lg:px-24 bg-white">
  <div class="max-w-7xl mx-auto">
    <h2 class="text-2xl md:text-3xl font-bold text-navy text-center mb-12">
      BizCivitas is for <span class="text-orange-500">YOU</span> if you're struggling with:
    </h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
      <div class="flex flex-col items-center text-center gap-4">
        <img src="/images/icon-slow-networking.png" alt="Slow networking" class="w-16 h-16 object-contain">
        <p class="text-sm md:text-base font-medium text-navy">Slow networking</p>
      </div>
      <div class="flex flex-col items-center text-center gap-4">
        <img src="/images/icon-passive-online.png" alt="Passive online presence" class="w-16 h-16 object-contain">
        <p class="text-sm md:text-base font-medium text-navy">Passive online presence</p>
      </div>
      <div class="flex flex-col items-center text-center gap-4">
        <img src="/images/icon-cold-outreach.png" alt="Cold outreach burnout" class="w-16 h-16 object-contain">
        <p class="text-sm md:text-base font-medium text-navy">Cold outreach burnout</p>
      </div>
      <div class="flex flex-col items-center text-center gap-4">
        <img src="/images/icon-excessive-noise.png" alt="Excessive noise" class="w-16 h-16 object-contain">
        <p class="text-sm md:text-base font-medium text-navy">Excessive noise, no warm intros</p>
      </div>
    </div>
  </div>
</section>

<!-- Stop Waiting -->
<section class="py-16 px-6 md:px-12 lg:px-24 bg-blue-50">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
    <div class="flex-1 flex justify-center">
      <img src="/images/stop-waiting-phones.png" alt="BizCivitas App" class="w-full max-w-[500px] h-auto">
    </div>
    <div class="flex-1 space-y-6">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-navy">Stop waiting passively to be discovered.</h2>
        <h2 class="text-2xl md:text-3xl font-bold text-green-600 mt-2">Start:</h2>
      </div>
      <div class="space-y-5">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <p class="text-gray-700 text-base md:text-lg">Getting found through your Bizcivitas profile</p>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <p class="text-gray-700 text-base md:text-lg">Joining targeted conversations and initiatives.</p>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <p class="text-gray-700 text-base md:text-lg">Receiving relevant introductions and referrals</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Success Stories -->
<section class="py-16 px-6 md:px-12 lg:px-24 bg-white">
  <div class="max-w-7xl mx-auto">
    <h2 class="text-2xl md:text-3xl font-bold text-navy mb-12">Our Members Success Stories</h2>
    <div class="flex gap-8 overflow-x-auto scrollbar-hide pb-4 justify-center">
      <div class="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm flex-shrink-0 w-[280px] md:w-[300px]">
        <div class="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden bg-gray-100">
          <img src="/images/jaimi.jpg" alt="Jaimi Panchal" class="w-full h-full object-cover">
        </div>
        <div class="h-10 flex items-center justify-center mb-3">
          <img src="/images/jaimi-logo.jpg" alt="business logo" class="h-10 w-auto object-contain">
        </div>
        <h3 class="font-semibold text-navy text-lg mb-1">Jaimi Panchal</h3>
        <p class="text-gray-500 text-sm leading-relaxed">"Has Received Rs.8,00,000/- Worth of Business."</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm flex-shrink-0 w-[280px] md:w-[300px]">
        <div class="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden bg-gray-100">
          <img src="/images/deven.jpg" alt="Deven Oza" class="w-full h-full object-cover">
        </div>
        <div class="h-10 flex items-center justify-center mb-3">
          <img src="/images/jaimi-logo.jpg" alt="business logo" class="h-10 w-auto object-contain">
        </div>
        <h3 class="font-semibold text-navy text-lg mb-1">Deven Oza</h3>
        <p class="text-gray-500 text-sm leading-relaxed">"Has Received Rs. 4,00,000/- Worth of Business."</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm flex-shrink-0 w-[280px] md:w-[300px]">
        <div class="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden bg-gray-100">
          <img src="/images/suraj.jpg" alt="Suraj Tanna" class="w-full h-full object-cover">
        </div>
        <div class="h-10 flex items-center justify-center mb-3">
          <img src="/images/suraj-logo.jpg" alt="business logo" class="h-10 w-auto object-contain">
        </div>
        <h3 class="font-semibold text-navy text-lg mb-1">Suraj Tanna</h3>
        <p class="text-gray-500 text-sm leading-relaxed">"Has Given Rs.10,00,000/- Worth of Business."</p>
      </div>
    </div>
  </div>
</section>

<!-- Membership -->
<section class="py-16 px-6 md:px-12 lg:px-24 bg-[#1a1a2e] text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
    <div class="flex-1">
      <h2 class="text-2xl md:text-3xl font-bold mb-10">What can you get from this<br>membership?</h2>
      <div class="grid grid-cols-1 gap-6">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <div><h3 class="font-semibold text-lg mb-1">BizConnect</h3><p class="text-gray-300 text-sm leading-relaxed">Build global connections with like-minded business owners.</p></div>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v5M8 23h8"/></svg>
          </div>
          <div><h3 class="font-semibold text-lg mb-1">BizPulse</h3><p class="text-gray-300 text-sm leading-relaxed">Get access to curated content - announcements, polls and spotlights.</p></div>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div><h3 class="font-semibold text-lg mb-1">BizHub</h3><p class="text-gray-300 text-sm leading-relaxed">Get access to community forums for open discussions.</p></div>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <div><h3 class="font-semibold text-lg mb-1">Digital Business Directory</h3><p class="text-gray-300 text-sm leading-relaxed">Get easily discovered by the right people who need what you offer.</p></div>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm0-14a1 1 0 0 0-1 1v4a1 1 0 0 0 .553.894l3 1.5a1 1 0 0 0 .894-1.788L13 10.382V7a1 1 0 0 0-1-1z"/></svg>
          </div>
          <div><h3 class="font-semibold text-lg mb-1">AI Matchmaking</h3><p class="text-gray-300 text-sm leading-relaxed">Get practical insights from peers.</p></div>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </div>
          <div><h3 class="font-semibold text-lg mb-1">Workshops &amp; Webinars</h3><p class="text-gray-300 text-sm leading-relaxed">Get access to monthly workshops and stay up-to-date.</p></div>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
          </div>
          <div><h3 class="font-semibold text-lg mb-1">Knowledge Hub</h3><p class="text-gray-300 text-sm leading-relaxed">Get curated content from experienced professionals.</p></div>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <div><h3 class="font-semibold text-lg mb-1">Business Growth Resources</h3><p class="text-gray-300 text-sm leading-relaxed">Get e-mail newsletters with latest industry insights.</p></div>
        </div>
      </div>
    </div>
    <div class="flex-1 flex justify-center">
      <img src="/images/membership-phones.png" alt="Membership Features" class="w-full max-w-[500px] h-auto">
    </div>
  </div>
</section>

<!-- Why BizCivitas -->
<section class="py-16 px-6 md:px-12 lg:px-24 bg-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
    <div class="flex-1 flex justify-center">
      <img src="/images/why-bizcivitas.png" alt="Why Bizcivitas" class="w-full max-w-[500px] h-auto">
    </div>
    <div class="flex-1 space-y-6">
      <h2 class="text-2xl md:text-3xl font-bold text-navy">Why Bizcivitas?</h2>
      <div class="space-y-5">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
          </div>
          <p class="text-gray-700 text-base">Targeted referrals from a trusted network.</p>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          </div>
          <p class="text-gray-700 text-base">Cross-city and cross-industry connections on demand.</p>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <p class="text-gray-700 text-base">Being easily found by the right people who need what you offer.</p>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          </div>
          <p class="text-gray-700 text-base">Creating consistent opportunities through an active network.</p>
        </div>
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <p class="text-gray-700 text-base">Practical insights from people actually building businesses.</p>
        </div>
      </div>
      <button
        onclick="document.dispatchEvent(new CustomEvent('open-inquiry'))"
        class="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-md text-base transition-colors cursor-pointer"
      >
        Access Now
      </button>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="bg-[#1a1a2e] text-white py-10 px-6 md:px-12">
  <div class="max-w-7xl mx-auto flex flex-col items-center gap-6">
    <img src="/images/logo-footer.png" alt="BizCivitas" class="h-10 md:h-12 w-auto">
    <div class="flex items-center gap-4">
      <a href="https://www.facebook.com/bizcivitas/" target="_blank" rel="noopener noreferrer" class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <img src="/images/facebook.svg" alt="Facebook" class="w-5 h-5">
      </a>
      <a href="https://www.instagram.com/bizcivitas/" target="_blank" rel="noopener noreferrer" class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <img src="/images/instagram.svg" alt="Instagram" class="w-5 h-5">
      </a>
      <a href="https://www.linkedin.com/company/bizcivitas/" target="_blank" rel="noopener noreferrer" class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <img src="/images/linkedin.svg" alt="LinkedIn" class="w-5 h-5">
      </a>
      <a href="https://www.youtube.com/@BizCivitas" target="_blank" rel="noopener noreferrer" class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <img src="/images/youtube.svg" alt="YouTube" class="w-5 h-5">
      </a>
    </div>
    <p class="text-gray-400 text-sm">2026 Bizcivitas - All rights reserved</p>
  </div>
</footer>

<script>
  // Wire up "open-inquiry" event to the React InquiryModal via a global hook
  document.addEventListener('open-inquiry', function() {
    window.__openInquiry && window.__openInquiry();
  });
</script>
`;

// ─── Offer Popup HTML (matches OfferModal.tsx exactly) ────────────────────────
const OFFER_POPUP_HTML = `
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Poppins', sans-serif; }
  @keyframes scaleIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
  .animate-scale-in { animation: scaleIn 0.3s ease-out; }
</style>

<div class="animate-scale-in overflow-hidden rounded-2xl shadow-2xl max-w-lg mx-auto">
  <!-- Top gradient -->
  <div class="relative bg-gradient-to-br from-orange-500 via-orange-400 to-yellow-400 px-8 pt-10 pb-8 text-center overflow-hidden">
    <div class="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full"></div>
    <div class="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full"></div>
    <!-- Logo -->
    <div class="relative z-10 mb-5 flex justify-center">
      <div class="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center p-3">
        <img src="/images/square.png" alt="BizCivitas" class="h-14 w-14 object-contain">
      </div>
    </div>
    <h2 class="text-white text-2xl md:text-3xl font-bold relative z-10 leading-tight">
      Get your Digital<br>Membership at
      <span class="bg-white text-orange-500 px-2 py-0.5 rounded-md inline-block">20% off</span>
    </h2>
    <p class="text-white/90 text-sm mt-3 relative z-10">Fast-track your network before spots fill.</p>
  </div>
  <!-- Bottom white -->
  <div class="bg-white px-8 py-8 text-center">
    <p class="text-[#1a1a2e] font-semibold text-lg tracking-wide mb-6">Connect. Learn. Grow.</p>
    <div class="flex items-center justify-center gap-3 mb-6">
      <span class="text-gray-400 line-through text-2xl font-medium">₹6,999/-</span>
      <span class="text-4xl font-extrabold text-green-600">₹5,599/-</span>
    </div>
    <button
      onclick="document.dispatchEvent(new CustomEvent('open-inquiry'))"
      class="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02]"
    >
      Access Now
    </button>
    <p class="text-gray-400 text-xs mt-4">No spam. Cancel anytime.</p>
  </div>
</div>
`;

// ─── Upsert records ────────────────────────────────────────────────────────────
await PmLandingPage.findOneAndUpdate(
  { slug: "bizcivitas-home" },
  {
    title:       "BizCivitas Homepage",
    slug:        "bizcivitas-home",
    type:        "page",
    status:      "published",
    description: "Main BizCivitas landing page — editable from admin. Renders on the homepage at /",
    content:     HOMEPAGE_HTML,
    buildMethod: "code",
  },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
console.log("✓ Homepage landing page seeded (slug: bizcivitas-home)");

await PmLandingPage.findOneAndUpdate(
  { slug: "offer-popup" },
  {
    title:       "Offer Popup — 20% Off",
    slug:        "offer-popup",
    type:        "popup",
    status:      "published",
    description: "Promotional popup — ₹6,999 → ₹5,599 at 20% off. Trigger: 2 seconds after page load.",
    content:     OFFER_POPUP_HTML,
    buildMethod: "code",
    settings: {
      triggerType:    "time",
      triggerValue:   2,
      successMessage: "Thank you! Redirecting to checkout…",
    },
  },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
console.log("✓ Offer popup seeded (slug: offer-popup)");

await PmForm.findOneAndUpdate(
  { title: "BizCivitas Membership Inquiry" },
  {
    title:          "BizCivitas Membership Inquiry",
    description:    "Main application form — collects lead details and redirects to Razorpay checkout.",
    status:         "active",
    successMessage: "Thank you! Redirecting to checkout…",
    redirectUrl:    "/checkout",
    fields: [
      { id: "fullName",         type: "text",     label: "Full Name",          placeholder: "Full Name",            required: true  },
      { id: "companyName",      type: "text",     label: "Company Name",       placeholder: "Company Name",         required: true  },
      { id: "email",            type: "email",    label: "Email",              placeholder: "Email",                required: true  },
      { id: "phone",            type: "phone",    label: "Phone",              placeholder: "Phone",                required: true  },
      { id: "city",             type: "text",     label: "City",               placeholder: "City",                 required: true  },
      { id: "state",            type: "text",     label: "State",              placeholder: "State",                required: true  },
      { id: "role",             type: "select",   label: "Role / Designation", placeholder: "",                     required: true,
        options: ["Founder", "Co-Founder", "CEO", "Director", "Manager", "Other"] },
      { id: "teamSize",         type: "select",   label: "Team Size",          placeholder: "",                     required: true,
        options: ["1-5", "6-20", "21-50", "51-100", "100+"] },
      { id: "gstNumber",        type: "text",     label: "GST Number",         placeholder: "e.g. 22AAAAA0000A1Z5", required: false },
      { id: "consentMessages",  type: "checkbox", label: "I consent to receive non-marketing messages from BizCivitas.", required: false },
      { id: "consentMarketing", type: "checkbox", label: "I consent to receive marketing and promotional messages from BizCivitas.", required: false },
    ],
  },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
console.log("✓ Inquiry form seeded");

await mongoose.disconnect();
console.log("\nDone. Homepage, popup and form are synced in admin.");
