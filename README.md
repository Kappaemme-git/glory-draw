# Glory Draw

Draft a World Cup XI by rolling random nation + year squads (1950–2026), picking one legend at a time, then simulate your tournament minute by minute.

Single-player. No backend — all data and the match engine run in the browser.

## Stack

- Vite + React + TypeScript
- Static dataset built from the [Fjelstul World Cup Database](https://github.com/jfjelstul/worldcup)

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run smoke:engine   # engine smoke test
npm run import:data    # regenerate the squads dataset
```

## Deploy

Static site. On Vercel, the defaults work out of the box:

- Build command: `npm run build`
- Output directory: `dist`
