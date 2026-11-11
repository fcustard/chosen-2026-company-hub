const showUrl = document.querySelector('link[rel="canonical"]').href;
const title = 'CHOSEN: The Story Before the Manger';
const text = 'Make room for hope this Christmas. December 20, 2026 at 6 PM at The Faith Center, Sunrise. Free admission. Bring someone you love.';
const status = document.getElementById('share-status');
async function copyLink() {
  try {
    await navigator.clipboard.writeText(showUrl);
    status.textContent = 'Link copied. Paste it into your invitation.';
  } catch {
    document.getElementById('manual-share').hidden = false;
    status.textContent = 'Copy the show link below and send it to someone you love.';
  }
}
document.getElementById('copy-show').addEventListener('click', copyLink);
document.getElementById('share-show').addEventListener('click', async () => {
  if (!navigator.share) return copyLink();
  try {
    await navigator.share({ title, text, url: showUrl });
    status.textContent = 'Thank you for sharing CHOSEN.';
  } catch (error) {
    if (error.name !== 'AbortError') await copyLink();
  }
});
