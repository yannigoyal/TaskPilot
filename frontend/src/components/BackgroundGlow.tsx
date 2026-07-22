/** Shared ambient glow + grain backdrop behind the login and board pages. */
export const BackgroundGlow = () => (
  <>
    <div className="pointer-events-none fixed inset-0 -z-10 bg-[var(--bg)]" />
    <div
      className="pointer-events-none fixed inset-0 -z-10 opacity-[0.05]"
      style={{
        backgroundImage:
          "linear-gradient(var(--stroke) 1px, transparent 1px), linear-gradient(90deg, var(--stroke) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
      }}
    />
    <div className="pointer-events-none fixed left-0 top-0 -z-10 h-[520px] w-[520px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(79,168,240,0.22)_0%,_rgba(79,168,240,0.06)_55%,_transparent_75%)]" />
    <div className="pointer-events-none fixed bottom-0 right-0 -z-10 h-[560px] w-[560px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(177,126,224,0.16)_0%,_rgba(177,126,224,0.05)_55%,_transparent_75%)]" />
    <div className="pointer-events-none fixed right-1/4 top-1/3 -z-10 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,_rgba(240,180,41,0.08)_0%,_transparent_70%)]" />
  </>
);
