# CHOSEN: church website connection brief

Reviewed November 16, 2026. Recommendation only: no changes made to the church website or its domain configuration.

## Recommended destination

Proposed official campaign address: `https://thefaithcenterint.org/chosen/` (not created or verified as available). Publish the existing CHOSEN guest experience on the church domain, preserving the navy/gold campaign artwork, story, promo video, cast, creative credits and attendance actions. The church web administrator should confirm the available slug and use the site's supported page/template workflow. The homepage HTML identifies WordPress, a Divi child theme and Elementor assets; this is public-source evidence, not authenticated access to the dashboard. A blank campaign template can preserve the theatrical layout while providing a simple church-home link.

For immediate promotion while migration is prepared, the administrator can make that proposed official address a temporary redirect to the current live guest page. After migration, retain the same printed/QR address and have it serve the final page. A redirect alone does not keep the church domain in the browser address bar.

## Discovery findings

- Homepage has an Upcoming Events block. Its The Faith Center Events button links to `/events/`.
- Main navigation Events links to `/announcements/`. This page has current announcement cards with off-site and Church Center links.
- The `/events/` text retrieved showed an older cancelled event and a registration-capacity heading. JavaScript may affect the rendered listings; verify the visible page before changing it. Do not make it the sole CHOSEN entry point without review.
- No CHOSEN listing was found on the reviewed homepage and announcements page. This is not an exhaustive claim about all church channels.
- Footer credits Software Your Way as site manager; the church administrator should confirm the current publishing contact.

Sources:
- https://thefaithcenterint.org/
- https://thefaithcenterint.org/announcements/
- https://thefaithcenterint.org/events/
- https://elementor.com/help/using-elementors-canvas-page-template/

## Placement request

| Location | Requested placement | Destination |
|---|---|---|
| Homepage | CHOSEN campaign image, date/time/free admission, Learn More button near the top | Official campaign address |
| Events / Announcements | A featured CHOSEN announcement card | Same address |
| Homepage Upcoming Events | A clear CHOSEN listing; reconcile the site's two Events routes | Same address |
| Church app, email, social profiles, screens and printed QR codes | Reuse the approved image and one consistent address | Same address |

Suggested short listing copy:

CHOSEN: The Story Before the Manger. Experience Mary and Joseph's journey through music, dance, and drama. Sunday, December 20, 2026 at 6 PM. The Faith Center, Sunrise. Free admission. Button: Learn More.

## Alternatives

1. Native church-domain landing page: preferred church-branded destination; requires the church's WordPress/hosting publisher.
2. `chosen.thefaithcenterint.org`: a useful alternative if preserving the separate static site's publishing workflow is the priority. Requires domain/DNS and hosting setup. Use a guest-only deployment rather than assigning the entire company-hub repository a new public campaign domain.
3. Existing GitHub guest page linked from the church website: quickest initial connection; visitors see the external domain.

Do not use an iframe as the primary implementation. The current experience already has navigation, a sticky attendance bar, calendar downloads and sharing behavior; a nested page adds another scrolling and navigation context to test.

## Migration and verification checklist

- Use guest-page markup and only its public assets; adapt the template, CSS/JS loading and relative asset URLs to the church hosting path.
- Preserve a single final URL; update canonical, Open Graph, Twitter/X and event structured data after the official destination is live.
- Update share buttons, calendar links and event-file URL/details consistently.
- Check the promo video, 40 cast credits, two creative-team credits, directions, calendar download, WhatsApp sharing and copy-link behavior.
- Test phone/desktop layouts and link previews. Check page views plus calendar, directions, video and sharing clicks using the church's approved analytics setup; do not treat clicks as attendance.
- Keep guest policy statements limited to confirmed facts. Do not add reservation, doors-open, parking, runtime or age-policy claims without confirmation.

## Publishing contact / access needed

The church website administrator or confirmed current site manager must publish the church-domain page and homepage/announcement links, or provide an appropriate editing workflow. DNS access is needed only if choosing a new subdomain. No church-site credentials were supplied or requested in this research.
