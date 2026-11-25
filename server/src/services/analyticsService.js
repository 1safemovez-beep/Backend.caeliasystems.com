// Analytics service — aggregates satellite heartbeats into the dashboard's
// bottom boxes + System Overview + Caelia's self-analytics.
import { all, get } from "../db/index.js";

export const analyticsService = {
  satellites() {
    const sats = all("SELECT * FROM satellites ORDER BY slot");
    return sats.map((s) => {
      const latest = get(
        "SELECT * FROM bridge_heartbeats WHERE satellite_id=? ORDER BY received_at DESC LIMIT 1",
        s.id
      );
      const count = get("SELECT COUNT(*) n FROM bridge_heartbeats WHERE satellite_id=?", s.id).n;
      return { ...s, heartbeats: count, latest };
    });
  },
  overview() {
    const hb = get("SELECT COUNT(*) n FROM bridge_heartbeats").n;
    const acts = get("SELECT COUNT(*) n FROM bridge_actions").n;
    const tasks = get("SELECT COUNT(*) n FROM tasks").n;
    const tasksDone = get("SELECT COUNT(*) n FROM tasks WHERE status='complete'").n;
    const facts = get("SELECT COUNT(*) n FROM memory_facts").n;
    const revenue = get("SELECT COALESCE(SUM(amount),0) total FROM money_revenue").total;
    return { heartbeats: hb, bridgeActions: acts, tasks, tasksDone, memoryFacts: facts, revenue };
  },
  // Caelia's OWN learning/activity/performance percentages (Spec 17, 26)
  caelia() {
    const total = get("SELECT COUNT(*) n FROM teach_queue").n;
    const retained = get("SELECT COUNT(*) n FROM teach_queue WHERE stage='retention'").n;
    const held = get("SELECT COUNT(*) n FROM teach_queue WHERE stage='held'").n;
    const delegations = get("SELECT COUNT(*) n FROM delegations").n;
    const delegDone = get("SELECT COUNT(*) n FROM delegations WHERE status='complete'").n;
    return {
      learning: { submitted: total, retained, held, retentionPct: total ? Math.round((retained / total) * 100) : 0 },
      activity: { delegations, delegationsComplete: delegDone },
      // Performance baseline; real performance scoring lands in Kallel's integration.
      performance: { note: "baseline only — full performance scoring in Caelia integration" },
    };
  },
};
