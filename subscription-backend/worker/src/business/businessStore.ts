import type { EnrichedBusiness } from './businessTypes.ts';

/**
 * Per-user persistence for Business Connect: saved leads, notes, outreach.
 * Every method takes the *authenticated* userId and scopes by it, so one
 * user can never read or write another's rows (the database's RLS policies
 * enforce the same rule for any direct client access).
 */

export interface SavedLead {
  id: string;
  providerBusinessId: string;
  name: string;
  category: string | null;
  city: string | null;
  website: string | null;
  createdAt: string;
}

export interface BusinessNote {
  id: string;
  content: string;
  createdAt: string;
}

export type OutreachStatus = 'draft' | 'scheduled' | 'sent' | 'replied' | 'failed';

export interface OutreachRecord {
  id: string;
  channel: 'email' | 'message' | 'follow_up';
  subject: string | null;
  body: string;
  status: OutreachStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface BusinessStore {
  saveLead(userId: string, business: EnrichedBusiness): Promise<SavedLead>;
  getLead(userId: string, providerBusinessId: string): Promise<SavedLead | null>;
  listLeads(userId: string): Promise<SavedLead[]>;
  addNote(userId: string, leadId: string, content: string): Promise<BusinessNote>;
  listNotes(userId: string, leadId: string): Promise<BusinessNote[]>;
  addOutreach(userId: string, leadId: string, rec: Omit<OutreachRecord, 'id' | 'createdAt' | 'sentAt' | 'repliedAt'>): Promise<OutreachRecord>;
  listOutreach(userId: string, leadId: string): Promise<OutreachRecord[]>;
}

// --------------------------------------------------------- Supabase ----

interface SupabaseLike {
  from(table: string): any;
}

const leadFromRow = (r: any): SavedLead => ({
  id: r.id,
  providerBusinessId: r.provider_business_id,
  name: r.name,
  category: r.category,
  city: r.city,
  website: r.website,
  createdAt: r.created_at,
});

const outreachFromRow = (r: any): OutreachRecord => ({
  id: r.id,
  channel: r.channel,
  subject: r.subject,
  body: r.body,
  status: r.status,
  scheduledFor: r.scheduled_for,
  sentAt: r.sent_at,
  repliedAt: r.replied_at,
  createdAt: r.created_at,
});

function check({ data, error }: { data: any; error: any }): any {
  if (error) throw new Error(error.message ?? 'Database error');
  return data;
}

export class SupabaseBusinessStore implements BusinessStore {
  private readonly db: SupabaseLike;
  constructor(db: SupabaseLike) {
    this.db = db;
  }

  async saveLead(userId: string, b: EnrichedBusiness): Promise<SavedLead> {
    const row = check(
      await this.db
        .from('business_leads')
        .upsert(
          {
            user_id: userId,
            provider_business_id: b.id,
            name: b.name,
            category: b.category,
            address: b.address,
            city: b.city,
            country: b.country,
            phone: b.phone,
            website: b.website,
            rating: b.rating,
            review_count: b.reviewCount,
            image_url: b.photo,
            estimated_budget_min: b.budget.min,
            estimated_budget_max: b.budget.max,
            estimated_budget_currency: b.budget.currency,
          },
          { onConflict: 'user_id,provider_business_id' }
        )
        .select()
        .single()
    );
    const lead = leadFromRow(row);
    if (b.socialEvidence.length) {
      await this.db.from('business_social_profiles').upsert(
        b.socialEvidence.map((e) => ({
          business_lead_id: lead.id,
          platform: e.platform,
          profile_url: e.url,
          username: e.username,
          source: e.source,
          confidence: e.confidence,
          verified_at: new Date().toISOString(),
        })),
        { onConflict: 'business_lead_id,platform' }
      );
    }
    return lead;
  }

  async getLead(userId: string, providerBusinessId: string): Promise<SavedLead | null> {
    const row = check(
      await this.db.from('business_leads').select().eq('user_id', userId).eq('provider_business_id', providerBusinessId).maybeSingle()
    );
    return row ? leadFromRow(row) : null;
  }

  async listLeads(userId: string): Promise<SavedLead[]> {
    const rows = check(await this.db.from('business_leads').select().eq('user_id', userId).order('created_at', { ascending: false }).limit(200));
    return (rows ?? []).map(leadFromRow);
  }

  async addNote(userId: string, leadId: string, content: string): Promise<BusinessNote> {
    const r = check(await this.db.from('business_notes').insert({ user_id: userId, business_lead_id: leadId, content }).select().single());
    return { id: r.id, content: r.content, createdAt: r.created_at };
  }

  async listNotes(userId: string, leadId: string): Promise<BusinessNote[]> {
    const rows = check(
      await this.db.from('business_notes').select().eq('user_id', userId).eq('business_lead_id', leadId).order('created_at', { ascending: false })
    );
    return (rows ?? []).map((r: any) => ({ id: r.id, content: r.content, createdAt: r.created_at }));
  }

  async addOutreach(userId: string, leadId: string, rec: Omit<OutreachRecord, 'id' | 'createdAt' | 'sentAt' | 'repliedAt'>): Promise<OutreachRecord> {
    const r = check(
      await this.db
        .from('business_outreach')
        .insert({
          user_id: userId,
          business_lead_id: leadId,
          channel: rec.channel,
          subject: rec.subject,
          body: rec.body,
          status: rec.status,
          scheduled_for: rec.scheduledFor,
        })
        .select()
        .single()
    );
    return outreachFromRow(r);
  }

  async listOutreach(userId: string, leadId: string): Promise<OutreachRecord[]> {
    const rows = check(
      await this.db.from('business_outreach').select().eq('user_id', userId).eq('business_lead_id', leadId).order('created_at', { ascending: false })
    );
    return (rows ?? []).map(outreachFromRow);
  }
}

// --------------------------------------------------------- In-memory ----

/** Test/dev implementation with the same per-user scoping rules. */
export class MemoryBusinessStore implements BusinessStore {
  leads: (SavedLead & { userId: string })[] = [];
  notes: (BusinessNote & { userId: string; leadId: string })[] = [];
  outreach: (OutreachRecord & { userId: string; leadId: string })[] = [];
  private seq = 0;
  private id() {
    return `id-${++this.seq}`;
  }

  async saveLead(userId: string, b: EnrichedBusiness): Promise<SavedLead> {
    const existing = this.leads.find((l) => l.userId === userId && l.providerBusinessId === b.id);
    if (existing) return existing;
    const lead = { id: this.id(), userId, providerBusinessId: b.id, name: b.name, category: b.category, city: b.city, website: b.website, createdAt: new Date().toISOString() };
    this.leads.push(lead);
    return lead;
  }
  async getLead(userId: string, pid: string) {
    return this.leads.find((l) => l.userId === userId && l.providerBusinessId === pid) ?? null;
  }
  async listLeads(userId: string) {
    return this.leads.filter((l) => l.userId === userId);
  }
  async addNote(userId: string, leadId: string, content: string) {
    const n = { id: this.id(), userId, leadId, content, createdAt: new Date().toISOString() };
    this.notes.push(n);
    return n;
  }
  async listNotes(userId: string, leadId: string) {
    return this.notes.filter((n) => n.userId === userId && n.leadId === leadId);
  }
  async addOutreach(userId: string, leadId: string, rec: Omit<OutreachRecord, 'id' | 'createdAt' | 'sentAt' | 'repliedAt'>) {
    const o = { ...rec, id: this.id(), userId, leadId, sentAt: null, repliedAt: null, createdAt: new Date().toISOString() };
    this.outreach.push(o);
    return o;
  }
  async listOutreach(userId: string, leadId: string) {
    return this.outreach.filter((o) => o.userId === userId && o.leadId === leadId);
  }
}
