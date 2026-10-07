// Fawn — Alicia's builder agent for design.
// Delegation contract: accept(task) validates scope and may refuse;
// progress events flow back; result returns to the switchboard.
// Kallel's integration connects the real Fawn runtime here.
export const fawn = {
  name: "fawn",
  role: "Builder agent — design",
  accept(task) {
    const t = typeof task === "string" ? { instruction: task } : task;
    if (!t.instruction && !t.prompt) return { accepted: false, reason: "empty task" };
    return { accepted: true, note: "Fawn runtime attaches in Caelia integration; task queued.", task: t };
  },
};
