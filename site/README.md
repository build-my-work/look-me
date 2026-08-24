# Look Me website

The public website is an English-first, multilingual Astro site that builds to static HTML. The current production origin is `https://lookme.anme.cc`.

## Development

```bash
npm install
npm run dev
```

Astro serves the site at `http://127.0.0.1:4321` by default.

## Verification

```bash
npm test
```

This runs Astro's type/content checks, creates the production build, and verifies required pages, metadata, structured data, internal links, sitemap output, language alternates, and medical-claim boundaries.

## Deployment

```bash
npm ci
npm run build
```

Deploy the generated `dist/` directory as the website root. Keep the configured production origin in `astro.config.mjs` and `src/lib/site.ts` synchronized if the domain changes.

The repository does not contain deployment credentials, Search Console ownership, or code-signing certificates. Those external steps must be completed separately.
