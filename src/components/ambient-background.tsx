/**
 * Purely decorative, very subtle static-feel layer behind page content.
 * Transform/opacity only, respects prefers-reduced-motion via the global rule.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="ambient-grid absolute inset-0 opacity-25" />
      <div className="absolute -left-40 -top-40 size-[30rem] rounded-full bg-primary/8 blur-3xl" />
      <div className="absolute -right-48 top-1/3 size-[34rem] rounded-full bg-success/8 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
    </div>
  );
}
