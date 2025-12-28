# 🆘 Guía de Resolución de Problemas - Fisioterapia Gossos

## 📋 Información General

Esta guía documenta los problemas más comunes del sistema **Fisioterapia Gossos** y sus soluciones paso a paso.

## 🔧 Problemas de Configuración Inicial

### ❌ Error: "Missing Supabase environment variables"

**Síntomas:**
```
Missing Supabase environment variables. Check your .env file.
```

**Causa:** Variables de entorno no configuradas correctamente.

**Solución:**
```bash
# 1. Verificar que existe el archivo .env
ls -la .env

# 2. Si no existe, copiar desde el ejemplo
cp .env.example .env

# 3. Completar las variables requeridas
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_aqui
VITE_APP_NAME="Fisioterapia Gossos"
VITE_APP_VERSION="1.0.0"

# 4. Reiniciar el servidor de desarrollo
npm run dev
```

### ❌ Error: Build Fallido en Docker

**Síntomas:**
- El contenedor Docker no se construye
- Error de permisos en `node_modules/.bin/`

**Solución:**
```bash
# Limpiar cache Docker
docker builder prune -f

# Verificar permisos en deploy.sh
chmod +x deploy.sh

# Build sin cache
docker build --no-cache -t fisio-gossos:latest .
```

## 🔐 Problemas de Autenticación

### ❌ Error: "Query timeout" en AuthContext

**Síntomas:**
- Login muy lento o falla
- Error en consola: "Query timeout"

**Causa:** Timeout en consultas a Supabase (código en `AuthContext.jsx` línea 25).

**Solución:**
```javascript
// Verificar conexión a Supabase
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
    
    if (error) throw error
    console.log('✅ Conexión a Supabase OK')
  } catch (error) {
    console.error('❌ Error de conexión:', error)
  }
}
```

**Pasos adicionales:**
1. Verificar estado de Supabase en https://status.supabase.com
2. Revisar configuración de RLS (Row Level Security)
3. Verificar que la URL y clave están correctas

### ❌ Error: "useAuth must be used within an AuthProvider"

**Síntomas:**
```
Error: useAuth must be used within an AuthProvider
```

**Causa:** Componente usa `useAuth()` fuera del `AuthProvider`.

**Solución:**
```jsx
// Verificar que App.jsx tiene la estructura correcta:
export default function App() {
  return (
    <AuthProvider>  {/* ✅ AuthProvider debe envolver todo */}
      <NotificationProvider>
        <AppRouter />
      </NotificationProvider>
    </AuthProvider>
  )
}
```

### ❌ Error: Perfil no se carga después del login

**Síntomas:**
- Usuario logueado pero sin perfil
- Página en blanco o error de permisos

**Causa:** Perfil no existe en la tabla `profiles`.

**Solución:**
```sql
-- Verificar en Supabase SQL Editor
SELECT * FROM profiles WHERE id = 'user_id_aqui';

-- Si no existe, crear perfil manualmente
INSERT INTO profiles (id, email, nombre_completo, role)
VALUES ('user_id_aqui', 'email@example.com', 'Nombre Usuario', 'cliente');
```

## 📅 Problemas de Reservas

### ❌ Error: "Este horario ya fue reservado por otro usuario"

**Síntomas:**
- Usuario selecciona horario disponible
- Al crear reserva aparece este error

**Causa:** Condición de carrera entre usuarios (código en `BookingSection.jsx` línea 284).

**Solución para usuarios:**
1. Refrescar la página
2. Seleccionar otro horario disponible
3. Completar reserva rápidamente

**Solución para admin:**
```javascript
// Verificar reservas duplicadas en consola
const checkDuplicates = async () => {
  const { data } = await supabase
    .from('bookings')
    .select('fecha_hora, count(*)')
    .eq('estado', 'pendiente')
    .group('fecha_hora')
    .having('count(*) > 1')
  
  console.log('Reservas duplicadas:', data)
}
```

### ❌ Error: Horarios no se cargan o aparecen desactualizados

**Síntomas:**
- Calendario muestra horarios ocupados como disponibles
- Horarios no se actualizan después de crear reserva

**Causa:** Problema de cache en `bookingUtils.js`.

**Solución:**
```javascript
// En la consola del navegador, limpiar cache manualmente:
window.localStorage.clear()
window.sessionStorage.clear()
window.location.reload()

// O usar la función específica:
import { clearAvailableTimeSlotsCache } from './utils/bookingUtils'
clearAvailableTimeSlotsCache()
```

### ❌ Error: "No hay horarios disponibles para esta fecha"

**Síntomas:**
- Fecha seleccionada no muestra horarios
- Admin ha configurado horarios pero no aparecen

**Verificación paso a paso:**

1. **Verificar configuración de admin:**
```sql
-- En Supabase SQL Editor
SELECT * FROM available_time_slots 
WHERE date = '2025-01-15' AND is_active = true;
```

2. **Verificar reservas existentes:**
```sql
SELECT fecha_hora, duracion_minutos, services.tipo 
FROM bookings 
JOIN services ON bookings.service_id = services.id
WHERE fecha_hora::date = '2025-01-15' AND estado = 'pendiente';
```

3. **Verificar visitas a domicilio:**
```sql
SELECT fecha_hora, duracion_minutos 
FROM bookings 
JOIN services ON bookings.service_id = services.id
WHERE fecha_hora::date = '2025-01-15' 
  AND services.tipo = 'rehabilitacion_domicilio' 
  AND estado = 'pendiente';
```

### ❌ Error: Visitas a domicilio bloquean todo el centro

**Síntomas:**
- Visita a domicilio programada
- No hay horarios disponibles en centro ese día

**Explicación:** Comportamiento correcto del sistema (código en `bookingUtils.js` línea 180).

**Verificación:**
```javascript
// Verificar si hay visitas a domicilio en la fecha
const checkHomeVisits = async (date) => {
  const { data } = await supabase
    .from('bookings')
    .select(`
      fecha_hora, duracion_minutos,
      services!inner(tipo)
    `)
    .eq('fecha_hora::date', date)
    .eq('services.tipo', 'rehabilitacion_domicilio')
    .eq('estado', 'pendiente')
  
  console.log('Visitas a domicilio:', data)
}
```

## 🛠️ Problemas de Configuración de Horarios (Admin)

### ❌ Error: "Error inserting time slot" en ConfigurationPanel

**Síntomas:**
- Admin no puede agregar horarios
- Error al guardar configuración

**Causa:** Posible conflicto con slots existentes (código en `ConfigurationPanel.jsx` línea 188).

**Solución:**
```sql
-- Verificar slots duplicados
SELECT date, start_time, end_time, COUNT(*) 
FROM available_time_slots 
WHERE is_active = true 
GROUP BY date, start_time, end_time 
HAVING COUNT(*) > 1;

-- Eliminar duplicados manteniendo el más reciente
DELETE FROM available_time_slots 
WHERE id NOT IN (
  SELECT DISTINCT ON (date, start_time, end_time) id 
  FROM available_time_slots 
  WHERE is_active = true 
  ORDER BY date, start_time, end_time, created_at DESC
);
```

### ❌ Error: Horarios configurados no aparecen para clientes

**Síntomas:**
- Admin configura horarios correctamente
- Clientes no ven horarios disponibles

**Verificación:**
1. **Comprobar que `is_active = true`:**
```sql
SELECT * FROM available_time_slots 
WHERE date = '2025-01-15' AND is_active = false;
```

2. **Verificar RLS (Row Level Security):**
```sql
-- En Supabase SQL Editor, verificar políticas RLS
SELECT * FROM available_time_slots WHERE date = '2025-01-15';
```

3. **Limpiar cache del navegador:**
```javascript
// En consola del navegador
localStorage.clear()
location.reload()
```

## 💧 Problemas Específicos por Tipo de Servicio

### ❌ Error: Servicios de hidroterapia no respetan tiempos de descanso

**Síntomas:**
- Reservas de hidroterapia muy seguidas
- No hay tiempo para secar al perro

**Verificación:** El sistema debe aplicar 15-30 min de descanso automáticamente (código en `bookingUtils.js` línea 35).

```javascript
// Verificar tiempo de descanso aplicado
const checkRestTime = (serviceType) => {
  switch (serviceType) {
    case 'hidroterapia':
    case 'hidroterapia_rehabilitacion':
      return 15 // min de descanso
    default:
      return 0
  }
}
```

### ❌ Error: Rehabilitación + Aqua Agility se solapan incorrectamente

**Síntomas:**
- Sistema permite reservas simultáneas que no deberían ser posibles

**Causa:** Lógica de compatibilidad actualizada (código en `bookingUtils.js` línea 78).

**Nota:** En la versión actual, NO hay compatibilidad entre servicios para evitar conflictos.

## 📱 Problemas de PWA

### ❌ Error: PWA no se puede instalar

**Síntomas:**
- No aparece opción "Instalar app"
- Error en service worker

**Solución:**
1. **Verificar que está en HTTPS** (no localhost)
2. **Comprobar manifest.json:**
```bash
# Verificar que el archivo existe
curl https://tu-dominio.com/manifest.json
```

3. **Verificar service worker:**
```javascript
// En consola del navegador
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service workers:', registrations)
})
```

4. **Verificar iconos PWA:**
```bash
# Verificar que existen los iconos
ls -la public/pwa-*.png
ls -la public/apple-touch-icon.png
```

### ❌ Error: PWA no se actualiza automáticamente

**Síntomas:**
- Cambios en el código no aparecen en PWA instalada

**Solución:**
```javascript
// Forzar actualización del service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.update()
    })
  })
}
```

## 📧 Problemas de Notificaciones Email

### ❌ Error: Emails no se envían

**Síntomas:**
- Reservas se crean pero no llegan emails
- Error en función edge de Supabase

**Verificación:**
1. **Comprobar función edge en Supabase:**
```sql
-- Verificar logs de la función
SELECT * FROM edge_logs ORDER BY created_at DESC LIMIT 10;
```

2. **Verificar configuración de Resend:**
```javascript
// Verificar variables de entorno en Supabase
console.log('RESEND_API_KEY configurado:', !!process.env.RESEND_API_KEY)
```

3. **Probar envío manual:**
```javascript
// En Supabase Edge Functions
const testEmail = await supabase.functions.invoke('resend-email', {
  body: {
    to: 'test@example.com',
    subject: 'Test',
    html: '<p>Test email</p>'
  }
})
```

## 🔄 Problemas de Cache y Rendimiento

### ❌ Error: Sistema lento al cargar horarios

**Síntomas:**
- Cargar horarios toma más de 5 segundos
- Timeout en queries

**Solución:**
```javascript
// Verificar performance de queries
const startTime = performance.now()
await generateFilteredTimeSlots(service, date)
const endTime = performance.now()
console.log(`Query took ${endTime - startTime} ms`)

// Si >3000ms, hay problema de rendimiento
```

**Optimizaciones:**
1. **Limpiar cache periódicamente:**
```javascript
// Cada hora
setInterval(() => {
  clearAvailableTimeSlotsCache()
}, 3600000)
```

2. **Verificar índices en Supabase:**
```sql
-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_bookings_fecha_estado 
ON bookings(fecha_hora, estado);

CREATE INDEX IF NOT EXISTS idx_available_slots_date 
ON available_time_slots(date, is_active);
```

## 🐛 Problemas de Base de Datos

### ❌ Error: "Row Level Security" bloquea consultas

**Síntomas:**
```
Row Level Security policy violation
```

**Solución:**
```sql
-- Verificar políticas RLS existentes
SELECT * FROM pg_policies WHERE tablename = 'bookings';

-- Política básica para bookings (ejemplo)
CREATE POLICY "Users can view own bookings" ON bookings
FOR SELECT USING (auth.uid() = client_id);
```

### ❌ Error: Constraints de base de datos

**Síntomas:**
```
duplicate key value violates unique constraint
```

**Verificación:**
```sql
-- Encontrar duplicados en tabla específica
SELECT fecha_hora, COUNT(*) 
FROM bookings 
WHERE estado = 'pendiente' 
GROUP BY fecha_hora 
HAVING COUNT(*) > 1;
```

## 🔧 Herramientas de Debug

### Activar Debug Mode

```javascript
// En consola del navegador
localStorage.setItem('debug', 'true')
window.location.reload()

// Para activar logs detallados en bookingUtils
window.DEBUG_BOOKING = true
```

### Verificar Estado del Sistema

```javascript
// Función de debug completa
const systemHealthCheck = async () => {
  console.log('🔍 System Health Check')
  
  // 1. Verificar conexión Supabase
  try {
    const { data } = await supabase.from('profiles').select('id').limit(1)
    console.log('✅ Supabase connection OK')
  } catch (error) {
    console.error('❌ Supabase connection failed:', error)
  }
  
  // 2. Verificar cache
  const cacheSize = Object.keys(localStorage).length
  console.log(`📦 Cache size: ${cacheSize} items`)
  
  // 3. Verificar service worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    console.log(`🔧 Service workers: ${registrations.length}`)
  }
  
  // 4. Verificar autenticación
  const user = supabase.auth.user()
  console.log(`👤 User authenticated: ${!!user}`)
}

// Ejecutar
systemHealthCheck()
```

### Logs Específicos por Componente

```javascript
// Para debugging de horarios
window.addEventListener('booking-updated', (event) => {
  console.log('📡 Booking update received:', event.detail)
})

// Para debugging de cache
const originalFetch = window.fetch
window.fetch = (...args) => {
  console.log('🌐 Fetch request:', args[0])
  return originalFetch(...args)
}
```

## 📞 Escalación de Problemas

### Cuando Contactar Soporte

**Contactar inmediatamente si:**
- Base de datos inaccesible >5 minutos
- Múltiples usuarios reportan el mismo error
- Pérdida de datos de reservas
- Sistema de pagos no funciona
- Emails críticos no se envían

**Información a incluir:**
1. **Descripción exacta del error**
2. **Pasos para reproducir**
3. **Logs de consola del navegador**
4. **Hora exacta del problema**
5. **Número de usuarios afectados**

### Logs para Soporte

```javascript
// Generar reporte de error completo
const generateErrorReport = (error) => {
  return {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    userAgent: navigator.userAgent,
    url: window.location.href,
    userId: supabase.auth.user()?.id,
    localStorage: Object.keys(localStorage),
    sessionStorage: Object.keys(sessionStorage)
  }
}

// Uso
try {
  // código problemático
} catch (error) {
  const report = generateErrorReport(error)
  console.error('ERROR REPORT:', JSON.stringify(report, null, 2))
}
```

## 🔄 Mantenimiento Preventivo

### Tareas Semanales

```bash
# Limpiar logs antiguos (si tienes acceso al servidor)
docker logs fisio-gossos --tail 1000 > logs_backup_$(date +%Y%m%d).txt
docker logs fisio-gossos --tail 0 -f > /dev/null

# Verificar espacio en disco
docker system df

# Verificar estado del contenedor
docker stats fisio-gossos --no-stream
```

### Verificaciones Mensuales

```sql
-- Limpiar datos antiguos (>6 meses)
DELETE FROM bookings 
WHERE created_at < NOW() - INTERVAL '6 months' 
  AND estado IN ('completada', 'cancelada');

-- Verificar integridad referencial
SELECT * FROM bookings b 
LEFT JOIN services s ON b.service_id = s.id 
WHERE s.id IS NULL;
```

## 📚 Referencias Útiles

- **Documentación Supabase**: https://supabase.com/docs
- **React Router**: https://reactrouter.com/docs
- **Vite Configuration**: https://vitejs.dev/config/
- **Docker Commands**: https://docs.docker.com/reference/

---

**📝 Nota:** Mantén este documento actualizado con nuevos problemas que encuentres. Cada problema resuelto debe documentarse aquí para futura referencia.