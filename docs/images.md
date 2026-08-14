# Images

There is no build-time image pipeline. `public/` is served verbatim, so a file
committed at 4342×2528 is a file every reader downloads at 4342×2528. Resize
before you commit.

Everything below uses [sharp](https://sharp.pixelplumbing.com/), which is
already in `node_modules` — Astro depends on it for its own assets pipeline, so
there is nothing to install. It is deliberately **not** a project dependency and
there is no npm script: these are one-off authoring commands, not part of
`npm run build`.

## Rules of thumb

| Image                       | Size                                  | Format                                            |
| --------------------------- | ------------------------------------- | ------------------------------------------------- |
| Post hero (`heroImage.src`) | max **1600px** wide, aspect preserved | PNG for flat art/screenshots, JPG for photographs |
| Social preview (`ogImage`)  | exactly **1200×630**                  | PNG or JPG — **never SVG**                        |
| Inline figure               | max **1600px** wide                   | as above                                          |

**Never use an SVG as an `og:image`.** X, LinkedIn, Slack, Facebook and iMessage
all fail to render one, and they fail silently: the link preview shows nothing
at all rather than a broken image. This is why `DEFAULT_OG_IMAGE` in
`src/lib/site.ts` points at a PNG.

## Resize a hero to 1600px wide

```bash
node -e "require('sharp')('in.png').resize({width:1600,withoutEnlargement:true}).png({compressionLevel:9,palette:true,quality:90,effort:10}).toFile('out.png')"
```

`palette: true` quantises to an indexed PNG. For flat illustration, UI
screenshots and gradients it is close to lossless and roughly 85% smaller; for
photographs use `.jpeg({ quality: 82, mozjpeg: true })` instead.

## Cut a 1200×630 social crop

```bash
node -e "require('sharp')('in.png').resize(1200,630,{fit:'cover',position:'centre'}).png({compressionLevel:9,palette:true,quality:90,effort:10}).toFile('og.png')"
```

`fit: 'cover'` fills the frame and crops the overflow, so check the result — a
centre crop of a 16:9 source loses the top and bottom bands. Then point the
post's `ogImage` frontmatter field at it.

## Regenerate the default OG card

`public/images/og-default.svg` is the **source**; `public/images/og-default.png`
is what the site actually references. Edit the SVG, then:

```bash
node -e "require('sharp')('public/images/og-default.svg',{density:96}).resize(1200,630).flatten({background:'#FBFBF8'}).png({compressionLevel:9}).toFile('public/images/og-default.png')"
```

Four things to know about that command:

- `density: 96` renders the SVG 1:1 — it already declares `width="1200"
height="630"` — so `resize` is a no-op assertion that the output really is
  1200×630. Keep both.
- The SVG sets type in `ABC Diatype, Helvetica Neue, Helvetica, Arial,
sans-serif` — the site's own stack. Nothing self-hosts Diatype and no font
  CDN is loaded, so rendering resolves this against the _system_ font stack
  and in practice lands on Arial or a metric-compatible substitute such as
  Liberation Sans. A machine with none of them will produce different line
  lengths, and the two description lines are broken by hand (SVG `<text>` does
  not wrap). **Open the PNG and look at it before committing.**
- The card's colours are the Ode palette, copied by hand from section 1 of
  `src/styles/global.css` — Bone (`--color-bg`) ground, Cola (`--color-text`)
  headline, Dove (`--color-text-muted`) description, Tomato (`--color-accent`)
  rules. A file in `public/` cannot read CSS custom properties, so a re-brand
  means updating both.
- Do not write a literal `--` inside the SVG's comments. It is illegal in XML
  and librsvg rejects the whole file with "corrupt header", which is why the
  token names in there are spelled without their leading dashes.

The Ode lockup on the card is inlined as outlined paths from the Figma export,
so it stays crisp at any density and needs no font and no external reference.
The type says only "Engineering" — the lockup already says "Ode", and the two
should never be concatenated into an "Ode Engineering" sub-brand.
