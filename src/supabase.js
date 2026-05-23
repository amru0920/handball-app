import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️  Missing Supabase env vars! Check .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Helper: check if subscription is active
export function isSubscriptionActive(sub) {
  if (!sub) return false;
  const now = new Date();
  if (sub.status === 'trial' && new Date(sub.trial_end) > now) return true;
  if (sub.status === 'active' && new Date(sub.paid_until) > now) return true;
  return false;
}

// Helper: days remaining
export function daysRemaining(sub) {
  if (!sub) return 0;
  const now = new Date();
  const end = sub.status === 'trial' ? new Date(sub.trial_end) : new Date(sub.paid_until);
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Save completed match + events to Supabase ─────────────────
export async function saveMatchToCloud(matchData, userId) {
  try {
    // 1. Insert match record
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        user_id:          userId,
        team_a_snapshot:  matchData.teamA,
        team_b_snapshot:  matchData.teamB,
        score_a:          matchData.score.A,
        score_b:          matchData.score.B,
        match_date:       new Date().toISOString(),
        status:           'completed',
        ended_at:         new Date().toISOString(),
      })
      .select()
      .single();

    if (matchError) throw matchError;

    // 2. Insert all events (batch)
    if (matchData.events.length > 0) {
      const rows = matchData.events.map(e => ({
        match_id:   match.id,
        user_id:    userId,
        team:       e.team,
        event_kind: e.kind || (e.zone ? 'SHOT' : null),
        zone:       e.zone       || null,
        outcome:    e.outcome    || null,
        pid:        e.pid        || null,
        assist_pid: e.assistPid  || null,
        severity:   e.severity   || null,
        to_type:    e.toType     || null,
        wave:       e.wave       || null,
        half:       e.half       ?? null,
        clock:      e.clock      ?? null,
      }));

      const { error: evError } = await supabase.from('events').insert(rows);
      if (evError) throw evError;
    }

    return { success: true, matchId: match.id };
  } catch (err) {
    console.error('saveMatchToCloud error:', err);
    return { success: false, error: err.message };
  }
}

// ─── Load match history from Supabase ──────────────────────────
export async function loadMatchHistory(userId) {
  try {
    // Load last 50 completed matches
    const { data: matches, error: mErr } = await supabase
      .from('matches')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('match_date', { ascending: false })
      .limit(50);

    if (mErr) throw mErr;
    if (!matches || matches.length === 0) return [];

    // Load all events for these matches in one query
    const matchIds = matches.map(m => m.id);
    const { data: allEvents, error: eErr } = await supabase
      .from('events')
      .select('*')
      .in('match_id', matchIds)
      .order('created_at');

    if (eErr) throw eErr;

    // Group events by match
    const byMatch = {};
    (allEvents || []).forEach(e => {
      if (!byMatch[e.match_id]) byMatch[e.match_id] = [];
      byMatch[e.match_id].push({
        id:        e.id,
        team:      e.team,
        kind:      e.event_kind !== 'SHOT' ? e.event_kind : undefined,
        zone:      e.zone,
        outcome:   e.outcome,
        pid:       e.pid,
        assistPid: e.assist_pid,
        severity:  e.severity,
        toType:    e.to_type,
        wave:      e.wave,
        half:      e.half,
        clock:     e.clock,
      });
    });

    // Return in app format
    return matches.map(m => ({
      id:     m.id,
      date:   new Date(m.match_date).toLocaleString('en-MY'),
      teamA:  m.team_a_snapshot,
      teamB:  m.team_b_snapshot,
      score:  { A: m.score_a, B: m.score_b },
      events: byMatch[m.id] || [],
    }));

  } catch (err) {
    console.error('loadMatchHistory error:', err);
    return [];
  }
}