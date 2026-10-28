import { Avatar } from "@fluentui/react-components";
import { useProfilePhotoUrl } from "./ProfilePhoto";

type Props = {
  name: string;
  photoPath?: string | null;
  size?: 16 | 20 | 24 | 28 | 32 | 36 | 40 | 48 | 56 | 64 | 72 | 96 | 120 | 128;
  className?: string;
};

export function ProfileAvatar({ name, photoPath, size = 40, className }: Props) {
  const photoUrl = useProfilePhotoUrl(photoPath);

  return (
    <Avatar
      name={name}
      image={photoUrl ? { src: photoUrl } : undefined}
      size={size}
      className={className}
    />
  );
}
