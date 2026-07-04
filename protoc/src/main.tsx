import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { ConfigProvider } from 'antd';

createRoot(document.getElementById("root")!).render(
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: '#2563eb', // Indigo / Blue 600
        borderRadius: 10,
        fontFamily: 'Outfit, Inter, system-ui, sans-serif',
      },
    }}
  >
    <App />
  </ConfigProvider>
);