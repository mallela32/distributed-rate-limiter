import { useState } from "react";
import { appBackendBaseUrl, appBackendRoutes, callAppBackendRoute } from "../api/appBackend.js";
import { QuotaBar } from "./QuotaBar.jsx";
import { StatusMessage, unreachableMessage } from "./StatusMessage.jsx";

let nextLogId = 1;

const describeResult = (result) => {
  if (result.networkError) return { label: "unreachable", tone: "error" };
  if (result.status == null) return { label: "error", tone: "error" };
  if (result.status === 429) return { label: "429 denied", tone: "denied" };
  if (result.ok) return { label: `${result.status} allowed`, tone: "allowed" };
  return { label: `${result.status} error`, tone: "error" };
};

export const TryItPanel = () => {
  const [route, setRoute] = useState(appBackendRoutes[0]);
  const [userId, setUserId] = useState("demo-user");
  const [burstSize, setBurstSize] = useState(5);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState([]);
  const [latest, setLatest] = useState(null);

  const recordResult = (result) => {
    const { label, tone } = describeResult(result);
    setLog((prev) =>
      [
        {
          id: nextLogId++,
          time: new Date().toLocaleTimeString(),
          route,
          label,
          tone,
        },
        ...prev,
      ].slice(0, 20),
    );
    setLatest(result);
  };

  const sendOne = async () => {
    setSending(true);
    const result = await callAppBackendRoute(route, userId);
    recordResult(result);
    setSending(false);
  };

  const sendBurst = async () => {
    setSending(true);
    const results = await Promise.all(
      Array.from({ length: burstSize }, () => callAppBackendRoute(route, userId)),
    );
    results.forEach(recordResult);
    setSending(false);
  };

  const networkDown = latest?.networkError;

  return (
    <section className="panel">
      <h2>Try it</h2>
      <p className="panel__hint">Fires demo requests at the App Backend ({appBackendBaseUrl}).</p>

      <div className="field-row">
        <label>
          Route
          <select value={route} onChange={(e) => setRoute(e.target.value)}>
            {appBackendRoutes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          User id
          <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        </label>
        <label>
          Burst size
          <input
            type="number"
            min="1"
            max="50"
            value={burstSize}
            onChange={(e) => setBurstSize(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="button-row">
        <button onClick={sendOne} disabled={sending || !userId}>
          Send one
        </button>
        <button onClick={sendBurst} disabled={sending || !userId}>
          Send burst of {burstSize}
        </button>
      </div>

      {sending && <StatusMessage kind="loading">Sending…</StatusMessage>}
      {networkDown && (
        <StatusMessage kind="error">{unreachableMessage(appBackendBaseUrl)}</StatusMessage>
      )}

      {latest && !latest.networkError && (
        <div className="result-block">
          <QuotaBar
            limit={latest.rateLimit.limit}
            remaining={latest.rateLimit.remaining}
            reset={latest.rateLimit.reset}
          />
          {latest.status === 429 && (
            <p className="retry-after">retry after {latest.rateLimit.retryAfter}s</p>
          )}
        </div>
      )}

      <h3>Recent requests</h3>
      {log.length === 0 ? (
        <StatusMessage kind="empty">Nothing sent yet.</StatusMessage>
      ) : (
        <ul className="request-log">
          {log.map((entry) => (
            <li key={entry.id} className={`request-log__item request-log__item--${entry.tone}`}>
              <span>{entry.time}</span>
              <span>{entry.route}</span>
              <span>{entry.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
