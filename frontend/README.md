# German Tracker — Frontend

React + TypeScript + Vite + Tailwind CSS, with GSAP animation and `lucide-react` icons.

```powershell
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

`/api/*` requests are proxied to the FastAPI backend at `http://localhost:8000` (see
`vite.config.ts`).

Current `App.tsx` is the provided landing-page design (full-viewport video background with
mouse parallax, liquid-glass header, hero, CTA). The learning experience (conversation +
translation modes) will be built on top of this scaffold.
