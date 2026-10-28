import { useEffect, useState } from "react";
import {
  deleteRule,
  getMetrics,
  listRules,
  rateLimiterBaseUrl,
  updateRule,
} from "../api/rateLimiter.js";
import { StatusMessage, unreachableMessage } from "./StatusMessage.jsx";

const emptyForm = { endpoint: "", limit: "", windowSec: "" };

const isPositiveNumber = (value) => value !== "" && Number(value) > 0;

export const AdminPanel = () => {
  const [rules, setRules] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = async () => {
    setLoading(true);
    const [rulesResult, metricsResult] = await Promise.all([listRules(), getMetrics()]);

    if (rulesResult.networkError || metricsResult.networkError) {
      setError(unreachableMessage(rateLimiterBaseUrl));
    } else if (!rulesResult.ok || !metricsResult.ok) {
      setError("The rate limiter service returned an error.");
    } else {
      setError(null);
      setRules(rulesResult.data.rules);
      setMetrics(metricsResult.data.metrics);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const metricsFor = (endpoint) => metrics.find((m) => m.endpoint === endpoint);

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.endpoint.trim()) {
      setFormError("endpoint is required");
      return;
    }
    if (!isPositiveNumber(form.limit) || !isPositiveNumber(form.windowSec)) {
      setFormError("limit and window must be positive numbers");
      return;
    }
    setFormError(null);
    const result = await updateRule({
      endpoint: form.endpoint.trim(),
      limit: Number(form.limit),
      windowSec: Number(form.windowSec),
    });
    if (result.networkError || !result.ok) {
      setFormError(result.networkError ? unreachableMessage(rateLimiterBaseUrl) : "save failed");
      return;
    }
    setForm(emptyForm);
    load();
  };

  const editRule = (rule) => {
    setForm({ endpoint: rule.endpoint, limit: String(rule.limit), windowSec: String(rule.windowSec) });
  };

  const removeRule = async (endpoint) => {
    const result = await deleteRule(endpoint);
    if (!result.networkError && result.ok) load();
  };

  return (
    <section className="panel">
      <h2>Admin</h2>
      <p className="panel__hint">
        Manages rules directly on the Rate Limiter Service ({rateLimiterBaseUrl}).
      </p>

      <div className="button-row">
        <button onClick={load} disabled={loading}>
          Refresh
        </button>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          auto-refresh every 5s
        </label>
      </div>

      {loading && <StatusMessage kind="loading">Loading rules…</StatusMessage>}
      {error && <StatusMessage kind="error">{error}</StatusMessage>}

      {!loading && !error && rules.length === 0 && (
        <StatusMessage kind="empty">No rules configured yet — new endpoints use the default.</StatusMessage>
      )}

      {!loading && !error && rules.length > 0 && (
        <table className="rules-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Limit</th>
              <th>Window (s)</th>
              <th>Allowed</th>
              <th>Denied</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const m = metricsFor(rule.endpoint);
              return (
                <tr key={rule.endpoint}>
                  <td>{rule.endpoint}</td>
                  <td>{rule.limit}</td>
                  <td>{rule.windowSec}</td>
                  <td>{m?.allowed ?? 0}</td>
                  <td>{m?.denied ?? 0}</td>
                  <td className="rules-table__actions">
                    <button onClick={() => editRule(rule)}>Edit</button>
                    <button onClick={() => removeRule(rule.endpoint)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <form className="rule-form" onSubmit={submitForm}>
        <h3>Create / update rule</h3>
        <div className="field-row">
          <label>
            Endpoint
            <input
              placeholder="/api/login"
              value={form.endpoint}
              onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
            />
          </label>
          <label>
            Limit
            <input
              type="number"
              min="1"
              value={form.limit}
              onChange={(e) => setForm({ ...form, limit: e.target.value })}
            />
          </label>
          <label>
            Window (s)
            <input
              type="number"
              min="1"
              value={form.windowSec}
              onChange={(e) => setForm({ ...form, windowSec: e.target.value })}
            />
          </label>
        </div>
        {formError && <StatusMessage kind="error">{formError}</StatusMessage>}
        <button type="submit">Save rule</button>
      </form>
    </section>
  );
};
