import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { format, addDays, startOfTomorrow, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { 
  generateFilteredTimeSlots, 
  timeToMinutes,
  minutesToTime,
  getBlockedTimeRange,        
  getRestTimeByServiceType,
  clearAvailableTimeSlotsCache,
  isTimeSlotBlocked,
  invalidateCacheAndNotify
} from '../../utils/bookingUtils'
import { useBookingNotifications } from '../NotificationProvider'
import { useNotifications } from '../../hooks/useNotifications'

export default function BookingSection({ onNavigateToSection }) {
  const { user, profile } = useAuth()
  const { notifyBookingConfirmed } = useBookingNotifications()
  const { notifyAdminNewBooking } = useNotifications()
  const [services, setServices] = useState([])
  const [userDogs, setUserDogs] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDog, setSelectedDog] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dayAvailability, setDayAvailability] = useState({})
  const [showCalendar, setShowCalendar] = useState(false)

  // FUNCIÓN: Obtener información de espacios según tipo de servicio
  const getSpaceInfo = (serviceType) => {
    switch (serviceType) {
      case 'hidroterapia_rehabilitacion':
        return {
          spaces: ['Caseta de Rehabilitación', 'Piscina (Hidroterapia/Aqua Agility)'],
          space_id: 1,
          display: 'Caseta de Rehabilitación + Piscina (Hidroterapia/Aqua Agility)'
        }
      case 'rehabilitacion':
        return {
          spaces: ['Caseta de Rehabilitación'],
          space_id: 1,
          display: 'Caseta de Rehabilitación'
        }
      case 'hidroterapia':
        return {
          spaces: ['Piscina (Hidroterapia/Aqua Agility)'],
          space_id: 2,
          display: 'Piscina (Hidroterapia/Aqua Agility)'
        }
      default:
        return {
          spaces: ['Espacio General'],
          space_id: 1,
          display: 'Espacio General'
        }
    }
  }

  // FUNCIONES MOVIDAS ARRIBA ANTES DE useEffect

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('activo', true)
        .neq('tipo', 'rehabilitacion_domicilio') // Excluir servicio a domicilio para clientes
        .order('id')

      if (error) throw error
      setServices(data)
    } catch (error) {
      console.error('Error loading services:', error)
      toast.error('Error cargando servicios')
    }
  }

  const loadUserDogs = async () => {
    try {
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('owner_id', user.id)
        .eq('activo', true)
        .order('nombre')

      if (error) throw error
      setUserDogs(data)
    } catch (error) {
      console.error('Error loading dogs:', error)
      toast.error('Error cargando perros')
    }
  }

  // Filtrar horarios del día actual con margen de 1.5h
  const filterTodaySlots = (slots, selectedDateStr) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    if (selectedDateStr !== today) return slots
    
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const minRequiredMinutes = currentMinutes + 90 // +1.5 horas
    
    return slots.filter(slot => {
      const [hours, minutes] = slot.split(':').map(Number)
      const slotMinutes = hours * 60 + minutes
      return slotMinutes >= minRequiredMinutes
    })
  }

  // Load day availability for calendar coloring
  const loadDayAvailability = async () => {
    if (!selectedService) return

    const startDate = startOfMonth(currentMonth)
    const endDate = endOfMonth(currentMonth)
    const availability = {}

    try {
      // Get all bookings for the month with service info
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          fecha_hora, 
          duracion_minutos,
          services!inner(tipo)
        `)
        .gte('fecha_hora', startDate.toISOString())
        .lte('fecha_hora', endDate.toISOString())
        .in('estado', ['pendiente'])

      if (bookingsError) throw bookingsError

      // Obtener visitas a domicilio para el mismo período
      const { data: homeVisits, error: homeVisitsError } = await supabase
        .from('bookings')
        .select(`
          fecha_hora, 
          duracion_minutos,
          services!inner(tipo)
        `)
        .gte('fecha_hora', startDate.toISOString())
        .lte('fecha_hora', endDate.toISOString())
        .in('estado', ['pendiente'])
        .eq('services.tipo', 'rehabilitacion_domicilio')

      if (homeVisitsError) throw homeVisitsError

      // Calculate availability for each day
      const days = eachDayOfInterval({ start: startDate, end: endDate })
      
      for (const day of days) {
        const dayStr = format(day, 'yyyy-MM-dd')
        
        if (isBefore(day, startOfDay(new Date()))) {
          availability[dayStr] = 'past'
          continue
        }

        const dayBookings = bookings.filter(booking => 
          booking.fecha_hora.substring(0, 10) === dayStr
        )

        const dayHomeVisits = homeVisits.filter(visit => 
          visit.fecha_hora.substring(0, 10) === dayStr
        )

        // Usar función que incluye filtro de admin
        let allSlots = await generateFilteredTimeSlots(selectedService, dayStr)
        
        // Aplicar el filtro para el día actual
        allSlots = filterTodaySlots(allSlots, dayStr)

        const availableSlots = allSlots.filter(slot => 
          !isTimeSlotBlocked(slot, dayBookings, dayHomeVisits, selectedService.duracion_minutos, selectedService.tipo)
        )

        if (availableSlots.length === 0) {
          availability[dayStr] = 'full' // Completely booked
        } else if (availableSlots.length < allSlots.length) {
          availability[dayStr] = 'partial' // Partially booked
        } else {
          availability[dayStr] = 'available' // Fully available
        }
      }

      setDayAvailability(availability)
    } catch (error) {
      console.error('Error loading day availability:', error)
    }
  }

  // FUNCIÓN CORREGIDA: Load available slots with proper filtering
  const loadAvailableSlots = async () => {
    setLoadingSlots(true)
    try {
      // 🚨 OBTENER RESERVAS FRESCAS DIRECTAMENTE DE BD
      const { data: freshBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          fecha_hora, 
          duracion_minutos,
          services!inner(tipo)
        `)
        .gte('fecha_hora', `${selectedDate}T00:00:00`)
        .lt('fecha_hora', `${selectedDate}T23:59:59`)
        .in('estado', ['pendiente'])
        
      if (bookingsError) {
        console.error('Error obteniendo reservas:', bookingsError)
        setAvailableSlots([])
        return
      }
      
      const centerBookings = freshBookings?.filter(b => b.services?.tipo !== 'rehabilitacion_domicilio') || []
      const homeVisits = freshBookings?.filter(b => b.services?.tipo === 'rehabilitacion_domicilio') || []
      
      // 🚨 PASAR RESERVAS REALES EN LUGAR DE ARRAYS VACÍOS
      const freshSlots = await generateFilteredTimeSlots(
        selectedService, 
        selectedDate, 
        centerBookings,  // ✅ Reservas reales del centro
        homeVisits       // ✅ Visitas reales a domicilio
      )
      
      // Aplicar filtro del día actual
      const filteredSlots = filterTodaySlots(freshSlots, selectedDate)
      setAvailableSlots(filteredSlots)
      
    } catch (error) {
      console.error('Error loading available slots:', error)
      toast.error('Error cargando horarios')
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  // Load services and user's dogs on mount
  useEffect(() => {
    loadServices()
    loadUserDogs()
  }, [])

  // Load day availability when service or month changes
  useEffect(() => {
    if (selectedService) {
      loadDayAvailability()
    }
  }, [selectedService, currentMonth])

  // Load available time slots when date changes
  useEffect(() => {
    if (selectedDate && selectedService) {
      loadAvailableSlots()
    }
  }, [selectedDate, selectedService])

  // Refresh automático de horarios cada 30 segundos
  useEffect(() => {
    if (!selectedDate || !selectedService) return
    
    const interval = setInterval(() => {
      loadAvailableSlots()
    }, 30000) // 30 segundos
    
    return () => clearInterval(interval)
  }, [selectedDate, selectedService])

  // CORREGIDO: Listener para actualizaciones en tiempo real
  useEffect(() => {
    const handleBookingUpdate = (event) => {
      const { dateString, timestamp } = event.detail
      
      console.log('📡 Recibida actualización de reserva:', { dateString, timestamp })
      
      // Si la actualización afecta la fecha seleccionada, recargar horarios
      if (selectedDate && (!dateString || dateString === selectedDate)) {
        console.log('🔄 Actualizando horarios por cambio de reserva')
        // Llamar la función directamente si hay fecha y servicio seleccionados
        if (selectedDate && selectedService) {
          loadAvailableSlots()
        }
      }
      
      // También recargar la disponibilidad del mes
      if (selectedService) {
        loadDayAvailability()
      }
    }
    
    // Escuchar eventos de actualización de reservas
    window.addEventListener('booking-updated', handleBookingUpdate)
    
    return () => {
      window.removeEventListener('booking-updated', handleBookingUpdate)
    }
  }, [selectedDate, selectedService]) // CORREGIDO: Solo estados en dependencias

  const handleServiceSelect = (service) => {
    setSelectedService(service)
    setSelectedTime('')
    setSelectedDate('')
    setAvailableSlots([])
    setShowCalendar(false)
  }

  const handleDateSelect = (date) => {
    const dayStr = format(date, 'yyyy-MM-dd')
    const availability = dayAvailability[dayStr]
    const isPastDay = isBefore(date, startOfDay(new Date()))
    
    // No permitir seleccionar días pasados o sin disponibilidad
    if (isPastDay || availability === 'full') {
      return
    }
    
    const dateStr = format(date, 'yyyy-MM-dd')
    setSelectedDate(dateStr)
    setSelectedTime('')
    setShowCalendar(false)
  }

  // Get day style with proper past day detection
  const getDayStyle = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const availability = dayAvailability[dayStr]
    
    let baseClasses = 'w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm border border-transparent rounded-md flex items-center justify-center transition-colors'
    
    const isPastDay = isBefore(day, startOfDay(new Date()))
    const isFullyBooked = availability === 'full'
    
    // Días pasados - deshabilitados
    if (isPastDay) {
      baseClasses += ' bg-gray-100 text-gray-400 cursor-not-allowed'
    } 
    // Días sin disponibilidad - deshabilitados (como días pasados)
    else if (isFullyBooked) {
      baseClasses += ' bg-gray-100 text-gray-400 cursor-not-allowed'
    } 
    // Días con cualquier tipo de disponibilidad - verde
    else if (availability === 'partial' || availability === 'available') {
      baseClasses += ' bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer'
    } 
    // Días sin información de disponibilidad - blanco/normal
    else {
      baseClasses += ' bg-white text-gray-700 hover:bg-gray-50 border-gray-200 cursor-pointer'
    }
    
    // Día seleccionado - azul (solo si no está deshabilitado)
    if (selectedDate && isSameDay(day, new Date(selectedDate)) && !isPastDay && !isFullyBooked) {
      baseClasses += ' !border-blue-500 !bg-blue-500 !text-white'
    }
    
    // Día actual - negrita
    if (isToday(day)) {
      baseClasses += ' font-bold'
    }
    
    return baseClasses
  }

  const handleAddDog = () => {
    if (onNavigateToSection) {
      onNavigateToSection('my-dogs')
      toast.success('Navegar a "Mis Perros" para añadir un nuevo perro')
    } else {
      toast.error('No se puede navegar a la sección de perros')
    }
  }

  // Función de envío con estado inicial 'pendiente'
  const handleSubmitBooking = async (e) => {
    e.preventDefault()
    
    if (!selectedService || !selectedDog || !selectedDate || !selectedTime) {
      toast.error('Por favor completa todos los campos obligatorios')
      return
    }

    setLoading(true)

    try {
      // 🚨 VALIDACIÓN SUPER FINAL - Verificar que el slot sigue disponible
      console.log('🔒 Verificación final de disponibilidad...')

      const { data: ultimateCheck, error: ultimateError } = await supabase
        .from('bookings')
        .select(`
          id, fecha_hora, duracion_minutos,
          services!inner(tipo)
        `)
        .gte('fecha_hora', `${selectedDate}T${selectedTime}:00`)
        .lte('fecha_hora', `${selectedDate}T${selectedTime}:59`)
        .in('estado', ['pendiente'])

      if (ultimateError) {
        console.error('Error en verificación final:', ultimateError)
        toast.error('Error verificando disponibilidad')
        setLoading(false)
        return
      }

      // Verificar si hay conflictos usando nuestra lógica corregida
      if (ultimateCheck && ultimateCheck.length > 0) {
        const isBlocked = isTimeSlotBlocked(
          selectedTime,
          ultimateCheck.filter(b => b.services?.tipo !== 'rehabilitacion_domicilio'),
          ultimateCheck.filter(b => b.services?.tipo === 'rehabilitacion_domicilio'),
          selectedService.duracion_minutos,
          selectedService.tipo
        )
        
        if (isBlocked) {
          toast.error('Este horario ya fue reservado por otro usuario. Selecciona otro horario.', {
            duration: 4000,
          })
          setSelectedTime('')
          await loadAvailableSlots() // Refrescar horarios
          setLoading(false)
          return
        }
      }

      const datetime = `${selectedDate}T${selectedTime}:00`
      const dogData = userDogs.find(dog => dog.id === parseInt(selectedDog))
      const spaceInfo = getSpaceInfo(selectedService.tipo)

      // USAR FUNCIÓN ATÓMICA - UNA SOLA LLAMADA
      const { data: result, error } = await supabase.rpc('create_booking_atomic', {
        p_client_id: user.id,
        p_dog_id: dogData.id,
        p_service_id: selectedService.id,
        p_space_id: spaceInfo.space_id,
        p_fecha_hora: datetime,
        p_duracion_minutos: selectedService.duracion_minutos,
        p_precio: selectedService.precio,
        p_observaciones: observaciones.trim() || null,
        p_spaces_display: spaceInfo.display,
        p_es_visita_domicilio: false,
        p_bloquea_centro: false,
        p_direccion_domicilio: null,
        p_hora_fin_domicilio: null
      })

      if (error) {
        console.error('Error calling atomic function:', error)
        toast.error('Error técnico al crear la reserva')
        return
      }

      // Verificar resultado de la función
      if (!result.success) {
        if (result.error_code === 'SLOT_CONFLICT') {
          toast.error('Este horario ya no está disponible. Selecciona otro horario.', {
            duration: 4000,
          })
          
          // Refrescar horarios disponibles
          await loadAvailableSlots()
          setSelectedTime('')
          return
        } else {
          toast.error(result.error || 'Error al crear la reserva')
          return
        }
      }

      // ÉXITO! La reserva se creó sin conflictos
      toast.success('¡Cita reservada correctamente!')

      // 🚨 INVALIDAR CACHE E INFORMAR A OTROS USUARIOS INMEDIATAMENTE
      invalidateCacheAndNotify(selectedDate)
      console.log('🚨 Notificación enviada a todos los usuarios sobre nueva reserva')

      // Enviar notificaciones (opcional - no bloquean el flujo)
      try {

        // Email al cliente
        await notifyBookingConfirmed({
          pet_name: dogData.nombre,
          service_name: selectedService.nombre,
          fecha: selectedDate,
          hora: selectedTime,
          duracion: selectedService.duracion_minutos.toString(),
          precio: selectedService.precio.toString()
        })

        // Email al admin
        await notifyAdminNewBooking({
          clientName: profile.nombre_completo,
          clientEmail: profile.email || user.email,
          dogName: dogData.nombre,
          service: selectedService.nombre,
          date: selectedDate,
          time: selectedTime,
          duration: selectedService.duracion_minutos.toString(),
          price: selectedService.precio.toString(),
          spaces: spaceInfo.display,
          observations: observaciones.trim() || null
        })
      } catch (emailError) {
        console.error('Error enviando notificaciones:', emailError)
        // No mostrar error al usuario - la reserva ya se creó exitosamente
      }

      // Reset form
      setSelectedService(null)
      setSelectedDog('')
      setSelectedDate('')
      setSelectedTime('')
      setObservaciones('')
      setAvailableSlots([])
      setShowCalendar(false)
      
    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error('Error inesperado. Inténtalo nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // Icono para servicios
  const getServiceIcon = (tipo) => {
    switch (tipo) {
      case 'rehabilitacion':
        return '🏥'
      case 'hidroterapia':
        return '💧'
      case 'hidroterapia_rehabilitacion':
        return '🏥💧'
      default:
        return '⚕️'
    }
  }

  // Calendar component - Completamente responsive
  const Calendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mt-2 shadow-sm max-w-full overflow-hidden">
        {/* Header del calendario */}
        <div className="flex justify-between items-center mb-4">
          <button
            type="button"
            onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
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
            onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Días del mes */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const isPastDay = isBefore(day, startOfDay(new Date()))
            const dayStr = format(day, 'yyyy-MM-dd')
            const availability = dayAvailability[dayStr]
            const isDisabled = isPastDay || availability === 'full'
            
            return (
              <button
                key={day.toString()}
                type="button"
                onClick={() => handleDateSelect(day)}
                disabled={isDisabled}
                className={getDayStyle(day)}
                title={
                  isPastDay 
                    ? 'Día pasado' 
                    : availability === 'full' 
                      ? 'Sin disponibilidad horaria' 
                      : availability === 'partial'
                        ? 'Disponibilidad limitada'
                        : 'Disponible'
                }
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
        
        {/* Leyenda actualizada */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 rounded" style={{backgroundColor: '#DCFCE7'}}></div>
              <span className="text-gray-600">Disponible</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 rounded"></div>
              <span className="text-gray-600">Sin horarios</span>
            </div>
            
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-6 sm:space-y-8">
        {/* BLOQUE DE CONSEJO */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-start space-x-2">
            <div className="text-amber-600 mt-0.5">⚡</div>
            <div className="flex-1">
              <p className="text-sm text-amber-800">
                <strong>Tip:</strong> Los horarios se reservan por orden de llegada. 
                Completa tu reserva rápidamente una vez seleccionada la hora.
              </p>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Reservar Cita</h2>
          <p className="text-sm sm:text-base text-gray-600">Selecciona el servicio y horario para tu perro</p>
        </div>

        {/* Info sobre visitas a domicilio */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
          <div className="flex">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-purple-800 text-sm sm:text-base">¿Necesitas una sesión a domicilio?</h3>
              <p className="text-purple-700 text-xs sm:text-sm mt-1">
                Las sesiones de rehabilitación a domicilio están disponibles bajo consulta. 
                <strong> Contacta con nosotros al </strong>
                <a 
                  href="https://wa.me/34676262863" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  676 26 28 63
                </a>{" "}
                para programar tu visita personalizada.
              </p>

            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">1. Selecciona el Servicio</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-4">
            {services.map((service) => {
              const spaceInfo = getSpaceInfo(service.tipo)
              
              return (
                <div
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className={`service-card p-4 sm:p-6 transition-all duration-300 min-w-0 relative overflow-hidden cursor-pointer ${selectedService?.id === service.id ? 'selected text-black' : 'text-gray-900'}`}
                >
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl mb-2 sm:mb-3 transition-all duration-300">
                      {getServiceIcon(service.tipo)}
                    </div>
                    <h4 className="font-semibold mb-2 text-sm sm:text-base truncate transition-colors duration-300 text-gray-900">
                      {service.nombre}
                    </h4>
                    <p className="text-xs sm:text-sm mb-3 transition-colors duration-300 text-gray-600">
                      Duración: {service.duracion_minutos} min
                    </p>

                    <p className="text-xs sm:text-sm mb-3 transition-colors duration-300 text-gray-600">
                      Precio: {service.precio} € IVA incluido
                    </p>
                    
                    {service.descripcion && (
                      <p className="text-xs mt-2 line-clamp-2 transition-colors duration-300 text-gray-500">
                        {service.descripcion}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {selectedService && (
          <form onSubmit={handleSubmitBooking} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  2. Selecciona tu Perro *
                </label>
                <select
                  value={selectedDog}
                  onChange={(e) => setSelectedDog(e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">Selecciona un perro...</option>
                  {userDogs.map((dog) => (
                    <option key={dog.id} value={dog.id}>
                      {dog.nombre} {dog.raza && `(${dog.raza})`}
                    </option>
                  ))}
                </select>
                {userDogs.length === 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    No tienes perros registrados. 
                    <button 
                      type="button" 
                      onClick={handleAddDog}
                      className="text-primary-600 hover:text-primary-500 ml-1 underline"
                    >
                      Añadir perro
                    </button>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  3. Selecciona la Fecha *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedDate ? format(new Date(selectedDate), 'dd/MM/yyyy') : ''}
                    readOnly
                    placeholder="Selecciona una fecha"
                    className="input cursor-pointer w-full"
                    onClick={() => setShowCalendar(!showCalendar)}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                
                {showCalendar && <Calendar />}
              </div>
            </div>

            {selectedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  4. Selecciona la Hora *
                </label>
                {loadingSlots ? (
                  <div className="flex justify-center py-8">
                    <div className="loading-spinner"></div>
                    <span className="ml-2 text-gray-600 text-sm">Cargando horarios disponibles...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                    {availableSlots.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setSelectedTime(time)}
                        className={`time-slot text-xs sm:text-sm py-2 px-2 ${selectedTime === time ? 'selected !text-black' : ''}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
                {!loadingSlots && availableSlots.length === 0 && selectedDate && (
                  <div className="text-amber-600 text-center py-4 bg-amber-50 rounded-lg">
                    <p className="text-sm font-medium">No hay horarios disponibles para esta fecha.</p>
                    <p className="text-xs mt-1">Esto puede deberse a citas programadas o visitas a domicilio.</p>
                    <p className="text-xs">Prueba con otra fecha.</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                5. Observaciones (opcional)
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="input resize-none w-full"
                placeholder="Información adicional sobre tu perro o la cita..."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !selectedService || !selectedDog || !selectedDate || !selectedTime}
                className="btn btn-primary btn-lg"
              >
                {loading ? (
                  <React.Fragment>
                    <div className="loading-spinner mr-2"></div>
                    Procesando...
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Solicitar Cita
                  </React.Fragment>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}