import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import { useBookingNotifications } from "../NotificationProvider";
import { useNotifications } from '../../hooks/useNotifications'
import { useRealtimeBookings, useRealtimeBookingUpdates } from '../../hooks/useRealtimeBookings' // ✅ NUEVA IMPORTACIÓN

import { 
  generateFilteredTimeSlots,
  timeToMinutes,
  minutesToTime,
  filterTodaySlots,
  getBlockedTimeRange,
  getRestTimeByServiceType,
  invalidateCacheAndNotify,
  isTimeSlotBlocked
} from '../../utils/bookingUtils'

export default function BookingsManagement() {
  const { forceUpdate } = useRealtimeBookings() // ✅ NUEVO: Activar realtime
  
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pendiente')
  const [dateFilter, setDateFilter] = useState('today')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [updating, setUpdating] = useState(new Set())
  const [viewMode, setViewMode] = useState('desktop')
  const { notifyBookingConfirmed, notifyBookingCanceled } = useBookingNotifications()
  const { notifyAdminCancellation } = useNotifications()
  const [selectedService, setSelectedService] = useState(null);


  // Estados para crear nueva cita
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])
  const [newBooking, setNewBooking] = useState({
    client_id: '',
    dog_id: '',
    service_id: '',
    fecha: '',
    hora: '',
    hora_inicio_domicilio: '',
    hora_fin_domicilio: '',
    direccion_domicilio: '',
    observaciones: ''
  })
  const [clientDogs, setClientDogs] = useState([])

  // Estados para modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState(null)

  // Estados para calendario
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const [availableSlots, setAvailableSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [dayAvailability, setDayAvailability] = useState({})
  const [endTimeSlots, setEndTimeSlots] = useState([])

  // ✅ NUEVA FUNCIÓN: Cargar reservas con callback para realtime
  const loadBookings = useCallback(async (skipLoadingState = false) => {
    try {
      if (!skipLoadingState) setLoading(true)
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          fecha_hora,
          duracion_minutos,
          precio,
          estado,
          observaciones,
          created_at,
          updated_at,
          services!inner(id, nombre, tipo, duracion_minutos, precio),
          dogs!inner(id, nombre, raza),
          profiles!bookings_client_id_fkey(id, nombre_completo, telefono, email),
          spaces(nombre)
        `)
        .order('fecha_hora', { ascending: false })

      if (error) throw error
      
      // ✅ ACTUALIZACIÓN SUAVE: Solo actualizar si hay cambios reales
      setBookings(prevBookings => {
        const bookingsChanged = JSON.stringify(prevBookings) !== JSON.stringify(data)
        if (bookingsChanged) {
          console.log(`📊 Admin - Reservas actualizadas: ${prevBookings.length} → ${data?.length || 0}`)
        }
        return data || []
      })
      
    } catch (error) {
      console.error('Error loading bookings:', error)
      if (!skipLoadingState) {
        toast.error('Error cargando citas')
      }
    } finally {
      if (!skipLoadingState) setLoading(false)
    }
  }, [])

  // ✅ NUEVO: Hook para responder a cambios realtime en bookings
  useRealtimeBookingUpdates(newBooking.fecha, selectedService, () => {
    // Recargar reservas sin loading state para evitar parpadeo
    loadBookings(true)
    
    // Si hay una fecha seleccionada en el formulario, recargar horarios
    if (newBooking.fecha && newBooking.service_id) {
      loadAvailableSlots(true) // Sin loading state
    }
    
    // Recargar disponibilidad del mes
    loadMonthAvailability()
  })

  useEffect(() => {
    loadBookings()
    loadClients()
    loadServices()
    
    // Detectar tamaño de pantalla
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'mobile' : 'desktop')
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [loadBookings])

  // Cargar opciones de hora fin cuando cambia hora inicio
  useEffect(() => {
    const loadEndTimes = async () => {
      if (newBooking.hora_inicio_domicilio && newBooking.fecha && isHomeVisitService()) {
        const slots = await getEndTimeSlots()
        setEndTimeSlots(slots)
      } else {
        setEndTimeSlots([])
      }
    }
    
    loadEndTimes()
  }, [newBooking.hora_inicio_domicilio, newBooking.fecha])

  // ✅ OPTIMIZADO: Refresh automático menos agresivo ya que tenemos realtime
  useEffect(() => {
    if (newBooking.fecha && newBooking.service_id) {
      const interval = setInterval(() => {
        loadAvailableSlots(true) // Sin loading state como backup
      }, 30000) // 30 segundos como backup del realtime
      
      return () => clearInterval(interval)
    }
  }, [newBooking.fecha, newBooking.service_id])

  // ✅ OPTIMIZADO: Refresh cuando admin vuelve a la ventana
  useEffect(() => {
    const handleFocus = () => {
      if (newBooking.fecha && newBooking.service_id) {
        console.log('🔄 Admin - refrescando horarios')
        loadAvailableSlots(true)
      }
      // También recargar bookings
      loadBookings(true)
    }
    
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [newBooking.fecha, newBooking.service_id, loadBookings])

  useEffect(() => {
    if (newBooking.client_id) {
      loadClientDogs(newBooking.client_id)
    }
  }, [newBooking.client_id])

  // Cargar disponibilidad del mes cuando cambian el mes, servicios o reservas
  useEffect(() => {
    loadMonthAvailability()
  }, [currentMonth, services, bookings])

  // ✅ LEGACY: Listener para actualizaciones (mantenido como fallback)
  useEffect(() => {
    const handleBookingUpdate = (event) => {
      const { dateString, timestamp } = event.detail
      
      console.log('📡 Admin recibió actualización de reserva (legacy):', { dateString, timestamp })
      
      // Recargar todas las reservas para mantener la vista actualizada
      loadBookings(true)
      
      // Si hay una fecha seleccionada en el formulario, recargar horarios
      if (newBooking.fecha && (!dateString || dateString === newBooking.fecha)) {
        loadAvailableSlots(true)
      }
      
      // Recargar disponibilidad del mes
      loadMonthAvailability()
    }
    
    // Escuchar eventos de actualización de reservas
    window.addEventListener('booking-updated', handleBookingUpdate)
    
    return () => {
      window.removeEventListener('booking-updated', handleBookingUpdate)
    }
  }, [newBooking.fecha, loadBookings])

  // Función para calcular la disponibilidad de los días del mes
  const calculateMonthAvailability = async (monthStart, monthEnd) => {
    try {
      const availability = {}
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
      
      // Obtener todas las reservas del mes
      const { data: monthBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          fecha_hora, 
          duracion_minutos,
          services!inner(tipo)
        `)
        .gte('fecha_hora', `${format(monthStart, 'yyyy-MM-dd')}T00:00:00`)
        .lt('fecha_hora', `${format(monthEnd, 'yyyy-MM-dd')}T23:59:59`)
        .in('estado', ['pendiente'])

      if (bookingsError) throw bookingsError

      // Obtener todos los slots configurados del mes
      const { data: configuredSlots, error: slotsError } = await supabase
        .from('available_time_slots')
        .select('*')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .eq('is_active', true)

      if (slotsError) throw slotsError

      // Procesar cada día
      for (const day of days) {
        const dayStr = format(day, 'yyyy-MM-dd')
        const isPastDay = isBefore(day, startOfDay(new Date()))
        
        // Los días pasados no se marcan como ocupados
        if (isPastDay) {
          availability[dayStr] = 'past'
          continue
        }

        // Obtener reservas del día
        const dayBookings = monthBookings?.filter(booking => 
          booking.fecha_hora.substring(0, 10) === dayStr
        ) || []

        // Obtener visitas a domicilio del día
        const dayHomeVisits = dayBookings.filter(booking => 
          booking.services?.tipo === 'rehabilitacion_domicilio'
        )

        // Obtener slots configurados para este día
        const dayConfiguredSlots = configuredSlots?.filter(slot => slot.date === dayStr) || []

        // Si no hay slots configurados, el día no está disponible
        if (dayConfiguredSlots.length === 0) {
          availability[dayStr] = 'unavailable'
          continue
        }

        // Verificar disponibilidad para cada servicio
        let hasAvailableSlots = false

        // Verificar para servicios normales (rehabilitación, hidroterapia, etc.)
        for (const service of services) {
          if (service.tipo === 'rehabilitacion_domicilio') continue
          
          try {
            // Usar la función existente para generar slots filtrados
            const availableSlots = await generateFilteredTimeSlots(
              service, 
              dayStr, 
              dayBookings, 
              dayHomeVisits
            )
            
            if (availableSlots.length > 0) {
              hasAvailableSlots = true
              break
            }
          } catch (error) {
            console.warn(`Error checking availability for service ${service.nombre} on ${dayStr}:`, error)
          }
        }

        availability[dayStr] = hasAvailableSlots ? 'available' : 'unavailable'

      }

      return availability
    } catch (error) {
      console.error('Error calculating month availability:', error)
      return {}
    }
  }

  // Función para cargar la disponibilidad del mes actual
  const loadMonthAvailability = async () => {
    if (services.length === 0) return // Esperar a que se carguen los servicios
    
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    
    const availability = await calculateMonthAvailability(monthStart, monthEnd)
    setDayAvailability(availability)
  }

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre_completo, email, telefono')
        .eq('role', 'cliente')
        .order('nombre_completo')

      if (error) throw error
      setClients(data)
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('activo', true)
        .order('nombre')

      if (error) throw error
      setServices(data)
    } catch (error) {
      console.error('Error loading services:', error)
    }
  }

  const loadClientDogs = async (clientId) => {
    try {
      const { data, error } = await supabase
        .from('dogs')
        .select('id, nombre, raza')
        .eq('owner_id', clientId)
        .eq('activo', true)
        .order('nombre')

      if (error) throw error
      setClientDogs(data)
    } catch (error) {
      console.error('Error loading client dogs:', error)
    }
  }

  // Verificar si es servicio a domicilio
  const isHomeVisitService = () => {
    const selectedService = services.find(s => s.id === parseInt(newBooking.service_id))
    return selectedService?.tipo === 'rehabilitacion_domicilio'
  }

  // Calcular duración y precio de visitas a domicilio
  const calculateHomeVisitData = () => {
    if (!newBooking.hora_inicio_domicilio || !newBooking.hora_fin_domicilio) {
      return { duracionMinutos: 0, precio: 0, error: null }
    }
    
    const inicioTotalMin = timeToMinutes(newBooking.hora_inicio_domicilio)
    const finTotalMin = timeToMinutes(newBooking.hora_fin_domicilio)
    
    if (finTotalMin <= inicioTotalMin) {
      return { duracionMinutos: 0, precio: 0, error: 'La hora de fin debe ser posterior a la de inicio' }
    }
    
    const duracionMinutos = finTotalMin - inicioTotalMin
    const duracionHoras = duracionMinutos / 60
    const precio = duracionHoras * 80 // €80 por hora
    
    return { duracionMinutos, precio, duracionHoras, error: null }
  }

  // Filtrar horas de fin basadas en hora de inicio Y slots configurados
  const getEndTimeSlots = async () => {
    if (!newBooking.hora_inicio_domicilio || !newBooking.fecha) return []
    
    try {
      // Obtener slots configurados para encontrar el rango válido
      const { data: configuredSlots, error } = await supabase
        .from('available_time_slots')
        .select('*')
        .eq('date', newBooking.fecha)
        .eq('is_active', true)
        .order('start_time')

      if (error) throw error

      const startMinutes = timeToMinutes(newBooking.hora_inicio_domicilio)
      const allEndSlots = []
      
      // Para cada slot configurado, verificar si contiene la hora de inicio
      configuredSlots.forEach(slot => {
        const slotStartMinutes = timeToMinutes(slot.start_time.substring(0, 5))
        const slotEndMinutes = timeToMinutes(slot.end_time.substring(0, 5))
        
        // Si la hora de inicio está dentro de este slot
        if (startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes) {
          // Generar opciones desde inicio+30min hasta fin del slot cada 5 minutos
          for (let minutes = startMinutes + 30; minutes <= slotEndMinutes; minutes += 5) {
            const timeString = minutesToTime(minutes)
            allEndSlots.push(timeString)
          }
        }
      })
      
      return allEndSlots.sort()
    } catch (error) {
      console.error('Error getting end time slots:', error)
      return []
    }
  }

  // ✅ OPTIMIZADA: Cargar horarios disponibles
  const loadAvailableSlots = useCallback(async (skipLoadingState = false) => {
    if (!skipLoadingState) setLoadingSlots(true)
    
    try {
      const selectedService = services.find(s => s.id === parseInt(newBooking.service_id))
      if (!selectedService) return
      
      // OBTENER RESERVAS FRESCAS DIRECTAMENTE (sin cache)
      const { data: freshBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          fecha_hora, 
          duracion_minutos,
          services!inner(tipo)
        `)
        .gte('fecha_hora', `${newBooking.fecha}T00:00:00`)
        .lt('fecha_hora', `${newBooking.fecha}T23:59:59`)
        .in('estado', ['pendiente'])
        
      if (bookingsError) {
        console.error('Admin error obteniendo reservas:', bookingsError)
        setAvailableSlots([])
        return
      }
      
      const centerBookings = freshBookings?.filter(b => b.services?.tipo !== 'rehabilitacion_domicilio') || []
      const homeVisits = freshBookings?.filter(b => b.services?.tipo === 'rehabilitacion_domicilio') || []
      
      console.log(`📊 Admin - Reservas del centro: ${centerBookings.length}, Visitas: ${homeVisits.length}`)
      
      // Usar función corregida con datos frescos
      const available = await generateFilteredTimeSlots(
        selectedService, 
        newBooking.fecha, 
        centerBookings,  // Datos frescos
        homeVisits       // Datos frescos
      )
      
      // ✅ ACTUALIZACIÓN SUAVE: Solo actualizar si hay cambios reales
      setAvailableSlots(prevSlots => {
        const slotsChanged = JSON.stringify(prevSlots) !== JSON.stringify(available)
        if (slotsChanged) {
          console.log(`✅ Admin - Horarios actualizados: ${prevSlots.length} → ${available.length}`)
        }
        return available
      })
      
    } catch (error) {
      console.error('Error loading available slots:', error)
      if (!skipLoadingState) {
        toast.error('Error cargando horarios disponibles')
      }
    } finally {
      if (!skipLoadingState) setLoadingSlots(false)
    }
  }, [newBooking.fecha, newBooking.service_id, services])

  const handleDateSelect = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    setNewBooking({...newBooking, fecha: dateStr, hora: ''})
    setShowCalendar(false)
  }

  // Get day style for calendar
  const getDayStyle = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const availability = dayAvailability[dayStr]
    
    let baseClasses = 'w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm border border-transparent rounded-md flex items-center justify-center cursor-pointer transition-colors'
    
    const isPastDay = isBefore(day, startOfDay(new Date()))
    
    if (isPastDay) {
      // Días pasados - gris claro
      baseClasses += ' bg-gray-100 text-gray-400 cursor-not-allowed'
    } else if (availability === 'available') {
      // Días con horarios configurados - VERDE
      baseClasses += ' bg-green-100 text-green-800 hover:bg-green-200 border-green-200'
    } else {
      // Días sin horarios configurados (unavailable, full, undefined) - GRIS
      baseClasses += ' bg-gray-100 text-gray-500 cursor-not-allowed'
    }
    
    // Día seleccionado
    const isSelected = newBooking.fecha && isSameDay(day, new Date(newBooking.fecha))
    if (isSelected && availability === 'available' && !isPastDay) {
      baseClasses += ' !border-blue-500 !bg-blue-500 !text-white'
    }
    
    // Día actual
    if (isToday(day)) {
      baseClasses += ' font-bold'
    }
    
    return baseClasses
  }

  // Componente de calendario responsive
  const AdminCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mt-2 shadow-sm max-w-full overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <button
            type="button"
            onClick={() => {
              setCurrentMonth(addDays(currentMonth, -30))
            }}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <button
            type="button"
            onClick={() => {
              setCurrentMonth(addDays(currentMonth, 30))
            }}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const availability = dayAvailability[dayStr]
            const isPastDay = isBefore(day, startOfDay(new Date()))
            const isFullyBooked = availability === 'full'
            const isUnavailable = availability === 'unavailable'
            
            return (
              <button
                key={day.toString()}
                type="button"
                onClick={() => {
                  // Solo permitir selección si el día no está en el pasado y no está completamente ocupado
                  if (!isPastDay && !isFullyBooked && !isUnavailable) {
                    handleDateSelect(day)
                  }
                }}
                disabled={isPastDay || isFullyBooked || isUnavailable}
                className={getDayStyle(day)}
                title={
                  isPastDay ? 'Día pasado' :
                  isFullyBooked ? 'Día completamente ocupado' :
                  isUnavailable ? 'Sin horarios configurados' :
                  'Disponible'
                }
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
        
        {/* Leyenda actualizada */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
              <span className="text-gray-600">Disponible</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 rounded"></div>
              <span className="text-gray-600">No Disponible</span>
            </div>
            
          </div>
        </div>
      </div>
    )
  }

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      setUpdating(prev => new Set(prev).add(bookingId))

      const { error } = await supabase
        .from('bookings')
        .update({ 
          estado: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

      if (error) throw error

      // AÑADIR EMAIL DE CANCELACIÓN SI ES CANCELACIÓN
      if (newStatus === 'cancelada') {
        try {
          const canceledBooking = bookings.find(b => b.id === bookingId)
          const cancelationData = {
            cliente_email: canceledBooking.profiles?.email,
            cliente_nombre: canceledBooking.profiles?.nombre_completo,
            pet_name: canceledBooking.dogs?.nombre,
            service_name: canceledBooking.services?.nombre,
            fecha: canceledBooking.fecha_hora.substring(0, 10),
            hora: canceledBooking.fecha_hora.substring(11, 16),
            motivo_cancelacion: 'Cancelación por parte del centro'
          }

          // Email al cliente
          await notifyBookingCanceled(cancelationData)
          
          // Email al admin
          await notifyAdminCancellation(cancelationData)
          
        } catch (emailError) {
          console.error('Error enviando emails de cancelación:', emailError)
          // No interrumpir el flujo si falla el email
        }
      }

      setBookings(prev => 
        prev.map(booking => 
          booking.id === bookingId 
            ? { ...booking, estado: newStatus, updated_at: new Date().toISOString() }
            : booking
        )
      )

      toast.success(`Cita ${newStatus === 'cancelada' ? 'cancelada' : 'actualizada'}`)
    } catch (error) {
      console.error('Error updating booking:', error)
      toast.error('Error actualizando cita')
    } finally {
      setUpdating(prev => {
        const newSet = new Set(prev)
        newSet.delete(bookingId)
        return newSet
      })
    }
  }

  const openDeleteModal = (booking) => {
    setBookingToDelete(booking)
    setShowDeleteModal(true)
  }

  const deleteBooking = async () => {
    if (!bookingToDelete) return

    try {
      setUpdating(prev => new Set(prev).add(bookingToDelete.id))

      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingToDelete.id)

      if (error) throw error

      setBookings(prev => prev.filter(booking => booking.id !== bookingToDelete.id))
      toast.success('Cita eliminada correctamente')
    } catch (error) {
      console.error('Error deleting booking:', error)
      toast.error('Error eliminando cita')
    } finally {
      setUpdating(prev => {
        const newSet = new Set(prev)
        newSet.delete(bookingToDelete.id)
        return newSet
      })
      setShowDeleteModal(false)
      setBookingToDelete(null)
    }
  }

  const createBooking = async (e) => {
    e.preventDefault()
    
    const isHomeVisit = isHomeVisitService()
    
    if (!newBooking.client_id || !newBooking.dog_id || !newBooking.service_id || !newBooking.fecha) {
      toast.error('Completa todos los campos obligatorios')
      return
    }

    // Validaciones específicas para cada tipo de servicio
    if (isHomeVisit) {
      if (!newBooking.hora_inicio_domicilio || !newBooking.hora_fin_domicilio || !newBooking.direccion_domicilio) {
        toast.error('Completa todos los campos obligatorios para visita a domicilio')
        return
      }
      
      const homeVisitData = calculateHomeVisitData()
      if (homeVisitData.error) {
        toast.error(homeVisitData.error)
        return
      }
      
      if (homeVisitData.duracionMinutos < 30) {
        toast.error('La duración mínima es de 30 minutos')
        return
      }
    } else {
      if (!newBooking.hora) {
        toast.error('Selecciona una hora')
        return
      }
    }

    try {
      setLoading(true)

      // VALIDACIÓN FINAL ANTES DE CREAR
      console.log('🔒 Admin - Verificación final de disponibilidad...')
      
      let targetTime
      const selectedService = services.find(s => s.id === parseInt(newBooking.service_id))
      const isHomeVisit = selectedService?.tipo === 'rehabilitacion_domicilio'
      
      if (isHomeVisit) {
        targetTime = newBooking.hora_inicio_domicilio
      } else {
        targetTime = newBooking.hora
      }
      
      const { data: adminUltimateCheck, error: adminUltimateError } = await supabase
        .from('bookings')
        .select(`
          id, fecha_hora, duracion_minutos,
          services!inner(tipo)
        `)
        .gte('fecha_hora', `${newBooking.fecha}T${targetTime}:00`)
        .lte('fecha_hora', `${newBooking.fecha}T${targetTime}:59`)
        .in('estado', ['pendiente'])

      if (adminUltimateError) {
        console.error('Admin error en verificación final:', adminUltimateError)
        toast.error('Error verificando disponibilidad')
        setLoading(false)
        return
      }

      if (adminUltimateCheck && adminUltimateCheck.length > 0) {
        const isBlocked = isTimeSlotBlocked(
          targetTime,
          adminUltimateCheck.filter(b => b.services?.tipo !== 'rehabilitacion_domicilio'),
          adminUltimateCheck.filter(b => b.services?.tipo === 'rehabilitacion_domicilio'),
          isHomeVisit ? (calculateHomeVisitData().duracionMinutos || selectedService.duracion_minutos) : selectedService.duracion_minutos,
          selectedService.tipo
        )
        
        if (isBlocked) {
          toast.error('Conflicto detectado: Este horario ya no está disponible', {
            duration: 4000,
          })
          await loadAvailableSlots() // Refrescar horarios
          setLoading(false)
          return
        }
      }
      
      const getSpaceForService = (serviceType) => {
        switch (serviceType) {
          case 'rehabilitacion_domicilio':
            return { space_id: null, spaces_display: 'Domicilio del Cliente' }
          case 'hidroterapia_rehabilitacion':
            return { space_id: 1, spaces_display: 'Caseta de Rehabilitación + Piscina (Hidroterapia)' }
          case 'rehabilitacion':
            return { space_id: 1, spaces_display: 'Caseta de Rehabilitación' }
          case 'hidroterapia':
            return { space_id: 2, spaces_display: 'Piscina (Hidroterapia)' }
          default:
            return { space_id: 1, spaces_display: 'Espacio General' }
        }
      }

      const spaceInfo = getSpaceForService(selectedService.tipo)
      
      let datetime, duracionMinutos, precio
      
      if (isHomeVisit) {
        // Para visitas a domicilio, usar hora de inicio y duración calculada
        datetime = `${newBooking.fecha}T${newBooking.hora_inicio_domicilio}:00`
        const homeVisitData = calculateHomeVisitData()
        duracionMinutos = homeVisitData.duracionMinutos
        precio = homeVisitData.precio
      } else {
        // Para servicios normales
        datetime = `${newBooking.fecha}T${newBooking.hora}:00`
        duracionMinutos = selectedService.duracion_minutos
        precio = selectedService.precio
      }
      
      const bookingData = {
        client_id: newBooking.client_id,
        dog_id: parseInt(newBooking.dog_id),
        service_id: parseInt(newBooking.service_id),
        space_id: spaceInfo.space_id,
        fecha_hora: datetime,
        duracion_minutos: duracionMinutos,
        precio: precio,
        observaciones: newBooking.observaciones.trim() || null,
        estado: 'pendiente',
        spaces_display: spaceInfo.spaces_display,
        ...(isHomeVisit && {
          es_visita_domicilio: true,
          bloquea_centro: true,
          direccion_domicilio: newBooking.direccion_domicilio.trim(),
          hora_fin_domicilio: newBooking.hora_fin_domicilio
        })
      }

      // USAR FUNCIÓN ATÓMICA
      const { data: result, error } = await supabase.rpc('create_booking_atomic', {
        p_client_id: newBooking.client_id,
        p_dog_id: parseInt(newBooking.dog_id),
        p_service_id: parseInt(newBooking.service_id),
        p_space_id: spaceInfo.space_id,
        p_fecha_hora: datetime,
        p_duracion_minutos: duracionMinutos,
        p_precio: precio,
        p_observaciones: newBooking.observaciones.trim() || null,
        p_spaces_display: spaceInfo.spaces_display,
        p_es_visita_domicilio: isHomeVisit,
        p_bloquea_centro: isHomeVisit,
        p_direccion_domicilio: isHomeVisit ? newBooking.direccion_domicilio.trim() : null,
        p_hora_fin_domicilio: isHomeVisit ? newBooking.hora_fin_domicilio : null
      })

      if (error) {
        console.error('Error calling atomic function:', error)
        toast.error('Error técnico al crear la cita')
        return
      }

      if (!result.success) {
        if (result.error_code === 'SLOT_CONFLICT') {
          toast.error('Conflicto detectado: Este horario ya no está disponible')
        } else {
          toast.error(result.error || 'Error al crear la cita')
        }
        return
      }

      // ÉXITO
      toast.success('Cita creada correctamente')

      // INVALIDAR CACHE E INFORMAR INMEDIATAMENTE
      invalidateCacheAndNotify(newBooking.fecha)
      console.log('🚨 Admin notificó nueva reserva a todos los usuarios')

      // ENVIAR EMAIL DE CONFIRMACIÓN AL CLIENTE
      try {
        const selectedClient = clients.find(c => c.id === newBooking.client_id)
        const selectedDog = clientDogs.find(d => d.id === parseInt(newBooking.dog_id))
        
        let timeDisplay
        if (isHomeVisit) {
          timeDisplay = `${newBooking.hora_inicio_domicilio} - ${newBooking.hora_fin_domicilio}`
        } else {
          timeDisplay = newBooking.hora
        }
        
        await notifyBookingConfirmed({
          pet_name: selectedDog?.nombre,
          service_name: selectedService?.nombre,
          fecha: newBooking.fecha,
          hora: timeDisplay,
          duracion: duracionMinutos.toString(),
          precio: precio.toString(),
          client_email: selectedClient?.email,
          client_name: selectedClient?.nombre_completo
        })
        
      } catch (emailError) {
        console.error('Error enviando email de confirmación:', emailError)
      }

      // LIMPIAR FORMULARIO Y RECARGAR
      setShowCreateModal(false)
      setNewBooking({
        client_id: '',
        dog_id: '',
        service_id: '',
        fecha: '',
        hora: '',
        hora_inicio_domicilio: '',
        hora_fin_domicilio: '',
        direccion_domicilio: '',
        observaciones: ''
      })
      setClientDogs([])
      setAvailableSlots([])
      await loadBookings()

    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error('Error inesperado al crear la cita')
    } finally {
      setLoading(false)
    }
  }

  const getFilteredBookings = () => {
    let filtered = bookings

    if (filter !== 'all') {
      filtered = filtered.filter(booking => booking.estado === filter)
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      filtered = filtered.filter(booking => {
        const bookingDate = new Date(booking.fecha_hora)
        
        switch (dateFilter) {
          case 'today':
            return bookingDate >= today && bookingDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
            return bookingDate >= weekAgo
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
            return bookingDate >= monthAgo
          default:
            return true
        }
      })
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(booking =>
        booking.profiles?.nombre_completo?.toLowerCase().includes(term) ||
        booking.dogs?.nombre?.toLowerCase().includes(term) ||
        booking.services?.nombre?.toLowerCase().includes(term) ||
        booking.profiles?.email?.toLowerCase().includes(term)
      )
    }

    return filtered
  }

  const getStatusBadge = (estado) => {
    const statusClasses = {
      pendiente: 'bg-yellow-100 text-yellow-800',
      completada: 'bg-green-100 text-green-800',
      cancelada: 'bg-red-100 text-red-800'
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[estado] || 'bg-gray-100 text-gray-800'}`}>
        {estado}
      </span>
    )
  }

  const getServiceIcon = (tipo) => {
    switch (tipo) {
      case 'rehabilitacion':
        return '🏥'
      case 'hidroterapia':
        return '💧'
      case 'hidroterapia_rehabilitacion':
        return '🏥💧'
      case 'rehabilitacion_domicilio':
        return '🏠'
      default:
        return '⚕️'
    }
  }

  // Renderizar vista móvil de citas como cards
  const renderMobileBookingCard = (booking) => (
    <div key={booking.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center mb-1">
            <span className="text-lg mr-2">{getServiceIcon(booking.services?.tipo)}</span>
            <h3 className="font-medium text-gray-900 text-sm">{booking.services?.nombre}</h3>
          </div>
          {getStatusBadge(booking.estado)}
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">
            {format(new Date(booking.fecha_hora.substring(0, 10)), 'dd/MM/yyyy')}
          </div>
          <div className="text-sm text-gray-600">
            {booking.fecha_hora.substring(11, 16)} ({booking.duracion_minutos}min)
          </div>
        </div>
      </div>
      
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Cliente:</span>
          <span className="font-medium text-gray-900">{booking.profiles?.nombre_completo}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Perro:</span>
          <span className="text-gray-900">{booking.dogs?.nombre}</span>
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        {(booking.estado === 'pendiente') && (
          <button
            onClick={() => updateBookingStatus(booking.id, 'cancelada')}
            disabled={updating.has(booking.id)}
            className="text-red-600 hover:text-red-900 disabled:opacity-50 p-1"
            title="Cancelar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        <button
          onClick={() => setSelectedBooking(booking)}
          className="text-blue-600 hover:text-blue-900 p-1"
          title="Ver detalles"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>
    </div>
  )

  const filteredBookings = getFilteredBookings()

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">Cargando citas...</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-4 sm:space-y-6">
        {/* Header responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Gestión de Citas</h2>
            <p className="text-sm sm:text-base text-gray-600">Administra todas las citas del sistema</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-white px-4 py-2 rounded-md flex items-center justify-center sm:justify-start hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#2563EB' }}
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nueva Cita
          </button>
        </div>

        {/* Filtros responsive */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="completada">Completadas</option>
                <option value="cancelada">Canceladas</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">Todas las fechas</option>
                <option value="today">Hoy</option>
                <option value="week">Última semana</option>
                <option value="month">Último mes</option>
              </select>
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cliente, perro, servicio o email..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          
          {/* Toggle vista móvil/desktop */}
          <div className="mt-3 sm:hidden flex bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('mobile')}
              className={`flex-1 px-3 py-1 text-xs rounded ${viewMode === 'mobile' ? 'bg-white shadow' : ''}`}
            >
              Lista
            </button>
          </div>
        </div>

        {/* Estadísticas responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">{bookings.filter(b => b.estado === 'pendiente').length}</div>
            <div className="text-xs sm:text-sm text-gray-600">Pendientes</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-lg sm:text-2xl font-bold text-gray-600">{bookings.filter(b => b.estado === 'completada').length}</div>
            <div className="text-xs sm:text-sm text-gray-600">Completadas</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-lg sm:text-2xl font-bold text-red-600">{bookings.filter(b => b.estado === 'cancelada').length}</div>
            <div className="text-xs sm:text-sm text-gray-600">Canceladas</div>
          </div>
        </div>

        {/* Lista de citas - Vista adaptativa */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-4 sm:px-6 py-4 border-b">
            <h3 className="text-base sm:text-lg font-semibold">
              Citas ({filteredBookings.length})
            </h3>
          </div>
          
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-4xl mb-2">📅</div>
              <h4 className="text-lg font-medium text-gray-900">No se encontraron citas</h4>
              <p className="text-gray-600">Ajusta los filtros o crea una nueva cita</p>
            </div>
          ) : viewMode === 'mobile' ? (
            // Vista móvil - Cards
            <div className="p-4 space-y-4">
              {filteredBookings.map(renderMobileBookingCard)}
            </div>
          ) : (
            // Vista desktop - Tabla responsive
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Perro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Servicio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {format(new Date(booking.fecha_hora.substring(0, 10)), 'dd/MM/yyyy', { locale: es })}
                          </div>
                          <div className="text-sm text-gray-500">
                            {booking.fecha_hora.substring(11, 16)} ({booking.duracion_minutos}min)
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {booking.profiles?.nombre_completo}
                          </div>
                          <div className="text-sm text-gray-500">
                            {booking.profiles?.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {booking.dogs?.nombre}
                          {booking.dogs?.raza && (
                            <div className="text-xs text-gray-500">{booking.dogs.raza}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">
                            {getServiceIcon(booking.services?.tipo)}
                          </span>
                          <div className="text-sm text-gray-900">
                            {booking.services?.nombre}
                            {booking.services?.tipo === 'rehabilitacion_domicilio' && (
                              <div className="text-xs text-purple-600 font-medium">A domicilio</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(booking.estado)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {(booking.estado === 'pendiente') && (
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'cancelada')}
                              disabled={updating.has(booking.id)}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Cancelar"
                            >
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Ver detalles"
                          >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL CREAR CITA RESPONSIVE */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Nueva Cita</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* FORMULARIO RESPONSIVE */}
              <form onSubmit={createBooking} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cliente *
                    </label>
                    <select
                      value={newBooking.client_id}
                      onChange={(e) => {
                        setNewBooking({...newBooking, client_id: e.target.value, dog_id: ''})
                        setClientDogs([])
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Selecciona un cliente</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.nombre_completo} - {client.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Perro *
                    </label>
                    <select
                      value={newBooking.dog_id}
                      onChange={(e) => setNewBooking({...newBooking, dog_id: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      required
                      disabled={!newBooking.client_id}
                    >
                      <option value="">Selecciona un perro</option>
                      {clientDogs.map(dog => (
                        <option key={dog.id} value={dog.id}>
                          {dog.nombre} {dog.raza && `(${dog.raza})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servicio *
                  </label>
                  <select
                    value={newBooking.service_id}
                    onChange={(e) => {
                      setNewBooking({
                        ...newBooking, 
                        service_id: e.target.value, 
                        hora: '', 
                        hora_inicio_domicilio: '', 
                        hora_fin_domicilio: '',
                        direccion_domicilio: ''
                      })
                      setEndTimeSlots([])
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Selecciona un servicio</option>
                    {services.map(service => (
                      <option key={service.id} value={service.id}>
                        {getServiceIcon(service.tipo)} {service.nombre}
                        {service.tipo === 'rehabilitacion_domicilio' ? '/hora' : ` - ${service.duracion_minutos}min`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newBooking.fecha ? format(new Date(newBooking.fecha), 'dd/MM/yyyy') : ''}
                      readOnly
                      placeholder="Selecciona una fecha"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 cursor-pointer text-sm"
                      onClick={() => setShowCalendar(!showCalendar)}
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  
                  {showCalendar && <AdminCalendar />}
                </div>

                {/* Formulario condicional según tipo de servicio */}
                {isHomeVisitService() ? (
                  // Formulario para visitas a domicilio
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hora de Inicio *
                        </label>
                        <select
                          value={newBooking.hora_inicio_domicilio}
                          onChange={(e) => setNewBooking({...newBooking, hora_inicio_domicilio: e.target.value, hora_fin_domicilio: ''})}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          required
                        >
                          <option value="">Selecciona hora</option>
                          {newBooking.fecha && newBooking.service_id ? (
                            loadingSlots ? (
                              <option disabled>Cargando...</option>
                            ) : (
                              availableSlots.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))
                            )
                          ) : (
                            <option disabled>Selecciona fecha y servicio primero</option>
                          )}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hora de Fin *
                        </label>
                        <select
                          value={newBooking.hora_fin_domicilio}
                          onChange={(e) => setNewBooking({...newBooking, hora_fin_domicilio: e.target.value})}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          required
                          disabled={!newBooking.hora_inicio_domicilio}
                        >
                          <option value="">Selecciona hora fin</option>
                          {endTimeSlots.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Mostrar duración y precio calculados */}
                    {newBooking.hora_inicio_domicilio && newBooking.hora_fin_domicilio && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        {(() => {
                          const homeVisitData = calculateHomeVisitData()
                          return homeVisitData.error ? (
                            <p className="text-red-600 text-sm">{homeVisitData.error}</p>
                          ) : (
                            <div className="text-sm">
                              <p className="font-medium text-blue-800">
                                Duración: {homeVisitData.duracionHoras}h ({homeVisitData.duracionMinutos} min)
                              </p>
                              <p className="font-semibold text-green-700">
                                Precio: €{homeVisitData.precio.toFixed(2)}
                              </p>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dirección del Domicilio *
                      </label>
                      <textarea
                        value={newBooking.direccion_domicilio}
                        onChange={(e) => setNewBooking({...newBooking, direccion_domicilio: e.target.value})}
                        rows={2}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        placeholder="Calle, número, piso, código postal, ciudad..."
                        required
                      />
                    </div>
                  </>
                ) : (
                  // Formulario para servicios normales (botones como antes)
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      Hora *
                    </label>
                    {newBooking.fecha && newBooking.service_id ? (
                      loadingSlots ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="loading-spinner mr-2"></div>
                          <span className="text-sm text-gray-600">Cargando horarios disponibles...</span>
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <div className="text-amber-600 text-center py-8 bg-amber-50 rounded-lg">
                          <p className="text-sm font-medium">No hay horarios disponibles para esta fecha.</p>
                          <p className="text-xs mt-1">Esto puede deberse a citas programadas o visitas a domicilio.</p>
                          <p className="text-xs">Prueba con otra fecha.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                          {availableSlots.map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => setNewBooking({...newBooking, hora: time})}
                              className={`py-2 px-3 text-sm rounded-md border transition-colors ${
                                newBooking.hora === time
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Selecciona fecha y servicio primero</p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observaciones
                  </label>
                  <textarea
                    value={newBooking.observaciones}
                    onChange={(e) => setNewBooking({...newBooking, observaciones: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Información adicional..."
                  />
                </div>

                {/* BOTONES RESPONSIVE */}
                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {loading ? 'Creando...' : 'Crear Cita'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal detalles cita responsive */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Detalles de la Cita</h3>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Cliente</label>
                    <p className="text-gray-900">{selectedBooking.profiles?.nombre_completo}</p>
                    <p className="text-sm text-gray-600">{selectedBooking.profiles?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Perro</label>
                    <p className="text-gray-900">{selectedBooking.dogs?.nombre}</p>
                    {selectedBooking.dogs?.raza && (
                      <p className="text-sm text-gray-600">{selectedBooking.dogs.raza}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Fecha y Hora</label>
                    <p className="text-gray-900">
                      {format(new Date(selectedBooking.fecha_hora.substring(0, 10)), 'EEEE d \'de\' MMMM \'de\' yyyy', { locale: es })}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedBooking.fecha_hora.substring(11, 16)} ({selectedBooking.duracion_minutos} minutos)
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Estado</label>
                    <div className="mt-1">
                      {getStatusBadge(selectedBooking.estado)}
                    </div>
                  </div>
                </div>
                
                {selectedBooking.observaciones && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Observaciones</label>
                    <p className="text-gray-900 bg-gray-50 p-2 rounded text-sm">
                      {selectedBooking.observaciones}
                    </p>
                  </div>
                )}
                
                <div className="text-xs text-gray-500 border-t pt-2">
                  <p>Creada: {format(parseISO(selectedBooking.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  {selectedBooking.updated_at !== selectedBooking.created_at && (
                    <p>Actualizada: {format(parseISO(selectedBooking.updated_at), 'dd/MM/yyyy HH:mm')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación */}
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setBookingToDelete(null)
          }}
          onConfirm={deleteBooking}
          title="Eliminar Cita"
          message="¿Estás seguro que quieres eliminar esta cita? Esta acción no se puede deshacer."
          confirmText="Eliminar"
          cancelText="Cancelar"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
      </div>
    </div>
  )
}