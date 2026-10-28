import { useEffect, useState } from "react";

// Ticks once a second and returns the seconds remaining until `targetUnixSeconds`.
// Returns null when there's nothing to count down to yet.
export const useCountdown = (targetUnixSeconds) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetUnixSeconds == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetUnixSeconds]);

  if (targetUnixSeconds == null) return null;
  return Math.max(0, Math.ceil(targetUnixSeconds - now / 1000));
};
