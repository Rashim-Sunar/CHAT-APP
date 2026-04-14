/**
 * ProfileModal Component
 * ----------------------
 * Modal dialog for managing user profile information including:
 * - Viewing current profile picture
 * - Editing user name
 * - Uploading new profile picture
 * - Displaying upload progress
 *
 * Features:
 * - Modes: 'view' (profile preview), 'edit-name' (name editing), 'upload' (file upload)
 * - Progress bar during file upload
 * - Error handling with user feedback
 * - Loading states for all operations
 * - Accessibility with focus management
 *
 * @component
 * @example
 * <ProfileModal
 *   isOpen={modalOpen}
 *   user={user}
 *   onClose={handleCloseModal}
 *   onUpdateName={handleNameUpdate}
 *   onUploadPicture={handlePictureUpload}
 * />
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {User} props.user - Current user data
 * @param {() => void} props.onClose - Callback to close modal
 * @param {(displayName: string) => Promise<void>} props.onUpdateName - Name update handler
 * @param {(file: File) => Promise<void>} props.onUploadPicture - Picture upload handler
 * @param {'view'|'edit-name'|'upload'} [props.mode] - modal mode
 *
 * @returns {JSX.Element | null} Renders modal or null if not open
 */

import { useState, useRef, useEffect } from "react";
import { BiX, BiArrowBack } from "react-icons/bi";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import type { User } from "../../types";

type ModalMode = "view" | "edit-name" | "upload";

interface ProfileModalProps {
  isOpen: boolean;
  user: User | null | undefined;
  mode?: ModalMode;
  onClose: () => void;
  onUpdateName: (displayName: string) => Promise<void>;
  onUploadPicture: (file: File) => Promise<void>;
}

const ProfileModal = ({
  isOpen,
  user,
  mode: initialMode = "view",
  onClose,
  onUpdateName,
  onUploadPicture,
}: ProfileModalProps) => {
  const [currentMode, setCurrentMode] = useState<ModalMode>(initialMode);
  const [editingName, setEditingName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const minZoomPercent = 100;
  const maxZoomPercent = 400;
  const zoomStep = 10;

  useEffect(() => {
    setCurrentMode(initialMode);
    setEditingName(user?.userName || "");
    setError(null);
    setZoomPercent(100);
    setPanOffset({ x: 0, y: 0 });
    setIsPanning(false);
  }, [initialMode, user]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const avatarSrc = user.profilePic ? user.profilePic : getAvatarByGender(user.gender);

  // Keep zoom changes bounded so the viewer stays usable and never renders
  // an image so small or so large that it becomes difficult to inspect.
  const changeZoom = (nextZoom: number) => {
    const clampedZoom = Math.min(maxZoomPercent, Math.max(minZoomPercent, nextZoom));
    setZoomPercent(clampedZoom);

    if (clampedZoom === minZoomPercent) {
      setPanOffset({ x: 0, y: 0 });
      setIsPanning(false);
    }
  };

  // Allow mouse wheel zooming inside the viewer. Positive wheel movement
  // zooms out, negative movement zooms in, matching common image viewers.
  const handleZoomWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const delta = event.deltaY < 0 ? zoomStep : -zoomStep;
    changeZoom(zoomPercent + delta);
  };

  const handlePanStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoomPercent === minZoomPercent) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y,
    };
    setIsPanning(true);
  };

  const handlePanMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    const deltaX = event.clientX - panStartRef.current.x;
    const deltaY = event.clientY - panStartRef.current.y;

    setPanOffset({
      x: panStartRef.current.offsetX + deltaX,
      y: panStartRef.current.offsetY + deltaY,
    });
  };

  const handlePanEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsPanning(false);
  };

  /**
   * Handle name save
   */
  const handleSaveName = async () => {
    if (!editingName.trim()) {
      setError("Name cannot be empty");
      return;
    }

    if (editingName === user.userName) {
      setCurrentMode("view");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onUpdateName(editingName.trim());
      setCurrentMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle file upload
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setError(null);

    // Validate file
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      setError("File size must be less than 5MB");
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);

    try {
      // Simulate progress tracking (backend should also track this)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 30;
        });
      }, 200);

      await onUploadPicture(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Keep progress visible for a moment
      setTimeout(() => {
        setCurrentMode("view");
        setUploadProgress(0);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setUploadProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Modal Header with Back button and Close button
   */
  const ModalHeader = () => (
    <div className="flex items-center justify-between p-6 border-b border-slate-200">
      {currentMode !== "view" && (
        <button
          onClick={() => {
            setCurrentMode("view");
            setError(null);
          }}
          aria-label="Go back to profile view"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <BiArrowBack className="w-5 h-5 text-slate-600" />
        </button>
      )}
      <h2 className="text-lg font-semibold text-slate-800 flex-1 ml-2">
        {currentMode === "view" && "Profile"}
        {currentMode === "edit-name" && "Edit Name"}
        {currentMode === "upload" && "Upload Picture"}
      </h2>
      <button
        onClick={onClose}
        aria-label="Close profile modal"
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <BiX className="w-5 h-5 text-slate-600" />
      </button>
    </div>
  );

  // The view mode is intentionally a full-screen photo viewer, not a profile
  // summary card. This keeps the interaction focused on inspecting the image.
  const ViewModeContent = () => (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${user.userName}'s profile picture`}
      onWheel={handleZoomWheel}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close profile picture viewer"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
      >
        <BiX className="h-5 w-5" />
      </button>

      <div className="flex w-full max-w-5xl flex-col items-center gap-4">
        <div
          className="flex max-h-[78vh] w-full max-w-[92vw] items-center justify-center overflow-hidden rounded-2xl bg-black/20 p-4 shadow-2xl"
          onDoubleClick={() => changeZoom(100)}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerCancel={handlePanEnd}
          onPointerLeave={handlePanEnd}
          style={{ touchAction: "none" }}
        >
          <img
            src={avatarSrc}
            alt={`${user.userName}'s profile picture`}
            draggable={false}
            className={`select-none rounded-xl object-contain shadow-lg transition-transform duration-150 ${zoomPercent > minZoomPercent ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"}`}
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomPercent / 100})`,
              transformOrigin: "center center",
              maxWidth: "none",
              maxHeight: "72vh",
            }}
          />
        </div>

        {/* Zoom controls are kept outside the image container so the user can
            adjust scale without losing access to the close action or overlay. */}
        <div className="w-full max-w-xl rounded-full bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => changeZoom(zoomPercent - zoomStep)}
              className="h-9 rounded-full border border-white/20 px-4 text-sm font-medium transition-colors hover:bg-white/10"
              aria-label="Zoom out"
            >
              -
            </button>

            <input
              type="range"
              min={minZoomPercent}
              max={maxZoomPercent}
              step={zoomStep}
              value={zoomPercent}
              onChange={(event) => changeZoom(Number(event.target.value))}
              aria-label="Zoom profile picture"
              className="h-2 w-full cursor-pointer accent-white"
            />

            <button
              type="button"
              onClick={() => changeZoom(zoomPercent + zoomStep)}
              className="h-9 rounded-full border border-white/20 px-4 text-sm font-medium transition-colors hover:bg-white/10"
              aria-label="Zoom in"
            >
              +
            </button>

            <button
              type="button"
              onClick={() => {
                changeZoom(100);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="h-9 rounded-full border border-white/20 px-4 text-sm font-medium transition-colors hover:bg-white/10"
              aria-label="Reset zoom"
            >
              Reset
            </button>
          </div>

          <p className="mt-2 text-center text-xs text-white/70">
            Double-click the image or use the slider to reset and zoom.
          </p>
        </div>
      </div>
    </div>
  );

  /**
   * Edit Name Mode
   */
  const EditNameContent = () => (
    <div className="p-6 space-y-4">
      <div>
        <label htmlFor="userName" className="block text-sm font-medium text-slate-700 mb-2">
          Display Name
        </label>
        <input
          id="userName"
          type="text"
          value={editingName}
          onChange={(e) => {
            setEditingName(e.target.value);
            setError(null);
          }}
          disabled={isLoading}
          placeholder="Enter your name"
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none 
                     focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 
                     disabled:text-slate-500"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2 pt-4">
        <button
          onClick={() => {
            setCurrentMode("view");
            setError(null);
          }}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 
                     transition-colors duration-200 font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveName}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                     transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );

  /**
   * Upload Mode
   */
  const UploadContent = () => (
    <div className="p-6 space-y-4">
      {isLoading && uploadProgress > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Uploading... {Math.round(uploadProgress)}%</p>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{error}</div>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center 
                   cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors 
                   duration-200"
      >
        <p className="text-slate-700 font-medium">Click to select an image</p>
        <p className="text-sm text-slate-500 mt-1">Maximum file size: 5MB</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={isLoading}
        className="hidden"
        aria-label="Upload profile picture"
      />

      <button
        onClick={() => {
          setCurrentMode("view");
          setError(null);
        }}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 
                   transition-colors duration-200 font-medium disabled:opacity-50"
      >
        {isLoading ? "Uploading..." : "Cancel"}
      </button>
    </div>
  );

  // Keep the view mode separate from the edit/upload modal shell. The photo
  // viewer takes over the screen, while the other modes still use the dialog.
  if (currentMode === "view") {
    return <ViewModeContent />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profileModalTitle"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <ModalHeader />

        <div className="divide-y divide-slate-200">
          {currentMode === "edit-name" && <EditNameContent />}
          {currentMode === "upload" && <UploadContent />}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
