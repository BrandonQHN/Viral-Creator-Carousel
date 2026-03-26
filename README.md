# Carousel Studio

Faceless Instagram content engine. Enter a niche topic → confirm angles, copy, and visual style → generate a full week of image carousels ready to post.

## Stack
- **Frontend**: React + Vite → Netlify
- **Backend**: Netlify Functions (Node.js)
- **Database + Auth**: Supabase
- **AI Text**: Claude API (claude-sonnet-4-6)
- **AI Images**: OpenAI DALL-E 3
- **Image Storage**: Supabase Storage

---

## Deploy Steps

### 1. Supabase setup
1. Create a new Supabase project at supabase.com
2. Go to SQL Editor → run `supabase/schema.sql`
3. Run `supabase/storage-and-rpc.sql`
4. Go to Storage → create bucket named `carousel-images`, set to **public**
5. Go to Authentication → enable Email and Google providers
6. Copy your project URL, anon key, and service role key

### 2. Netlify setup
1. Connect your repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Functions directory: `netlify/functions`

### 3. Environment variables
Set these in Netlify Dashboard > Site > Environment Variables:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
ANTHROPIC_KEY=
OPENAI_KEY=
```

Also create a `.env` file locally (copy `.env.example` and fill in values).

### 4. Install and run locally
```bash
npm install
npm install -g @supabase/supabase-js  # for functions
netlify dev  # runs Vite + Netlify functions together
```

---

## Cost per run
| Item | Cost |
|---|---|
| Claude (5 calls) | ~$0.06 |
| DALL-E 3 (~40 images) | ~$1.60 |
| Supabase Storage | ~$0.02 |
| **Total** | **~$1.70** |

## Usage tiers
| Plan | Runs/mo | Price |
|---|---|---|
| Free | 1 | $0 |
| Starter | 10 | $29 |
| Pro | 30 | $79 |
| Agency | 100 | $199 |

---

## User flow
1. Login (Supabase auth)
2. Enter niche topic + goal
3. **Gate 1**: Confirm niche brief (audience, pillars, voice)
4. **Gate 2**: Confirm content plan (carousel topics, formats, slide counts)
5. **Gate 3**: Confirm Visual DNA + approve sample image
6. **Gate 4**: Review and edit all copy (slides, captions, hashtags)
7. Generate — images appear carousel by carousel
8. Download ZIPs

---

## File structure
```
carousel-studio/
├── netlify/functions/
│   ├── _utils.js              # shared: auth, Claude, DALL-E, storage
│   ├── generate-niche.js      # Prompt 1: niche research
│   ├── generate-plan.js       # Prompt 2: content plan
│   ├── generate-visual-dna.js # Prompt 3: visual system + sample image
│   ├── generate-copy.js       # Prompt 4: all slide copy + captions
│   └── generate-images.js     # Prompt 5 + DALL-E loop (SSE streaming)
├── src/
│   ├── components/
│   │   ├── AuthGate.jsx
│   │   ├── UsageHeader.jsx
│   │   ├── TopicInput.jsx
│   │   ├── NicheBriefGate.jsx
│   │   ├── ContentPlanGate.jsx
│   │   ├── VisualDNAGate.jsx
│   │   ├── CopyReviewGate.jsx
│   │   ├── GenerationPanel.jsx
│   │   └── OutputPanel.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   └── api.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   ├── schema.sql
│   └── storage-and-rpc.sql
├── index.html
├── vite.config.js
├── netlify.toml
└── .env.example
```
