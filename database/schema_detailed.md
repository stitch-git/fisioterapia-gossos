# Schema de Base de Datos - Fisioterapia Gossos

Documentación completa del esquema de base de datos PostgreSQL (Supabase).

**Fecha última actualización:** 2026-01-01

---

## 📋 Índice

1. [Tablas Principales](#tablas-principales)
2. [Funciones RPC](#funciones-rpc)
3. [Políticas RLS](#políticas-rls)
4. [Triggers](#triggers)
5. [Relaciones](#relaciones)

---

## 📊 Tablas Principales

### `profiles`
Almacena información de usuarios (clientes y administradores).

**Campos:**
- `id` (uuid, PK): ID del usuario (referencia a auth.users)
- `nombre_completo` (text): Nombre completo del usuario
- `telefono` (text): Número de teléfono
- `email` (text): Email del usuario
- `direccion` (text, nullable): Dirección del usuario
- `observaciones` (text, nullable): Notas sobre el cliente
- `fecha_nacimiento` (date, nullable): Fecha de nacimiento
- `preferred_language` (text): Idioma preferido (ca/es)
- `is_admin` (boolean): Si el usuario es administrador
- `created_at` (timestamptz): Fecha de creación
- `updated_at` (timestamptz): Fecha de última actualización

**Índices:**
- `profiles_pkey` (id)
- `profiles_email_idx` (email)

---

### `dogs`
Almacena información de perros/pacientes.

**Campos:**
- `id` (serial, PK): ID del perro
- `owner_id` (uuid, FK → profiles.id): Propietario del perro
- `nombre` (text): Nombre del perro
- `raza` (text, nullable): Raza
- `fecha_nacimiento` (date, nullable): Fecha de nacimiento
- `peso` (numeric, nullable): Peso en kg
- `observaciones` (text, nullable): Notas médicas
- `historial_medico` (text, nullable): Historial médico
- `created_at` (timestamptz): Fecha de creación
- `updated_at` (timestamptz): Fecha de última actualización

**Índices:**
- `dogs_pkey` (id)
- `dogs_owner_id_idx` (owner_id)

---

### `services`
Define los servicios disponibles.

**Campos:**
- `id` (serial, PK): ID del servicio
- `nombre` (text): Nombre del servicio
- `descripcion` (text, nullable): Descripción
- `duracion_minutos` (integer): Duración en minutos
- `precio` (numeric): Precio del servicio
- `tipo` (text): Tipo de servicio (hidroterapia, rehabilitacion, hidroterapia_rehabilitacion)
- `activo` (boolean, default: true): Si el servicio está activo
- `created_at` (timestamptz): Fecha de creación
- `updated_at` (timestamptz): Fecha de actualización

**Índices:**
- `services_pkey` (id)

---

### `spaces`
Define espacios/salas disponibles para reservas.

**Campos:**
- `id` (serial, PK): ID del espacio
- `nombre` (text): Nombre del espacio
- `capacidad` (integer): Capacidad máxima
- `activo` (boolean, default: true): Si está activo
- `created_at` (timestamptz): Fecha de creación
- `updated_at` (timestamptz): Fecha de actualización

**Índices:**
- `spaces_pkey` (id)

---

### `bookings`
Almacena las reservas/citas.

**Campos:**
- `id` (serial, PK): ID de la reserva
- `client_id` (uuid, FK → profiles.id): Cliente que hizo la reserva
- `dog_id` (integer, FK → dogs.id): Perro para la cita
- `service_id` (integer, FK → services.id): Servicio reservado
- `space_id` (integer, FK → spaces.id): Espacio asignado
- `fecha_hora` (timestamptz): Fecha y hora de la cita
- `duracion_minutos` (integer): Duración en minutos
- `precio` (numeric): Precio de la reserva
- `estado` (text): Estado de la reserva (pendiente, confirmada, cancelada, completada, pendiente_confirmacion)
- `observaciones` (text, nullable): Notas adicionales
- `spaces_display` (text, nullable): Espacios para mostrar en UI
- `es_visita_domicilio` (boolean, default: false): Si es visita a domicilio
- `bloquea_centro` (boolean, default: false): Si bloquea el centro completo
- `direccion_domicilio` (text, nullable): Dirección para visitas a domicilio
- `hora_fin_domicilio` (time, nullable): Hora fin para visitas a domicilio
- `created_by` (uuid, FK → profiles.id): Usuario que creó la reserva
- `created_at` (timestamptz): Fecha de creación
- `updated_at` (timestamptz): Fecha de actualización
- `reminder_sent` (boolean, default: false): Si se envió recordatorio

**Índices:**
- `bookings_pkey` (id)
- `bookings_client_id_idx` (client_id)
- `bookings_fecha_hora_idx` (fecha_hora)
- `bookings_estado_idx` (estado)

---

### `available_time_slots`
Define los slots de tiempo disponibles para reservas.

**Campos:**
- `id` (serial, PK): ID del slot
- `fecha` (date): Fecha del slot
- `hora_inicio` (time): Hora de inicio
- `hora_fin` (time): Hora de fin
- `espacio_id` (integer, FK → spaces.id): Espacio asignado
- `admin_only` (boolean, default: false): Si solo admin puede usar este slot
- `activo` (boolean, default: true): Si está activo
- `created_at` (timestamptz): Fecha de creación
- `updated_at` (timestamptz): Fecha de actualización

**Índices:**
- `available_time_slots_pkey` (id)
- `available_time_slots_fecha_idx` (fecha)

---

### `scheduled_email_reminders`
Almacena recordatorios de email programados.

**Campos:**
- `id` (uuid, PK): ID del recordatorio
- `booking_id` (integer, FK → bookings.id): Reserva asociada
- `user_id` (uuid, FK → profiles.id): Usuario destinatario
- `email` (text): Email del destinatario
- `scheduled_for` (timestamptz): Fecha/hora programada para envío
- `is_sent` (boolean, default: false): Si fue enviado
- `sent_at` (timestamptz, nullable): Fecha/hora de envío real
- `booking_data` (jsonb, nullable): Datos de la reserva en JSON
- `created_at` (timestamptz): Fecha de creación

**Índices:**
- `scheduled_email_reminders_pkey` (id)
- `scheduled_email_reminders_booking_id_idx` (booking_id)
- `scheduled_email_reminders_scheduled_for_idx` (scheduled_for)

---

### `email_logs`
Registro de todos los emails enviados por el sistema.

**Campos:**
- `id` (uuid, PK): ID del log
- `email_type` (text): Tipo de email (confirmation, reminder, cancellation, etc.)
- `recipient_email` (text): Email del destinatario
- `booking_id` (integer, nullable): Reserva asociada
- `resend_id` (text, nullable): ID de Resend
- `status` (text): Estado del envío (sent, failed)
- `error_message` (text, nullable): Mensaje de error si falló
- `created_at` (timestamptz): Fecha de creación

**Índices:**
- `email_logs_pkey` (id)
- `email_logs_booking_id_idx` (booking_id)
- `email_logs_created_at_idx` (created_at)

---

## 🔧 Funciones RPC

### `create_booking_atomic`

**Descripción:**  
Crea una reserva de forma atómica con verificación de conflictos temporales. Esta función garantiza que no haya solapamientos entre reservas usando locks optimistas y cálculo preciso de intervalos.

**Firma:**
```sql
create_booking_atomic(
  p_client_id uuid,
  p_dog_id integer,
  p_service_id integer,
  p_space_id integer,
  p_fecha_hora timestamptz,
  p_duracion_minutos integer,
  p_precio numeric,
  p_observaciones text DEFAULT NULL,
  p_spaces_display text DEFAULT NULL,
  p_es_visita_domicilio boolean DEFAULT false,
  p_bloquea_centro boolean DEFAULT false,
  p_direccion_domicilio text DEFAULT NULL,
  p_hora_fin_domicilio time DEFAULT NULL
) RETURNS json
```

**Parámetros:**
- `p_client_id`: ID del cliente (UUID)
- `p_dog_id`: ID del perro
- `p_service_id`: ID del servicio
- `p_space_id`: ID del espacio
- `p_fecha_hora`: Fecha y hora de la reserva
- `p_duracion_minutos`: Duración de la sesión
- `p_precio`: Precio de la reserva
- `p_observaciones`: Notas adicionales (opcional)
- `p_spaces_display`: Texto de espacios para mostrar (opcional)
- `p_es_visita_domicilio`: Si es visita a domicilio (default: false)
- `p_bloquea_centro`: Si bloquea el centro completo (default: false)
- `p_direccion_domicilio`: Dirección para visita a domicilio (opcional)
- `p_hora_fin_domicilio`: Hora fin para visita a domicilio (opcional)

**Retorno:**
```json
{
  "success": true|false,
  "booking_id": 123,           // Solo si success=true
  "message": "...",             // Solo si success=true
  "error": "...",               // Solo si success=false
  "error_code": "..."           // Solo si success=false
}
```

**Códigos de error:**
- `SLOT_CONFLICT`: El horario se solapa con otra reserva
- `DATABASE_ERROR`: Error interno de base de datos

**Lógica de verificación:**

1. **Lock optimista**: Bloquea solo reservas del mismo día para mejorar concurrencia
2. **Cálculo temporal preciso**:
   - Nueva reserva: `[fecha_hora, fecha_hora + duracion_minutos]`
   - Reservas existentes: `[fecha_hora, fecha_hora + duracion_minutos + descanso]`
   - Descanso: 15min solo para servicios de hidroterapia, 0min para otros
3. **Detección de solapamiento**: Verifica si los rangos temporales se solapan
4. **Excepción**: Permite reservas que terminan/empiezan exactamente al mismo tiempo

**Ejemplo de uso (JavaScript):**
```javascript
const { data, error } = await supabase.rpc('create_booking_atomic', {
  p_client_id: user.id,
  p_dog_id: 5,
  p_service_id: 1,
  p_space_id: 1,
  p_fecha_hora: '2026-01-15T10:00:00Z',
  p_duracion_minutos: 45,
  p_precio: 35.00
});

if (data.success) {
  console.log('Reserva creada:', data.booking_id);
} else {
  console.error('Error:', data.error);
}
```

**Definición SQL completa:**
```sql
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_client_id uuid,
  p_dog_id integer,
  p_service_id integer,
  p_space_id integer,
  p_fecha_hora timestamp with time zone,
  p_duracion_minutos integer,
  p_precio numeric,
  p_observaciones text DEFAULT NULL::text,
  p_spaces_display text DEFAULT NULL::text,
  p_es_visita_domicilio boolean DEFAULT false,
  p_bloquea_centro boolean DEFAULT false,
  p_direccion_domicilio text DEFAULT NULL::text,
  p_hora_fin_domicilio time without time zone DEFAULT NULL::time without time zone
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
  booking_id INTEGER;
  conflict_check INTEGER;
  nueva_reserva_inicio TIMESTAMP;
  nueva_reserva_fin TIMESTAMP;
  tipo_servicio_nuevo TEXT;
BEGIN
  -- Lock optimista: Solo bloquear reservas del mismo día
  PERFORM 1 FROM bookings 
  WHERE DATE(fecha_hora) = DATE(p_fecha_hora)
    AND estado IN ('pendiente', 'pendiente_confirmacion')
  FOR UPDATE;
  
  -- Obtener tipo de servicio de la nueva reserva
  SELECT tipo INTO tipo_servicio_nuevo
  FROM services
  WHERE id = p_service_id;
  
  -- Calcular rango temporal de la nueva reserva
  nueva_reserva_inicio := p_fecha_hora;
  nueva_reserva_fin := p_fecha_hora + (p_duracion_minutos || ' minutes')::INTERVAL;
  
  -- Verificar solapamientos temporales
  SELECT COUNT(*) INTO conflict_check
  FROM bookings b
  INNER JOIN services s ON b.service_id = s.id
  WHERE b.estado IN ('pendiente', 'pendiente_confirmacion')
    AND DATE(b.fecha_hora) = DATE(p_fecha_hora)
    AND (
      -- Solapamiento temporal con tiempo de descanso
      b.fecha_hora < nueva_reserva_fin AND 
      (
        b.fecha_hora + 
        (b.duracion_minutos || ' minutes')::INTERVAL + 
        CASE 
          WHEN s.tipo = 'hidroterapia' THEN '15 minutes'::INTERVAL
          ELSE '0 minutes'::INTERVAL
        END
      ) > nueva_reserva_inicio
      -- Permitir si terminan/empiezan exactamente al mismo tiempo
      AND NOT (
        b.fecha_hora = nueva_reserva_fin OR
        (
          b.fecha_hora + 
          (b.duracion_minutos || ' minutes')::INTERVAL + 
          CASE 
            WHEN s.tipo = 'hidroterapia' THEN '15 minutes'::INTERVAL
            ELSE '0 minutes'::INTERVAL
          END
        ) = nueva_reserva_inicio
      )
    );
  
  -- Si hay conflicto, retornar error
  IF conflict_check > 0 THEN
    result := json_build_object(
      'success', false,
      'error', 'Este horario se solapa con ' || conflict_check || ' reserva(s) existente(s)',
      'error_code', 'SLOT_CONFLICT'
    );
    RETURN result;
  END IF;
  
  -- Insertar nueva reserva
  INSERT INTO bookings (
    client_id, dog_id, service_id, space_id, fecha_hora,
    duracion_minutos, precio, observaciones, estado,
    spaces_display, es_visita_domicilio, bloquea_centro,
    direccion_domicilio, hora_fin_domicilio, 
    created_by, created_at, updated_at
  ) VALUES (
    p_client_id, p_dog_id, p_service_id, p_space_id, p_fecha_hora,
    p_duracion_minutos, p_precio, p_observaciones, 'pendiente',
    p_spaces_display, p_es_visita_domicilio, p_bloquea_centro,
    p_direccion_domicilio, p_hora_fin_domicilio,
    p_client_id, NOW(), NOW()
  ) RETURNING id INTO booking_id;
  
  -- Retornar éxito
  result := json_build_object(
    'success', true,
    'booking_id', booking_id,
    'message', 'Reserva creada exitosamente'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', 'Error interno: ' || SQLERRM,
      'error_code', 'DATABASE_ERROR'
    );
    RETURN result;
END;
$function$;
```

---

## 🔐 Políticas RLS

### `profiles`

**Políticas activas:**
- `Users can view own profile`: Los usuarios pueden ver su propio perfil
- `Users can update own profile`: Los usuarios pueden actualizar su propio perfil
- `Admins can view all profiles`: Los administradores pueden ver todos los perfiles

### `dogs`

**Políticas activas:**
- `Users can view own dogs`: Los usuarios pueden ver sus propios perros
- `Users can create own dogs`: Los usuarios pueden crear perros vinculados a su cuenta
- `Users can update own dogs`: Los usuarios pueden actualizar sus propios perros
- `Admins can view all dogs`: Los administradores pueden ver todos los perros

### `bookings`

**Políticas activas:**
- `Users can view own bookings`: Los usuarios pueden ver sus propias reservas
- `Users can create bookings`: Los usuarios pueden crear reservas
- `Admins can view all bookings`: Los administradores pueden ver todas las reservas
- `Admins can manage bookings`: Los administradores pueden actualizar/eliminar reservas

### `scheduled_email_reminders`

**Políticas activas:**
- `Service role can manage all reminders`: El service role puede hacer todo
- `Users can view own reminders`: Los usuarios pueden ver sus propios recordatorios
- `Users can create own reminders`: Los usuarios pueden crear sus propios recordatorios

### `email_logs`

**Políticas activas:**
- `Service role can manage logs`: Solo el service role puede acceder a logs
- `Admins can view logs`: Los administradores pueden ver logs de emails

---

## ⚙️ Triggers

### `update_bookings_updated_at`
**Tabla:** `bookings`  
**Evento:** BEFORE UPDATE  
**Función:** `update_updated_at_column()`  
**Descripción:** Actualiza automáticamente el campo `updated_at` cuando se modifica una reserva.

### `update_profiles_updated_at`
**Tabla:** `profiles`  
**Evento:** BEFORE UPDATE  
**Función:** `update_updated_at_column()`  
**Descripción:** Actualiza automáticamente el campo `updated_at` cuando se modifica un perfil.

### `update_dogs_updated_at`
**Tabla:** `dogs`  
**Evento:** BEFORE UPDATE  
**Función:** `update_updated_at_column()`  
**Descripción:** Actualiza automáticamente el campo `updated_at` cuando se modifica un perro.

---

## 🔗 Relaciones

### Relaciones principales:

```
profiles (1) ----< (N) dogs
  |
  └─> (owner_id)

profiles (1) ----< (N) bookings
  |
  └─> (client_id, created_by)

dogs (1) ----< (N) bookings
  |
  └─> (dog_id)

services (1) ----< (N) bookings
  |
  └─> (service_id)

spaces (1) ----< (N) bookings
  |
  └─> (space_id)

spaces (1) ----< (N) available_time_slots
  |
  └─> (espacio_id)

bookings (1) ----< (N) scheduled_email_reminders
  |
  └─> (booking_id)

profiles (1) ----< (N) scheduled_email_reminders
  |
  └─> (user_id)

bookings (1) ----< (N) email_logs
  |
  └─> (booking_id)
```

---

## 📌 Notas Importantes

### Estados de Reserva
- `pendiente`: Reserva creada, pendiente de confirmación
- `pendiente_confirmacion`: Reserva fuera de horario, requiere confirmación del admin
- `confirmada`: Reserva confirmada por el admin
- `completada`: Reserva finalizada
- `cancelada`: Reserva cancelada

### Tipos de Servicio
- `hidroterapia`: Solo hidroterapia (30-45 min + 15 min descanso)
- `rehabilitacion`: Solo rehabilitación (45 min, sin descanso)
- `hidroterapia_rehabilitacion`: Combinado (75 min, sin descanso)

### Idiomas Soportados
- `ca`: Catalán
- `es`: Español

### Tipos de Email
- `confirmation`: Email de confirmación de reserva
- `reminder`: Recordatorio 24h antes
- `cancellation`: Notificación de cancelación
- `admin_new_booking`: Notificación al admin de nueva reserva
- `admin_cancellation`: Notificación al admin de cancelación

---

**Última revisión:** 2026-01-01  
**Versión del esquema:** 1.0