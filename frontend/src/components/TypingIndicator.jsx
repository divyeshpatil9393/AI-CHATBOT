export default function TypingIndicator() {
  return (
    <div className="flex h-7 items-center gap-1" role="status" aria-label="Assistant is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-dot rounded-full bg-muted"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}
