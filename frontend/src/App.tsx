import "./App.css";
import "./index.css";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./pages/login/Login";
import Home from "./pages/home/Home";
import SignUp from "./pages/signup/Signup";
import { useAuthContext } from "./context/Auth-Context";
import { useDeviceLinkContext } from "./context/DeviceLinkContext";
import useLogout from "./hooks/useLogout";
import { getErrorMessage } from "./Utils/getErrorMessage";

const MIN_BACKUP_PASSWORD_LENGTH = 10;

const isStrongBackupPassword = (password: string): boolean => {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  return (
    password.length >= MIN_BACKUP_PASSWORD_LENGTH &&
    hasUpper &&
    hasLower &&
    hasNumber &&
    hasSymbol
  );
};

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
          <p className="text-sm text-slate-700">New device wants to access your encrypted chats.</p>
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

const RestoreOrLinkGate = ({
  error,
  backupEnabled,
  onRestore,
  onUseDeviceLink,
  isRestoring,
}: {
  error: string | null;
  backupEnabled: boolean;
  onRestore: (password: string) => Promise<void>;
  onUseDeviceLink: () => Promise<void>;
  isRestoring: boolean;
}) => {
  const { logout, loading } = useLogout();
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleRestore = async () => {
    setLocalError(null);

    if (!password.trim()) {
      setLocalError("Enter your backup password.");
      return;
    }

    try {
      await onRestore(password);
      setPassword("");
    } catch (restoreError: unknown) {
      setLocalError(getErrorMessage(restoreError));
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Restore your messages</h1>
        <p className="text-sm text-slate-600 mt-3">
          This device has no local private key. Restore from encrypted backup or request access from an already approved device.
        </p>

        {backupEnabled ? (
          <div className="mt-4 space-y-3">
            <label className="text-sm font-medium text-slate-700" htmlFor="restore-password">
              Backup password
            </label>
            <input
              id="restore-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter backup password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <button
              onClick={() => void handleRestore()}
              disabled={isRestoring}
              className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm disabled:opacity-70"
            >
              {isRestoring ? "Restoring..." : "Restore with password"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 mt-4">
            No encrypted backup is available for this account yet. Use device linking.
          </p>
        )}

        {error || localError ? (
          <p className="text-sm text-rose-600 mt-3">{localError || error}</p>
        ) : null}

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={() => void onUseDeviceLink()}
            disabled={isRestoring}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm disabled:opacity-70"
          >
            Use device linking
          </button>
          <button
            onClick={() => void logout()}
            disabled={loading || isRestoring}
            className="px-4 py-2 rounded-md bg-slate-200 text-slate-800 text-sm disabled:opacity-70"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
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

const BackupSetupPrompt = ({
  onEnable,
  onDismiss,
}: {
  onEnable: () => void;
  onDismiss: () => void;
}) => {
  return (
    <div className="fixed top-4 right-4 z-40 w-[92vw] max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-md">
      <p className="text-sm font-semibold text-slate-900">Protect your E2EE keys</p>
      <p className="mt-1 text-xs text-slate-600">
        Set a one-time backup password so you can restore your private key on a new device.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onEnable}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
        >
          Enable backup
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

function App() {
  const { authUser, loading } = useAuthContext();
  const {
    status: deviceLinkStatus,
    error: deviceLinkError,
    backupEnabled,
    isEnablingBackup,
    restoreFromBackup,
    startDeviceLinking,
    enableBackup,
  } = useDeviceLinkContext();

  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupPromptDismissed, setBackupPromptDismissed] = useState(false);

  const userId = authUser?.data?.user?._id || null;

  useEffect(() => {
    if (!userId) {
      setBackupPromptDismissed(false);
      return;
    }

    const dismissed = localStorage.getItem(`backup-prompt-dismissed:${userId}`) === "true";
    setBackupPromptDismissed(dismissed);
  }, [userId]);

  const shouldShowBackupPrompt = useMemo(
    () => Boolean(authUser && deviceLinkStatus === "ready" && !backupEnabled && !backupPromptDismissed),
    [authUser, deviceLinkStatus, backupEnabled, backupPromptDismissed]
  );

  const handleEnableBackup = async () => {
    setBackupError(null);

    if (!isStrongBackupPassword(backupPassword)) {
      setBackupError(
        "Use at least 10 characters including uppercase, lowercase, number, and symbol."
      );
      return;
    }

    if (backupPassword !== confirmPassword) {
      setBackupError("Passwords do not match.");
      return;
    }

    try {
      await enableBackup(backupPassword);
      setBackupModalOpen(false);
      setBackupPassword("");
      setConfirmPassword("");
      setBackupPromptDismissed(true);
    } catch (enableError: unknown) {
      setBackupError(getErrorMessage(enableError));
    }
  };

  if (loading) {
    return (
      <div className="p-4 h-screen flex items-center justify-center">
        <Toaster />
        <div className="text-sm opacity-70">Checking your session...</div>
      </div>
    );
  }

  if (authUser && (deviceLinkStatus === "needs_restore" || deviceLinkStatus === "restoring")) {
    return (
      <>
        <Toaster />
        <RestoreOrLinkGate
          error={deviceLinkError}
          backupEnabled={backupEnabled}
          onRestore={restoreFromBackup}
          onUseDeviceLink={startDeviceLinking}
          isRestoring={deviceLinkStatus === "restoring"}
        />
      </>
    );
  }

  if (
    authUser &&
    deviceLinkStatus !== "ready" &&
    deviceLinkStatus !== "restoring" &&
    deviceLinkStatus !== "needs_restore"
  ) {
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
      {shouldShowBackupPrompt ? (
        <BackupSetupPrompt
          onEnable={() => {
            setBackupModalOpen(true);
            setBackupError(null);
          }}
          onDismiss={() => {
            if (userId) {
              localStorage.setItem(`backup-prompt-dismissed:${userId}`, "true");
            }
            setBackupPromptDismissed(true);
          }}
        />
      ) : null}

      {backupModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Enable encrypted key backup</h2>
            <p className="mt-1 text-xs text-slate-600">
              Your password is used locally to encrypt the private key. It is never sent to the server.
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="password"
                value={backupPassword}
                onChange={(event) => setBackupPassword(event.target.value)}
                placeholder="Backup password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm backup password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {backupError ? <p className="text-sm text-rose-600">{backupError}</p> : null}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => void handleEnableBackup()}
                disabled={isEnablingBackup}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-70"
              >
                {isEnablingBackup ? "Encrypting..." : "Enable backup"}
              </button>
              <button
                onClick={() => {
                  setBackupModalOpen(false);
                  setBackupPassword("");
                  setConfirmPassword("");
                  setBackupError(null);
                }}
                className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Routes>
        <Route path="/login" element={authUser ? <Navigate to="/" /> : <Login />} />
        <Route path="/signup" element={authUser ? <Navigate to="/" /> : <SignUp />} />
        <Route path="/" element={authUser ? <Home /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;
