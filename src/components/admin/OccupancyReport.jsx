import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { mergeConsecutiveSlots } from '../../utils/bookingUtils'

// Función helper para mostrar precio condicional
const displayPrice = (servicio, precio) => {
  if (servicio && (
    servicio.toLowerCase().includes('rehabilitación a domicilio') ||
    servicio.toLowerCase().includes('rehabilitacion a domicilio')
  )) {
    return 'A partir de 80 €';
  }
  return `€${precio}`;
};

export default function OccupancyReport() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedSpace, setSelectedSpace] = useState('all')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [viewMode, setViewMode] = useState('desktop')
  const [availableSlots, setAvailableSlots] = useState([])

  // Generar horas del día (08:00 - 21:00, solo horas completas)
  const timeSlots = []
    for (let hour = 6; hour <= 23; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`)
    }

  const HOUR_HEIGHT = 50 // píxeles por hora
  const WORK_DAY_START_HOUR = 6 // primera hora mostrada (6:00)

  // Función helper para convertir minutos a píxeles
  const minutesToPixels = (minutes) => {
    const hoursSinceWorkStart = (minutes - (WORK_DAY_START_HOUR * 60)) / 60
    return hoursSinceWorkStart * HOUR_HEIGHT
  }

  useEffect(() => {
    loadWeeklyBookings()
    
    // Detectar el tamaño de pantalla
    const handleResize = () => {
      setViewMode(window.innerWidth < 1024 ? 'mobile' : 'desktop')
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [currentWeek])

  const loadWeeklyBookings = async () => {
    try {
      setLoading(true)
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })

      // Cargar citas existentes
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          services(nombre, tipo, duracion_minutos),
          dogs(nombre, raza),
          profiles!bookings_client_id_fkey(nombre_completo),
          spaces(nombre)
        `)
        .gte('fecha_hora', weekStart.toISOString())
        .lte('fecha_hora', weekEnd.toISOString())
        .in('estado', ['pendiente', 'confirmada'])
        .order('fecha_hora')

      if (bookingsError) throw bookingsError

      // Cargar slots disponibles
      const { data: slotsData, error: slotsError } = await supabase
        .from('available_time_slots')
        .select('*')
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('is_active', true)
        .order('date')
        .order('start_time')

      if (slotsError) throw slotsError
      
      console.log('Bookings cargadas:', bookingsData?.length || 0)
      console.log('Slots disponibles cargados:', slotsData?.length || 0)
      
      setBookings(bookingsData || [])
      setAvailableSlots(slotsData || [])
    } catch (error) {
      console.error('Error loading weekly data:', error)
      toast.error('Error cargando datos de la semana')
    } finally {
      setLoading(false)
    }
  }

  // Obtener días de la semana actual
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 1 })
  })

  // Funciones helper para manejo de tiempo
  const timeToMinutes = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  // Colores por tipo de servicio - CORREGIDOS
  const getServiceColor = (serviceType) => {
    switch (serviceType) {
      case 'rehabilitacion': return '#FEF3C7' // Amarillo
      case 'hidroterapia': return '#DBEAFE' // Azul
      case 'hidroterapia_rehabilitacion': return '#D1FAE5' // Verde
      case 'rehabilitacion_domicilio': return '#F3E8FF' // Púrpura
      default: return '#F3F4F6' // Gris
    }
  }

  const getServiceBorderColor = (serviceType) => {
    switch (serviceType) {
      case 'rehabilitacion': return '#F59E0B' // Amarillo
      case 'hidroterapia': return '#3B82F6' // Azul
      case 'hidroterapia_rehabilitacion': return '#10B981' // Verde
      case 'rehabilitacion_domicilio': return '#9333EA' // Púrpura
      default: return '#6B7280' // Gris
    }
  }

  const getServiceIcon = (serviceType) => {
    switch (serviceType) {
      case 'rehabilitacion': return '🏥'
      case 'hidroterapia': return '💧'
      case 'hidroterapia_rehabilitacion': return '🏥💧'
      case 'rehabilitacion_domicilio': return '🏠'
      default: return '⚕️'
    }
  }

  // Calcular tamaño de texto dinámico basado en altura del evento - CORREGIDO
  const getDynamicFontSize = (heightPixels, isSimultaneous = false) => {
    // Usar altura directamente en píxeles
    const estimatedHeightPx = heightPixels
    
    // Ajustar por eventos simultáneos que tienen menos ancho
    const heightMultiplier = isSimultaneous ? 0.8 : 1
    const adjustedHeight = estimatedHeightPx * heightMultiplier
    
    // Definir rangos de tamaño basados en altura
    if (adjustedHeight >= 120) {
      return 'text-xs' // 12px - eventos muy largos
    } else if (adjustedHeight >= 80) {
      return 'text-[11px]' // 11px - eventos largos
    } else if (adjustedHeight >= 50) {
      return 'text-[10px]' // 10px - eventos medianos
    } else if (adjustedHeight >= 35) {
      return 'text-[9px]' // 9px - eventos cortos
    } else if (adjustedHeight >= 25) {
      return 'text-[8px]' // 8px - eventos muy cortos
    } else {
      return 'text-[7px]' // 7px - eventos mínimos
    }
  }

  // Función para calcular el tamaño de fuente ideal para que quepa todo el contenido - CORREGIDO
  const getAdaptiveFontSize = (heightPixels, contentLines) => {
      const estimatedHeightPx = heightPixels
      const availableHeight = Math.max(20, estimatedHeightPx - 8) // -8px para padding
      
      // Calcular altura necesaria por línea
      const heightPerLine = availableHeight / contentLines
      
      // Mapear altura por línea a tamaño de fuente
      if (heightPerLine >= 20) {
        return 'text-xs' // 12px
      } else if (heightPerLine >= 16) {
        return 'text-[11px]' // 11px
      } else if (heightPerLine >= 14) {
        return 'text-[10px]' // 10px
      } else if (heightPerLine >= 12) {
        return 'text-[9px]' // 9px
      } else if (heightPerLine >= 10) {
        return 'text-[8px]' // 8px
      } else if (heightPerLine >= 8) {
        return 'text-[7px]' // 7px
      } else {
        return 'text-[6px]' // 6px - mínimo
      }
    }  

    // Función para calcular el tamaño de fuente ideal para citas (3 líneas) - CORREGIDO
    const getAdaptiveFontSizeForBookings = (heightPixels) => {
      const estimatedHeightPx = heightPixels
      const availableHeight = Math.max(30, estimatedHeightPx - 8) // -8px para padding, mínimo 30px
      
      // Calcular altura necesaria por línea para 3 líneas
      const heightPerLine = availableHeight / 3
      
      // Mapear altura por línea a tamaño de fuente
      if (heightPerLine >= 18) {
        return 'text-xs' // 12px
      } else if (heightPerLine >= 15) {
        return 'text-[11px]' // 11px
      } else if (heightPerLine >= 13) {
        return 'text-[10px]' // 10px
      } else if (heightPerLine >= 11) {
        return 'text-[9px]' // 9px
      } else if (heightPerLine >= 9) {
        return 'text-[8px]' // 8px
      } else if (heightPerLine >= 7) {
        return 'text-[7px]' // 7px
      } else {
        return 'text-[6px]' // 6px - mínimo
      }
    }

  // Determinar qué información mostrar basado en el espacio disponible - CORREGIDO
  const getContentLevel = (heightPixels, duration) => {
    const estimatedHeightPx = heightPixels
    
    if (estimatedHeightPx >= 140) {
      return 'full-multiline' // Mostrar toda la información con múltiples líneas
    } else if (estimatedHeightPx >= 100) {
      return 'full' // Mostrar toda la información
    } else if (estimatedHeightPx >= 70) {
      return 'medium' // Mostrar información principal
    } else if (estimatedHeightPx >= 45) {
      return 'compact' // Mostrar información mínima
    } else {
      return 'minimal' // Solo lo esencial
    }
  }

  // Función para truncar texto inteligentemente
  const smartTruncate = (text, maxLength) => {
    if (!text || text.length <= maxLength) return text
    
    // Intentar cortar por palabra completa
    const truncated = text.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    
    if (lastSpace > maxLength * 0.6) {
      return truncated.substring(0, lastSpace) + '...'
    }
    
    return truncated + '...'
  }

  // Nueva función para fragmentar slots disponibles considerando reservas
  const fragmentAvailableSlot = (slot, dayBookings) => {
    const slotStart = timeToMinutes(slot.start_time.substring(0, 5))
    const slotEnd = timeToMinutes(slot.end_time.substring(0, 5))
    
    // Obtener todos los períodos ocupados (cita + descanso según el tipo de servicio)
    const occupiedPeriods = dayBookings.map(booking => {
      const bookingStart = timeToMinutes(booking.fecha_hora.substring(11, 16))
      const bookingDuration = booking.duracion_minutos || booking.services?.duracion_minutos || 30
      
      // CORREGIDO: Aplicar tiempo de descanso según el tipo de servicio
      let restTime = 15 // Por defecto 15 min
      if (booking.services?.tipo === 'rehabilitacion_domicilio') {
        restTime = 0 // Las visitas a domicilio no necesitan tiempo de descanso en el centro
      } else if (booking.services?.tipo === 'hidroterapia' || booking.services?.tipo === 'hidroterapia_rehabilitacion') {
        restTime = 30 // 30 min para servicios de hidroterapia
      }
      
      const bookingEnd = bookingStart + bookingDuration + restTime
      
      return {
        start: Math.max(slotStart, bookingStart),
        end: Math.min(slotEnd, bookingEnd)
      }
    }).filter(period => period.start < period.end)
    
    // Ordenar períodos ocupados por hora de inicio
    occupiedPeriods.sort((a, b) => a.start - b.start)
    
    // Generar fragmentos disponibles
    const availableFragments = []
    let currentStart = slotStart
    
    for (const occupiedPeriod of occupiedPeriods) {
      // Si hay espacio antes del período ocupado
      if (currentStart < occupiedPeriod.start) {
        const fragmentDuration = occupiedPeriod.start - currentStart
        
        // Solo crear fragmento si tiene duración mínima útil (30 min)
        if (fragmentDuration >= 30) {
          availableFragments.push({
            start: currentStart,
            end: occupiedPeriod.start,
            duration: fragmentDuration
          })
        }
      }
      
      // Mover el inicio después del período ocupado
      currentStart = Math.max(currentStart, occupiedPeriod.end)
    }
    
    // Verificar si queda espacio al final
    if (currentStart < slotEnd) {
      const fragmentDuration = slotEnd - currentStart
      
      if (fragmentDuration >= 30) {
        availableFragments.push({
          start: currentStart,
          end: slotEnd,
          duration: fragmentDuration
        })
      }
    }
    
    return availableFragments
  }

  // Función simplificada para agrupar eventos (sin Aqua Agility por ahora)
  const groupSimultaneousEvents = (events) => {
    const processedEvents = []
    const usedEvents = new Set()

    events.forEach((event, index) => {
      if (usedEvents.has(index)) return

      // Solo procesar eventos de citas (no disponibles)
      if (!event.isAvailable) {
        // Por ahora, sin compatibilidad - cada evento ocupa su propio espacio
        processedEvents.push({
          ...event,
          columnIndex: 0,
          totalColumns: 1,
          isSimultaneous: false
        })
        usedEvents.add(index)
      } else {
        // Eventos disponibles se procesan normalmente
        processedEvents.push({
          ...event,
          columnIndex: 0,
          totalColumns: 1,
          isSimultaneous: false
        })
        usedEvents.add(index)
      }
    })

    return processedEvents
  }

  // Filtrar citas por espacio
  const getFilteredBookings = () => {
    if (selectedSpace === 'all') return bookings
    
    return bookings.filter(booking => {
      const serviceType = booking.services?.tipo
      switch (selectedSpace) {
        case 'rehabilitacion':
          return serviceType === 'rehabilitacion' || serviceType === 'hidroterapia_rehabilitacion'
        case 'hidroterapia':
          return serviceType === 'hidroterapia' || serviceType === 'hidroterapia_rehabilitacion'
        default:
          return true
      }
    })
  }

  // FUNCIÓN ESTILO GOOGLE CALENDAR: Crear estructura de eventos por día - CORREGIDO
  const createBookingMatrix = () => {
    const matrix = {}
    const filteredBookings = getFilteredBookings()
    
    // Inicializar días
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd')
      matrix[dayKey] = {
        events: []
      }
    })
    
    // 🚨 NUEVO: Agrupar slots por día y fusionar consecutivos
    const slotsByDay = {}
    availableSlots.forEach(slot => {
      if (!slotsByDay[slot.date]) {
        slotsByDay[slot.date] = []
      }
      slotsByDay[slot.date].push(slot)
    })

    // Procesar cada día con slots fusionados
    Object.entries(slotsByDay).forEach(([dayKey, daySlots]) => {
      if (!matrix[dayKey]) return
      
      // 🚨 FUSIONAR slots consecutivos del día
      const mergedSlots = mergeConsecutiveSlots(daySlots)
      console.log(`📅 OccupancyReport - Día ${dayKey}: ${daySlots.length} slots originales, ${mergedSlots.length} fusionados`)
      
      // Obtener citas del día para fragmentación
      const dayBookings = filteredBookings.filter(booking => 
        booking.fecha_hora.substring(0, 10) === dayKey
      )
      
      // Procesar cada slot fusionado
      mergedSlots.forEach(slot => {
        // Fragmentar el slot considerando las reservas existentes
        const availableFragments = fragmentAvailableSlot(slot, dayBookings)
        
        // Crear eventos para cada fragmento disponible
        availableFragments.forEach((fragment, index) => {
          const startTime = minutesToTime(fragment.start)
          const endTime = minutesToTime(fragment.end)
          
          // Crear evento "Disponible" fragmentado con posicionamiento en píxeles
          const availableEvent = {
            id: `available-${slot.id}-fragment-${index}`,
            isAvailable: true,
            startMinutes: fragment.start,
            endMinutes: fragment.end,
            duration: fragment.duration,
            displayStartTime: startTime,
            displayEndTime: endTime,
            topPixels: minutesToPixels(fragment.start),
            heightPixels: minutesToPixels(fragment.end) - minutesToPixels(fragment.start),
            slot: slot,
            isFragment: true
          }
          
          matrix[dayKey].events.push(availableEvent)
        })
      }) // Cierre del mergedSlots.forEach
    }) // Cierre del Object.entries forEach
    
    // Luego, procesar cada cita como evento independiente
    filteredBookings.forEach(booking => {
      const bookingDate = booking.fecha_hora.substring(0, 10)
      const bookingTime = booking.fecha_hora.substring(11, 16)
      
      if (!matrix[bookingDate]) return
      
      // Calcular tiempos
      const startMinutes = timeToMinutes(bookingTime)
      const duration = booking.duracion_minutos || booking.services?.duracion_minutos || 30
      const endMinutes = startMinutes + duration
      
      // Preparar evento enriquecido con posicionamiento en píxeles
      const enrichedEvent = {
        ...booking,
        isAvailable: false,
        startMinutes,
        endMinutes,
        duration,
        displayStartTime: bookingTime,
        displayEndTime: minutesToTime(endMinutes),
        topPixels: minutesToPixels(startMinutes),
        heightPixels: minutesToPixels(endMinutes) - minutesToPixels(startMinutes)
      }
      
      matrix[bookingDate].events.push(enrichedEvent)
    })
    
    return matrix
  }
  const renderDayColumn = (day, dayKey) => {
    const dayData = bookingMatrix[dayKey]
    if (!dayData) return null

    // Agrupar eventos (sin simultaneidad por ahora)
    const processedEvents = groupSimultaneousEvents(dayData.events)

    return (
      <div key={dayKey} className="flex-1 border-r border-gray-200 relative bg-white" style={{ height: `${timeSlots.length * HOUR_HEIGHT}px` }}>
        {/* Eventos posicionados */}
        {processedEvents.map((event, index) => {
          // Calcular nivel de contenido y tamaño de fuente - CORREGIDO
          const contentLevel = getContentLevel(event.heightPixels, event.duration)
          const fontSize = getDynamicFontSize(event.heightPixels, event.isSimultaneous)
          
          // Calcular posicionamiento horizontal para eventos
          const getHorizontalPosition = () => {
            return { left: '4px', right: '4px' }
          }

          const horizontalPosition = getHorizontalPosition()
        
          
          // Estilo para citas normales con contenido adaptativo
          return (
            <div
              key={`${event.id}-${index}`}
              onClick={() => !event.isAvailable && setSelectedBooking(event)}
              className={`absolute rounded-md overflow-hidden shadow-sm border-l-4 transition-all duration-200 transform z-10 ${
                event.isAvailable 
                  ? '' // Sin cursor-pointer ni hover para disponibles
                  : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' // Solo para citas
              }`}
              style={{
                backgroundColor: getServiceColor(event.services?.tipo),
                borderLeftColor: getServiceBorderColor(event.services?.tipo),
                top: `${event.topPixels}px`,
                height: `${Math.max(event.heightPixels, 24)}px`,
                minHeight: '24px',
                ...horizontalPosition
              }}
            >
              <div className="h-full w-full p-1 flex flex-col justify-center overflow-hidden">

                {(() => {
                  const serviceIcon = getServiceIcon(event.services?.tipo)
                  const clientName = event.profiles?.nombre_completo || 'Cliente'
                  const dogName = event.dogs?.nombre || 'Perro'
                  
                  // Calcular altura disponible y líneas que caben - CORREGIDO
                  const estimatedHeightPx = event.heightPixels
                  const availableHeight = Math.max(24, estimatedHeightPx - 6)
                  
                  // Estimar altura de línea según el tamaño de fuente
                  const getLineHeight = () => {
                    if (fontSize.includes('text-xs')) return 16
                    if (fontSize.includes('text-[11px]')) return 14
                    if (fontSize.includes('text-[10px]')) return 13
                    if (fontSize.includes('text-[9px]')) return 12
                    if (fontSize.includes('text-[8px]')) return 11
                    return 10
                  }
                  
                  const lineHeight = getLineHeight()
                  const maxLines = Math.floor(availableHeight / lineHeight)
                  
                  // Renderizado para eventos DISPONIBLES
                  if (event.isAvailable) {
                    return (
                      <div className="text-center px-1 py-1 w-full h-full flex flex-col justify-center">
                        {/* Siempre mostrar algo, adaptándose al espacio disponible */}
                        {maxLines >= 2 ? (
                          // Espacio para 2+ líneas: mostrar completo
                          <>
                            <div className={`font-medium text-green-700 leading-tight ${fontSize}`}>
                              ✅ DISPONIBLE
                            </div>
                            <div className={`text-green-600 leading-tight ${fontSize}`}>
                              {event.displayStartTime} - {event.displayEndTime}
                            </div>
                          </>
                        ) : maxLines >= 1 ? (
                          // Espacio para 1 línea: solo "✅ DISPONIBLE"
                          <div className={`font-medium text-green-700 leading-tight ${fontSize}`}>
                            ✅ DISPONIBLE
                          </div>
                        ) : (
                          // Muy poco espacio: solo el emoji
                          <div className={`font-medium text-green-700 leading-tight text-center ${fontSize}`}>
                            ✅
                          </div>
                        )}
                      </div>
                    )
                  }
                  
                  // Renderizado para CITAS con salto de línea inteligente
                  const fullClientName = `${serviceIcon} ${clientName}`
                  const dogLine = `🐶 ${dogName}`
                  const timeLine = `⌚ ${event.displayStartTime} - ${event.displayEndTime}`
                  
                  // Estimar cuántas líneas necesitará cada texto basado en longitud
                  const estimateLines = (text, maxChars) => {
                    return Math.ceil(text.length / maxChars)
                  }
                  
                  // Caracteres aproximados por línea según el tamaño de fuente
                  const getCharsPerLine = () => {
                    if (fontSize.includes('text-xs')) return 20
                    if (fontSize.includes('text-[11px]')) return 22
                    if (fontSize.includes('text-[10px]')) return 24
                    if (fontSize.includes('text-[9px]')) return 26
                    if (fontSize.includes('text-[8px]')) return 28
                    return 30
                  }
                  
                  const charsPerLine = getCharsPerLine()
                  
                  // Estimar líneas necesarias para cada sección
                  const clientNameLines = estimateLines(fullClientName, charsPerLine)
                  const dogLines = 1 // Siempre 1 línea
                  const timeLines = 1 // Siempre 1 línea
                  
                  // Decidir qué mostrar basado en el espacio disponible
                  let showClient = false
                  let showDog = false
                  let showTime = false
                  
                  if (maxLines >= clientNameLines) {
                    showClient = true
                    
                    if (maxLines >= clientNameLines + dogLines) {
                      showDog = true
                      
                      if (maxLines >= clientNameLines + dogLines + timeLines) {
                        showTime = true
                      }
                    }
                  }
                  
                  return (
                    <div className="h-full w-full p-1 flex flex-col justify-center overflow-hidden">
                      {/* Sección 1: Nombre del cliente (puede usar múltiples líneas) */}
                      {showClient && (
                        <div 
                          className={`font-semibold text-gray-800 leading-tight ${fontSize}`}
                          style={{ 
                            maxHeight: `${clientNameLines * lineHeight}px`,
                            overflow: 'hidden'
                          }}
                        >
                          <div className="break-words">
                            {fullClientName}
                          </div>
                        </div>
                      )}
                      
                      {/* Sección 2: Perro (1 línea) */}
                      {showDog && (
                        <div className={`text-gray-700 leading-tight ${fontSize}`}>
                          <div className="break-words">
                            {dogLine}
                          </div>
                        </div>
                      )}
                      
                      {/* Sección 3: Hora (1 línea) */}
                      {showTime && (
                        <div className={`text-gray-600 leading-tight font-medium ${fontSize}`}>
                          <div className="break-words">
                            {timeLine}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })}
        
        {/* Líneas de hora alineadas con timeSlots */}
        {timeSlots.map((_, index) => (
          <div
            key={index}
            className="absolute left-0 right-0 border-t border-gray-100 z-0"
            style={{ top: `${index * HOUR_HEIGHT}px` }}
          />
        ))}
      </div>
    )
  }

  // Navegar entre semanas
  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1))
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1))
  const goToCurrentWeek = () => setCurrentWeek(new Date())

  // Obtener estadísticas
  const getWeekStats = () => {
    const filteredBookings = getFilteredBookings()
    const totalBookings = filteredBookings.length
    const totalRevenue = filteredBookings.reduce((sum, booking) => {
      return sum + (parseFloat(booking.precio) || 0) + (parseFloat(booking.recargo_cancelacion) || 0)
    }, 0)
    const totalMinutes = filteredBookings.reduce((sum, booking) => {
      const duration = booking.duracion_minutos || booking.services?.duracion_minutos || 0
      return sum + duration
    }, 0)

    return {
      totalBookings,
      totalRevenue,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10
    }
  }

  // Vista de día individual para móviles
  const renderMobileDayView = (day) => {
    const dayKey = format(day, 'yyyy-MM-dd')
    const dayBookings = getFilteredBookings()
      .filter(booking => booking.fecha_hora.substring(0, 10) === dayKey)
      .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))

    // Obtener slots disponibles del día usando fragmentación
    let dayAvailableSlots = []
    availableSlots
      .filter(slot => slot.date === dayKey)
      .forEach(slot => {
        const availableFragments = fragmentAvailableSlot(slot, dayBookings)
        
        availableFragments.forEach((fragment, index) => {
          dayAvailableSlots.push({
            id: `available-${slot.id}-fragment-${index}`,
            isAvailable: true,
            displayStartTime: minutesToTime(fragment.start),
            displayEndTime: minutesToTime(fragment.end),
            duration: fragment.duration,
            slot: slot,
            isFragment: true
          })
        })
      })

    // Combinar citas y slots disponibles, ordenados por hora
    const allEvents = [...dayBookings, ...dayAvailableSlots]
      .sort((a, b) => {
        const timeA = a.isAvailable ? a.displayStartTime : a.fecha_hora.substring(11, 16)
        const timeB = b.isAvailable ? b.displayStartTime : b.fecha_hora.substring(11, 16)
        return timeA.localeCompare(timeB)
      })

    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 capitalize">
              {format(day, 'EEEE d \'de\' MMMM', { locale: es })}
            </h3>
            <span className="text-sm text-gray-500">
              {dayBookings.length} cita{dayBookings.length !== 1 ? 's' : ''} | {dayAvailableSlots.length} disponible{dayAvailableSlots.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        
        <div className="p-4 space-y-3">
          {allEvents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay citas ni horarios disponibles</p>
          ) : (
            allEvents.map((event, index) => {
              if (event.isAvailable) {
                // Renderizar slot disponible
                return (
                  <div
                    key={`${event.id}-${index}`}
                    className="p-3 rounded-lg border-2 border-dashed border-green-400 bg-green-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-green-700">
                        ✅ Horario Disponible
                      </div>
                      <div className="text-sm font-medium text-green-700">
                        {event.displayStartTime} - {event.displayEndTime}
                      </div>
                    </div>
                    <div className="text-sm text-green-600">
                      Duración: {event.duration} minutos
                    </div>
                  </div>
                )
              } else {
                // Renderizar cita normal
                const startTime = event.fecha_hora.substring(11, 16)
                const duration = event.duracion_minutos || event.services?.duracion_minutos || 30
                const endTime = minutesToTime(timeToMinutes(startTime) + duration)
                
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedBooking(event)}
                    className="p-3 rounded-lg border-l-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{
                      backgroundColor: getServiceColor(event.services?.tipo),
                      borderLeftColor: getServiceBorderColor(event.services?.tipo)
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-gray-900">
                        {getServiceIcon(event.services?.tipo)} {event.services?.nombre}
                      </div>
                      <div className="text-sm font-medium text-gray-700">
                        {startTime} - {endTime}
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div>Cliente: {event.profiles?.nombre_completo}</div>
                      <div>Perro: {event.dogs?.nombre}</div>
                      <div className="flex justify-between">
                        <span>Duración: {duration}min</span>
                        {event.precio && <span className="font-medium">{displayPrice(event.services?.nombre, event.precio)}</span>}
                      </div>
                    </div>
                  </div>
                )
              }
            })
          )}
        </div>
      </div>
    )
  }

  const stats = getWeekStats()
  const bookingMatrix = createBookingMatrix()

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">Cargando calendario...</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-4 sm:space-y-6">
        {/* Header responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Ocupación de Espacios</h2>
            <p className="text-sm sm:text-base text-gray-600">Vista semanal de citas y disponibilidad</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              value={selectedSpace}
              onChange={(e) => setSelectedSpace(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">Todos los Espacios</option>
              <option value="rehabilitacion">Caseta de Rehabilitación</option>
              <option value="hidroterapia">Piscina (Hidroterapia)</option>
            </select>
            
            {/* Toggle vista móvil/desktop */}
            <div className="flex justify-center lg:hidden bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setViewMode('mobile')}
                className={`px-3 py-1 text-xs rounded transition-colors ${viewMode === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
              >
                Lista
              </button>
            </div>
          </div>
        </div>

        {/* Estadísticas responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalBookings}</div>
            <div className="text-xs sm:text-sm text-gray-600">Citas esta semana</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-xl sm:text-2xl font-bold text-green-600">€{stats.totalRevenue.toFixed(2)}</div>
            <div className="text-xs sm:text-sm text-gray-600">Ingresos estimados</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-xl sm:text-2xl font-bold text-purple-600">{stats.totalHours}h</div>
            <div className="text-xs sm:text-sm text-gray-600">Tiempo ocupado</div>
          </div>
        </div>

        {/* Navegación responsive */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <button 
              onClick={goToPreviousWeek} 
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded w-full sm:w-auto justify-center sm:justify-start transition-colors"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm sm:text-base">Anterior</span>
            </button>
            
            <div className="text-center">
              <h3 className="text-sm sm:text-lg font-semibold">
                Semana del {format(weekDays[0], 'd')} al {format(weekDays[6], 'd \'de\' MMMM yyyy', { locale: es })}
              </h3>
              <button 
                onClick={goToCurrentWeek} 
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 mt-1 transition-colors"
              >
                Ir a semana actual
              </button>
            </div>
            
            <button 
              onClick={goToNextWeek} 
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded w-full sm:w-auto justify-center sm:justify-start transition-colors"
            >
              <span className="text-sm sm:text-base">Siguiente</span>
              <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Leyenda responsive - CORREGIDA */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
          <h4 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Leyenda de Servicios</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <div className="flex items-center">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#FEF3C7', border: '2px solid #F59E0B' }}></div>
              <span className="ml-2 text-xs sm:text-sm">🏥 Rehabilitación</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#DBEAFE', border: '2px solid #3B82F6' }}></div>
              <span className="ml-2 text-xs sm:text-sm">💧 Hidroterapia</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#D1FAE5', border: '2px solid #10B981' }}></div>
              <span className="ml-2 text-xs sm:text-sm">🏥💧 Rehabilitación + Hidroterapia</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#F3E8FF', border: '2px solid #9333EA' }}></div>
              <span className="ml-2 text-xs sm:text-sm">🏠 Rehabilitación a Domicilio</span>
            </div>
          </div>
        </div>

        {/* Calendario - Vista adaptativa */}
        {viewMode === 'mobile' ? (
          // Vista móvil - Lista de días
          <div className="space-y-4">
            {weekDays.map(day => (
              <div key={day.toString()}>
                {renderMobileDayView(day)}
              </div>
            ))}
          </div>
        ) : (
          // Vista desktop - Estilo Google Calendar
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header del calendario */}
                <div className="flex bg-gray-50 border-b-2 border-gray-200">
                  {/* Columna vacía para alinear con horas */}
                  <div className="text-left text-xs sm:text-sm font-semibold text-gray-700 border-r border-gray-200 flex items-center justify-end pr-2" style={{ width: '60px', height: '60px' }}>
                    
                  </div>
                  {/* Headers de días */}
                  {weekDays.map(day => (
                    <div key={day.toString()} className="flex-1 text-center text-xs sm:text-sm font-semibold text-gray-700 border-r border-gray-200 flex flex-col items-center justify-center" style={{ height: '60px' }}>
                      <div className="capitalize">{format(day, 'EEEE', { locale: es })}</div>
                      <div className="text-xs text-gray-500 capitalize">{format(day, 'd MMM', { locale: es })}</div>
                    </div>
                  ))}
                </div>
                
                {/* Contenedor principal del calendario estilo Google */}
                <div className="flex">
                  {/* Columna de horas */}
                  <div className="flex flex-col border-r border-gray-200 bg-gray-50" style={{ width: '60px', height: `${timeSlots.length * HOUR_HEIGHT}px` }}>
                    {timeSlots.map((timeSlot, index) => (
                      <div 
                        key={timeSlot} 
                        className="flex items-center justify-center text-xs text-gray-600 border-b border-gray-100"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      >
                        {timeSlot}
                      </div>
                    ))}
                  </div>
                  
                  {/* Columnas de días */}
                  <div className="flex flex-1">
                    {weekDays.map(day => {
                      const dayKey = format(day, 'yyyy-MM-dd')
                      return renderDayColumn(day, dayKey)
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de detalles responsive */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Detalles de la Cita</h3>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Cliente</label>
                  <p className="text-gray-900">{selectedBooking.profiles?.nombre_completo}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Perro</label>
                  <p className="text-gray-900">{selectedBooking.dogs?.nombre}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Servicio</label>
                  <p className="text-gray-900 flex items-center">
                    <span className="mr-2">{getServiceIcon(selectedBooking.services?.tipo)}</span>
                    {selectedBooking.services?.nombre}
                  </p>
                  {selectedBooking.services?.tipo === 'rehabilitacion_domicilio' && (
                    <p className="text-xs text-purple-600 font-medium mt-1">Visita a domicilio</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Fecha</label>
                  <p className="text-gray-900">
                    {format(new Date(selectedBooking.fecha_hora.substring(0, 10)), 'EEEE d \'de\' MMMM yyyy', { locale: es })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Horario</label>
                  <p className="text-gray-900">
                    {selectedBooking.displayStartTime || selectedBooking.fecha_hora.substring(11, 16)} - {selectedBooking.displayEndTime || minutesToTime(
                      timeToMinutes(selectedBooking.fecha_hora.substring(11, 16)) + 
                      (selectedBooking.duracion_minutos || selectedBooking.services?.duracion_minutos || 30)
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Duración</label>
                  <p className="text-gray-900">{selectedBooking.duracion_minutos || selectedBooking.services?.duracion_minutos || 30} minutos</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Estado</label>
                  <p className="text-gray-900 capitalize">{selectedBooking.estado}</p>
                </div>
                {selectedBooking.precio && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Precio</label>
                    <p className="text-gray-900 font-semibold">{displayPrice(selectedBooking.services?.nombre, selectedBooking.precio)}</p>
                  </div>
                )}
                {selectedBooking.observaciones && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Observaciones</label>
                    <p className="text-gray-900 bg-gray-50 p-2 rounded text-sm">{selectedBooking.observaciones}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}