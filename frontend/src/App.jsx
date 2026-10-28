import "./App.css";
import { AdminPanel } from "./components/AdminPanel.jsx";
import { TryItPanel } from "./components/TryItPanel.jsx";

function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>Rate Limiter Dashboard</h1>
      </header>
      <main className="app__main">
        <TryItPanel />
        <AdminPanel />
      </main>
    </div>
  );
}

export default App;
