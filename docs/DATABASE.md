# 📊 Database Schema - Fisioterapia Gossos

## Arquitectura General

### Tecnología
- **Base de datos**: PostgreSQL (Supabase)
- **Autenticación**: Supabase Auth
- **Seguridad**: Row Level Security (RLS) habilitado
- **Migraciones**: Controladas por Supabase

### Principios de Diseño
- **Atomicidad**: Transacciones ACID para reservas
- **Seguridad**: RLS en todas las tablas sensibles
- **Escalabilidad**: Índices optimizados para consultas frecuentes
- **Integridad**: Foreign keys y constraints estrictos

## Tablas Principales

### 1. profiles
Extensión de la tabla `auth.users` de Supabase para información adicional del usuario.

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'client' CHECK (role IN ('client', 'admin', 'super')),
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (id)
);
```

**Campos:**
- `id`: UUID del usuario (FK a auth.users)
- `email`: Email único del usuario
- `full_name`: Nombre completo
- `role`: Rol del usuario (client, admin, super)
- `phone`: Teléfono de contacto
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

**Índices:**
```sql
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
```

### 2. dogs
Información de las mascotas de los clientes.

```sql
CREATE TABLE dogs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  breed TEXT,
  age INTEGER CHECK (age >= 0 AND age <= 30),
  weight DECIMAL(5,2) CHECK (weight > 0 AND weight <= 150),
  medical_notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);
```

**Campos:**
- `id`: UUID único del perro
- `owner_id`: FK al propietario (profiles)
- `name`: Nombre del perro
- `breed`: Raza del perro
- `age`: Edad en años (0-30)
- `weight`: Peso en kg (0.1-150)
- `medical_notes`: Notas médicas importantes
- `active`: Si el perro está activo en el sistema

**Índices:**
```sql
CREATE INDEX idx_dogs_owner_id ON dogs(owner_id);
CREATE INDEX idx_dogs_active ON dogs(active);
```

### 3. services
Catálogo de servicios disponibles.

```sql
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  duration INTEGER NOT NULL CHECK (duration > 0), -- minutos
  price DECIMAL(8,2) NOT NULL CHECK (price >= 0),
  is_home_service BOOLEAN DEFAULT false,
  max_simultaneous INTEGER DEFAULT 1 CHECK (max_simultaneous >= 1),
  color TEXT DEFAULT '#4a90a4',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);
```

**Campos:**
- `id`: UUID único del servicio
- `name`: Nombre del servicio
- `description`: Descripción detallada
- `duration`: Duración en minutos
- `price`: Precio en euros
- `is_home_service`: Si es servicio a domicilio
- `max_simultaneous`: Máximo servicios simultáneos
- `color`: Color para el calendario
- `active`: Si el servicio está disponible

**Datos iniciales:**
```sql
INSERT INTO services (name, description, duration, price, is_home_service, max_simultaneous) VALUES
('Rehabilitación', 'Fisioterapia y ejercicios de rehabilitación', 30, 45.00, false, 2),
('Hidroterapia', 'Terapia en agua para recuperación', 30, 50.00, false, 1),
('Hidroterapia + Rehabilitación', 'Sesión completa combinada', 60, 85.00, false, 1),
('Aqua Agility', 'Ejercicios de agilidad en agua', 30, 40.00, false, 2),
('Rehabilitación a Domicilio', 'Fisioterapia en el hogar del cliente', 60, 80.00, true, 1);
```

### 4. service_compatibility
Reglas de compatibilidad entre servicios.

```sql
CREATE TABLE service_compatibility (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_a_id UUID REFERENCES services(id) ON DELETE CASCADE,
  service_b_id UUID REFERENCES services(id) ON DELETE CASCADE,
  compatible BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(service_a_id, service_b_id)
);
```

**Reglas de compatibilidad:**
```sql
-- Hidroterapia es incompatible con todo
INSERT INTO service_compatibility (service_a_id, service_b_id, compatible, notes) 
SELECT s1.id, s2.id, false, 'Hidroterapia requiere instalación exclusiva'
FROM services s1, services s2 
WHERE s1.name = 'Hidroterapia' AND s2.name != 'Hidroterapia';

-- Rehabilitación compatible con Aqua Agility
INSERT INTO service_compatibility (service_a_id, service_b_id, compatible, notes)
SELECT s1.id, s2.id, true, 'Pueden realizarse simultáneamente'
FROM services s1, services s2 
WHERE s1.name = 'Rehabilitación' AND s2.name = 'Aqua Agility';
```

### 5. bookings
Tabla principal de reservas.

```sql
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dog_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  duration INTEGER NOT NULL, -- minutos
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
  total_price DECIMAL(8,2) NOT NULL CHECK (total_price >= 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  
  -- Constraint: no puede haber booking en el pasado
  CONSTRAINT no_past_bookings CHECK (
    booking_date >= CURRENT_DATE OR 
    (booking_date = CURRENT_DATE AND booking_time >= CURRENT_TIME)
  )
);
```

**Campos críticos:**
- `client_id`: FK al cliente
- `dog_id`: FK al perro
- `service_id`: FK al servicio
- `booking_date` + `booking_time`: Fecha y hora exacta
- `status`: Estado de la reserva
- `total_price`: Precio total calculado

**Índices de rendimiento:**
```sql
CREATE INDEX idx_bookings_date_time ON bookings(booking_date, booking_time);
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_service_date ON bookings(service_id, booking_date);
```

### 6. booking_conflicts
Log de conflictos detectados y resueltos.

```sql
CREATE TABLE booking_conflicts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('time_overlap', 'service_incompatible', 'resource_unavailable')),
  conflict_details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  resolved_at TIMESTAMP WITH TIME ZONE
);
```

## Funciones y Triggers

### 1. Trigger para actualizar updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar a todas las tablas relevantes
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dogs_updated_at BEFORE UPDATE ON dogs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Función de validación de reservas

```sql
CREATE OR REPLACE FUNCTION validate_booking_slot(
  p_service_id UUID,
  p_booking_date DATE,
  p_booking_time TIME,
  p_duration INTEGER,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  service_record services%ROWTYPE;
  conflicting_count INTEGER;
  end_time TIME;
BEGIN
  -- Obtener información del servicio
  SELECT * INTO service_record FROM services WHERE id = p_service_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Calcular hora de fin
  end_time := p_booking_time + (p_duration || ' minutes')::INTERVAL;
  
  -- Verificar conflictos de horario
  SELECT COUNT(*) INTO conflicting_count
  FROM bookings b
  JOIN services s ON b.service_id = s.id
  WHERE b.booking_date = p_booking_date
    AND b.status NOT IN ('cancelled')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (
      -- Overlap de horarios
      (b.booking_time < end_time AND 
       (b.booking_time + (b.duration || ' minutes')::INTERVAL) > p_booking_time)
      OR
      -- Servicios incompatibles
      EXISTS (
        SELECT 1 FROM service_compatibility sc
        WHERE ((sc.service_a_id = p_service_id AND sc.service_b_id = b.service_id) OR
               (sc.service_a_id = b.service_id AND sc.service_b_id = p_service_id))
          AND sc.compatible = false
      )
    );
  
  RETURN conflicting_count = 0;
END;
$$ LANGUAGE plpgsql;
```

### 3. Función de estadísticas mensuales

```sql
CREATE OR REPLACE FUNCTION get_monthly_stats(p_month INTEGER, p_year INTEGER)
RETURNS TABLE (
  total_bookings BIGINT,
  completed_bookings BIGINT,
  cancelled_bookings BIGINT,
  total_revenue NUMERIC,
  avg_booking_value NUMERIC,
  top_service TEXT,
  busiest_day DATE
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      b.*,
      s.name as service_name
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE EXTRACT(MONTH FROM b.booking_date) = p_month
      AND EXTRACT(YEAR FROM b.booking_date) = p_year
  ),
  stats AS (
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
      SUM(total_price) FILTER (WHERE status = 'completed') as total_revenue,
      AVG(total_price) FILTER (WHERE status = 'completed') as avg_booking_value
    FROM monthly_data
  ),
  top_service AS (
    SELECT service_name
    FROM monthly_data
    WHERE status = 'completed'
    GROUP BY service_name
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ),
  busiest_day AS (
    SELECT booking_date
    FROM monthly_data
    GROUP BY booking_date
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  SELECT 
    s.total_bookings,
    s.completed_bookings,
    s.cancelled_bookings,
    s.total_revenue,
    s.avg_booking_value,
    ts.service_name,
    bd.booking_date
  FROM stats s
  CROSS JOIN top_service ts
  CROSS JOIN busiest_day bd;
END;
$$ LANGUAGE plpgsql;
```

## Políticas de Seguridad (RLS)

### 1. Políticas para profiles

```sql
-- Los usuarios solo pueden ver su propio perfil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Los admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super')
    )
  );
```

### 2. Políticas para dogs

```sql
-- Los usuarios solo pueden ver sus propios perros
CREATE POLICY "Users can view own dogs" ON dogs
  FOR SELECT USING (owner_id = auth.uid());

-- Los usuarios pueden gestionar sus propios perros
CREATE POLICY "Users can manage own dogs" ON dogs
  FOR ALL USING (owner_id = auth.uid());

-- Los admins pueden ver todos los perros
CREATE POLICY "Admins can view all dogs" ON dogs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super')
    )
  );
```

### 3. Políticas para bookings

```sql
-- Los clientes solo pueden ver sus propias reservas
CREATE POLICY "Clients can view own bookings" ON bookings
  FOR SELECT USING (client_id = auth.uid());

-- Los clientes pueden crear reservas para sus perros
CREATE POLICY "Clients can create bookings" ON bookings
  FOR INSERT WITH CHECK (
    client_id = auth.uid() AND
    EXISTS (SELECT 1 FROM dogs WHERE id = dog_id AND owner_id = auth.uid())
  );

-- Los admins pueden ver y gestionar todas las reservas
CREATE POLICY "Admins can manage all bookings" ON bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super')
    )
  );
```

## Índices de Optimización

### Índices principales para rendimiento

```sql
-- Búsquedas frecuentes en bookings
CREATE INDEX idx_bookings_date_status ON bookings(booking_date, status);
CREATE INDEX idx_bookings_client_date ON bookings(client_id, booking_date DESC);
CREATE INDEX idx_bookings_service_time ON bookings(service_id, booking_date, booking_time);

-- Búsquedas de disponibilidad
CREATE INDEX idx_bookings_availability ON bookings(booking_date, booking_time, status) 
  WHERE status NOT IN ('cancelled');

-- Estadísticas y reportes
CREATE INDEX idx_bookings_monthly_stats ON bookings(
  EXTRACT(YEAR FROM booking_date), 
  EXTRACT(MONTH FROM booking_date), 
  status
);

-- Búsquedas de perros por cliente
CREATE INDEX idx_dogs_owner_active ON dogs(owner_id, active);
```

## Backup y Mantenimiento

### Comandos de respaldo

```sql
-- Backup completo de datos críticos
COPY (
  SELECT 
    b.id, b.client_id, b.dog_id, b.service_id,
    b.booking_date, b.booking_time, b.status, b.total_price,
    p.email, p.full_name,
    d.name as dog_name,
    s.name as service_name
  FROM bookings b
  JOIN profiles p ON b.client_id = p.id
  JOIN dogs d ON b.dog_id = d.id
  JOIN services s ON b.service_id = s.id
  WHERE b.booking_date >= CURRENT_DATE - INTERVAL '1 year'
) TO '/backup/bookings_backup.csv' WITH CSV HEADER;
```

### Limpieza automática

```sql
-- Eliminar reservas canceladas antiguas (opcional)
DELETE FROM bookings 
WHERE status = 'cancelled' 
  AND cancelled_at < CURRENT_DATE - INTERVAL '2 years';

-- Archivar registros antiguos
CREATE TABLE bookings_archive (LIKE bookings INCLUDING ALL);

INSERT INTO bookings_archive 
SELECT * FROM bookings 
WHERE booking_date < CURRENT_DATE - INTERVAL '3 years';
```

## Vistas para Consultas Frecuentes

### Vista de reservas completas

```sql
CREATE VIEW booking_details AS
SELECT 
  b.id,
  b.booking_date,
  b.booking_time,
  b.duration,
  b.status,
  b.total_price,
  b.notes,
  p.full_name as client_name,
  p.email as client_email,
  p.phone as client_phone,
  d.name as dog_name,
  d.breed as dog_breed,
  d.age as dog_age,
  s.name as service_name,
  s.description as service_description,
  b.created_at,
  b.updated_at
FROM bookings b
JOIN profiles p ON b.client_id = p.id
JOIN dogs d ON b.dog_id = d.id
JOIN services s ON b.service_id = s.id;
```

### Vista de disponibilidad diaria

```sql
CREATE VIEW daily_availability AS
SELECT 
  generate_series(
    CURRENT_DATE, 
    CURRENT_DATE + INTERVAL '30 days', 
    '1 day'::interval
  )::date as date,
  generate_series(
    '09:00'::time, 
    '18:00'::time, 
    '30 minutes'::interval
  )::time as time_slot
EXCEPT
SELECT 
  booking_date as date,
  booking_time as time_slot
FROM bookings 
WHERE status NOT IN ('cancelled')
  AND booking_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';
```