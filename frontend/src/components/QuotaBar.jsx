import { useCountdown } from "../hooks/useCountdown.js";

export const QuotaBar = ({ limit, remaining, reset }) => {
  const secondsLeft = useCountdown(reset);

  if (limit == null || remaining == null) {
    return <p className="quota-bar__empty">No quota data yet</p>;
  }

  const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
  const low = pct <= 20;

  return (
    <div className="quota-bar">
      <div className="quota-bar__track">
        <div
          className={`quota-bar__fill ${low ? "quota-bar__fill--low" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="quota-bar__meta">
        <span>{remaining} / {limit} tokens left</span>
        {secondsLeft != null && <span>full again in {secondsLeft}s</span>}
      </div>
    </div>
  );
};
