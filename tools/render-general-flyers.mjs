const asset = 'resources/marketing/flyers/';
const formats = [
  { name: 'Post', slug: 'post', shape: '4:5', height: 400 },
  { name: 'Story', slug: 'story', shape: '9:16', height: 569 }
];

export const generalFlyersStylesheet = '<link rel="stylesheet" href="resources/marketing/flyers/flyers.css">';

export function renderGeneralFlyers() {
  const downloads = formats.map(({ name, slug, shape, height }) => {
    const filename = `chosen-2026-${slug}`;
    return `<a class="general-flyers-download" href="${asset}${filename}.png" download>
      <img src="${asset}${filename}.webp" width="320" height="${height}" alt="" loading="lazy" decoding="async">
      <span>Download ${name}<small>${shape} &middot; PNG</small></span>
    </a>`;
  }).join('');
  return `<section class="general-flyers" id="share-flyers" aria-labelledby="share-flyers-title">
  <div>
    <h2 id="share-flyers-title">Share the CHOSEN flyer</h2>
    <p>Download a Post for your feed or a Story for Instagram and WhatsApp Status.</p>
  </div>
  <div class="general-flyers-downloads">${downloads}</div>
</section>`;
}
