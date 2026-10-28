import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  Checkbox,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
} from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import { apiRequest } from "../api/http";
import type { Profile } from "../api/profile";

type Props = { session: Session };

export function ProfileEditor({ session }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [housemates, setHousemates] = useState("1");
  const [genderPreference, setGenderPreference] = useState("any");
  const [hasPets, setHasPets] = useState(false);
  const [interests, setInterests] = useState("");
  const [opinions, setOpinions] = useState("");
  const [workSchedule, setWorkSchedule] = useState("");
  const [cookingHabits, setCookingHabits] = useState("");
  const [discoveryVisible, setDiscoveryVisible] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusKm, setRadiusKm] = useState("25");
  const [areaLabel, setAreaLabel] = useState("");
  const [locationSource, setLocationSource] = useState<"gps" | "manual">("manual");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Profile>("/api/profile", session.access_token, { signal: controller.signal })
      .then((data) => {
        setProfile(data);
        setDisplayName(data.displayName);
        setBio(data.bio);
        setHousemates(String(data.preferredHousemates ?? 1));
        setGenderPreference(data.genderPreference);
        setHasPets(data.hasPets);
        setInterests(data.interests.join(", "));
        setOpinions(data.opinions);
        setWorkSchedule(data.workSchedule);
        setCookingHabits(data.cookingHabits);
        setDiscoveryVisible(data.discoveryVisible);
        if (data.searchArea) {
          setLatitude(String(data.searchArea.latitude));
          setLongitude(String(data.searchArea.longitude));
          setRadiusKm(String(data.searchArea.radiusKm));
          setAreaLabel(data.searchArea.areaLabel);
          setLocationSource(data.searchArea.locationSource);
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Não foi possível carregar o perfil.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session.access_token]);

  function useBrowserLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Este browser não disponibiliza localização. Pode preencher a zona manualmente.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude.toFixed(5));
        setLongitude(coords.longitude.toFixed(5));
        setLocationSource("gps");
        setLocating(false);
      },
      (positionError) => {
        setError(positionError.code === positionError.PERMISSION_DENIED
          ? "Permissão de localização recusada. Pode introduzir as coordenadas manualmente."
          : "Não foi possível obter a localização. Pode introduzi-la manualmente.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      let updatedProfile = profile;
      const hasArea = latitude.trim() !== "" && longitude.trim() !== "" && areaLabel.trim() !== "";
      if (hasArea) {
        updatedProfile = await apiRequest<Profile>("/api/profile/search-area", session.access_token, {
          method: "PUT",
          body: JSON.stringify({
            latitude: Number(latitude),
            longitude: Number(longitude),
            radiusKm: Number(radiusKm),
            areaLabel: areaLabel.trim(),
            locationSource,
          }),
        });
      } else if (discoveryVisible) {
        throw new Error("Indique uma cidade/área e defina a localização antes de ativar a descoberta.");
      }

      const saved = await apiRequest<Profile>("/api/profile", session.access_token, {
        method: "PUT",
        body: JSON.stringify({
          displayName,
          bio,
          preferredHousemates: Number(housemates),
          genderPreference,
          hasPets,
          interests: interests.split(",").map((item) => item.trim()).filter(Boolean),
          opinions,
          workSchedule,
          cookingHabits,
          discoveryVisible,
        }),
      });
      const completeProfile = updatedProfile?.searchArea ? { ...saved, searchArea: updatedProfile.searchArea } : saved;
      setProfile(completeProfile);
      setNotice("Perfil guardado. A sua localização exata só é visível nesta conta.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível guardar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="A carregar perfil…" />;

  return (
    <Card style={{ padding: 24, borderRadius: 16 }}>
      <h2 style={{ marginTop: 0 }}>O seu perfil de partilha</h2>
      <p>As preferências ajudam a encontrar pessoas com rotinas compatíveis. Pode alterá-las quando quiser.</p>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
      <form onSubmit={(event) => void saveProfile(event)} style={{ display: "grid", gap: 16 }}>
        <label>Nome a apresentar<Input value={displayName} maxLength={80} required onChange={(_, data) => setDisplayName(data.value)} /></label>
        <label>Sobre si<Textarea value={bio} maxLength={2000} resize="vertical" onChange={(_, data) => setBio(data.value)} /></label>
        <label>Número de colegas de casa que procura
          <Input type="number" min={1} max={20} value={housemates} required onChange={(_, data) => setHousemates(data.value)} />
        </label>
        <label>Preferência de género
          <select value={genderPreference} onChange={(event) => setGenderPreference(event.target.value)}>
            <option value="any">Sem preferência</option>
            <option value="women">Mulheres</option>
            <option value="men">Homens</option>
            <option value="other">Outra preferência</option>
          </select>
        </label>
        <Checkbox checked={hasPets} label="Tenho animais ou aceito animais em casa" onChange={(_, data) => setHasPets(data.checked === true)} />
        <label>Interesses (separados por vírgulas)<Input value={interests} maxLength={1000} onChange={(_, data) => setInterests(data.value)} /></label>
        <label>Interesses e opiniões importantes para a convivência<Textarea value={opinions} maxLength={2000} resize="vertical" onChange={(_, data) => setOpinions(data.value)} /></label>
        <label>Horário de trabalho e rotina<Textarea value={workSchedule} maxLength={500} resize="vertical" onChange={(_, data) => setWorkSchedule(data.value)} /></label>
        <label>Hábitos de cozinha e partilha da cozinha<Textarea value={cookingHabits} maxLength={500} resize="vertical" onChange={(_, data) => setCookingHabits(data.value)} /></label>

        <section style={{ display: "grid", gap: 12, padding: 16, borderRadius: 12, background: "#f6f7f3" }}>
          <Text weight="semibold">Zona de procura</Text>
          <p style={{ margin: 0 }}>A localização precisa é privada. Só mostramos a área aproximada aos perfis compatíveis.</p>
          <Button type="button" appearance="secondary" disabled={locating} onClick={useBrowserLocation}>
            {locating ? "A obter localização…" : "Usar a minha localização (GPS)"}
          </Button>
          <Text size={200}>O browser pedirá permissão quando carregar no botão. Se preferir, preencha as coordenadas manualmente.</Text>
          <label>Área aproximada (ex.: Lisboa)<Input value={areaLabel} maxLength={160} required onChange={(_, data) => setAreaLabel(data.value)} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <label>Latitude<Input type="number" min={-90} max={90} step="any" value={latitude} required onChange={(_, data) => { setLatitude(data.value); setLocationSource("manual"); }} /></label>
            <label>Longitude<Input type="number" min={-180} max={180} step="any" value={longitude} required onChange={(_, data) => { setLongitude(data.value); setLocationSource("manual"); }} /></label>
            <label>Raio (km)<Input type="number" min={0.1} max={250} step="0.1" value={radiusKm} required onChange={(_, data) => setRadiusKm(data.value)} /></label>
          </div>
        </section>

        <Checkbox
          checked={discoveryVisible}
          label="Quero aparecer na descoberta de pessoas em áreas mutuamente compatíveis"
          onChange={(_, data) => setDiscoveryVisible(data.checked === true)}
        />
        <Button type="submit" appearance="primary" disabled={saving}>{saving ? "A guardar…" : "Guardar perfil"}</Button>
      </form>
    </Card>
  );
}
