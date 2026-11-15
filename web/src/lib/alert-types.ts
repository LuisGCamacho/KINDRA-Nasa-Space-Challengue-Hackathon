/**
 * Contratos nuevos de KINDRA 4: cámaras, detecciones, alertas de incendio y correo.
 * Python (visión y agente) escribe con esta forma; la API y la interfaz la leen.
 * Cambiar un campo es cambiar un contrato: se acuerda con el equipo antes.
 */

// ─── Cámaras ────────────────────────────────────────────────────────────

/** Dueño de la cámara. Solo fuentes publicadas oficialmente por su dueño. */
export type CameraProvider = "caltrans" | "tfl" | "windy" | "hpwren" | "demo";

/** Cámara pública. Fuente: `web/data/cameras.json` o la tabla `cameras`. */
export interface Camera {
  id: string;
  name: string;
  provider: CameraProvider;
  /** Posición en `[lon, lat]`, en grados (mismo orden que `Zone.center`). */
  position: [number, number];
  /** Última imagen; en Windy la URL vence y se pide de nuevo en cada carga. */
  imageUrl: string;
  /** Video de la demo; `null` en las cámaras que solo publican fotos. */
  videoUrl: string | null;
  refreshSeconds: number;
  /** Texto de crédito que exige el dueño, por ejemplo "Powered by TfL Open Data". */
  attribution: string;
  termsUrl: string;
}

// ─── Detección (visión por computadora) ────────────────────────────────

export type FireLabel = "humo" | "llama" | "anomalia";
export type MaterialLabel = "vegetacion" | "auto" | "edificio" | "tanque_combustible";

/**
 * Recuadro normalizado a la imagen: `x` e `y` son la esquina superior izquierda,
 * todo entre 0 y 1. Así sirve igual para la foto original, la miniatura y el correo.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Zona anómala marcada en la imagen. */
export interface FireRegion {
  label: FireLabel;
  /** Confianza del modelo, de 0 a 1. */
  confidence: number;
  box: Box;
  /** Id de seguimiento en video (ByteTrack); `null` en fotos sueltas. */
  trackId: number | null;
}

/** Material que puede arder cerca de la zona anómala. */
export interface NearbyMaterial {
  label: MaterialLabel;
  /** `imagen`: lo vio el modelo; `osm`: viene de OpenStreetMap. */
  source: "imagen" | "osm";
  /** Recuadro en la imagen; `null` si viene solo de OpenStreetMap. */
  box: Box | null;
  /** Distancia a la cámara en metros; `null` si no se puede calcular. */
  distanceM: number | null;
}

/** Una detección: un cuadro analizado con sus zonas anómalas y materiales. */
export interface Detection {
  id: string;
  cameraId: string;
  /** Hora de la captura, ISO 8601 en UTC. */
  capturedAt: string;
  /** Imagen original y la misma con las marcas dibujadas. */
  frameUrl: string;
  annotatedUrl: string;
  regions: FireRegion[];
  materials: NearbyMaterial[];
  model: { name: string; version: string };
}

/** Cuadro de un video con sus zonas, para que el recuadro siga al humo. */
export interface TrackFrame {
  /** Segundo del video. */
  t: number;
  regions: FireRegion[];
}

// ─── Alerta de incendio ─────────────────────────────────────────────────

export type AgentDecision = "confirmar" | "descartar" | "revisar";

export type FireAlertStatus =
  | "pendiente"            // el agente todavía no decidió
  | "descartada"           // el agente la descartó: no se envía correo
  | "enviada"              // el agente la confirmó y se envió el correo
  | "incendio_confirmado"  // una persona tocó "Confirmar incendio"
  | "falso_positivo";      // una persona tocó "Marcar como falso positivo"

/** Cruce con NASA FIRMS: ¿hay un foco de calor cerca en las últimas horas? */
export interface FirmsMatch {
  found: boolean;
  nearestKm: number | null;
  hoursAgo: number | null;
  /** Por ejemplo `"VIIRS_NOAA20_NRT"`; `null` si no se encontró foco. */
  source: string | null;
}

export type HotspotSensor = "VIIRS" | "MODIS";

/**
 * Foco de FIRMS cerca de la cámara de una alerta, para el mapa. Lo escribe el agente en
 * `web/data/live/hotspots/{alertId}.json`, aparte de la alerta: el POST del agente no cambia.
 */
export interface FirmsHotspot {
  position: [number, number];
  sensor: HotspotSensor;
  /** Fuente de FIRMS, por ejemplo `"VIIRS_NOAA20_NRT"` o `"MODIS"`. */
  source: string;
  acquiredAt: string;
  /** Potencia radiativa del fuego en MW; `null` si FIRMS no la trae. */
  frp: number | null;
  /** VIIRS usa letras (l, n, h) y MODIS un número de 0 a 100. */
  confidence: string;
  /** Distancia a la cámara de la alerta. */
  distanceKm: number;
}

export type WaterKind = "hidrante" | "rio" | "lago" | "represa";

/** Fuente de agua cercana, de OpenStreetMap (Overpass). */
export interface WaterSource {
  id: string;
  kind: WaterKind;
  name: string | null;
  position: [number, number];
  distanceM: number;
}

export interface FireAlert {
  id: string;
  detectionId: string;
  cameraId: string;
  createdAt: string;
  status: FireAlertStatus;
  agent: {
    decision: AgentDecision;
    /** Confianza del agente en su decisión, de 0 a 1. */
    confidence: number;
    /** Razones cortas, en español, que se muestran en la app y en el correo. */
    reasons: string[];
  };
  firms: FirmsMatch;
  /** Solo se llena en incendios grandes; si no, lista vacía. */
  water: WaterSource[];
  /** Hora del único correo enviado; `null` si no se envió. */
  emailedAt: string | null;
}

// ─── Respuesta del botón y aprendizaje de errores ──────────────────────

export type AlertAction = "confirmar" | "falso_positivo";

/** Registro de quién respondió y por dónde. */
export interface AlertResponse {
  alertId: string;
  action: AlertAction;
  /** Id del token de un solo uso (`jti`); impide responder dos veces. */
  tokenId: string;
  via: "correo" | "app";
  respondedAt: string;
}

/** Log que deja el agente cuando una persona marca un falso positivo. */
export interface FalsePositiveLog {
  id: string;
  alertId: string;
  detectionId: string;
  annotatedUrl: string;
  detected: FireRegion[];
  /** Lo que escribió la persona, si escribió algo. */
  humanNote: string | null;
  /** Por qué cree el agente que se equivocó, por ejemplo "nube baja al atardecer". */
  probableCause: string;
  /** Qué cambiaría. El agente propone; el equipo decide y reentrena. */
  suggestion: {
    kind: "umbral" | "regla" | "reentrenar";
    detail: string;
  };
  createdAt: string;
}

// ─── Correo de alerta ───────────────────────────────────────────────────

/**
 * Texto que redacta el agente con un LLM. Solo puede usar los datos de la alerta:
 * Python revisa que no aparezca ninguna cifra nueva antes de enviarlo.
 */
export interface AlertEmailDraft {
  /** Una frase, por ejemplo "Humo denso sobre la ladera norte, con viento hacia el pueblo". */
  headline: string;
  /** Dos o tres frases que explican qué se vio y por qué el agente lo confirmó. */
  summary: string;
}

/** Lo que el agente de Python envía a `POST /api/fire-alerts`. */
export interface AgentReport {
  alert: FireAlert;
  detection: Detection;
  /** `null` si el agente descartó la alerta: no se envía correo. */
  draft: AlertEmailDraft | null;
}

/** Registro del único correo que se manda por alerta. */
export interface AlertEmailRecord {
  alertId: string;
  subject: string;
  /** Id que devuelve Resend, para buscar el envío en su panel. */
  providerId: string;
  sentAt: string;
}
