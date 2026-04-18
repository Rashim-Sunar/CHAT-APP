import "./App.css";
import "./index.css";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./pages/login/Login";
import Home from "./pages/home/Home";
import SignUp from "./pages/signup/Signup";
import { useAuthContext } from "./context/Auth-Context";
import { useDeviceLinkContext } from "./context/DeviceLinkContext";
import useLogout from "./hooks/useLogout";

const DeviceApprovalBanner = () => {
  const { incomingRequests, approveRequest, rejectRequest, clearRequest } = useDeviceLinkContext();

  if (incomingRequests.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-xl">
      {incomingRequests.map((request) => (
        <div
          key={request.sessionId}
          className="bg-white border border-slate-200 shadow-lg rounded-xl p-4 mb-3"
        >
          <p className="text-sm text-slate-700">
            New device wants to access your encrypted chats.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {request.deviceInfo?.label || request.deviceInfo?.browser || "Unknown device"}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => void approveRequest(request.sessionId)}
              className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white"
            >
              Approve
            </button>
            <button
              onClick={() => void rejectRequest(request.sessionId)}
              className="px-3 py-2 text-sm rounded-md bg-rose-600 text-white"
            >
              Reject
            </button>
            <button
              onClick={() => clearRequest(request.sessionId)}
              className="px-3 py-2 text-sm rounded-md bg-slate-100 text-slate-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const WaitingForDeviceApproval = ({
  status,
  error,
}: {
  status: "checking" | "pending" | "rejected" | "expired" | "error";
  error: string | null;
}) => {
  const { logout, loading } = useLogout();

  const heading =
    status === "checking"
      ? "Preparing secure session"
      : status === "pending"
      ? "Waiting for approval from another device"
      : "Secure login could not be completed";

  const body =
    status === "checking"
      ? "Verifying local encryption key state for this device..."
      : status === "pending"
      ? "This device is authenticated, but it cannot decrypt chats until an existing approved device shares your encrypted key material."
      : error || "Please login again and retry the device linking process.";

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{heading}</h1>
        <p className="text-sm text-slate-600 mt-3">{body}</p>
        <p className="text-xs text-slate-500 mt-2">
          E2EE login gate is active: without a local private key, chat access stays blocked.
        </p>

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={() => void logout()}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm disabled:opacity-70"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const { authUser, loading } = useAuthContext();
  const { status: deviceLinkStatus, error: deviceLinkError } = useDeviceLinkContext();

  if (loading) {
    return (
      <div className="p-4 h-screen flex items-center justify-center">
        <Toaster />
        <div className="text-sm opacity-70">Checking your session...</div>
      </div>
    );
  }

  if (authUser && deviceLinkStatus !== "ready") {
    return (
      <>
        <Toaster />
        <WaitingForDeviceApproval status={deviceLinkStatus} error={deviceLinkError} />
      </>
    );
  }

  return (
    <div className="p-4 h-screen flex items-center justify-center">
      <Toaster />
      {authUser && deviceLinkStatus === "ready" ? <DeviceApprovalBanner /> : null}
      <Routes>
        <Route path="/login" element={authUser ? <Navigate to="/" /> : <Login />} />
        <Route path="/signup" element={authUser ? <Navigate to="/" /> : <SignUp />} />
        <Route path="/" element={authUser ? <Home /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;