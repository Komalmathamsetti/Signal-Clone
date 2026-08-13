import { UserRound } from "lucide-react";

export default function Avatar({
  src,
  name,
  size = 44,
  online = false
}: {
  src?: string | null;
  name: string;
  size?: number;
  online?: boolean;
}) {
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="" className="avatar" />
      ) : (
        <span className="avatar avatar-fallback">
          <UserRound size={size * 0.48} />
        </span>
      )}
      {online && <span className="online-dot" />}
    </span>
  );
}
