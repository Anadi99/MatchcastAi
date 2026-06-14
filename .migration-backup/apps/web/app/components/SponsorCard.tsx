interface SponsorCardProps {
  text: string;
}

export default function SponsorCard({ text }: SponsorCardProps) {
  return (
    <div
      role="complementary"
      aria-label="Sponsored message"
      className="bg-bg-sponsor rounded-lg p-4 mb-3 border border-white/5"
    >
      <div className="flex items-start gap-2">
        <span className="text-lg mt-0.5" aria-hidden="true">
          💡
        </span>
        <p className="text-text-primary text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
