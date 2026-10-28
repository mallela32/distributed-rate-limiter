export const StatusMessage = ({ kind, children }) => (
  <p className={`status-message status-message--${kind}`}>{children}</p>
);

export const unreachableMessage = (baseUrl) =>
  `Can't reach ${baseUrl}. Is the service running, and is its CORS_ORIGIN set to this page's origin?`;
