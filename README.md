# Portfolio
Design portfolio focused on building clear, quiet, and considered interfaces.<br>
Work spans brand systems, web experiences, and product prototypes.

---

## Access
- [Portfolio](https://avorpt.github.io)
- [AVOR App](https://github.com/avorpt/avor-ios-app)

---

## Structure
Portfolio at the root; AVOR case-study artifacts isolated under `avor/`,
each prototype self-contained.

```
/                    Portfolio — landing page, 404, project pages, shared CSS/JS
assets/              Images (WebP) + self-hosted fonts, shared site-wide
avor/web/            AVOR brand-site prototype (own styles + scripts)
avor/infotainment/   AVOR infotainment (HMI) prototype (own styles + scripts)
```

---

## Projects
### AVOR
Case study. <br>
A fictional premium automotive brand exploring "Silent Presence" — design can be quiet.

Includes:
- Brand system  
- Website  
  - Homepage, Model Pages, Finder, <br>
    Listing detail, Accessories, Service, Cookie Policy
- Infotainment concept 
  - Driving-focused interaction  
  - Reduced cognitive load  
  - State-aware UI
- Companion app (SwiftUI)
  - Vehicle overview  
  - Remote actions  
  - Service information  
  - Location preview  
  - State-driven UI feedback

Infotainment browser prototype driven by a vanilla-JS state engine; operable by keyboard (the intended
physical-control model), and mouse fallback.

---

### BlitzTour
Collaboration. <br>
Group project spanning research, concept, and prototype delivery.

---

### Neru
Exploration. <br>
A controlled experiment outside the AVOR context.

---

## Note
AVOR is a fictional brand created as part of this portfolio.

Built without a framework by deliberate choice; the scope did not require one.
Tooling is limited to local helper scripts for WebP optimization, CSS/JS cache-busting,
and markup/link validation, run on demand during development rather than as part of a build or deploy.
GitHub Pages serves the committed files directly.

With more time:
component-level CSS, a component framework, and a static generator to avoid duplicated HTML navigation.

No third-party requests. Fonts are self-hosted, icons are inline SVGs.
The site uses no analytics or tracking, and no visitor data leaves the page.

The AVOR site includes a cookie-consent pattern and policy page, even though it sets no tracking cookies.
Cookie preferences are stored locally.

Images are royalty-free or AI-generated, used for concept purposes only.

## Third-Party Notices
Alexandria (SIL Open Font License 1.1) and Phosphor Icons (MIT) are bundled under their respective licenses — full notices in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
