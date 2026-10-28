# Integration hand-off

## Scaffold state
- Backend: `services/api/src/CasaComigo.Api`; run: `dotnet run --project services/api/src/CasaComigo.Api`; default port `5080`; build: `dotnet build services/api/CasaComigo.sln`; health: `GET /health`.
- Frontend: `services/web`; dev: `npm run dev --workspace @casa-comigo/web`; build: `npm run build --workspace @casa-comigo/web`; API seam: `services/web/src/api/http.ts`; Supabase Auth seam: `services/web/src/api/supabase.ts`.
- Frontend preview: shell only; no mock client or mock data files exist. The visible copy is explanatory, not simulated server data.
- Backend routes: `GET /api/profile`, `PUT /api/profile`, `PUT /api/profile/search-area`, `GET /api/discovery/profiles`, `POST /api/profiles/{profileId}/likes`, `GET /api/matches`, `GET|POST /api/matches/{matchId}/messages`, `POST /api/matches/{matchId}/visit-requests`, `GET|POST /api/houses`, `GET|PUT|DELETE /api/houses/{listingId}`, `GET /api/houses/favorites`, `PUT|DELETE /api/houses/{listingId}/favorite`, `POST /api/profiles/{profileId}/blocks`, `POST /api/profiles/{profileId}/reports`; all currently return authenticated `501`. `GET /health` responds `200`.
- Database: Supabase local PostgreSQL; schema in `supabase/migrations/20261028000100_initial_schema.sql`; apply with `npx supabase db reset`; no seed data. RLS and private storage policies plus `is_area_compatible`/`record_like` SQL functions are present; policy/function tests still required.
- Connection/config: `ConnectionStrings__Supabase`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, optional `SUPABASE_JWT_ISSUER`; frontend public variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`. No service-role key may enter the browser.
- Services — Essential: React/Vite, ASP.NET Core Web API, Supabase Auth/PostgreSQL/Storage. Enhancement: SignalR live delivery (planned, not implemented); no external integrations.

## Integration tasks
- Add SQL migration validation and targeted authorization tests with two distinct users; do not add seed data.
- Implement API operations against the schema, matching Supabase JWT claims to RLS context safely, and replace authenticated `501` placeholders.
- Wire frontend navigation/actions to real backend data; add authentication/onboarding and real loading/error/empty states.
- Implement and authorize matched-only chat/SignalR before exposing a hub.
- Verify API endpoint behaviors and local end-to-end startup after .NET 10 SDK and Supabase CLI are available.
