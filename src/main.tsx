import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FeedbackProvider } from "./components/Feedback";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </StrictMode>,
);
