import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthContextProvider } from "./context/Auth-Context";
import { SocketContextProvider } from "./context/SocketContext";
import { DeviceLinkProvider } from "./context/DeviceLinkContext";
import { CallProvider } from "./context/CallContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthContextProvider>
        <SocketContextProvider>
          <DeviceLinkProvider>
            <CallProvider>
              <App />
            </CallProvider>
          </DeviceLinkProvider>
        </SocketContextProvider>
      </AuthContextProvider>
    </BrowserRouter>
  </React.StrictMode>
);