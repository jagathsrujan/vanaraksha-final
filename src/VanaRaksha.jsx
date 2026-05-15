import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import { WARD_DB } from "./data/WARD_DB";
import { matchWard } from "./utils/matchWard";
import { buildSystemPrompt } from "./utils/buildPrompt";
import { buildFallback } from "./utils/fallback";
import { parseAIResponse } from "./utils/parseResult";
import AppFooter from "./components/AppFooter";
import AppHeader from "./components/AppHeader";
import AppSection from "./components/AppSection";
import BackgroundVideo from "./components/BackgroundVideo";
import Button from "./components/Button";
import CoverageMap from "./components/CoverageMap";
import DropZone from "./components/DropZone";
import FormInput from "./components/FormInput";
import FormTextarea from "./components/FormTextarea";
import PillSelector from "./components/PillSelector";
import PrintCSS from "./components/PrintCSS";
import ProgressTracker from "./components/ProgressTracker";
import ReasonCard from "./components/ReasonCard";
import ScoreGauge from "./components/ScoreGauge";
import StepDot from "./components/StepDot";
import SummaryCard from "./components/SummaryCard";
import TierBadge from "./components/TierBadge";
import WardCard from "./components/WardCard";
import heroIllustrationUrl from "./assets/hero-illustration.svg";
import logoUrl from "./assets/logo.svg";

const STEP_LABELS = ["Start", "Location", "Property", "Photos", "Testimony", "Results"];
const STEP_DOTS = ["Location", "Property", "Photos", "Testimony", "Results"];
const PROPERTY_TYPES = ["Residential", "Commercial", "Agricultural", "Institutional"];
const USER_INTENTS = ["Home Buyer", "Seller", "Researcher", "Planner"];
const PHOTO_LIMIT = 5;
const SOFT_PHOTO_SIZE = 5 * 1024 * 1024;
const HARD_PHOTO_SIZE = 20 * 1024 * 1024;
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash";

const INITIAL_LOCATION = { address: "", ward: "", pin: "" };

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function countZones() {
  return new Set(Object.values(WARD_DB).map((ward) => ward.zone).filter(Boolean)).size;
}

function readPhotoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      resolve({
        id: makeId("photo"),
        base64,
        preview: URL.createObjectURL(file),
        mediaType: file.type || "image/jpeg",
        why: "",
        assessment: "",
        tags: [],
        aiAnalysis: {},
      });
    };
    reader.readAsDataURL(file);
  });
}

function buildOpenRouterHeaders(apiKey) {
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-OpenRouter-Title": "VanaRaksha",
  };

  const siteUrl = import.meta.env.VITE_OPENROUTER_SITE_URL || window.location.origin;
  if (siteUrl) headers["HTTP-Referer"] = siteUrl;
  return headers;
}

async function callOpenRouter(messages, apiKey, options = {}) {
  const model = import.meta.env.VITE_OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL;
  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: buildOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      ...options,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errorJson = await response.json();
      detail = errorJson?.error?.message ? `: ${errorJson.error.message}` : "";
    } catch {
      detail = "";
    }
    throw new Error(`OpenRouter analysis service returned ${response.status}${detail}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter analysis service returned an empty response");
  return text;
}

async function analyzePhotoWithOpenRouter(photo, matchedWard, apiKey) {
  const systemPrompt = buildSystemPrompt(matchedWard);
  const raw = await callOpenRouter(
    [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Analyze this photo for climate risk signals. Respond ONLY as valid JSON with flood_signals, heat_signals, water_signals arrays, key_observation, and confidence as Low, Medium, or High.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${photo.mediaType || "image/jpeg"};base64,${photo.base64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    apiKey,
    { temperature: 0.2, max_tokens: 1200 }
  );
  const parsed = parseAIResponse(raw, "photo");
  if (!parsed.ok) throw new Error(parsed.error || "Photo analysis was not valid JSON");
  return parsed.data;
}

function buildPhotoEvidence(photos) {
  if (!photos.length) return "None";
  return photos.map((photo, index) => {
    const analysis = photo.aiAnalysis || {};
    const flood = (analysis.flood_signals || []).join(", ") || "none detected";
    const heat = (analysis.heat_signals || []).join(", ") || "none detected";
    const water = (analysis.water_signals || []).join(", ") || "none detected";
    return [
      `Photo ${index + 1} [confidence: ${analysis.confidence || "Low"}]`,
      `Flood signals: ${flood}`,
      `Heat signals: ${heat}`,
      `Water signals: ${water}`,
      `Key observation: ${analysis.key_observation || "none"}`,
      `User annotation: ${photo.why || "none"}`,
      `User assessment: ${photo.assessment || "none"}`,
    ].join("\n");
  }).join("\n\n");
}

async function runOpenRouterSynthesis({
  apiKey,
  location,
  matchedWard,
  propertyType,
  userIntent,
  notes,
  photos,
  testimonies,
}) {
  const systemPrompt = buildSystemPrompt(matchedWard);
  const testimonySection = testimonies.length
    ? testimonies.map((item) =>
      `- ${item.who || "Anonymous"} (${item.concern}, credibility ${item.credibility}/5): "${item.said || "No statement"}"`
    ).join("\n")
    : "None";

  const prompt = `${systemPrompt}

Analyze this Bengaluru property for climate risk.

Location:
- Address: ${location.address || "Not specified"}
- Ward hint: ${location.ward || "Not specified"}
- PIN: ${location.pin || "Not specified"}

Property context:
- Ward match: ${matchedWard?.label || "Unknown"}
- Property type: ${propertyType || "Not specified"}
- User intent: ${userIntent || "Not specified"}
- Notes: ${notes || "None"}

Photo evidence:
${buildPhotoEvidence(photos)}

Local testimony:
${testimonySection}

Respond ONLY as valid JSON with the complete synthesis schema: composite_score, composite_tier, flood_score, flood_tier, flood_confidence, flood_reasoning, uhi_score, uhi_tier, uhi_confidence, uhi_reasoning, water_score, water_tier, water_confidence, water_reasoning, compound_risk, executive_summary, flags, recommendations, data_sources.`;

  const raw = await callOpenRouter(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    apiKey
  );
  const parsed = parseAIResponse(raw, "synthesis");
  if (!parsed.ok) throw new Error(parsed.error || "Risk synthesis was not valid JSON");
  return parsed.data;
}

export default function VanaRaksha() {
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [propertyType, setPropertyType] = useState("");
  const [userIntent, setUserIntent] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState([]);
  const [testimonies, setTestimonies] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [apiError, setApiError] = useState(null);
  const [photoWarning, setPhotoWarning] = useState(null);
  const headingRef = useRef(null);
  const errorRef = useRef(null);
  const firstPhotoRef = useRef(null);
  const photosRef = useRef([]);

  const matchedWard = useMemo(
    () => matchWard(location.address, location.ward, location.pin),
    [location.address, location.ward, location.pin]
  );

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => {
        if (photo.preview?.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
      });
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => headingRef.current?.focus());
  }, [step]);

  useEffect(() => {
    if (apiError) errorRef.current?.focus();
  }, [apiError]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setApiError(null);
        setPhotoWarning(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const updateLocation = (field, value) => {
    setLocation((current) => ({
      ...current,
      [field]: field === "pin" ? value.replace(/\D/g, "").slice(0, 6) : value,
    }));
  };

  const addPhotos = async (files) => {
    setPhotoWarning(null);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const remaining = PHOTO_LIMIT - photos.length;

    if (!imageFiles.length) {
      setPhotoWarning("Please choose image files only.");
      return;
    }

    if (remaining <= 0) {
      setPhotoWarning(`You can upload up to ${PHOTO_LIMIT} photos.`);
      return;
    }

    const accepted = [];
    const warnings = [];

    for (const file of imageFiles.slice(0, remaining)) {
      if (file.size > HARD_PHOTO_SIZE) {
        warnings.push(`${file.name} is larger than 20MB and was rejected.`);
        continue;
      }
      if (file.size > SOFT_PHOTO_SIZE) {
        warnings.push(`${file.name} is larger than 5MB; it was accepted but may be slow to analyze.`);
      }
      accepted.push(file);
    }

    if (imageFiles.length > remaining) {
      warnings.push(`Only ${remaining} more photo${remaining === 1 ? "" : "s"} can be added.`);
    }

    if (warnings.length) setPhotoWarning(warnings.join(" "));
    if (!accepted.length) return;

    const newPhotos = await Promise.all(accepted.map(readPhotoFile));
    setPhotos((current) => [...current, ...newPhotos].slice(0, PHOTO_LIMIT));
    setTimeout(() => firstPhotoRef.current?.focus(), 0);
  };

  const removePhoto = (id) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target?.preview?.startsWith("blob:")) URL.revokeObjectURL(target.preview);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const updatePhoto = (id, field, value) => {
    setPhotos((current) => current.map((photo) =>
      photo.id === id ? { ...photo, [field]: value } : photo
    ));
  };

  const addTestimony = () => {
    setTestimonies((current) => [
      ...current,
      { id: makeId("testimony"), who: "", said: "", concern: "none", credibility: 3 },
    ]);
  };

  const updateTestimony = (id, field, value) => {
    setTestimonies((current) => current.map((item) =>
      item.id === id
        ? { ...item, [field]: field === "credibility" ? Number(value) : value }
        : item
    ));
  };

  const removeTestimony = (id) => {
    setTestimonies((current) => current.filter((item) => item.id !== id));
  };

  const resetAssessment = () => {
    photos.forEach((photo) => {
      if (photo.preview?.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
    });
    setLocation(INITIAL_LOCATION);
    setPropertyType("");
    setUserIntent("");
    setNotes("");
    setPhotos([]);
    setTestimonies([]);
    setResult(null);
    setApiError(null);
    setPhotoWarning(null);
    setLoading(false);
    setLoadingMsg("");
    setStep(0);
  };

  const runAnalysis = async () => {
    setLoading(true);
    setApiError(null);
    setResult(null);

    try {
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || "";
      let photosForSynthesis = photos;
      let synthesis = null;

      if (apiKey.trim()) {
        const analyzed = [];
        for (let index = 0; index < photos.length; index += 1) {
          setLoadingMsg(`Analyzing photo ${index + 1} of ${photos.length}...`);
          try {
            const aiAnalysis = await analyzePhotoWithOpenRouter(photos[index], matchedWard, apiKey);
            analyzed.push({ ...photos[index], aiAnalysis });
          } catch (error) {
            analyzed.push({
              ...photos[index],
              aiAnalysis: {
                flood_signals: [],
                heat_signals: [],
                water_signals: [],
                key_observation: error.message,
                confidence: "Low",
              },
            });
          }
        }
        photosForSynthesis = analyzed;
        setPhotos(analyzed);
        setLoadingMsg("Synthesizing ward, photo, and testimony evidence...");
        synthesis = await runOpenRouterSynthesis({
          apiKey,
          location,
          matchedWard,
          propertyType,
          userIntent,
          notes,
          photos: photosForSynthesis,
          testimonies,
        });
      } else {
        setLoadingMsg("Calculating risk from ward baseline data...");
      }

      setResult(synthesis || buildFallback(matchedWard));
      setStep(5);
    } catch (error) {
      setApiError(error.message || "Analysis failed.");
      setResult(buildFallback(matchedWard));
      setStep(5);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  return (
    <div className="vrm-app">
      <PrintCSS />
      <BackgroundVideo />
      <AppHeader />
      <main className="vrm-container">
        {step > 0 && (
          <ProgressTracker
            currentStep={step}
            totalSteps={STEP_LABELS.length}
            label={STEP_LABELS[step]}
          />
        )}

        {step === 0 && (
          <LandingPage
            headingRef={headingRef}
            onStart={() => setStep(1)}
            wardCount={Object.keys(WARD_DB).length}
            zoneCount={countZones()}
          />
        )}

        {step === 1 && (
          <LocationStep
            headingRef={headingRef}
            location={location}
            matchedWard={matchedWard}
            onChange={updateLocation}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <PropertyStep
            headingRef={headingRef}
            propertyType={propertyType}
            userIntent={userIntent}
            notes={notes}
            onChangePropertyType={setPropertyType}
            onChangeIntent={setUserIntent}
            onChangeNotes={setNotes}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <PhotosStep
            headingRef={headingRef}
            photos={photos}
            photoWarning={photoWarning}
            firstPhotoRef={firstPhotoRef}
            onAddPhotos={addPhotos}
            onRemovePhoto={removePhoto}
            onUpdatePhotoAnnotation={updatePhoto}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <TestimonyStep
            headingRef={headingRef}
            testimonies={testimonies}
            onAdd={addTestimony}
            onRemove={removeTestimony}
            onUpdateField={updateTestimony}
            onNext={runAnalysis}
            onBack={() => setStep(3)}
            loadingMsg={loadingMsg}
            loading={loading}
            apiError={apiError}
            errorRef={errorRef}
          />
        )}

        {step === 5 && result && (
          <ResultsPage
            headingRef={headingRef}
            result={result}
            matchedWard={matchedWard}
            apiError={apiError}
            errorRef={errorRef}
            onNewAssessment={resetAssessment}
            onRefine={() => {
              setResult(null);
              setApiError(null);
              setStep(3);
            }}
          />
        )}
      </main>
      <AppFooter currentStep={step} />
    </div>
  );
}

function LandingPage({ headingRef, onStart, wardCount, zoneCount }) {
  return (
    <section className="landing slide-up" aria-labelledby="landing-title">
      <img className="landing__hero-icon" src={logoUrl} alt="" aria-hidden="true" />
      <h1 id="landing-title" ref={headingRef} tabIndex="-1">
        Understand Climate Risk for Your Bengaluru Property
      </h1>
      <p className="landing__subtitle">
        VanaRaksha assesses flood risk, urban heat island exposure, and water stress using curated BBMP ward data, photo evidence, and local testimony.
      </p>

      <div className="landing__illustration" aria-hidden="true">
        <img src={heroIllustrationUrl} alt="" />
      </div>

      <div className="landing__steps" aria-label="Assessment flow">
        {STEP_DOTS.map((label, index) => (
          <StepDot key={label} n={index} current={0} label={label} />
        ))}
      </div>

      <div className="pillar-grid">
        <PillarCard
          accent="var(--danger)"
          title="🌊 Flood Risk"
          body="Historical flooding, drainage capacity, terrain, soils, and nearby lake systems."
        />
        <PillarCard
          accent="var(--warning)"
          title="🌡️ Urban Heat Island"
          body="Vegetation cover, impervious surfaces, density, and observed heat delta."
        />
        <PillarCard
          accent="var(--info)"
          title="💧 Water Stress"
          body="Groundwater depth, BWSSB coverage, rainfall, and contamination proximity."
        />
      </div>

      <CoverageMap />
      <p className="coverage-note">
        Covers {wardCount} wards across {zoneCount} BBMP zones represented in the database.
      </p>
      <Button size="large" onClick={onStart}>Start Assessment →</Button>
    </section>
  );
}

function PillarCard({ accent, title, body }) {
  return (
    <article className="pillar-card" style={{ "--accent-color": accent }}>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function LocationStep({ headingRef, location, matchedWard, onChange, onBack, onNext }) {
  const hasAddress = location.address.trim().length > 0;

  return (
    <AppSection headingRef={headingRef} id="location-step-title" title="📍 Step 1: Location" size="narrow">
      <FormInput
        id="street-address"
        label="Street Address / Area"
        placeholder="e.g., 80 Feet Road, Koramangala"
        value={location.address}
        onChange={(event) => onChange("address", event.target.value)}
        autoComplete="street-address"
      />
      <FormInput
        id="ward-name"
        label="Ward Name (optional)"
        placeholder="e.g., Koramangala"
        value={location.ward}
        onChange={(event) => onChange("ward", event.target.value)}
        helperText="A ward or neighborhood hint improves matching."
      />
      <FormInput
        id="pin-code"
        label="PIN Code (optional)"
        placeholder="e.g., 560034"
        value={location.pin}
        onChange={(event) => onChange("pin", event.target.value)}
        maxLength={6}
        inputMode="numeric"
        pattern="[0-9]*"
        helperText="Six digits, if known."
      />

      {matchedWard && <WardCard ward={matchedWard} />}

      {!matchedWard && hasAddress && (
        <div className="status-card status-card--warning" role="status">
          ⚠️ Ward not in database. VanaRaksha will use interpolation or city averages.
        </div>
      )}

      <div className="button-row">
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        <Button onClick={onNext} disabled={!hasAddress}>Next →</Button>
      </div>
    </AppSection>
  );
}

function PropertyStep({
  headingRef,
  propertyType,
  userIntent,
  notes,
  onChangePropertyType,
  onChangeIntent,
  onChangeNotes,
  onNext,
  onBack,
}) {
  return (
    <AppSection headingRef={headingRef} id="property-step-title" title="🏠 Step 2: Property Details" size="narrow">
      <PillSelector
        legend="Property Type"
        name="property-type"
        options={PROPERTY_TYPES}
        value={propertyType}
        onChange={onChangePropertyType}
      />
      <PillSelector
        legend="Your Intent"
        name="user-intent"
        options={USER_INTENTS}
        value={userIntent}
        onChange={onChangeIntent}
      />
      <FormTextarea
        id="property-notes"
        label="Additional Notes"
        placeholder="Any specific concerns..."
        minLength={0}
        value={notes}
        onChange={(event) => onChangeNotes(event.target.value)}
      />
      <div className="button-row">
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        <Button onClick={onNext} disabled={!propertyType}>Next →</Button>
      </div>
    </AppSection>
  );
}

function PhotosStep({
  headingRef,
  photos,
  photoWarning,
  firstPhotoRef,
  onAddPhotos,
  onRemovePhoto,
  onUpdatePhotoAnnotation,
  onNext,
  onBack,
}) {
  const fileInputRef = useRef(null);

  return (
    <AppSection
      headingRef={headingRef}
      id="photos-step-title"
      title="📸 Step 3: Photo Evidence"
      intro="Upload up to 5 photos showing conditions around the property."
      size="wide"
    >
      {photos.length === 0 ? (
        <DropZone onFiles={onAddPhotos} />
      ) : (
        <>
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <article
                key={photo.id}
                className="photo-card"
                tabIndex="-1"
                ref={index === 0 ? firstPhotoRef : undefined}
                aria-label={`Photo evidence ${index + 1}`}
              >
                <img src={photo.preview} alt={`Evidence ${index + 1}`} />
                <Button
                  className="photo-card__remove"
                  variant="danger"
                  size="small"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => onRemovePhoto(photo.id)}
                >
                  ✕
                </Button>
                <label className="form-label" htmlFor={`photo-why-${photo.id}`}>
                  Why did you take this photo?
                </label>
                <textarea
                  id={`photo-why-${photo.id}`}
                  className="form-control"
                  value={photo.why}
                  placeholder="Why did you take this photo?"
                  onChange={(event) => onUpdatePhotoAnnotation(photo.id, "why", event.target.value)}
                />
                <label className="form-label" htmlFor={`photo-assessment-${photo.id}`}>
                  Your assessment
                </label>
                <textarea
                  id={`photo-assessment-${photo.id}`}
                  className="form-control"
                  value={photo.assessment}
                  placeholder="What risk signal does it show?"
                  onChange={(event) => onUpdatePhotoAnnotation(photo.id, "assessment", event.target.value)}
                />
              </article>
            ))}
          </div>

          {photos.length < PHOTO_LIMIT && (
            <>
              <button
                type="button"
                className="add-photo-button"
                onClick={() => fileInputRef.current?.click()}
              >
                + Add Photos ({photos.length}/{PHOTO_LIMIT})
              </button>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  onAddPhotos(Array.from(event.target.files || []));
                  event.target.value = "";
                }}
              />
            </>
          )}
        </>
      )}

      {photoWarning && (
        <div className="status-card status-card--warning" role="status" aria-live="polite">
          ⚠️ {photoWarning}
        </div>
      )}

      <div className="button-row">
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        <Button onClick={onNext}>Next →</Button>
      </div>
    </AppSection>
  );
}

function TestimonyStep({
  headingRef,
  testimonies,
  onAdd,
  onRemove,
  onUpdateField,
  onNext,
  onBack,
  loadingMsg,
  loading,
  apiError,
  errorRef,
}) {
  return (
    <AppSection
      headingRef={headingRef}
      id="testimony-step-title"
      title="🗣️ Step 4: Local Testimony"
      intro="Add statements from residents, officials, or reports."
      size="narrow"
    >
      <div className="testimony-list">
        {testimonies.map((item, index) => (
          <article key={item.id} className="testimony-card vr-card" aria-label={`Testimony ${index + 1}`}>
            <Button
              className="testimony-card__remove"
              variant="danger"
              size="small"
              aria-label={`Remove testimony ${index + 1}`}
              onClick={() => onRemove(item.id)}
            >
              ✕
            </Button>
            <FormInput
              id={`testimony-who-${item.id}`}
              label="Who said this"
              placeholder="Resident, official, report title..."
              value={item.who}
              onChange={(event) => onUpdateField(item.id, "who", event.target.value)}
            />
            <FormTextarea
              id={`testimony-said-${item.id}`}
              label="What did they report"
              placeholder="Describe flooding, heat, water shortages, or observations..."
              value={item.said}
              onChange={(event) => onUpdateField(item.id, "said", event.target.value)}
            />
            <div className="testimony-card__grid">
              <div className="form-group">
                <label className="form-label" htmlFor={`testimony-concern-${item.id}`}>Concern</label>
                <select
                  id={`testimony-concern-${item.id}`}
                  className="form-select"
                  value={item.concern}
                  onChange={(event) => onUpdateField(item.id, "concern", event.target.value)}
                >
                  {["none", "low", "medium", "high"].map((concern) => (
                    <option key={concern} value={concern}>{concern}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={`testimony-credibility-${item.id}`}>Credibility</label>
                <div className="range-row">
                  <input
                    id={`testimony-credibility-${item.id}`}
                    type="range"
                    min="1"
                    max="5"
                    value={item.credibility}
                    onChange={(event) => onUpdateField(item.id, "credibility", event.target.value)}
                  />
                  <span className="range-value">{item.credibility}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Button variant="secondary" onClick={onAdd}>+ Add Testimony</Button>

      {apiError && (
        <div
          ref={errorRef}
          className="status-card status-card--error"
          role="alert"
          tabIndex="-1"
        >
          <strong>{apiError}</strong>
          <p>Showing fallback results based on ward baseline data.</p>
        </div>
      )}

      <div className="button-row">
        <Button variant="secondary" onClick={onBack} disabled={loading}>← Back</Button>
        <Button onClick={onNext} disabled={loading}>
          {loading ? "Analyzing..." : "🚀 Run AI Analysis"}
        </Button>
      </div>

      {loadingMsg && (
        <p className="loading-status" aria-live="polite">{loadingMsg}</p>
      )}
    </AppSection>
  );
}

function ResultsPage({
  headingRef,
  result,
  matchedWard,
  apiError,
  errorRef,
  onNewAssessment,
  onRefine,
}) {
  const sources = result.data_sources || [];
  const flags = result.flags || [];
  const recommendations = result.recommendations || [];

  return (
    <AppSection headingRef={headingRef} id="results-step-title" title="📊 Risk Assessment Results" size="wide">
      {apiError && (
        <div ref={errorRef} className="status-card status-card--error" role="alert" tabIndex="-1">
          <strong>{apiError}</strong>
          <p>Showing fallback results based on ward baseline data.</p>
        </div>
      )}

      <div className="results-header">
        <div className="results-header__score">
          <span className="results-header__label">Overall Risk</span>
          <span className="results-header__value">{Math.round(result.composite_score ?? 0)}/100</span>
        </div>
        <TierBadge tier={result.composite_tier} size="lg" />
      </div>

      <div className="gauge-grid">
        <ScoreGauge
          score={result.flood_score}
          tier={result.flood_tier}
          label="Flood Risk"
          confidence={result.flood_confidence}
        />
        <ScoreGauge
          score={result.uhi_score}
          tier={result.uhi_tier}
          label="Heat Island Risk"
          confidence={result.uhi_confidence}
        />
        <ScoreGauge
          score={result.water_score}
          tier={result.water_tier}
          label="Water Stress"
          confidence={result.water_confidence}
        />
      </div>

      <div className="reason-grid">
        <ReasonCard title="🌊 Flood Analysis" accent="var(--info)">
          {result.flood_reasoning}
        </ReasonCard>
        <ReasonCard title="🌡️ UHI Analysis" accent="var(--danger)">
          {result.uhi_reasoning}
        </ReasonCard>
        <ReasonCard title="💧 Water Stress Analysis" accent="var(--primary)">
          {result.water_reasoning}
        </ReasonCard>
      </div>

      <div className="summary-stack">
        <SummaryCard title="🔗 Compound Risk Interactions" accent="var(--warning)">
          <p>{result.compound_risk}</p>
        </SummaryCard>
        <SummaryCard title="📝 Executive Summary" accent="var(--primary)">
          <p>{result.executive_summary}</p>
        </SummaryCard>
        <SummaryCard title="🔴 Risk Flags" accent="var(--danger)">
          {flags.length ? (
            <ul className="risk-list">
              {flags.map((flag, index) => <li key={`${flag}-${index}`}>{flag}</li>)}
            </ul>
          ) : (
            <p>No risk flags were raised.</p>
          )}
        </SummaryCard>
        <SummaryCard title="✅ Recommendations" accent="var(--primary)">
          {recommendations.length ? (
            <ol className="recommendation-list">
              {recommendations.map((recommendation, index) => (
                <li key={`${recommendation}-${index}`}>{recommendation}</li>
              ))}
            </ol>
          ) : (
            <p>No recommendations were generated.</p>
          )}
        </SummaryCard>
        <SummaryCard title="📚 Data Sources" accent="var(--info)">
          <div className="source-tags">
            {sources.length ? sources.map((source, index) => (
              <span className="source-tag" key={`${source}-${index}`}>{source}</span>
            )) : <span className="source-tag">WARD_DB</span>}
          </div>
        </SummaryCard>
      </div>

      {matchedWard && <WardCard ward={matchedWard} />}

      <div className="button-row">
        <Button variant="secondary" onClick={onNewAssessment}>New Assessment</Button>
        <Button onClick={onRefine}>Refine with More Data</Button>
      </div>
    </AppSection>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<VanaRaksha />);
}
