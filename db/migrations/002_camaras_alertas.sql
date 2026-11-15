-- KINDRA 4: cámaras públicas, detecciones, alertas de incendio, respuestas y falsos positivos.
-- Misma forma que web/src/lib/alert-types.ts. Las columnas JSONB guardan listas del contrato
-- tal cual (regiones, materiales, agua) para no repartir un objeto chico en cinco tablas.

CREATE TABLE cameras (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  provider         text NOT NULL CHECK (provider IN ('caltrans', 'tfl', 'windy', 'hpwren', 'demo')),
  position         geography(Point, 4326) NOT NULL,
  image_url        text NOT NULL,
  video_url        text,
  refresh_seconds  integer NOT NULL DEFAULT 300,
  attribution      text NOT NULL,               -- crédito que exige el dueño
  terms_url        text NOT NULL
);

CREATE TABLE detections (
  id             text PRIMARY KEY,
  camera_id      text NOT NULL REFERENCES cameras (id),
  captured_at    timestamptz NOT NULL,
  frame_url      text NOT NULL,
  annotated_url  text NOT NULL,
  regions        jsonb NOT NULL,                -- FireRegion[]
  materials      jsonb NOT NULL,                -- NearbyMaterial[]
  model_name     text NOT NULL,
  model_version  text NOT NULL
);
CREATE INDEX detections_camera_time ON detections (camera_id, captured_at DESC);

CREATE TABLE fire_alerts (
  id                text PRIMARY KEY,
  detection_id      text NOT NULL UNIQUE REFERENCES detections (id),
  camera_id         text NOT NULL REFERENCES cameras (id),
  created_at        timestamptz NOT NULL,
  status            text NOT NULL CHECK (status IN
                      ('pendiente', 'descartada', 'enviada', 'incendio_confirmado', 'falso_positivo')),
  agent_decision    text NOT NULL CHECK (agent_decision IN ('confirmar', 'descartar', 'revisar')),
  agent_confidence  real NOT NULL CHECK (agent_confidence BETWEEN 0 AND 1),
  agent_reasons     text[] NOT NULL,
  firms             jsonb NOT NULL,             -- FirmsMatch
  water             jsonb NOT NULL DEFAULT '[]',-- WaterSource[]
  emailed_at        timestamptz                 -- único correo; NULL si no se envió
);

-- Un token sirve una vez (token_id único) y una alerta se responde una vez (alert_id único).
CREATE TABLE alert_responses (
  alert_id      text PRIMARY KEY REFERENCES fire_alerts (id),
  action        text NOT NULL CHECK (action IN ('confirmar', 'falso_positivo')),
  token_id      text NOT NULL UNIQUE,
  via           text NOT NULL CHECK (via IN ('correo', 'app')),
  note          text,
  responded_at  timestamptz NOT NULL
);

CREATE TABLE false_positive_logs (
  id               text PRIMARY KEY,
  alert_id         text NOT NULL REFERENCES fire_alerts (id),
  detection_id     text NOT NULL REFERENCES detections (id),
  annotated_url    text NOT NULL,
  detected         jsonb NOT NULL,
  human_note       text,
  probable_cause   text NOT NULL,
  suggestion_kind  text NOT NULL CHECK (suggestion_kind IN ('umbral', 'regla', 'reentrenar')),
  suggestion       text NOT NULL,
  created_at       timestamptz NOT NULL
);
