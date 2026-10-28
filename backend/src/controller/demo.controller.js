const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

const products = [
  { id: 1, name: "Keyboard", price: 49 },
  { id: 2, name: "Mouse", price: 25 },
  { id: 3, name: "Monitor", price: 189 },
];

let nextMessageId = 1;

export const login = (req, res) => {
  const { username, password } = req.body ?? {};
  if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: "username and password are required" });
  }
  if (username !== "demo" || password !== "demo123") {
    return res.status(401).json({ error: "invalid credentials" });
  }
  res.json({ message: "login successful", token: "demo-token" });
};

export const sendMessage = (req, res) => {
  const { user_id, text } = req.body ?? {};
  if (!isNonEmptyString(user_id) || !isNonEmptyString(text)) {
    return res.status(400).json({ error: "user_id and text are required" });
  }
  res.status(201).json({ id: nextMessageId++, status: "sent" });
};

export const getProducts = (req, res) => {
  res.json({ products });
};
