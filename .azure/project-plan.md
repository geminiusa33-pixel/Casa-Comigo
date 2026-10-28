**Status**: Approved
**Created**: 2026-10-27
**Mode**: Local-first MVP

## 1. Project Overview

Casa Comigo is a responsive, Portuguese-language roommate-matching platform. It helps people find compatible housemates through profile preferences and mutually compatible search areas, then supports reciprocal likes, matches, private chat, and user-initiated visits or WhatsApp contact. The MVP also includes a distinct area for user-created house listings and favorites.

The project is local-first and cost-conscious: develop and test the application locally with Supabase from the beginning. Do not provision Azure resources for the MVP.

## 2. Goals & Scope

### MVP goals
- Create an account and complete or edit a profile, including photos, preferred number of housemates, gender preference, pets, interests and opinions, work schedule, cooking habits, and search area.
- Request browser GPS location with clear consent; let the user set a search radius in kilometres and edit both location and radius later. Provide a manual area/location fallback if GPS permission is declined or unavailable.
- Discover candidate roommates only when both users' selected areas and radii are compatible. Let users like profiles and create a match only when the like is reciprocal.
- Enable private chat only between matched users.
- Support user-initiated visit requests and an explicit WhatsApp hand-off, without automated outreach.
- Let users publish and edit house listings and save or remove favorite listings.

### Out of scope for the MVP
- Idealista integration, scraping, or any assumption that a public/authorized API is available. Revisit only after validating API availability, terms, and authorization.
- Payments, subscriptions, identity verification, automated background checks, native mobile applications, and production-scale moderation tooling.
- Azure-hosted services or paid infrastructure are not part of the local MVP. Production is intended to use a separately configured hosted Supabase project; no cloud project provisioning, migration push, API hosting, or deployment is included in this local scaffold.

## 3. User Journeys

1. **Onboarding:** A user signs up, enters roommate preferences and lifestyle details, optionally uploads profile photos, grants or declines location permission, and chooses a search radius in kilometres.
2. **Discover and match:** The user browses eligible profiles, sees compatibility-relevant profile details without exposing precise coordinates, and likes or passes. A match appears only after both users like each other.
3. **Chat and arrange a visit:** Matched users exchange messages. Either may initiate a visit request or choose to open WhatsApp using contact details they have chosen to share.
4. **Manage profile and search:** The user edits profile fields, photos, search area, and radius in settings; can pause or hide discovery participation.
5. **Find a home:** The user browses user-created house listings, views listing details, and adds or removes listings from favorites.
6. **Manage a listing:** A signed-in user creates, edits, or removes their own listing; other users can view active listings and favorite them.

## 4. Architecture & Services

| Service | Responsibility | MVP implementation |
|---|---|---|
| Frontend | Responsive web app, onboarding, profile, discovery, matches/chat, settings, listings, and favorites | React with TypeScript and Vite |
| Backend | REST API and authorization-aware operations for profiles, discovery, reciprocal likes, matches, visits, and listings | C# with ASP.NET Core Web API on .NET 10 |
| Data and identity | Relational application data, sign-in, and access policies | Supabase local development stack: PostgreSQL, Supabase Auth, and RLS |
| File storage | Profile and listing photos | Supabase Storage in local development; private buckets and authorized access policies |
| Realtime messaging | Deliver chat updates to participants | ASP.NET Core SignalR, authorized for matched conversation participants |
| Geospatial search | Store search-area coordinates and evaluate radius compatibility | PostgreSQL with PostGIS where supported by the selected Supabase local setup; otherwise a tested distance calculation using stored coordinates |

Use the Supabase CLI and Docker-based local services for repeatable development. The React frontend uses Supabase Auth for sign-in and obtains an access token for the ASP.NET Core API. The API validates Supabase JWTs, applies authorization to each operation, and accesses PostgreSQL through Npgsql/EF Core; do not put Supabase service-role credentials in the frontend. Keep configuration in environment variables and provide a safe example environment file without credentials. A developer should be able to start the frontend, API, and local Supabase dependencies from the repository using documented commands.

## 5. Data & API Design

### Core records
- `profiles`: auth user reference, display name, bio, lifestyle preferences (housemate count, gender preference, pets, interests/opinions, work schedule, cooking), discovery visibility, and timestamps.
- `search_areas`: user reference, latitude/longitude, selected radius in kilometres, location source/consent metadata, and update time. Exact coordinates are private and are never shown to other users.
- `profile_photos`: profile reference, storage object path, ordering, and timestamps.
- `likes`: actor and recipient profile references, with a uniqueness rule preventing duplicate likes.
- `matches`: canonical pair of profile references and creation time, created only after reciprocal likes.
- `conversations` and `messages`: match-linked conversation and participant-authored messages.
- `visit_requests`: requester, recipient/listing reference where relevant, proposed visit details, status, and timestamps.
- `house_listings`: owner, description, approximate area, rent/house details, photos, active status, and timestamps.
- `house_favorites`: user and listing references with a unique pair constraint.

### API and access rules
- Use ASP.NET Core API endpoints for validation and business operations that require server-side checks. Keep database constraints and RLS as defense in depth.
- Enforce authentication for personal features. RLS and API authorization must limit profile edits to their owner, listings to their owner for modification, favorites to their user, and messages to participants in the associated match.
- Create a match transactionally or through an idempotent database operation when a reciprocal like is recorded; reject chat access without a match.
- Filter discovery using both users' selected areas and radii. Do not return exact coordinates; return only the minimum area/distance information needed by the interface.
- Validate uploads by type and size, associate objects with their owner, and do not expose private storage objects publicly by default.
- Validate and normalize all user-entered listing, profile, message, and location values. Add database indexes for discovery, likes, messages, and listings as query patterns are established.

### Initial API routes
- `GET /api/profile` and `PUT /api/profile`
- `PUT /api/profile/search-area`
- `GET /api/discovery/profiles`
- `POST /api/profiles/{profileId}/likes`
- `GET /api/matches`
- `GET /api/matches/{matchId}/messages` and `POST /api/matches/{matchId}/messages`
- `POST /api/matches/{matchId}/visit-requests`
- `GET /api/houses`, `POST /api/houses`, and `GET|PUT|DELETE /api/houses/{listingId}`
- `GET /api/houses/favorites`, `PUT /api/houses/{listingId}/favorite`, and `DELETE /api/houses/{listingId}/favorite`
- `POST /api/profiles/{profileId}/blocks` and `POST /api/profiles/{profileId}/reports`
- `GET /health`

Sign-up and sign-in use Supabase Auth directly from the frontend; the API validates its access tokens. Chat history uses the messages endpoints and live updates use the authorized SignalR hub.

## 6. Design System & UI

**Component Library**: Fluent UI v9

- Use a warm, contemporary, non-romantic visual direction. The experience should feel like a practical, welcoming housing community rather than a dating app.
- Build a responsive navigation structure for discovery, matches/chat, houses, favorites, and profile/settings. Keep house listings visually distinct from roommate discovery.
- Use Fluent UI v9 components for forms, cards, dialogs, navigation, buttons, and feedback. Define consistent spacing, typography, color tokens, and accessible focus states.
- Make onboarding progressive and easy to edit later. Explain why location permission is requested, display the selected radius clearly, and provide a no-GPS fallback.
- Profile cards should emphasize shared-living compatibility and relevant preferences, never exact location. Include clear loading, empty, error, success, and permission-denied states.
- Support keyboard navigation, semantic labels, sufficient contrast, and Portuguese UI copy. Avoid presenting a match as guaranteed compatibility.

## 7. Privacy, Security & Safety

- Request location permission only when needed and explain its purpose. Store precise coordinates only for matching, restrict access through server-side authorization and RLS, and never expose them in profile responses.
- Store only necessary profile and preference data. Make discovery visibility and contact sharing user-controlled; avoid exposing a phone number before the user chooses the WhatsApp hand-off.
- Use RLS policies and server-side validation for every user-owned record. Keep Supabase service-role credentials server-only and out of client bundles.
- Restrict photo access and uploads; provide a way to remove profile/listing images and associated storage objects.
- Allow users to block/report another profile as a basic safety affordance for the MVP, and ensure blocked users are excluded from discovery and contact flows.
- Treat user-generated profile text, chat, and listings as untrusted content. Do not render unsafe HTML.

## 8. Implementation & Validation

1. Create the React TypeScript frontend, ASP.NET Core Web API, and Supabase CLI configuration; document prerequisites and startup/reset commands.
2. Add database migrations, core tables, constraints, indexes, seed-free local setup, and RLS policies. Validate policies with distinct test accounts.
3. Implement sign-up/sign-in, profile onboarding/editing, photo upload, consented location entry, and radius settings.
4. Implement reciprocal area filtering, discovery, likes, idempotent match creation, and match-only chat.
5. Add visit requests and user-initiated WhatsApp hand-off; implement house listings and favorites.
6. Finish responsive Fluent UI v9 screens, accessibility states, error handling, and Portuguese copy.
7. Verify the app locally: migrations apply cleanly; users cannot access another user's private data; discovery respects reciprocal distance; matches require reciprocal likes; non-matches cannot read/send chat; owners alone can edit listings; users can manage favorites; and location/photo permissions and failure states are handled.

### Acceptance criteria
- A user can run the complete MVP locally with Supabase and no paid cloud resources.
- A user can create/edit a profile, set GPS-derived or manually entered search area and radius, discover mutually area-compatible profiles, and receive a match only after a reciprocal like.
- Only matched participants can access their conversation.
- Users can create/manage house listings and favorites, and initiate a visit or WhatsApp contact themselves.
- The UI does not reveal precise coordinates, does not initiate unsolicited contact, and does not depend on Idealista.
