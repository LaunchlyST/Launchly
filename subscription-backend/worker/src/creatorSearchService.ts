/**
 * The actual creator-search data layer.
 *
 * IMPORTANT — audit finding: Launchly has no real creator-search backend
 * anywhere in this repository today. `src/pages/bots/demo-data.ts` in the
 * frontend is an explicitly-labelled, seeded-random *simulation* built for
 * the Bots page UI — its own comments say plainly that "nothing in this
 * module touches TikTok". There is no upstream provider integration, no
 * Supabase cache table, and no parser to reuse here.
 *
 * So this file is the one real gateway this worker exposes for creator
 * search — both the public /api/v1/creators/search endpoint and any future
 * in-app search should call `searchCreators` here — but until a real
 * upstream data source is wired in below, it returns an honest "not yet
 * connected" error instead of inventing creator data. Never replace the
 * `throw` below with demo/simulated data to make the endpoint "work" —
 * that would return fabricated numbers to a paying API customer.
 */

export interface CreatorSearchParams {
  q: string;
  region?: string;
}

export interface CreatorResult {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  region: string | null;
  followers: number | null;
  likes: number | null;
  videoCount: number | null;
  gmv: number | null;
  itemsSold: number | null;
  productCount: number | null;
}

export class CreatorSearchUnavailableError extends Error {}

export async function searchCreators(_params: CreatorSearchParams): Promise<CreatorResult[]> {
  // TODO: wire in Launchly's real creator-data source here (upstream
  // provider request + normalization + Supabase cache), then return real
  // CreatorResult[] instead of throwing. Everything upstream of this
  // function — auth, subscription check, rate limiting, response shaping —
  // is already wired and ready for it.
  throw new CreatorSearchUnavailableError('Creator search is not connected to a live data source yet.');
}
