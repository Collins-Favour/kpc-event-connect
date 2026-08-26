/**
 * Purely decorative, subtle motion layer used behind page content.
 * Transform/opacity only, respects prefers-reduced-motion via the global rule.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ambient-grid absolute inset-0 opacity-60" />
      <div className="ambient-drift-a absolute -left-32 -top-32 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="ambient-drift-b absolute -right-40 top-1/4 size-[32rem] rounded-full bg-success/20 blur-3xl" />
      <div className="ambient-drift-a absolute bottom-[-12rem] left-1/3 size-[26rem] rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  );
}
