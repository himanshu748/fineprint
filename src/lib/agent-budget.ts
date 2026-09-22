// Both public agent routes share this additional, process-local guard.
let active = 0;
let budget = { hour: 0, count: 0 };

export function reserveAgentRun() {
  const hour = Math.floor(Date.now() / 3_600_000);
  if (budget.hour !== hour) budget = { hour, count: 0 };
  if (active >= 2 || budget.count >= 20) return null;
  active++;
  budget.count++;
  let released = false;
  return () => {
    if (!released) active--;
    released = true;
  };
}
