# gz-site

Academic personal site. Eleventy 3, plain CSS, no runtime dependencies.

```sh
npm install
npm run dev     # http://localhost:8080
npm run build   # -> _site/
```

## Changing the content

Nothing person-specific lives in the templates. Everything is in `src/_data/`:

| File | Holds |
| --- | --- |
| `profile.js` | Name, role, institution, email, CV link, home headline and lede, about text, areas, education, contact rows, social links |
| `publications.js` | One array. `type: "book"` or `type: "article"` decides which heading an entry renders under; `pdf` is optional and the link is omitted when absent |
| `navigation.js` | The five nav items, in order |
| `site.js` | Site-level only — origin, language, meta description, social-card fallback, browser theme colors. Deliberately has no `title`: the name comes from `profile.js` so there is one place to change it |
| `crawlers.js` | Which AI crawlers `robots.txt` allows and blocks — see [AI crawlers](#ai-crawlers) |

All of them are ES modules with a default export, not JSON, so they can carry comments
and — in `site.js` — read the deploy environment.

`profile.js` accepts inline HTML in `home.headline` and `about.body` — that is how the
accent word in the headline (`<span class="accent">`) and the italic book title work.

Essays are markdown files in `src/writing/`, with `title`, `date`, and `excerpt` front
matter. Drop a new `.md` in and it appears on `/writing/` and in the home page's three
most recent, newest first. Add `draft: true` to keep one out of production builds while
still seeing it under `npm run dev`.

### Images in essays

A **cover image** is optional front matter. It renders full-width at 16:9 between the
back-link and the date; posts without it are unaffected.

```yaml
cover: /assets/images/treescape.jpg
coverAlt: Fog settling between forested ridges at first light.
```

**In-body images** use a shortcode, which works inside markdown. The caption is optional;
omit it and you get the image alone.

```njk
{% raw %}{% figure "/assets/images/treescape.jpg", "Alt text.", "Figure 1. The caption." %}{% endraw %}
```

Cropping is `object-fit: cover` — 16:9 for covers, 3:2 for body figures — so any source
aspect works, but supply covers at 1600×900 to avoid upscaling. Plain markdown
`![alt](src)` is still supported and renders as a bordered image at its natural ratio.
Covers load eagerly (they are above the fold); body figures are lazy.

## Discovery

Generated on every build, all from `site.url`:

| Output | From | Notes |
| --- | --- | --- |
| `/sitemap.xml` | `sitemap.njk` | Every page except `noindex` ones and the 404 |
| `/feed.xml` | `feed.njk` | RSS 2.0, 20 most recent essays, full bodies in `content:encoded`. Linked from `<head>` on every page |
| `/robots.txt` | `robots.njk` | Policy below |
| `/404.html` | `404.njk` | `netlify.toml` serves it for any unmatched path |

`base.njk` emits canonical, Open Graph and Twitter-card tags for every page. Essays use
their own `cover`/`coverAlt` as the social image and fall back to `site.ogImage`.

`site.url` follows the deploy context rather than being hard-coded: Netlify's `URL` in
production, `DEPLOY_PRIME_URL` on previews. Previews also go `noindex` and get a
`Disallow: /` robots.txt, so they never compete with production in an index.

### AI crawlers

`robots.txt` blocks AI **training** crawlers while allowing AI **search** ones, so pages
can be cited and linked in AI answers without being absorbed into training corpora. The
two lists live in `_data/crawlers.js`. This works because the major vendors ship separate,
documented tokens per use — `GPTBot` vs. `OAI-SearchBot`, `ClaudeBot` vs.
`Claude-SearchBot`, `Google-Extended` vs. `Googlebot`.

Three things it is not: robots.txt is voluntary, so anything willing to ignore it or spoof
a user agent is unaffected; the training/search split is each vendor's claim about its own
bot; and blocking does not remove already-crawled data. `facebookexternalhit` is
deliberately left allowed — it renders link previews from the `og:` tags.

## Still to supply

- `src/assets/cv.pdf` — the "Download CV" links point at it.
- The real domain in `site.js` (`FALLBACK_ORIGIN`, currently `https://example.com`).
  Netlify overrides it on deploy, so this only affects local builds and other hosts.
- Real Google Scholar / PhilPapers URLs in `profile.contact.links`.

## Theming

Light and dark tokens are the `:root` and `[data-theme="dark"]` custom-property blocks at
the top of `src/css/style.css`. The stylesheet has no `prefers-color-scheme` block on
purpose — an inline script in `<head>` always writes an explicit `data-theme` before first
paint, which avoids both a flash and the specificity tie where a media query silently
overrides a user's explicit choice.

## Deploying

`netlify.toml` is set up: build `npm run build`, publish `_site`, Node pinned to 22.
Commit `package-lock.json` so Netlify runs `npm ci`.
