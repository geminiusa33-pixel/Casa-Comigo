import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
import { supabase } from "../api/supabase";
import { ProfileAvatar } from "./ProfileAvatar";
import { getAdministrativeAreaLabel } from "./portugalAdministrativeArea";

const SearchAreaMap = lazy(() => import("./SearchAreaMap").then(({ SearchAreaMap: Map }) => ({ default: Map })));

type Props = {
  session: Session;
  onPhotoPathChange: (photoPath: string | null) => void;
};

export function ProfileEditor({ session, onPhotoPathChange }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const locationLookupVersion = useRef(0);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [housemates, setHousemates] = useState("1");
  const [genderPreference, setGenderPreference] = useState("any");
  const [hasPets, setHasPets] = useState(false);
  const [interests, setInterests] = useState("");
  const [opinions, setOpinions] = useState("");
  const [workSchedule, setWorkSchedule] = useState("");
  const [cookingHabits, setCookingHabits] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [leaseHolderPreference, setLeaseHolderPreference] = useState("any");
  const [billsPreference, setBillsPreference] = useState("discuss");
  const [furnishedPreference, setFurnishedPreference] = useState("any");
  const [preferredBathrooms, setPreferredBathrooms] = useState("");
  const [preferredBedrooms, setPreferredBedrooms] = useState("");
  const [homeTypePreference, setHomeTypePreference] = useState("any");
  const [moveInTiming, setMoveInTiming] = useState("flexible");
  const [minimumLeaseMonths, setMinimumLeaseMonths] = useState("");
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
        setPhotoPath(data.photoPath ?? null);
        onPhotoPathChange(data.photoPath ?? null);
        setDisplayName(data.displayName);
        setBio(data.bio);
        setHousemates(String(data.preferredHousemates ?? 1));
        setGenderPreference(data.genderPreference);
        setHasPets(data.hasPets);
        setInterests(data.interests.join(", "));
        setOpinions(data.opinions);
        setWorkSchedule(data.workSchedule);
        setCookingHabits(data.cookingHabits);
        setMonthlyBudget(data.monthlyBudget === null ? "" : String(data.monthlyBudget));
        setLeaseHolderPreference(data.leaseHolderPreference);
        setBillsPreference(data.billsPreference);
        setFurnishedPreference(data.furnishedPreference);
        setPreferredBathrooms(data.preferredBathrooms === null ? "" : String(data.preferredBathrooms));
        setPreferredBedrooms(data.preferredBedrooms === null ? "" : String(data.preferredBedrooms));
        setHomeTypePreference(data.homeTypePreference);
        setMoveInTiming(data.moveInTiming);
        setMinimumLeaseMonths(data.minimumLeaseMonths === null ? "" : String(data.minimumLeaseMonths));
        setDiscoveryVisible(data.discoveryVisible);
        if (data.searchArea) {
          setLatitude(String(data.searchArea.latitude));
          setLongitude(String(data.searchArea.longitude));
          setRadiusKm(String(data.searchArea.radiusKm));
          if (data.searchArea.areaLabel) {
            setAreaLabel(data.searchArea.areaLabel);
          } else {
            void updateLocationCoordinates(
              String(data.searchArea.latitude),
              String(data.searchArea.longitude),
              data.searchArea.locationSource,
            );
          }
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
    return () => {
      controller.abort();
      locationLookupVersion.current += 1;
    };
  }, [session.access_token, onPhotoPathChange]);

  async function uploadProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensions[file.type];
    if (!extension) {
      setError("Escolha uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("A foto não pode ultrapassar 10 MB.");
      return;
    }
    if (!supabase) {
      setError("O armazenamento de fotos não está configurado.");
      return;
    }

    setError("");
    setNotice("");
    setPhotoUploading(true);
    const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("profile_photos").insert({
        profile_id: session.user.id,
        storage_object_path: path,
        display_order: 0,
      });
      if (insertError) {
        const { error: cleanupError } = await supabase.storage.from("profile-photos").remove([path]);
        if (cleanupError) console.error("Não foi possível limpar o upload de foto incompleto.", cleanupError);
        throw insertError;
      }

      setPhotoPath(path);
      setProfile((current) => current ? { ...current, photoPath: path } : current);
      onPhotoPathChange(path);

      const { data: oldPhotos, error: listError } = await supabase
        .from("profile_photos")
        .select("storage_object_path")
        .eq("profile_id", session.user.id)
        .neq("storage_object_path", path);
      if (listError) {
        console.error("A foto foi atualizada, mas não foi possível listar fotos antigas.", listError);
        setNotice("Foto atualizada. Não foi possível limpar uma foto anterior.");
        return;
      }

      const oldPaths = oldPhotos.map((photo) => photo.storage_object_path);
      if (oldPaths.length) {
        const { error: removeError } = await supabase.storage.from("profile-photos").remove(oldPaths);
        if (removeError) {
          console.error("A foto foi atualizada, mas não foi possível limpar fotos antigas.", removeError);
          setNotice("Foto atualizada. Não foi possível limpar uma foto anterior.");
          return;
        }
        const { error: deleteRowsError } = await supabase
          .from("profile_photos")
          .delete()
          .eq("profile_id", session.user.id)
          .neq("storage_object_path", path);
        if (deleteRowsError) {
          console.error("A foto foi atualizada, mas não foi possível limpar os registos antigos.", deleteRowsError);
          setNotice("Foto atualizada. Não foi possível limpar um registo anterior.");
          return;
        }
      }

      setNotice("Foto de perfil atualizada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar a foto.");
    } finally {
      setPhotoUploading(false);
    }
  }

  function useBrowserLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Este browser não disponibiliza localização. Pode preencher a zona manualmente.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void updateLocationCoordinates(
          coords.latitude.toFixed(5),
          coords.longitude.toFixed(5),
          "gps",
        );
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
    void updateLocationCoordinates(
      selectedLatitude.toFixed(5),
      selectedLongitude.toFixed(5),
      "manual",
    );
  }

  async function updateLocationCoordinates(
    latitudeValue: string,
    longitudeValue: string,
    source: "gps" | "manual",
  ) {
    const lookupVersion = ++locationLookupVersion.current;
    setLatitude(latitudeValue);
    setLongitude(longitudeValue);
    setLocationSource(source);
    setAreaLabel("");

    if (!latitudeValue.trim() || !longitudeValue.trim()) return;

    const latitudeNumber = Number(latitudeValue);
    const longitudeNumber = Number(longitudeValue);
    if (!Number.isFinite(latitudeNumber) || !Number.isFinite(longitudeNumber)
      || latitudeNumber < -90 || latitudeNumber > 90
      || longitudeNumber < -180 || longitudeNumber > 180) return;

    setError("");
    try {
      const label = await getAdministrativeAreaLabel(latitudeNumber, longitudeNumber);
      if (lookupVersion !== locationLookupVersion.current) return;
      if (label) {
        setAreaLabel(label);
        return;
      }

      setError("Não foi possível identificar um distrito ou ilha nesta localização. Preencha a área aproximada manualmente.");
    } catch (caught) {
      if (lookupVersion !== locationLookupVersion.current) return;
      console.error("Não foi possível carregar os limites administrativos locais.", caught);
      setError("Não foi possível carregar os limites administrativos locais. Preencha a área aproximada manualmente.");
    }
  }

  function updateManualCoordinate(coordinate: "latitude" | "longitude", value: string) {
    locationLookupVersion.current += 1;
    setLocationSource("manual");
    if (coordinate === "latitude") setLatitude(value);
    else setLongitude(value);
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
          monthlyBudget: monthlyBudget.trim() === "" ? null : Number(monthlyBudget),
          leaseHolderPreference,
          billsPreference,
          furnishedPreference,
          preferredBathrooms: preferredBathrooms.trim() === "" ? null : Number(preferredBathrooms),
          preferredBedrooms: preferredBedrooms.trim() === "" ? null : Number(preferredBedrooms),
          homeTypePreference,
          moveInTiming,
          minimumLeaseMonths: minimumLeaseMonths.trim() === "" ? null : Number(minimumLeaseMonths),
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
            <div className="profile-photo-control">
              <ProfileAvatar name={displayName || "O seu perfil"} photoPath={photoPath} size={96} />
              <div>
                <strong>Foto de perfil</strong>
                <p>A sua foto aparece no ícone do perfil, na descoberta e nos matches.</p>
                <input
                  ref={photoInputRef}
                  className="profile-photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Escolher foto de perfil"
                  onChange={(event) => void uploadProfilePhoto(event)}
                />
                <Button
                  type="button"
                  appearance="secondary"
                  disabled={photoUploading}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoUploading ? "A carregar foto…" : photoPath ? "Alterar foto" : "Adicionar foto"}
                </Button>
                <small>JPEG, PNG ou WebP · máximo 10 MB.</small>
              </div>
            </div>
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

          <section className="profile-form-section profile-housing-section">
            <header className="profile-section-heading">
              <span className="profile-section-icon"><Home24Regular /></span>
              <div><h3>Detalhes da casa</h3><p>Partilhe as suas condições preferidas para encontrarem um equilíbrio.</p></div>
            </header>
            <div className="profile-soft-note">
              <span>Preferências flexíveis</span>
              <p>Estas respostas ajudam a conversar, mas nunca impedem um match.</p>
            </div>
            <div className="profile-fields-grid">
              <label className="profile-field">
                <span>Quanto pode contribuir por mês?</span>
                <div className="profile-money-input">
                  <span aria-hidden="true">€</span>
                  <Input type="number" min={0} max={100000} step="25" placeholder="Sem preferência" value={monthlyBudget} onChange={(_, data) => setMonthlyBudget(data.value)} />
                </div>
                <small>Valor mensal aproximado por pessoa.</small>
              </label>
              <label className="profile-field">
                <span>Em nome de quem ficará o contrato?</span>
                <select value={leaseHolderPreference} onChange={(event) => setLeaseHolderPreference(event.target.value)}>
                  <option value="any">Sem preferência</option>
                  <option value="own_name">No meu nome</option>
                  <option value="joint">Em conjunto</option>
                  <option value="other">A combinar</option>
                </select>
              </label>
              <label className="profile-field">
                <span>Despesas e recibos</span>
                <select value={billsPreference} onChange={(event) => setBillsPreference(event.target.value)}>
                  <option value="discuss">A combinar</option>
                  <option value="split_equally">Dividir por igual</option>
                  <option value="separate">Cada um paga os seus</option>
                </select>
              </label>
              <label className="profile-field">
                <span>Mobília</span>
                <select value={furnishedPreference} onChange={(event) => setFurnishedPreference(event.target.value)}>
                  <option value="any">Sem preferência</option>
                  <option value="furnished">Mobilada</option>
                  <option value="unfurnished">Sem mobília</option>
                  <option value="partial">Parcialmente mobilada</option>
                </select>
              </label>
              <label className="profile-field">
                <span>Casas de banho (preferência)</span>
                <Input type="number" min={1} max={20} placeholder="Sem preferência" value={preferredBathrooms} onChange={(_, data) => setPreferredBathrooms(data.value)} />
              </label>
              <label className="profile-field">
                <span>Quartos (preferência)</span>
                <Input type="number" min={1} max={30} placeholder="Sem preferência" value={preferredBedrooms} onChange={(_, data) => setPreferredBedrooms(data.value)} />
              </label>
              <label className="profile-field">
                <span>Tipo de casa</span>
                <select value={homeTypePreference} onChange={(event) => setHomeTypePreference(event.target.value)}>
                  <option value="any">Sem preferência</option>
                  <option value="apartment">Apartamento</option>
                  <option value="house">Moradia</option>
                  <option value="room">Quarto numa casa partilhada</option>
                </select>
              </label>
              <label className="profile-field">
                <span>Quando gostaria de se mudar?</span>
                <select value={moveInTiming} onChange={(event) => setMoveInTiming(event.target.value)}>
                  <option value="flexible">Com flexibilidade</option>
                  <option value="immediately">Assim que possível</option>
                  <option value="one_to_three_months">Dentro de 1 a 3 meses</option>
                  <option value="three_plus_months">Daqui a 3 ou mais meses</option>
                </select>
              </label>
              <label className="profile-field">
                <span>Duração mínima do contrato (meses)</span>
                <Input type="number" min={1} max={120} placeholder="Sem preferência" value={minimumLeaseMonths} onChange={(_, data) => setMinimumLeaseMonths(data.value)} />
              </label>
            </div>
          </section>

          <section className="profile-form-section profile-location-section">
            <header className="profile-section-heading">
              <span className="profile-section-icon"><Location24Regular /></span>
              <div><h3>Zona de procura</h3><p>Encontre pessoas que procuram viver perto de si.</p></div>
            </header>
            <div className="profile-hard-note">
              <span>Critério essencial para um match</span>
              <p>O centro de cada área tem de ficar dentro do raio escolhido pela outra pessoa, nos dois sentidos. É o único critério de perfil obrigatório para aparecerem um ao outro.</p>
            </div>
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
                <Input placeholder="Ex.: Distrito de Lisboa, Porto" value={areaLabel} maxLength={160} required onChange={(_, data) => { locationLookupVersion.current += 1; setAreaLabel(data.value); }} />
                <small>Preenchida localmente com o distrito ou ilha ao escolher uma localização. Pode ajustá-la.</small>
              </label>
              <label className="profile-field">
                <span>Latitude</span>
                <Input type="number" min={-90} max={90} step="any" value={latitude} required onChange={(_, data) => updateManualCoordinate("latitude", data.value)} onBlur={() => { void updateLocationCoordinates(latitude, longitude, "manual"); }} />
              </label>
              <label className="profile-field">
                <span>Longitude</span>
                <Input type="number" min={-180} max={180} step="any" value={longitude} required onChange={(_, data) => updateManualCoordinate("longitude", data.value)} onBlur={() => { void updateLocationCoordinates(latitude, longitude, "manual"); }} />
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
