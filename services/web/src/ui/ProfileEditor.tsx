import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  Checkbox,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Textarea,
} from "@fluentui/react-components";
import {
  Home24Regular,
  Location24Regular,
  PeopleCommunity24Regular,
  Person24Regular,
  ShieldCheckmark24Regular,
} from "@fluentui/react-icons";
import type { Session } from "@supabase/supabase-js";
import { apiRequest } from "../api/http";
import type { Profile } from "../api/profile";

const SearchAreaMap = lazy(() => import("./SearchAreaMap").then(({ SearchAreaMap: Map }) => ({ default: Map })));

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

  const selectedPosition = latitude.trim() !== "" && longitude.trim() !== ""
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    && Number(latitude) >= -90 && Number(latitude) <= 90
    && Number(longitude) >= -180 && Number(longitude) <= 180
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
  const parsedRadius = Number(radiusKm);
  const selectedRadius = Number.isFinite(parsedRadius) && parsedRadius >= 0.1 && parsedRadius <= 250
    ? parsedRadius
    : 25;

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

  function selectMapLocation(selectedLatitude: number, selectedLongitude: number) {
    setLatitude(selectedLatitude.toFixed(5));
    setLongitude(selectedLongitude.toFixed(5));
    setLocationSource("manual");
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
    <div className="profile-editor">
      <header className="profile-editor-intro">
        <div className="profile-editor-intro-icon"><Person24Regular /></div>
        <div>
          <span className="profile-editor-eyebrow">O seu espaço, à sua medida</span>
          <h2>O seu perfil de partilha</h2>
          <p>Conte um pouco sobre si e sobre a casa que procura. Pode atualizar estas escolhas quando quiser.</p>
        </div>
      </header>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
      <div className="profile-editor-card">
        <Card>
          <form className="profile-editor-form" onSubmit={(event) => void saveProfile(event)}>
          <section className="profile-form-section">
            <header className="profile-section-heading">
              <span className="profile-section-icon"><Person24Regular /></span>
              <div><h3>Sobre si</h3><p>Uma primeira impressão para quem também procura casa.</p></div>
            </header>
            <div className="profile-fields-grid">
              <label className="profile-field profile-field-wide">
                <span>Nome a apresentar</span>
                <Input value={displayName} maxLength={80} required onChange={(_, data) => setDisplayName(data.value)} />
              </label>
              <label className="profile-field profile-field-wide">
                <span>Apresente-se</span>
                <Textarea placeholder="O que gostaria que as pessoas soubessem sobre si?" value={bio} maxLength={2000} resize="vertical" onChange={(_, data) => setBio(data.value)} />
                <small>Uma breve descrição ajuda a iniciar uma boa conversa.</small>
              </label>
            </div>
          </section>

          <section className="profile-form-section">
            <header className="profile-section-heading">
              <span className="profile-section-icon"><PeopleCommunity24Regular /></span>
              <div><h3>A casa que procura</h3><p>Defina com quem gostaria de partilhar o seu espaço.</p></div>
            </header>
            <div className="profile-fields-grid">
              <label className="profile-field">
                <span>Número de colegas de casa</span>
                <Input type="number" min={1} max={20} value={housemates} required onChange={(_, data) => setHousemates(data.value)} />
              </label>
              <label className="profile-field">
                <span>Preferência de género</span>
                <select value={genderPreference} onChange={(event) => setGenderPreference(event.target.value)}>
                  <option value="any">Sem preferência</option>
                  <option value="women">Mulheres</option>
                  <option value="men">Homens</option>
                  <option value="other">Outra preferência</option>
                </select>
              </label>
            </div>
            <div className="profile-checkbox-row">
              <Home24Regular />
              <div>
                <Checkbox checked={hasPets} label="Animais em casa" onChange={(_, data) => setHasPets(data.checked === true)} />
                <p>Indique se tem animais ou se aceita animais na casa.</p>
              </div>
            </div>
          </section>

          <section className="profile-form-section">
            <header className="profile-section-heading">
              <span className="profile-section-icon"><Home24Regular /></span>
              <div><h3>Rotinas e convivência</h3><p>Pequenos detalhes que fazem a partilha funcionar melhor.</p></div>
            </header>
            <div className="profile-fields-grid">
              <label className="profile-field profile-field-wide">
                <span>Interesses</span>
                <Input placeholder="Ex.: caminhadas, cinema, cozinhar" value={interests} maxLength={1000} onChange={(_, data) => setInterests(data.value)} />
                <small>Separe os interesses por vírgulas.</small>
              </label>
              <label className="profile-field profile-field-wide">
                <span>O que valoriza na convivência?</span>
                <Textarea placeholder="Há temas ou valores importantes para si?" value={opinions} maxLength={2000} resize="vertical" onChange={(_, data) => setOpinions(data.value)} />
              </label>
              <label className="profile-field">
                <span>Horário e rotina</span>
                <Textarea placeholder="Como é um dia normal para si?" value={workSchedule} maxLength={500} resize="vertical" onChange={(_, data) => setWorkSchedule(data.value)} />
              </label>
              <label className="profile-field">
                <span>Cozinha e refeições</span>
                <Textarea placeholder="Como prefere partilhar a cozinha?" value={cookingHabits} maxLength={500} resize="vertical" onChange={(_, data) => setCookingHabits(data.value)} />
              </label>
            </div>
          </section>

          <section className="profile-form-section profile-location-section">
            <header className="profile-section-heading">
              <span className="profile-section-icon"><Location24Regular /></span>
              <div><h3>Zona de procura</h3><p>Encontre pessoas que procuram viver perto de si.</p></div>
            </header>
            <div className="profile-location-privacy">
              <ShieldCheckmark24Regular />
              <span>A localização exata é privada. Só mostramos a área aproximada aos perfis compatíveis.</span>
            </div>
            <Button className="profile-location-button" type="button" appearance="secondary" disabled={locating} onClick={useBrowserLocation}>
              <Location24Regular /> {locating ? "A obter localização…" : "Usar a minha localização"}
            </Button>
            <p className="profile-location-hint">O browser pedirá permissão. Também pode preencher ou ajustar a localização manualmente.</p>
            <Suspense fallback={<div className="search-area-map-loading">A carregar mapa…</div>}>
              <SearchAreaMap
                position={selectedPosition}
                radiusKm={selectedRadius}
                onSelect={selectMapLocation}
              />
            </Suspense>
            <p className="profile-map-caption">Clique no mapa para marcar a zona ou arraste o marcador. O círculo mostra o raio de procura.</p>
            <p className="profile-map-privacy">Mapa por OpenStreetMap. O serviço de mapas recebe pedidos dos mosaicos da área visível; os dados do perfil não são enviados para esse serviço.</p>
            <div className="profile-fields-grid">
              <label className="profile-field profile-field-wide">
                <span>Área aproximada</span>
                <Input placeholder="Ex.: Lisboa, Porto, Coimbra" value={areaLabel} maxLength={160} required onChange={(_, data) => setAreaLabel(data.value)} />
              </label>
              <label className="profile-field">
                <span>Latitude</span>
                <Input type="number" min={-90} max={90} step="any" value={latitude} required onChange={(_, data) => { setLatitude(data.value); setLocationSource("manual"); }} />
              </label>
              <label className="profile-field">
                <span>Longitude</span>
                <Input type="number" min={-180} max={180} step="any" value={longitude} required onChange={(_, data) => { setLongitude(data.value); setLocationSource("manual"); }} />
              </label>
              <label className="profile-field">
                <span>Raio de procura (km)</span>
                <Input type="number" min={0.1} max={250} step="0.1" value={radiusKm} required onChange={(_, data) => setRadiusKm(data.value)} />
              </label>
            </div>
          </section>

          <div className="profile-discovery-toggle">
            <div className="profile-discovery-toggle-icon"><PeopleCommunity24Regular /></div>
            <div>
              <Checkbox
                checked={discoveryVisible}
                label="Aparecer na descoberta"
                onChange={(_, data) => setDiscoveryVisible(data.checked === true)}
              />
              <p>O seu perfil será mostrado a pessoas em áreas de procura mutuamente compatíveis.</p>
            </div>
          </div>

          <footer className="profile-form-footer">
            <span><ShieldCheckmark24Regular /> A sua localização exata nunca é apresentada a outros utilizadores.</span>
            <Button className="profile-save-button" type="submit" appearance="primary" disabled={saving}>
              {saving ? "A guardar…" : "Guardar perfil"}
            </Button>
          </footer>
          </form>
        </Card>
      </div>
    </div>
  );
}
