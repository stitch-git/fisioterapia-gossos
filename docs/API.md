# API Reference - Fisioterapia Gossos

## Configuración de Supabase

### Cliente
```javascript
import { supabase } from '../lib/supabase'
```

## Autenticación

### Login
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@ejemplo.com',
  password: 'contraseña'
})
```

### Registro
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'usuario@ejemplo.com',
  password: 'contraseña',
  options: {
    data: {
      full_name: 'Nombre Completo'
    }
  }
})
```

### Logout
```javascript
const { error } = await supabase.auth.signOut()
```

## Gestión de Perfiles

### Obtener perfil del usuario
```javascript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single()
```

### Actualizar perfil
```javascript
const { data, error } = await supabase
  .from('profiles')
  .update({
    full_name: 'Nuevo Nombre',
    phone: '+34 123 456 789'
  })
  .eq('id', userId)
```

## Gestión de Perros

### Listar perros del usuario
```javascript
const { data, error } = await supabase
  .from('dogs')
  .select('*')
  .eq('owner_id', userId)
  .order('name')
```

### Crear nuevo perro
```javascript
const { data, error } = await supabase
  .from('dogs')
  .insert({
    owner_id: userId,
    name: 'Rex',
    breed: 'Golden Retriever',
    age: 5,
    weight: 30.5,
    medical_notes: 'Problemas de cadera'
  })
```

### Actualizar información del perro
```javascript
const { data, error } = await supabase
  .from('dogs')
  .update({
    weight: 32.0,
    medical_notes: 'Mejora en cadera, continuar fisioterapia'
  })
  .eq('id', dogId)
```

### Eliminar perro
```javascript
const { data, error } = await supabase
  .from('dogs')
  .delete()
  .eq('id', dogId)
```

## Sistema de Reservas

### Obtener servicios disponibles
```javascript
const { data, error } = await supabase
  .from('services')
  .select('*')
  .eq('active', true)
  .order('name')
```

### Crear nueva reserva
```javascript
const { data, error } = await supabase
  .from('bookings')
  .insert({
    client_id: userId,
    dog_id: dogId,
    service_id: serviceId,
    booking_date: '2024-01-15',
    booking_time: '10:00:00',
    status: 'confirmed',
    total_price: 45.00,
    notes: 'Primera sesión de rehabilitación'
  })
```

### Listar reservas del cliente
```javascript
const { data, error } = await supabase
  .from('bookings')
  .select(`
    *,
    dogs:dog_id (name, breed),
    services:service_id (name, duration, price)
  `)
  .eq('client_id', userId)
  .order('booking_date', { ascending: false })
```

### Listar todas las reservas (Admin)
```javascript
const { data, error } = await supabase
  .from('bookings')
  .select(`
    *,
    dogs:dog_id (name, breed),
    services:service_id (name, duration, price),
    profiles:client_id (full_name, email, phone)
  `)
  .order('booking_date', { ascending: true })
```

### Actualizar estado de reserva
```javascript
const { data, error } = await supabase
  .from('bookings')
  .update({
    status: 'completed',
    notes: 'Sesión completada exitosamente'
  })
  .eq('id', bookingId)
```

### Cancelar reserva
```javascript
const { data, error } = await supabase
  .from('bookings')
  .update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString()
  })
  .eq('id', bookingId)
```

## Consultas de Disponibilidad

### Verificar disponibilidad de horario
```javascript
const { data, error } = await supabase
  .from('bookings')
  .select('id')
  .eq('booking_date', '2024-01-15')
  .eq('booking_time', '10:00:00')
  .neq('status', 'cancelled')
```

### Obtener horarios ocupados del día
```javascript
const { data, error } = await supabase
  .from('bookings')
  .select('booking_time, service_id')
  .eq('booking_date', '2024-01-15')
  .neq('status', 'cancelled')
```

## Funciones RPC (Stored Procedures)

### Verificar compatibilidad de servicios
```javascript
const { data, error } = await supabase
  .rpc('check_service_compatibility', {
    p_date: '2024-01-15',
    p_time: '10:00:00',
    p_service_id: serviceId
  })
```

### Obtener estadísticas del mes (Admin)
```javascript
const { data, error } = await supabase
  .rpc('get_monthly_stats', {
    p_month: 1,
    p_year: 2024
  })
```

## Manejo de Errores

### Estructura típica de error
```javascript
if (error) {
  console.error('Error:', error.message)
  // Manejar según el tipo de error
  switch (error.code) {
    case '23505':
      // Violación de constraint único
      break
    case '23503':
      // Violación de foreign key
      break
    default:
      // Error genérico
      break
  }
}
```

### Helper para manejo de errores
```javascript
import { handleDatabaseError } from '../lib/supabase'

try {
  const { data, error } = await supabase.from('table').select('*')
  if (error) throw error
  return data
} catch (error) {
  const friendlyMessage = handleDatabaseError(error)
  toast.error(friendlyMessage)
}
```

## Políticas de Seguridad (RLS)

### Row Level Security habilitado en todas las tablas
- **profiles**: Los usuarios solo ven su propio perfil
- **dogs**: Los usuarios solo ven sus propios perros
- **bookings**: Los clientes ven solo sus reservas, admins ven todas
- **services**: Lectura pública, escritura solo admins

### Verificar permisos de usuario
```javascript
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', userId)
  .single()

const isAdmin = profile?.role === 'admin' || profile?.role === 'super'
```

## Rate Limiting y Optimización

### Usar select específico
```javascript
// En lugar de select('*')
const { data } = await supabase
  .from('bookings')
  .select('id, booking_date, booking_time, status')
```

### Paginación
```javascript
const { data, error } = await supabase
  .from('bookings')
  .select('*')
  .range(0, 9) // Primeros 10 registros
  .order('booking_date', { ascending: false })
```

### Cache de consultas frecuentes
```javascript
// Cachear servicios ya que cambian poco
const cachedServices = localStorage.getItem('services')
if (!cachedServices) {
  const { data } = await supabase.from('services').select('*')
  localStorage.setItem('services', JSON.stringify(data))
}
```