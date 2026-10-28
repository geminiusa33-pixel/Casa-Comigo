import { useEffect, useState } from "react";
import { supabase } from "../api/supabase";

export function useProfilePhotoUrl(photoPath?: string | null) {
  const [photoUrl, setPhotoUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    setPhotoUrl(undefined);
    if (!photoPath || !supabase) return () => { active = false; };

    void supabase.storage
      .from("profile-photos")
      .createSignedUrl(photoPath, 60 * 60 * 24)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Não foi possível carregar a foto de perfil.", error);
          return;
        }
        setPhotoUrl(data.signedUrl);
      })
      .catch((error: unknown) => {
        if (active) console.error("Não foi possível carregar a foto de perfil.", error);
      });

    return () => { active = false; };
  }, [photoPath]);

  return photoUrl;
}

type Props = {
  name: string;
  photoPath?: string | null;
};

export function ProfilePhoto({ name, photoPath }: Props) {
  const photoUrl = useProfilePhotoUrl(photoPath);
  return photoUrl
    ? <img className="profile-photo-full" src={photoUrl} alt={`Foto de perfil de ${name}`} />
    : null;
}
