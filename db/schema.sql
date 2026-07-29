CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ENUMS (Con las categorías actualizadas para el Frontend)
-- ==============================================================================
CREATE TYPE rol_usuario AS ENUM ('admin', 'encargado');
CREATE TYPE condicion_personal AS ENUM ('en_planta', 'contratado');
CREATE TYPE tipo_area AS ENUM ('camara', 'invernadero', 'planta_madre', 'rusticadero', 'plantado', 'picado', 'general');
CREATE TYPE modo_calculo AS ENUM ('dias', 'horas');
CREATE TYPE origen_tarea AS ENUM ('admin', 'encargado', 'empleado');
CREATE TYPE tipo_licencia AS ENUM ('licencia_maternidad', 'licencia', 'rto');
CREATE TYPE accion_auditoria AS ENUM ('alta', 'edicion', 'borrado');

-- ==============================================================================
-- 2. TABLAS MAESTRAS
-- ==============================================================================
CREATE TABLE usuario (
    id              SERIAL PRIMARY KEY,
    nombre_usuario  VARCHAR(150) UNIQUE NOT NULL,
    nombre          VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    rol             rol_usuario NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE personal (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    apellido        VARCHAR(150) NOT NULL,
    documento       VARCHAR(50),
    condicion       condicion_personal NOT NULL,
    precio_hora     NUMERIC(12,2),
    precio_dia      NUMERIC(12,2),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE area (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    tipo            tipo_area NOT NULL,
    area_padre_id   INTEGER REFERENCES area(id) ON DELETE SET NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_area_padre ON area(area_padre_id);

CREATE TABLE tarea (
    id                  SERIAL PRIMARY KEY,
    nombre              VARCHAR(150) NOT NULL,
    descripcion         TEXT,
    area_id             INTEGER REFERENCES area(id),
    tipo_formulario     VARCHAR(50) NOT NULL DEFAULT 'general',
    modo_calculo        modo_calculo NOT NULL DEFAULT 'dias',
    meta_cantidad       NUMERIC(10,2),
    meta_horas          NUMERIC(10,2),
    avance_porcentaje   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (avance_porcentaje BETWEEN 0 AND 100),
    origen              origen_tarea DEFAULT 'admin',
    encargado_id        INTEGER REFERENCES usuario(id),
    creado_por          INTEGER REFERENCES usuario(id),
    activa              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tarea_area ON tarea(area_id);
CREATE INDEX idx_tarea_encargado ON tarea(encargado_id);

CREATE TABLE area_tarea (
    id          SERIAL PRIMARY KEY,
    area_id     INTEGER NOT NULL REFERENCES area(id) ON DELETE CASCADE,
    tarea_id    INTEGER NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
    UNIQUE (area_id, tarea_id)
);

CREATE TABLE tarea_personal (
    id          SERIAL PRIMARY KEY,
    tarea_id    INTEGER NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
    personal_id INTEGER NOT NULL REFERENCES personal(id),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tarea_id, personal_id)
);
CREATE INDEX idx_tarea_personal_tarea ON tarea_personal(tarea_id);
CREATE INDEX idx_tarea_personal_personal ON tarea_personal(personal_id);

CREATE TABLE variedad (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL,
    color_hex   VARCHAR(7) 
);

-- ==============================================================================
-- 3. TABLAS DE REPORTES Y TRANSACCIONES
-- ==============================================================================
CREATE TABLE avance_diario (
    id                      SERIAL PRIMARY KEY,
    tarea_id                INTEGER NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
    fecha                   DATE NOT NULL DEFAULT CURRENT_DATE,
    registrado_por          INTEGER REFERENCES usuario(id),
    rendimiento_descripcion TEXT,
    observaciones           TEXT,
    avance_porcentaje_dia   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (avance_porcentaje_dia BETWEEN 0 AND 100),
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_avance_diario_tarea_fecha ON avance_diario(tarea_id, fecha);
CREATE INDEX idx_avance_diario_fecha ON avance_diario(fecha);

CREATE TABLE avance_diario_personal (
    id                      SERIAL PRIMARY KEY,
    avance_diario_id        INTEGER NOT NULL REFERENCES avance_diario(id) ON DELETE CASCADE,
    personal_id             INTEGER NOT NULL REFERENCES personal(id),
    horas_trabajadas_dia    NUMERIC(5,2),
    cantidad_producida      NUMERIC(12,2),
    unidad                  VARCHAR(50),
    precio_hora_snapshot    NUMERIC(12,2),
    precio_dia_snapshot     NUMERIC(12,2),
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (avance_diario_id, personal_id)
);
CREATE INDEX idx_adp_avance_diario ON avance_diario_personal(avance_diario_id);
CREATE INDEX idx_adp_personal ON avance_diario_personal(personal_id);

-- Formularios dinámicos
CREATE TABLE avance_diario_movimiento (
    avance_diario_id    INTEGER REFERENCES avance_diario(id) ON DELETE CASCADE PRIMARY KEY,
    area_origen_id      INTEGER REFERENCES area(id),
    area_destino_id     INTEGER REFERENCES area(id),
    variedad_id         INTEGER REFERENCES variedad(id),
    cantidad            INT NOT NULL
);

CREATE TABLE avance_diario_aplicacion (
    avance_diario_id    INTEGER REFERENCES avance_diario(id) ON DELETE CASCADE PRIMARY KEY,
    producto_quimico    VARCHAR(100) NOT NULL,
    dosis               DECIMAL(10, 2) NOT NULL,
    unidad              VARCHAR(20) NOT NULL
);

CREATE TABLE avance_diario_logistica (
    avance_diario_id    INTEGER REFERENCES avance_diario(id) ON DELETE CASCADE PRIMARY KEY,
    patente             VARCHAR(20) NOT NULL,
    chofer              VARCHAR(100) NOT NULL,
    remito              VARCHAR(50),
    cliente             VARCHAR(100)
);

-- ==============================================================================
-- 4. TABLAS ADMINISTRATIVAS Y TRIGGERS
-- ==============================================================================
CREATE TABLE licencia (
    id              SERIAL PRIMARY KEY,
    personal_id     INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    tipo            tipo_licencia NOT NULL,
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE,
    observaciones   TEXT,
    cargado_por     INTEGER REFERENCES usuario(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_licencia_personal ON licencia(personal_id);

CREATE TABLE auditoria (
    id              SERIAL PRIMARY KEY,
    tabla           VARCHAR(100) NOT NULL,
    registro_id     INTEGER NOT NULL,
    accion          accion_auditoria NOT NULL,
    usuario_id      INTEGER REFERENCES usuario(id),
    detalle         JSONB,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers de actualización de fecha
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuario_actualizado BEFORE UPDATE ON usuario FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER trg_personal_actualizado BEFORE UPDATE ON personal FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER trg_area_actualizado BEFORE UPDATE ON area FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER trg_tarea_actualizado BEFORE UPDATE ON tarea FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER trg_avance_diario_actualizado BEFORE UPDATE ON avance_diario FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();