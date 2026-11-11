// Public invitation renderer. Keep attendance facts in marketing-launch.json.
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const asset = 'resources/marketing/guest/';
export function renderGuestPage(data) {
  const e = data.event;
  const g = data.guest_page;
  const directions = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.address);
  const calendar = '<a class="button gold" href="resources/marketing/chosen-2026.ics" download="chosen-2026.ics"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-12 5h6"/></svg>Save the Date</a>';
  const preview = g.preview;
  const hasPreview = Boolean(preview?.video && preview?.captions && preview?.poster);
  const guestAnswers = [
    { question: 'When is CHOSEN?', answer: `${e.date}, at ${e.time} Eastern.` },
    { question: 'Where is the show?', answer: `${e.venue}, ${e.address}.` },
    { question: 'How much is admission?', answer: `${e.admission}. Bring someone you love.` },
    ...(g.confirmed_guest_information ?? [])
  ];
  const schema = {
    '@context': 'https://schema.org', '@type': 'TheaterEvent', name: e.title,
    description: 'Experience Mary and Joseph’s journey through music, dance, and drama. Make room for hope this Christmas.',
    startDate: '2026-12-20T18:00:00-05:00', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled', isAccessibleForFree: true, url: e.url,
    image: new URL(asset + 'chosen-social.jpg', e.url).href,
    location: { '@type': 'Place', name: e.venue, address: { '@type': 'PostalAddress', streetAddress: '5555 NW 95th Avenue', addressLocality: 'Sunrise', addressRegion: 'FL', postalCode: '33351', addressCountry: 'US' } },
    organizer: { '@type': 'Organization', name: e.venue, url: 'https://thefaithcenterint.org/' }
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#08131f">
<title>CHOSEN: The Story Before the Manger | December 20 · Free Admission</title>
<meta name="description" content="Before the manger, there was a choice to trust. Experience CHOSEN through music, dance, and drama. December 20, 2026 at 6 PM at The Faith Center, Sunrise. Free admission.">
<link rel="canonical" href="${esc(e.url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="CHOSEN: The Story Before the Manger">
<meta property="og:description" content="Make room for hope this Christmas. December 20, 2026 · 6 PM · The Faith Center, Sunrise · Free admission.">
<meta property="og:url" content="${esc(e.url)}">
<meta property="og:image" content="${esc(new URL(asset + 'chosen-social.jpg', e.url).href)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="CHOSEN promo artwork: illustrated Mary and Joseph beneath a star, with the show title and event details">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" as="image" href="${asset}chosen-hero.webp" media="(min-width: 701px)">
<link rel="preload" as="image" href="${asset}chosen-hero-mobile.webp" media="(max-width: 700px)">
<link rel="stylesheet" href="${asset}guest.css?v=20261111-2">
<script type="application/ld+json">${json(schema)}</script>
<script src="${asset}guest.js?v=20261111-1" defer></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="header-inner"><a class="small-brand" href="chosen.html" aria-label="CHOSEN home">CHOSEN<span>The Faith Center</span></a>
  <nav aria-label="Show navigation"><a href="#story">The Story</a><a href="#cast">The Cast</a>${hasPreview ? '<a href="#preview">Preview</a>' : ''}<a href="#details">Plan Your Visit</a></nav>
  <a class="header-cta" href="resources/marketing/chosen-2026.ics" download="chosen-2026.ics">Save the Date<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div>
</header>
<main id="main">
<section class="hero hero--promo" aria-labelledby="show-title">
  <h1 id="show-title" class="sr-only">CHOSEN: The Story Before the Manger</h1>
  <picture class="hero-art"><source media="(max-width:700px)" srcset="${asset}chosen-hero-mobile.webp" width="1100" height="619"><img src="${asset}chosen-hero.webp" alt="CHOSEN promo artwork: illustrated Mary and Joseph beneath a star, with the show title and event details" width="2200" height="600" fetchpriority="high" decoding="async"></picture>
  <div class="promo-content wrap"><div class="promo-copy"><p class="eyebrow"><span aria-hidden="true">✦</span> The Faith Center presents</p><h2>${esc(g.hook)}</h2><p class="hero-description">A Christmas stage production told through music, dance, and drama.</p></div>
  <div class="promo-attend"><p class="hero-date"><time datetime="2026-12-20T18:00:00-05:00">Sunday, December 20, 2026 · 6:00 PM</time><span>Sunrise, Florida <i aria-hidden="true">·</i> <strong>Free admission</strong></span></p><div class="actions">${calendar}<a class="text-link" href="#details">Plan Your Visit <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></a></div></div></div>
</section>
<div class="event-strip"><div class="wrap"><span>DECEMBER <b>20</b>, 2026</span><span>6:00 PM <small>EASTERN</small></span><span>THE FAITH CENTER <small>SUNRISE, FL</small></span><span class="free">FREE ADMISSION</span></div></div>
<section class="story-section wrap" id="story" aria-labelledby="story-title">
  <div><p class="eyebrow ink">The story before the manger</p><h2 id="story-title">A promise.<br>A journey.<br><em>A choice to trust.</em></h2></div>
  <div class="story-copy"><p class="lead">${esc(g.story_lead)}</p><p>${esc(g.story)}</p><p class="story-invite">Make room for hope this Christmas.</p><a class="inline-action" href="resources/marketing/chosen-2026.ics" download="chosen-2026.ics">Save the Date <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div>
</section>
${hasPreview ? `<section class="preview-section wrap" id="preview" aria-labelledby="preview-title"><p class="eyebrow ink">A glimpse of CHOSEN</p><h2 id="preview-title">Step inside the story.</h2><video controls playsinline preload="none" poster="${esc(preview.poster)}"><source src="${esc(preview.video)}" type="video/mp4"><track kind="captions" src="${esc(preview.captions)}" srclang="en" label="English" default>Your browser does not support this video.</video><p>${esc(preview.description || 'A look behind the scenes of CHOSEN.')}</p></section>` : ''}
<section class="experience-section" aria-labelledby="experience-title"><div class="wrap">
  <div class="experience-heading"><p class="eyebrow">Experience CHOSEN</p><h2 id="experience-title">Feel the story.<br><em>Share the hope.</em></h2><p>An evening to experience together.</p></div>
  <div class="experience-grid"><article><span class="experience-number" aria-hidden="true">01</span><h3>Music</h3><p>A Christmas story carried through song.</p></article><article><span class="experience-number" aria-hidden="true">02</span><h3>Dance</h3><p>Movement that brings emotion to life.</p></article><article><span class="experience-number" aria-hidden="true">03</span><h3>Drama</h3><p>Mary and Joseph’s journey of faith and courage.</p></article></div>
</div></section>
<section class="cast-section wrap" id="cast" aria-labelledby="cast-title"><div class="section-heading"><div><p class="eyebrow ink">Meet Mary &amp; Joseph</p><h2 id="cast-title">The faces behind<br><em>the journey.</em></h2></div><p>Meet the performers bringing<br>Mary and Joseph’s story to life.</p></div>
  <div class="cast-grid">${g.cast.map(c => `<article class="cast-card"><div class="portrait-frame"><img src="${asset}${esc(c.image)}" alt="Portrait of ${esc(c.name)}, who plays ${esc(c.role)}" width="${c.width}" height="${c.height}" loading="lazy" decoding="async"><span class="role-tag">${esc(c.role)}</span></div><div class="cast-info"><div><p class="cast-role">AS ${esc(c.role).toUpperCase()}</p><h3>${esc(c.name)}</h3></div><a href="${esc(c.flyer)}" download aria-label="Download ${esc(c.name)}’s invitation flyer">Invitation flyer <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div></article>`).join('')}</div>
</section>
<section class="hope-section"><div class="wrap"><span class="star" aria-hidden="true">✦</span><p class="eyebrow">A Christmas invitation</p><h2>Make room for hope.<br><em>Bring someone you love.</em></h2><p>Share an evening of music, dance, and drama<br class="desktop-break"> at The Faith Center.</p>${calendar}</div></section>
<section class="visit-section wrap" id="details" aria-labelledby="visit-title"><div class="section-heading"><div><p class="eyebrow ink">Plan your visit</p><h2 id="visit-title">Your Christmas plans<br><em>start here.</em></h2></div><span class="admission-mark">Free<br><em>admission</em></span></div>
  <div class="visit-grid"><div class="venue-panel"><p class="eyebrow">Join us in Sunrise</p><h3>${esc(e.venue)}</h3><address>5555 NW 95th Avenue<br>Sunrise, FL 33351</address><a class="button outline" href="${esc(directions)}" target="_blank" rel="noopener">Get Directions <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a><p class="venue-note">Sunday, December 20, 2026<br><strong>6:00 PM Eastern</strong></p></div><div class="guest-faq"><p class="faq-intro">A few things to know before you go.</p>${guestAnswers.map(a => `<details><summary>${esc(a.question)}<span aria-hidden="true">+</span></summary><p>${esc(a.answer)}</p></details>`).join('')}<div class="calendar-options"><span>Add CHOSEN to your calendar</span><a href="resources/marketing/chosen-2026.ics" download="chosen-2026.ics">Apple / Outlook <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a><a href="${esc(g.google_calendar_url)}" target="_blank" rel="noopener">Google Calendar <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div></div></div>
</section>
<section class="invite-section"><div class="wrap"><p class="eyebrow ink">Good things are better together</p><h2>Who will you bring?</h2><p>Send a little hope their way. Invite someone to CHOSEN.</p><div class="share-actions"><a class="button dark" href="${esc('https://wa.me/?text=' + encodeURIComponent(g.share_text + '\n' + e.url))}" target="_blank" rel="noopener">Invite on WhatsApp <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a><button class="button light" id="share-show" type="button">Share the Show <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></button><button class="copy-link" id="copy-show" type="button">Copy Link</button></div><p id="share-status" role="status" aria-live="polite"></p><p id="manual-share" hidden>Copy this link: <a href="${esc(e.url)}">${esc(e.url)}</a></p></div></section>
</main>
<footer><div class="wrap footer-inner"><a class="footer-brand" href="chosen.html">CHOSEN<span>The Story Before the Manger</span></a><p>The Faith Center · Sunrise, Florida<br>December 20, 2026 · 6:00 PM · Free admission</p><a href="https://thefaithcenterint.org/" target="_blank" rel="noopener">Visit The Faith Center <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div></footer>
<div class="mobile-attend"><p>DEC 20 <span>6 PM · FREE ADMISSION</span></p><a href="resources/marketing/chosen-2026.ics" download="chosen-2026.ics">Save the Date <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div>
</body></html>`;
}
