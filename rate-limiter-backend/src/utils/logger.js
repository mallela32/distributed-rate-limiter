const write = (level, message, meta = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...meta }));
};

export const logger = {
  info: (message, meta) => write("info", message, meta),
  error: (message, meta) => write("error", message, meta),
};
