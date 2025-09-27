// utils/bookingUtils.js - Versión Optimizada y Corregida
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

// Cache mejorado para la configuración de horarios disponibles
let availableTimeSlotsCache = {}
let cacheTimestamp = {}
const CACHE_DURATION = 30 * 1000 // 30 segundos

/**
 * Convierte tiempo HH:MM a minutos desde medianoche
 */
export const timeToMinutes = (timeString) => {
  if (!timeString) return 0
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convierte minutos desde medianoche a formato HH:MM
 */
export const minutesToTime = (minutes) => {
  if (minutes < 0) return '00:00'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Determina el tiempo de descanso según el tipo de servicio
 * CORREGIDO: Aplicar la lógica correcta de tiempos de descanso
 */
export const getRestTimeByServiceType = (serviceType) => {
  switch (serviceType) {
    case 'hidroterapia':
    case 'hidroterapia_rehabilitacion':
      return 15 // 15 min descanso para secar el perro
    case 'rehabilitacion':
    case 'rehabilitacion_domicilio':
    default:
      return 0 // Sin tiempo de descanso
  }
}

/**
 * Calcula el rango de tiempo bloqueado por una reserva (incluyendo tiempo de descanso)
 */
export const getBlockedTimeRange = (startTime, durationMinutes, serviceType = null) => {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + (durationMinutes || 30)
  
  // Determinar tiempo de descanso según tipo de servicio
  const restTime = serviceType ? getRestTimeByServiceType(serviceType) : 15
  
  return { 
    startMinutes, 
    endMinutes: endMinutes + restTime 
  }
}

/**
 * Verifica si dos servicios son compatibles (pueden ejecutarse simultáneamente)
 * REGLAS DE NEGOCIO:
 * - Hidroterapia individual: NO compatible con ningún otro servicio
 * - Hidroterapia + Rehabilitación: NO compatible con ningún otro servicio  
 * - Rehabilitación ↔ Aqua Agility: SÍ compatible
 * - Rehabilitación a domicilio ↔ Aqua Agility: SÍ compatible
 * - Mismo servicio consigo mismo: NO compatible (evita solapamientos)
 */
/**
 * Función de compatibilidad SIMPLIFICADA - Sin excepciones
 * Solo para referencia, pero la lógica principal está en isTimeSlotBlocked
 */
export const areServicesCompatible = (serviceType1, serviceType2) => {
  // REGLA SIMPLE: Ningún servicio es compatible con otro
  // La rehabilitación a domicilio ya tiene su lógica especial en isTimeSlotBlocked
  return false
}

/**
 * Obtiene la configuración de horarios disponibles para una fecha específica
 */
export const getAvailableTimeSlotsForDate = async (dateString) => {
  try {
    // Verificar cache por fecha individual
    const now = Date.now()
    if (
      availableTimeSlotsCache[dateString] && 
      cacheTimestamp[dateString] && 
      (now - cacheTimestamp[dateString]) < CACHE_DURATION
    ) {
      return availableTimeSlotsCache[dateString]
    }

    // Consultar configuración desde BD para la fecha específica
    const { data, error } = await supabase
      .from('available_time_slots')
      .select('*')
      .eq('date', dateString)
      .eq('is_active', true)
      .order('start_time')

    if (error) {
      console.warn('Error loading available time slots for date:', dateString, error)
      return null
    }

    // Actualizar cache por fecha
    availableTimeSlotsCache[dateString] = data || []
    cacheTimestamp[dateString] = now

    return data || []
  } catch (error) {
    console.warn('Error fetching available time slots for date:', dateString, error)
    return null
  }
}

/**
 * Limpia el cache de configuración de horarios
 */
export const clearAvailableTimeSlotsCache = (dateString = null) => {
  if (dateString) {
    delete availableTimeSlotsCache[dateString]
    delete cacheTimestamp[dateString]
  } else {
    availableTimeSlotsCache = {}
    cacheTimestamp = {}
  }
}

/**
 * Filtrar horarios del día actual con margen de 1.5h
 */
export const filterTodaySlots = (slots, selectedDateStr) => {
  const today = format(new Date(), 'yyyy-MM-dd')
  if (selectedDateStr !== today) return slots
  
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const minRequiredMinutes = currentMinutes + 60 // + 1 horas
  
  return slots.filter(slot => {
    const [hours, minutes] = slot.split(':').map(Number)
    const slotMinutes = hours * 60 + minutes
    return slotMinutes >= minRequiredMinutes
  })
}

/**
 * Verifica si un horario específico está dentro de algún slot disponible
 */
export const isTimeSlotAvailableByAdmin = async (timeSlot, dateString, serviceDurationMinutes) => {
  try {
    const availableSlots = await getAvailableTimeSlotsForDate(dateString)
    
    // Si no hay configuración, considerar NO disponible
    if (!availableSlots || availableSlots.length === 0) {
      return false
    }

    const requestedStartMinutes = timeToMinutes(timeSlot)
    const requestedEndMinutes = requestedStartMinutes + serviceDurationMinutes

    // Verificar si el horario solicitado cabe dentro de algún slot disponible
    return availableSlots.some(slot => {
      const slotStartMinutes = timeToMinutes(slot.start_time)
      const slotEndMinutes = timeToMinutes(slot.end_time)
      
      // El servicio debe comenzar y terminar dentro del slot disponible
      return requestedStartMinutes >= slotStartMinutes && requestedEndMinutes <= slotEndMinutes
    })
  } catch (error) {
    console.warn('Error checking admin availability:', error)
    return false
  }
}

/**
 * Fusiona slots consecutivos para permitir servicios que crucen entre slots
 */
export const mergeConsecutiveSlots = (slots) => {
  if (!slots || slots.length === 0) return []
  
  // Ordenar slots por hora de inicio
  const sortedSlots = [...slots].sort((a, b) => 
    timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  )
  
  const mergedSlots = []
  let currentSlot = { ...sortedSlots[0] }
  
  for (let i = 1; i < sortedSlots.length; i++) {
    const nextSlot = sortedSlots[i]
    const currentEndMinutes = timeToMinutes(currentSlot.end_time)
    const nextStartMinutes = timeToMinutes(nextSlot.start_time)
    
    // Si los slots son consecutivos (sin gap), fusionar
    if (currentEndMinutes === nextStartMinutes) {
      currentSlot.end_time = nextSlot.end_time
      console.log(`🔗 Fusionando slots: ${currentSlot.start_time}-${currentSlot.end_time}`)
    } else {
      // No son consecutivos, guardar el actual e iniciar nuevo
      mergedSlots.push(currentSlot)
      currentSlot = { ...nextSlot }
    }
  }
  
  // Añadir el último slot
  mergedSlots.push(currentSlot)
  
  return mergedSlots
}

/**
 * EXPORTADA: Verifica si un slot está bloqueado por reservas existentes
 * LÓGICA CORREGIDA para rehabilitación a domicilio
 */
export const isTimeSlotBlocked = (timeSlot, existingBookings, homeVisits, serviceDuration, selectedServiceType) => {
  const [hours, minutes] = timeSlot.split(':').map(Number)
  const slotMinutes = hours * 60 + minutes
  const slotEndMinutes = slotMinutes + serviceDuration

  console.log(`🔍 Verificando slot ${timeSlot} para servicio ${selectedServiceType}`)

  // PASO 1: Verificar bloqueo por visitas a domicilio
  const blockedByHomeVisit = homeVisits.some(visit => {
    const visitTime = visit.fecha_hora.substring(11, 16)
    const { startMinutes: visitStartMinutes, endMinutes: visitEndMinutes } = getBlockedTimeRange(
      visitTime, 
      visit.duracion_minutos, 
      visit.services?.tipo
    )
    
    const isBlocked = (slotMinutes < visitEndMinutes && slotEndMinutes > visitStartMinutes)
    
    if (isBlocked) {
      console.log(`❌ Slot ${timeSlot} bloqueado por visita a domicilio ${visitTime}-${minutesToTime(visitEndMinutes)}`)
    }
    
    return isBlocked
  })
  
  if (blockedByHomeVisit) return true

  // PASO 2: Verificar conflictos con reservas existentes del centro
  for (const booking of existingBookings) {
    const bookingTime = booking.fecha_hora.substring(11, 16)
    const existingServiceType = booking.services?.tipo
    
    // Aplicar tiempo de descanso SOLO para servicios con agua
    const restTime = (existingServiceType === 'hidroterapia' || existingServiceType === 'hidroterapia_rehabilitacion') ? 15 : 0
    
    const bookingStartMinutes = timeToMinutes(bookingTime)
    const bookingEndMinutes = bookingStartMinutes + booking.duracion_minutos + restTime
    
    // Verificar si hay solapamiento (incluyendo tiempo de descanso)
    const hasOverlap = (slotMinutes < bookingEndMinutes && slotEndMinutes > bookingStartMinutes)
    
    if (!hasOverlap) {
      continue // No hay solapamiento, continuar con siguiente reserva
    }
    
    console.log(`⚠️  Solapamiento detectado:`)
    console.log(`   Nuevo slot: ${timeSlot}-${minutesToTime(slotEndMinutes)} (${selectedServiceType})`)
    console.log(`   Reserva existente: ${bookingTime}-${minutesToTime(bookingEndMinutes)} (${existingServiceType} + ${restTime}min descanso)`)
    
    // LÓGICA SIMPLIFICADA - SIN EXCEPCIONES PROBLEMÁTICAS
    
    // CASO 1: Rehabilitación a domicilio - NO es compatible con NADA del centro
    if (selectedServiceType === 'rehabilitacion_domicilio') {
      console.log(`❌ Rehabilitación domicilio no puede coexistir con ${existingServiceType}`)
      return true
    }
    
    // CASO 2: Si hay rehabilitación a domicilio existente - NADA del centro puede coexistir
    if (existingServiceType === 'rehabilitacion_domicilio') {
      console.log(`❌ Servicio ${selectedServiceType} bloqueado por rehabilitación domicilio`)
      return true
    }
    
    // CASO 3: Servicios que requieren exclusividad total (hidroterapia)
    if (existingServiceType === 'hidroterapia_rehabilitacion' || 
        existingServiceType === 'hidroterapia' ||
        selectedServiceType === 'hidroterapia_rehabilitacion' || 
        selectedServiceType === 'hidroterapia') {
      console.log(`❌ Servicio bloqueado por hidroterapia (requiere exclusividad)`)
      return true
    }
    
    // CASO 4: Cualquier otro solapamiento entre servicios del centro está prohibido
    console.log(`❌ Solapamiento no permitido entre servicios del centro`)
    return true
  }

  console.log(`✅ Slot ${timeSlot} disponible`)
  return false
}
/**
 * Genera horarios disponibles considerando reservas existentes y fragmentación
 * CORREGIDA: Rehabilitación a domicilio también respeta configuración de admin
 */
export const generateFilteredTimeSlots = async (service, dateString, existingBookings = [], homeVisits = []) => {
  try {
    const serviceDurationMinutes = service.duracion_minutos
    const selectedServiceType = service.tipo

    // Obtener configuración de admin para TODOS los servicios
    const availableSlots = await getAvailableTimeSlotsForDate(dateString)
    
    // Si no hay configuración, no hay horarios disponibles
    if (!availableSlots || availableSlots.length === 0) {
      return []
    }

    const possibleSlots = []

    // Si no se proporcionaron reservas, obtenerlas
    let finalExistingBookings = existingBookings
    let finalHomeVisits = homeVisits
    
    if (existingBookings.length === 0) {
      // Obtener reservas del día
      const { data: dayBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          fecha_hora, 
          duracion_minutos,
          services!inner(tipo)
        `)
        .gte('fecha_hora', `${dateString}T00:00:00`)
        .lt('fecha_hora', `${dateString}T23:59:59`)
        .in('estado', ['pendiente'])

      if (!bookingsError && dayBookings) {
        finalExistingBookings = dayBookings.filter(booking => 
          booking.services?.tipo !== 'rehabilitacion_domicilio'
        )
        finalHomeVisits = dayBookings.filter(booking => 
          booking.services?.tipo === 'rehabilitacion_domicilio'
        )
      }
    }

    // Para cada slot configurado por el admin
    const mergedSlots = mergeConsecutiveSlots(availableSlots)
    console.log(`📅 Slots originales: ${availableSlots.length}, Fusionados: ${mergedSlots.length}`)

      // Para cada slot fusionado (en lugar de cada slot individual)
      mergedSlots.forEach(adminSlot => {
        const slotStartMinutes = timeToMinutes(adminSlot.start_time)
        const slotEndMinutes = timeToMinutes(adminSlot.end_time)
      
      // DIFERENTE INTERVALO SEGÚN TIPO DE SERVICIO
      let interval = 5 // Por defecto cada 5 minutos
      if (selectedServiceType === 'rehabilitacion_domicilio') {
        interval = 15 // Para rehabilitación a domicilio cada 15 minutos
      }
      
      // Generar slots donde el servicio completo quepa
      for (let minutes = slotStartMinutes; minutes <= slotEndMinutes - serviceDurationMinutes; minutes += interval) {
        const proposedEndMinutes = minutes + serviceDurationMinutes
        
        // Verificar que el servicio cabe en el slot configurado
        if (proposedEndMinutes <= slotEndMinutes) {
          const timeString = minutesToTime(minutes)
          
          // Verificar que no se solapa con reservas existentes (incluyendo descanso)
          const isBlocked = isTimeSlotBlocked(
            timeString, 
            finalExistingBookings, 
            finalHomeVisits, 
            serviceDurationMinutes, 
            selectedServiceType
          )
          
          if (!isBlocked) {
            possibleSlots.push(timeString)
          }
        }
      }
    })

    // Eliminar duplicados y ordenar
    const uniqueSlots = [...new Set(possibleSlots)].sort()
    
    // Aplicar filtro del día actual antes de devolver
    return filterTodaySlots(uniqueSlots, dateString)
  } catch (error) {
    console.warn('Error generating filtered time slots:', error)
    return []
  }
}

/**
 * Versión específica para visitas a domicilio (rango completo 08:00-20:00)
 */
export const generateHomeVisitTimeSlots = async (dateString) => {
  try {
    // Para visitas a domicilio, generar slots base de 06:30 a 23:00 cada 15 minutos
    const slots = []
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = (hour === 6 ? 30 : 0); minute < 60; minute += 15) {
        // Parar exactamente a las 23:00
        if (hour === 23 && minute > 0) break
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
      }
    }
    
    // Aplicar filtro del día actual
    return filterTodaySlots(slots, dateString)
  } catch (error) {
    console.warn('Error generating home visit time slots:', error)
    return []
  }
}

/**
 * Obtiene todos los horarios disponibles para un rango de fechas
 */
export const getAvailableTimeSlotsForDateRange = async (startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('available_time_slots')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('is_active', true)
      .order('date')
      .order('start_time')

    if (error) {
      console.warn('Error loading available time slots for range:', error)
      return {}
    }

    // Organizar por fecha
    const slotsByDate = {}
    if (data) {
      data.forEach(slot => {
        if (!slotsByDate[slot.date]) {
          slotsByDate[slot.date] = []
        }
        slotsByDate[slot.date].push(slot)
      })
    }

    return slotsByDate
  } catch (error) {
    console.warn('Error fetching available time slots for range:', error)
    return {}
  }
}

/**
 * Verifica si hay algún horario disponible configurado para una fecha
 */
export const hasAvailableTimeSlotsForDate = async (dateString) => {
  const slots = await getAvailableTimeSlotsForDate(dateString)
  return slots && slots.length > 0
}

/**
 * Calcula disponibilidad de días para colorear calendario
 * CORREGIDA: Considera rehabilitación a domicilio
 */
export const calculateDayAvailability = async (service, days, existingBookings = [], homeVisits = []) => {
  const availability = {}
  
  for (const day of days) {
    const dayStr = format(day, 'yyyy-MM-dd')
    
    // Verificar si es día pasado
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const dayDate = new Date(day)
    dayDate.setHours(0, 0, 0, 0)
    
    if (dayDate < now) {
      availability[dayStr] = 'past'
      continue
    }
    
    // Para rehabilitación a domicilio, siempre disponible (no requiere configuración admin)
    if (service.tipo === 'rehabilitacion_domicilio') {
      availability[dayStr] = 'available'
      continue
    }
    
    // Para otros servicios, verificar configuración admin
    const adminSlots = await generateFilteredTimeSlots(service, dayStr)
    
    if (adminSlots.length === 0) {
      availability[dayStr] = 'full' // Sin configuración = no disponible
      continue
    }
    
    availability[dayStr] = 'available'
  }
  
  return availability
}

/**
 * Función legacy para mantener compatibilidad
 * @deprecated Usar generateFilteredTimeSlots directamente
 */
export const filterSlotsByAdminConfig = async (allSlots, dateString, serviceDurationMinutes) => {
  console.warn('filterSlotsByAdminConfig is deprecated, use generateFilteredTimeSlots instead')
  
  const filteredSlots = []
  
  for (const slot of allSlots) {
    const isAvailable = await isTimeSlotAvailableByAdmin(slot, dateString, serviceDurationMinutes)
    if (isAvailable) {
      filteredSlots.push(slot)
    }
  }
  
  return filteredSlots
}



/**
 * Función de utilidad para invalidar cache cuando se modifica configuración
 */
export const invalidateTimeSlotsCache = (dateString = null) => {
  clearAvailableTimeSlotsCache(dateString)
}

/**
 * NUEVA FUNCIÓN: Invalidar cache y notificar actualización global
 */
export const invalidateCacheAndNotify = (dateString = null) => {
  // Limpiar cache local
  clearAvailableTimeSlotsCache(dateString)
  
  // Disparar evento personalizado para que otros componentes se actualicen
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('booking-updated', { 
      detail: { dateString, timestamp: Date.now() } 
    }))
    
    console.log('🔄 Cache invalidado y evento de actualización disparado')
  }
}

// ================================
// FUNCIONES ADICIONALES PARA DEBUGGING
// ================================

/**
 * Función de debug para mostrar información detallada sobre disponibilidad
 */
export const debugSlotAvailability = async (service, dateString, timeSlot) => {
  try {
    console.log(`🔍 Debug para ${service.nombre} en ${dateString} a las ${timeSlot}`)
    
    // Obtener reservas existentes
    const { data: dayBookings } = await supabase
      .from('bookings')
      .select(`
        fecha_hora, 
        duracion_minutos,
        services!inner(tipo, nombre)
      `)
      .gte('fecha_hora', `${dateString}T00:00:00`)
      .lt('fecha_hora', `${dateString}T23:59:59`)
      .in('estado', ['pendiente'])
    
    const centerBookings = dayBookings?.filter(b => b.services?.tipo !== 'rehabilitacion_domicilio') || []
    const homeVisits = dayBookings?.filter(b => b.services?.tipo === 'rehabilitacion_domicilio') || []
    
    console.log(`📊 Reservas del centro: ${centerBookings.length}`)
    console.log(`🏠 Visitas a domicilio: ${homeVisits.length}`)
    
    // Verificar bloqueos
    const isBlocked = isTimeSlotBlocked(
      timeSlot, 
      centerBookings, 
      homeVisits, 
      service.duracion_minutos, 
      service.tipo
    )
    
    console.log(`${isBlocked ? '❌' : '✅'} Slot ${timeSlot} ${isBlocked ? 'bloqueado' : 'disponible'}`)
    
    return !isBlocked
  } catch (error) {
    console.error('Error en debug:', error)
    return false
  }
}