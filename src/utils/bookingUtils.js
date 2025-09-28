// utils/bookingUtils.js - Versión con Debugging Avanzado
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

// Cache mejorado para la configuración de horarios disponibles
let availableTimeSlotsCache = {}
let cacheTimestamp = {}
const CACHE_DURATION = 10 * 1000 // REDUCIDO A 10 SEGUNDOS para debugging

// 🚨 NUEVA: Variable para tracking de debugging
let debugMode = false
const debugLog = (message, data = null) => {
  if (debugMode) {
    console.log(`🔍 [BOOKING-DEBUG] ${message}`, data || '')
  }
}

// 🚨 NUEVA: Función para activar/desactivar debugging
export const toggleBookingDebug = (enabled = true) => {
  debugMode = enabled
  console.log(`${enabled ? '🔍' : '❌'} Debugging de reservas ${enabled ? 'ACTIVADO' : 'DESACTIVADO'}`)
}

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
 * 🚨 NUEVA: Función para obtener reservas ULTRA-FRESCAS con debug completo
 */
export const getFreshBookingsWithDebug = async (dateString, context = 'unknown') => {
  debugLog(`Obteniendo reservas frescas para ${dateString} - Contexto: ${context}`)
  
  try {
    const { data: freshBookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        fecha_hora, 
        duracion_minutos,
        estado,
        created_at,
        updated_at,
        services!inner(tipo, nombre)
      `)
      .gte('fecha_hora', `${dateString}T00:00:00`)
      .lt('fecha_hora', `${dateString}T23:59:59`)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })

    if (error) {
      debugLog(`❌ Error obteniendo reservas: ${error.message}`)
      throw error
    }

    debugLog(`📊 Reservas encontradas: ${freshBookings?.length || 0}`)
    
    if (freshBookings && freshBookings.length > 0) {
      freshBookings.forEach((booking, index) => {
        const timeStr = booking.fecha_hora.substring(11, 16)
        const serviceType = booking.services?.tipo
        const createdAt = new Date(booking.created_at).toLocaleTimeString()
        
        debugLog(`   ${index + 1}. ${timeStr} - ${serviceType} (ID:${booking.id}) - Creada: ${createdAt}`)
      })
    } else {
      debugLog(`✅ No hay reservas para ${dateString}`)
    }

    const centerBookings = freshBookings?.filter(b => b.services?.tipo !== 'rehabilitacion_domicilio') || []
    const homeVisits = freshBookings?.filter(b => b.services?.tipo === 'rehabilitacion_domicilio') || []
    
    debugLog(`🏥 Reservas centro: ${centerBookings.length}`)
    debugLog(`🏠 Visitas domicilio: ${homeVisits.length}`)
    
    return { centerBookings, homeVisits, allBookings: freshBookings || [] }
    
  } catch (error) {
    debugLog(`❌ Error crítico obteniendo reservas: ${error.message}`)
    return { centerBookings: [], homeVisits: [], allBookings: [] }
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
 * 🚨 MEJORADA: Función isTimeSlotBlocked con debugging detallado
 */
export const isTimeSlotBlocked = (timeSlot, existingBookings, homeVisits, serviceDuration, selectedServiceType) => {
  const [hours, minutes] = timeSlot.split(':').map(Number)
  const slotMinutes = hours * 60 + minutes
  const slotEndMinutes = slotMinutes + serviceDuration

  debugLog(`Verificando slot ${timeSlot} para servicio ${selectedServiceType}`)
  debugLog(`  - Slot: ${slotMinutes}-${slotEndMinutes} minutos (${serviceDuration}min duración)`)
  debugLog(`  - Evaluando ${existingBookings.length} reservas centro + ${homeVisits.length} visitas`)

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
      debugLog(`❌ Slot ${timeSlot} bloqueado por visita a domicilio ${visitTime}-${minutesToTime(visitEndMinutes)}`)
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
      debugLog(`✅ Sin solapamiento con ${bookingTime}-${minutesToTime(bookingEndMinutes)} (${existingServiceType})`)
      continue // No hay solapamiento, continuar con siguiente reserva
    }
    
    debugLog(`⚠️  SOLAPAMIENTO DETECTADO:`)
    debugLog(`   Nuevo slot: ${timeSlot}-${minutesToTime(slotEndMinutes)} (${selectedServiceType})`)
    debugLog(`   Reserva existente: ${bookingTime}-${minutesToTime(bookingEndMinutes)} (${existingServiceType} + ${restTime}min descanso)`)
    debugLog(`   Booking ID: ${booking.id} - Creada: ${booking.created_at}`)
    
    // LÓGICA SIMPLIFICADA - SIN EXCEPCIONES PROBLEMÁTICAS
    
    // CASO 1: Rehabilitación a domicilio - NO es compatible con NADA del centro
    if (selectedServiceType === 'rehabilitacion_domicilio') {
      debugLog(`❌ Rehabilitación domicilio no puede coexistir con ${existingServiceType}`)
      return true
    }
    
    // CASO 2: Si hay rehabilitación a domicilio existente - NADA del centro puede coexistir
    if (existingServiceType === 'rehabilitacion_domicilio') {
      debugLog(`❌ Servicio ${selectedServiceType} bloqueado por rehabilitación domicilio`)
      return true
    }
    
    // CASO 3: Servicios que requieren exclusividad total (hidroterapia)
    if (existingServiceType === 'hidroterapia_rehabilitacion' || 
        existingServiceType === 'hidroterapia' ||
        selectedServiceType === 'hidroterapia_rehabilitacion' || 
        selectedServiceType === 'hidroterapia') {
      debugLog(`❌ Servicio bloqueado por hidroterapia (requiere exclusividad)`)
      return true
    }
    
    // CASO 4: Cualquier otro solapamiento entre servicios del centro está prohibido
    debugLog(`❌ Solapamiento no permitido entre servicios del centro`)
    return true
  }

  debugLog(`✅ Slot ${timeSlot} disponible`)
  return false
}

/**
 * Obtiene la configuración de horarios disponibles para una fecha específica
 */
export const getAvailableTimeSlotsForDate = async (dateString) => {
  try {
    // 🚨 CACHE MÁS AGRESIVO - Verificar cada consulta
    const now = Date.now()
    if (
      availableTimeSlotsCache[dateString] && 
      cacheTimestamp[dateString] && 
      (now - cacheTimestamp[dateString]) < CACHE_DURATION
    ) {
      debugLog(`🗂️ Usando cache para slots admin de ${dateString}`)
      return availableTimeSlotsCache[dateString]
    }

    debugLog(`🔄 Recargando slots admin para ${dateString}`)

    // Consultar configuración desde BD para la fecha específica
    const { data, error } = await supabase
      .from('available_time_slots')
      .select('*')
      .eq('date', dateString)
      .eq('is_active', true)
      .order('start_time')

    if (error) {
      debugLog(`❌ Error cargando slots admin: ${error.message}`)
      return null
    }

    debugLog(`📋 Slots admin configurados: ${data?.length || 0}`)

    // Actualizar cache por fecha
    availableTimeSlotsCache[dateString] = data || []
    cacheTimestamp[dateString] = now

    return data || []
  } catch (error) {
    debugLog(`❌ Error crítico obteniendo slots admin: ${error.message}`)
    return null
  }
}

/**
 * 🚨 NUEVA: Limpia el cache de configuración de horarios de forma más agresiva
 */
export const clearAvailableTimeSlotsCache = (dateString = null) => {
  if (dateString) {
    delete availableTimeSlotsCache[dateString]
    delete cacheTimestamp[dateString]
    debugLog(`🗑️ Cache eliminado para fecha: ${dateString}`)
  } else {
    availableTimeSlotsCache = {}
    cacheTimestamp = {}
    debugLog(`🗑️ Todo el cache eliminado`)
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
  const minRequiredMinutes = currentMinutes + 90 // + 1.5 horas
  
  const filteredSlots = slots.filter(slot => {
    const [hours, minutes] = slot.split(':').map(Number)
    const slotMinutes = hours * 60 + minutes
    return slotMinutes >= minRequiredMinutes
  })
  
  debugLog(`⏰ Filtro día actual: ${slots.length} -> ${filteredSlots.length} slots`)
  return filteredSlots
}

/**
 * Verifica si un horario específico está dentro de algún slot disponible
 */
export const isTimeSlotAvailableByAdmin = async (timeSlot, dateString, serviceDurationMinutes) => {
  try {
    const availableSlots = await getAvailableTimeSlotsForDate(dateString)
    
    // Si no hay configuración, considerar NO disponible
    if (!availableSlots || availableSlots.length === 0) {
      debugLog(`❌ Sin configuración admin para ${dateString}`)
      return false
    }

    const requestedStartMinutes = timeToMinutes(timeSlot)
    const requestedEndMinutes = requestedStartMinutes + serviceDurationMinutes

    // Verificar si el horario solicitado cabe dentro de algún slot disponible
    const isAvailable = availableSlots.some(slot => {
      const slotStartMinutes = timeToMinutes(slot.start_time)
      const slotEndMinutes = timeToMinutes(slot.end_time)
      
      // El servicio debe comenzar y terminar dentro del slot disponible
      const fits = requestedStartMinutes >= slotStartMinutes && requestedEndMinutes <= slotEndMinutes
      
      if (fits) {
        debugLog(`✅ Slot ${timeSlot} cabe en admin slot ${slot.start_time}-${slot.end_time}`)
      }
      
      return fits
    })

    if (!isAvailable) {
      debugLog(`❌ Slot ${timeSlot} NO cabe en ningún slot admin`)
    }

    return isAvailable
  } catch (error) {
    debugLog(`❌ Error verificando disponibilidad admin: ${error.message}`)
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
      debugLog(`🔗 Fusionando slots: ${currentSlot.start_time}-${currentSlot.end_time}`)
    } else {
      // No son consecutivos, guardar el actual e iniciar nuevo
      mergedSlots.push(currentSlot)
      currentSlot = { ...nextSlot }
    }
  }
  
  // Añadir el último slot
  mergedSlots.push(currentSlot)
  
  debugLog(`📎 Slots fusionados: ${slots.length} -> ${mergedSlots.length}`)
  return mergedSlots
}

/**
 * 🚨 FUNCIÓN PRINCIPAL MEJORADA: Genera horarios disponibles con debugging completo
 */
export const generateFilteredTimeSlots = async (service, dateString, existingBookings = [], homeVisits = []) => {
  debugLog(`=== INICIANDO generateFilteredTimeSlots ===`)
  debugLog(`Servicio: ${service.nombre} (${service.tipo})`)
  debugLog(`Fecha: ${dateString}`)
  debugLog(`Duracion: ${service.duracion_minutos} min`)
  
  try {
    const serviceDurationMinutes = service.duracion_minutos
    const selectedServiceType = service.tipo

    // 🚨 FORZAR RECARGA DE CACHE DE ADMIN SLOTS
    clearAvailableTimeSlotsCache(dateString)
    
    // Obtener configuración de admin para TODOS los servicios
    const availableSlots = await getAvailableTimeSlotsForDate(dateString)
    
    // Si no hay configuración, no hay horarios disponibles
    if (!availableSlots || availableSlots.length === 0) {
      debugLog(`❌ Sin slots configurados por admin para ${dateString}`)
      return []
    }

    const possibleSlots = []

    // 🚨 Si no se proporcionaron reservas, obtenerlas FRESCAS
    let finalExistingBookings = existingBookings
    let finalHomeVisits = homeVisits
    
    if (existingBookings.length === 0 && homeVisits.length === 0) {
      debugLog(`🔄 Obteniendo reservas frescas (no se pasaron parámetros)`)
      const freshData = await getFreshBookingsWithDebug(dateString, 'generateFilteredTimeSlots')
      finalExistingBookings = freshData.centerBookings
      finalHomeVisits = freshData.homeVisits
    } else {
      debugLog(`✅ Usando reservas pasadas como parámetros`)
    }

    // Para cada slot configurado por el admin
    const mergedSlots = mergeConsecutiveSlots(availableSlots)

      // Para cada slot fusionado
      mergedSlots.forEach(adminSlot => {
        const slotStartMinutes = timeToMinutes(adminSlot.start_time)
        const slotEndMinutes = timeToMinutes(adminSlot.end_time)
      
      debugLog(`🏗️ Procesando admin slot: ${adminSlot.start_time}-${adminSlot.end_time}`)
      
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
            debugLog(`✅ Slot ${timeString} agregado como disponible`)
          } else {
            debugLog(`❌ Slot ${timeString} bloqueado`)
          }
        }
      }
    })

    // Eliminar duplicados y ordenar
    const uniqueSlots = [...new Set(possibleSlots)].sort()
    
    // Aplicar filtro del día actual antes de devolver
    const finalSlots = filterTodaySlots(uniqueSlots, dateString)
    
    debugLog(`📊 RESULTADO FINAL: ${finalSlots.length} slots disponibles`)
    debugLog(`=== FIN generateFilteredTimeSlots ===`)
    
    return finalSlots
  } catch (error) {
    debugLog(`❌ ERROR CRÍTICO: ${error.message}`)
    console.error('Error generating filtered time slots:', error)
    return []
  }
}

/**
 * 🚨 NUEVA FUNCIÓN: Invalidar cache y notificar actualización global SIN DELAY
 */
export const invalidateCacheAndNotifyImmediate = (dateString = null) => {
  // Limpiar cache local INMEDIATAMENTE
  clearAvailableTimeSlotsCache(dateString)
  
  // Disparar evento personalizado INMEDIATAMENTE
  if (typeof window !== 'undefined') {
    const eventDetail = { 
      dateString, 
      timestamp: Date.now(),
      source: 'immediate_invalidation'
    }
    
    window.dispatchEvent(new CustomEvent('booking-updated', { detail: eventDetail }))
    
    debugLog(`🚨 INVALIDACIÓN INMEDIATA - Cache limpio y evento disparado`, eventDetail)
  }
}

/**
 * FUNCIÓN LEGACY: Invalidar cache y notificar actualización global
 */
export const invalidateCacheAndNotify = (dateString = null) => {
  // Usar la nueva función inmediata
  invalidateCacheAndNotifyImmediate(dateString)
}

/**
 * 🚨 NUEVA: Función de debug para mostrar información detallada sobre disponibilidad
 */
export const debugSlotAvailabilityDetailed = async (service, dateString, timeSlot) => {
  console.log(`🔍 ===== DEBUG DETALLADO PARA SLOT =====`)
  console.log(`Servicio: ${service.nombre} (${service.tipo})`)
  console.log(`Fecha: ${dateString}`)
  console.log(`Hora: ${timeSlot}`)
  console.log(`Duración: ${service.duracion_minutos} minutos`)
  
  try {
    // Activar debugging temporalmente
    const originalDebugMode = debugMode
    debugMode = true
    
    // Obtener reservas frescas
    const freshData = await getFreshBookingsWithDebug(dateString, 'debugSlotAvailability')
    
    console.log(`📊 Total reservas: ${freshData.allBookings.length}`)
    console.log(`🏥 Reservas centro: ${freshData.centerBookings.length}`)
    console.log(`🏠 Visitas domicilio: ${freshData.homeVisits.length}`)
    
    // Verificar disponibilidad admin
    const adminSlots = await getAvailableTimeSlotsForDate(dateString)
    console.log(`⚙️ Slots configurados por admin: ${adminSlots?.length || 0}`)
    
    if (adminSlots && adminSlots.length > 0) {
      adminSlots.forEach(slot => {
        console.log(`   - ${slot.start_time} a ${slot.end_time}`)
      })
    }
    
    // Verificar si el slot específico está disponible por admin
    const adminAvailable = await isTimeSlotAvailableByAdmin(timeSlot, dateString, service.duracion_minutos)
    console.log(`⚙️ Disponible por configuración admin: ${adminAvailable ? '✅' : '❌'}`)
    
    // Verificar bloqueos
    const isBlocked = isTimeSlotBlocked(
      timeSlot, 
      freshData.centerBookings, 
      freshData.homeVisits, 
      service.duracion_minutos, 
      service.tipo
    )
    
    console.log(`🔒 Slot bloqueado por reservas: ${isBlocked ? '❌' : '✅'}`)
    
    // Generar todos los slots disponibles
    const allAvailableSlots = await generateFilteredTimeSlots(
      service, 
      dateString, 
      freshData.centerBookings, 
      freshData.homeVisits
    )
    
    console.log(`📋 Total slots disponibles: ${allAvailableSlots.length}`)
    console.log(`🎯 Slot ${timeSlot} está en la lista: ${allAvailableSlots.includes(timeSlot) ? '✅' : '❌'}`)
    
    if (allAvailableSlots.length <= 10) {
      console.log(`📝 Slots disponibles: ${allAvailableSlots.join(', ')}`)
    }
    
    // Restaurar debugging
    debugMode = originalDebugMode
    
    console.log(`🔍 ===== FIN DEBUG DETALLADO =====`)
    
    return !isBlocked && adminAvailable
  } catch (error) {
    console.error('❌ Error en debug detallado:', error)
    debugMode = originalDebugMode
    return false
  }
}

// ================================
// FUNCIONES ADICIONALES EXISTENTES (sin cambios)
// ================================

export const generateHomeVisitTimeSlots = async (dateString) => {
  try {
    const slots = []
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = (hour === 6 ? 30 : 0); minute < 60; minute += 15) {
        if (hour === 23 && minute > 0) break
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
      }
    }
    
    return filterTodaySlots(slots, dateString)
  } catch (error) {
    console.warn('Error generating home visit time slots:', error)
    return []
  }
}

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

export const hasAvailableTimeSlotsForDate = async (dateString) => {
  const slots = await getAvailableTimeSlotsForDate(dateString)
  return slots && slots.length > 0
}

export const calculateDayAvailability = async (service, days, existingBookings = [], homeVisits = []) => {
  const availability = {}
  
  for (const day of days) {
    const dayStr = format(day, 'yyyy-MM-dd')
    
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const dayDate = new Date(day)
    dayDate.setHours(0, 0, 0, 0)
    
    if (dayDate < now) {
      availability[dayStr] = 'past'
      continue
    }
    
    if (service.tipo === 'rehabilitacion_domicilio') {
      availability[dayStr] = 'available'
      continue
    }
    
    const adminSlots = await generateFilteredTimeSlots(service, dayStr)
    
    if (adminSlots.length === 0) {
      availability[dayStr] = 'full'
      continue
    }
    
    availability[dayStr] = 'available'
  }
  
  return availability
}

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

export const invalidateTimeSlotsCache = (dateString = null) => {
  clearAvailableTimeSlotsCache(dateString)
}

// 🚨 NUEVA: Función para debug rápido desde consola
export const quickDebugBookings = async (dateString = null) => {
  const targetDate = dateString || format(new Date(), 'yyyy-MM-dd')
  console.log(`🚀 QUICK DEBUG para ${targetDate}`)
  
  const originalDebugMode = debugMode
  debugMode = true
  
  try {
    const freshData = await getFreshBookingsWithDebug(targetDate, 'quickDebug')
    const adminSlots = await getAvailableTimeSlotsForDate(targetDate)
    
    console.log(`📋 Resumen para ${targetDate}:`)
    console.log(`   - Reservas totales: ${freshData.allBookings.length}`)
    console.log(`   - Slots admin: ${adminSlots?.length || 0}`)
    
    return {
      date: targetDate,
      bookings: freshData.allBookings.length,
      adminSlots: adminSlots?.length || 0,
      centerBookings: freshData.centerBookings.length,
      homeVisits: freshData.homeVisits.length
    }
  } finally {
    debugMode = originalDebugMode
  }
}