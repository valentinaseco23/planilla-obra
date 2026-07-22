CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE rol_usuario AS ENUM ('admin', 'encargado');
CREATE TYPE condicion_personal AS ENUM ('en_planta', 'contratado');
CREATE TYPE tipo_area AS ENUM ('camara', 'invernadero', 'planta_madre', 'rusticadero', 'plantado');
CREATE TYPE modo_calculo AS ENUM ('dias', 'horas');
CREATE TYPE origen_tarea AS ENUM ('admin', 'encargado', 'empleado');
CREATE TYPE tipo_licencia AS ENUM ('licencia_maternidad', 'licencia', 'rto');
CREATE TYPE accion_auditoria AS ENUM ('alta', 'edicion', 'borrado');

-- ---------------------------------------------------------------------
-- USUARIO (solo admin y encargado; el empleado no tiene fila acá)
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    rol             rol_usuario NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- PERSONAL (incluye a los "empleados" que no se loguean)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- AREA (jerárquica, con área_padre para subcategorías)
-- ---------------------------------------------------------------------
CREATE TABLE area (
    id              SERIAL PRIMARY KEY,
    tipo            tipo_area NOT NULL,
    codigo          VARCHAR(100) NOT NULL,
    area_padre_id   INTEGER REFERENCES area(id) ON DELETE SET NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tipo, codigo, area_padre_id)
);

CREATE INDEX idx_area_padre ON area(area_padre_id);

-- ---------------------------------------------------------------------
-- TAREA PREASIGNADA (plantillas por área)
-- ---------------------------------------------------------------------
CREATE TABLE tarea_preasignada (
    id                      SERIAL PRIMARY KEY,
    area_id                 INTEGER NOT NULL REFERENCES area(id) ON DELETE CASCADE,
    nombre                  VARCHAR(150) NOT NULL,
    descripcion             TEXT,
    modo_calculo_default    modo_calculo NOT NULL DEFAULT 'dias',
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tarea_preasignada_area ON tarea_preasignada(area_id);

-- ---------------------------------------------------------------------
-- TAREA
-- ---------------------------------------------------------------------
CREATE TABLE tarea (
    id                      SERIAL PRIMARY KEY,
    area_id                 INTEGER NOT NULL REFERENCES area(id),
    tarea_preasignada_id    INTEGER REFERENCES tarea_preasignada(id),
    nombre                  VARCHAR(150) NOT NULL,
    descripcion             TEXT,
    modo_calculo            modo_calculo NOT NULL DEFAULT 'dias',
    avance_porcentaje       NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (avance_porcentaje BETWEEN 0 AND 100),
    origen                  origen_tarea NOT NULL,
    encargado_id            INTEGER REFERENCES usuario(id),
    creado_por              INTEGER REFERENCES usuario(id),
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tarea_area ON tarea(area_id);
CREATE INDEX idx_tarea_encargado ON tarea(encargado_id);

-- ---------------------------------------------------------------------
-- TAREA_PERSONAL ("personal habitualmente asignado a la tarea")
-- ---------------------------------------------------------------------
CREATE TABLE tarea_personal (
    id              SERIAL PRIMARY KEY,
    tarea_id        INTEGER NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
    personal_id     INTEGER NOT NULL REFERENCES personal(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tarea_id, personal_id)
);

CREATE INDEX idx_tarea_personal_tarea ON tarea_personal(tarea_id);
CREATE INDEX idx_tarea_personal_personal ON tarea_personal(personal_id);

-- ---------------------------------------------------------------------
-- AVANCE_DIARIO
-- ---------------------------------------------------------------------
CREATE TABLE avance_diario (
    id                          SERIAL PRIMARY KEY,
    tarea_id                    INTEGER NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
    fecha                       DATE NOT NULL,
    registrado_por              INTEGER NOT NULL REFERENCES usuario(id),
    rendimiento_descripcion     TEXT,
    observaciones               TEXT,
    avance_porcentaje_dia       NUMERIC(5,2) NOT NULL CHECK (avance_porcentaje_dia BETWEEN 0 AND 100),
    creado_en                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_avance_diario_tarea_fecha ON avance_diario(tarea_id, fecha);
CREATE INDEX idx_avance_diario_fecha ON avance_diario(fecha);

-- ---------------------------------------------------------------------
-- AVANCE_DIARIO_PERSONAL (detalle por persona)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- LICENCIA
-- ---------------------------------------------------------------------
CREATE TABLE licencia (
    id              SERIAL PRIMARY KEY,
    personal_id     INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    tipo            tipo_licencia NOT NULL,
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE,
    observaciones   TEXT,
    cargado_por     INTEGER NOT NULL REFERENCES usuario(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_licencia_personal ON licencia(personal_id);
CREATE INDEX idx_licencia_vigencia ON licencia(personal_id, fecha_inicio, fecha_fin);

-- ---------------------------------------------------------------------
-- AUDITORIA
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
    id              SERIAL PRIMARY KEY,
    tabla           VARCHAR(100) NOT NULL,
    registro_id     INTEGER NOT NULL,
    accion          accion_auditoria NOT NULL,
    usuario_id      INTEGER REFERENCES usuario(id),
    detalle         JSONB,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_tabla_registro ON auditoria(tabla, registro_id);
CREATE INDEX idx_auditoria_fecha ON auditoria(creado_en);

-- ---------------------------------------------------------------------
-- Trigger genérico para actualizado_en
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuario_actualizado BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER trg_personal_actualizado BEFORE UPDATE ON personal
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER trg_area_actualizado BEFORE UPDATE ON area
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER trg_tarea_actualizado BEFORE UPDATE ON tarea
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER trg_avance_diario_actualizado BEFORE UPDATE ON avance_diario
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- =====================================================================
-- SEED: instancias iniciales de Área
-- =====================================================================
INSERT INTO area (tipo, codigo) VALUES
    ('camara', '1'), ('camara', '2'), ('camara', '3'), ('camara', '4'), ('camara', '5');

INSERT INTO area (tipo, codigo)
SELECT 'invernadero', gs::text
FROM generate_series(1, 17) AS gs;

INSERT INTO area (tipo, codigo) VALUES
    ('planta_madre', 'Sector 1'),
    ('planta_madre', 'Sector 2'),
    ('planta_madre', 'Sector 3');

INSERT INTO area (tipo, codigo) VALUES
    ('rusticadero', 'A1'),
    ('rusticadero', 'A2'),
    ('rusticadero', 'A3');

INSERT INTO area (tipo, codigo, area_padre_id)
SELECT 'rusticadero', sub, (SELECT id FROM area WHERE tipo = 'rusticadero' AND codigo = 'A2')
FROM (VALUES ('2A'), ('2B'), ('2C')) AS t(sub);

INSERT INTO area (tipo, codigo) VALUES
    ('plantado', 'General');
