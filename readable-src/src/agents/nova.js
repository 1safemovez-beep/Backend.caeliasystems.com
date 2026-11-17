// Nova — the mall's AI host.
// Same delegation contract as Fawn. Real Nova runtime attaches in integration.
export const nova = {
  name: "nova",
  role: "Mall AI host",
  accept(task) {
    const t = typeof task === "string" ? { instruction: task } : task;
    if (!t.instruction && !t.prompt) return { accepted: false, reason: "empty task" };
    return { accepted: true, note: "Nova runtime attaches in Caelia integration; task queued.", task: t };
  },
};
