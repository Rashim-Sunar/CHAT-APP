const CRYPTO_BADGES = ["AES-256-GCM", "RSA-OAEP", "PBKDF2", "Zero-knowledge server"];
const STACK = ["React", "TypeScript", "Node.js", "MongoDB", "Socket.io"];

const TechStrip = () => {
  return (
    <div className="border-y border-slate-100 bg-white/60 py-6">
      <div className="mx-auto flex max-w-landing flex-col items-center gap-3 px-5 text-center sm:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {CRYPTO_BADGES.map((badge, index) => (
            <span key={badge} className="flex items-center gap-x-5">
              <span className="font-mono text-[11px] font-medium tracking-tight text-slate-500">{badge}</span>
              {index < CRYPTO_BADGES.length - 1 && <span className="h-3 w-px bg-slate-200" aria-hidden="true" />}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {STACK.map((tech) => (
            <span key={tech} className="text-[11px] font-medium text-slate-300">
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TechStrip;
