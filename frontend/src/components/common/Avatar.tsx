import { useEffect, useState } from "react";
import { loadGenderAvatar } from "../../Utils/getAvatarByGender";
import { getInitial } from "../../Utils/getInitial";
import type { Gender } from "../../types";

interface AvatarProps {
  src?: string | null;
  gender?: Gender | string | null;
  name?: string | null;
  alt: string;
  className?: string;
  textClassName?: string;
  // Groups have no gender to fall back on — "group" skips straight from src
  // to initials, since falling through to loadGenderAvatar(undefined) would
  // silently render a male person icon for an unnamed/unphotographed group.
  kind?: "user" | "group";
}

/**
 * Three-tier avatar: the real profile picture if given; otherwise (for
 * users only) the gender-based default image, fetched on demand; otherwise
 * (while that's loading, if it also fails, or for groups) an instant
 * initials letter that never depends on a network request.
 */
const Avatar = ({
  src,
  gender,
  name,
  alt,
  className,
  textClassName = "text-base",
  kind = "user",
}: AvatarProps) => {
  const [srcFailed, setSrcFailed] = useState(false);
  const [genderAvatarUrl, setGenderAvatarUrl] = useState<string | null>(null);
  const [genderAvatarFailed, setGenderAvatarFailed] = useState(false);

  useEffect(() => {
    setSrcFailed(false);
  }, [src]);

  const needsGenderAvatar = kind === "user" && (!src || srcFailed);

  useEffect(() => {
    if (!needsGenderAvatar) return;

    let cancelled = false;
    setGenderAvatarUrl(null);
    setGenderAvatarFailed(false);

    loadGenderAvatar(gender)
      .then((url) => {
        if (!cancelled) setGenderAvatarUrl(url);
      })
      .catch(() => {
        if (!cancelled) setGenderAvatarFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [needsGenderAvatar, gender]);

  if (src && !srcFailed) {
    return <img src={src} alt={alt} onError={() => setSrcFailed(true)} className={className} />;
  }

  if (needsGenderAvatar && genderAvatarUrl && !genderAvatarFailed) {
    return (
      <img src={genderAvatarUrl} alt={alt} onError={() => setGenderAvatarFailed(true)} className={className} />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`${className} flex items-center justify-center bg-indigo-500 text-white font-semibold select-none ${textClassName}`}
    >
      {getInitial(name)}
    </div>
  );
};

export default Avatar;
