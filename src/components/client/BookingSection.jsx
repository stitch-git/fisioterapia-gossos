import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { format, addDays, startOfTomorrow, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, startOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { es, ca } from 'date-fns/locale'
import {
  generateFilteredTimeSlots,
  timeToMinutes,
  minutesToTime,
  getBlockedTimeRange,
  getRestTimeByServiceType,
  clearAvailableTimeSlotsCache,
  isTimeSlotBlocked,
  invalidateCacheAndNotify,
  requiresAdminConfirmation
} from '../../utils/bookingUtils'
import { useBookingNotifications } from '../NotificationProvider'
import { useNotifications } from '../../hooks/useNotifications'
import { useRealtimeBookings, useRealtimeBookingUpdates } from '../../hooks/useRealtimeBookings'
import { useRealtimeAdminSlots } from '../../hooks/useRealtimeAdminSlots'
import { useTranslation } from 'react-i18next'

export default function BookingSection({ onNavigateToSection }) {
  const { user, profile } = useAuth()
  const { notifyBookingConfirmed } = useBookingNotifications()
  const { notifyAdminNewBooking, sendPendingConfirmationEmail, sendAdminPendingConfirmationEmail } = useNotifications()
  const { t, i18n } = useTranslation()
  const getDateLocale = () => i18n.language === 'ca' ? ca : es
  
  const { forceUpdate } = useRealtimeBookings()
  
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
  
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dayAvailability, setDayAvailability] = useState({})
  const [showCalendar, setShowCalendar] = useState(false)
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [monthAvailabilityCache, setMonthAvailabilityCache] = useState({})

  const getSpaceInfo = (serviceType) => {
    switch (serviceType) {
      case 'hidroterapia_rehabilitacion':
        return {
          spaces: [t('bookingSection.spaces.rehabCabin'), t('bookingSection.spaces.pool')],
          space_id: 1,
          display: t('bookingSection.spaces.rehabCabinPool')
        }
      case 'rehabilitacion':
        return {
          spaces: [t('bookingSection.spaces.rehabCabin')],
          space_id: 1,
          display: t('bookingSection.spaces.rehabCabin')
        }
      case 'hidroterapia':
        return {
          spaces: [t('bookingSection.spaces.pool')],
          space_id: 2,
          display: t('bookingSection.spaces.pool')
        }
      default:
        return {
          spaces: [t('bookingSection.spaces.general')],
          space_id: 1,
          display: t('bookingSection.spaces.general')
        }
    }
  }

  const getServiceDescription = (service) => {
    const lang = i18n.language // 'ca' o 'es'
    return service[`descripcion_${lang}`] || service.descripcion || ''
  }

  const getServiceName = (service) => {
    const lang = i18n.language // 'ca' o 'es'
    return service[`nombre_${lang}`] || service.nombre || ''
  }

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, nombre, nombre_ca, nombre_es, tipo, duracion_minutos, precio, descripcion, descripcion_ca, descripcion_es, activo')
        .eq('activo', true)
        .neq('tipo', 'rehabilitacion_domicilio')
        .order('id')

      if (error) throw error
      setServices(data)
    } catch (error) {
      console.error('Error loading services:', error)
      toast.error(t('bookingSection.toasts.loadingServices'))
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
      toast.error(t('bookingSection.toasts.loadingDogs'))
    }
  }

  const filterTodaySlots = (slots, selectedDateStr) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    if (selectedDateStr !== today) return slots
    
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const minRequiredMinutes = currentMinutes + 120 // ✅ + 2 horas (unificado con bookingUtils.js)
    
    return slots.filter(slot => {
      const [hours, minutes] = slot.split(':').map(Number)
      const slotMinutes = hours * 60 + minutes
      return slotMinutes >= minRequiredMinutes
    })
  }

  const loadDayAvailability = useCallback(async (monthDate = currentMonth) => {
    if (!selectedService) return

    const monthKey = format(monthDate, 'yyyy-MM')
    
    if (monthAvailabilityCache[monthKey]) {
      console.log(`📦 Cache hit para ${monthKey}`)
      setDayAvailability(monthAvailabilityCache[monthKey])
      return
    }

    setLoadingCalendar(true)
    const startDate = startOfMonth(monthDate)
    const endDate = endOfMonth(monthDate)
    const availability = {}

    try {
      const { data: allBookings, error: bookingsError } = await supabase
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

      const { data: configuredSlots, error: slotsError } = await supabase
        .from('available_time_slots')
        .select('date, start_time, end_time')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .eq('is_active', true)

      if (slotsError) throw slotsError

      const bookingsByDate = {}
      const slotsByDate = {}
      
      allBookings?.forEach(booking => {
        const dateKey = booking.fecha_hora.substring(0, 10)
        if (!bookingsByDate[dateKey]) bookingsByDate[dateKey] = []
        bookingsByDate[dateKey].push(booking)
      })

      configuredSlots?.forEach(slot => {
        if (!slotsByDate[slot.date]) slotsByDate[slot.date] = []
        slotsByDate[slot.date].push(slot)
      })

      const days = eachDayOfInterval({ start: startDate, end: endDate })
      
      for (const day of days) {
        const dayStr = format(day, 'yyyy-MM-dd')
        
        if (isBefore(day, startOfDay(new Date()))) {
          availability[dayStr] = 'past'
          continue
        }

        const daySlots = slotsByDate[dayStr] || []
        
        if (daySlots.length === 0) {
          availability[dayStr] = 'full'
          continue
        }

        const dayBookings = bookingsByDate[dayStr] || []
        const centerBookings = dayBookings.filter(b => b.services?.tipo !== 'rehabilitacion_domicilio')
        const homeVisits = dayBookings.filter(b => b.services?.tipo === 'rehabilitacion_domicilio')

        const allSlots = await generateFilteredTimeSlots(
          selectedService, 
          dayStr,
          centerBookings,
          homeVisits
        )
        
        const filteredSlots = filterTodaySlots(allSlots, dayStr)

        if (filteredSlots.length === 0) {
          availability[dayStr] = 'full'
        } else if (filteredSlots.length < allSlots.length) {
          availability[dayStr] = 'partial'
        } else {
          availability[dayStr] = 'available'
        }
      }

      setMonthAvailabilityCache(prev => ({
        ...prev,
        [monthKey]: availability
      }))
      
      setDayAvailability(availability)
      console.log(`✅ Disponibilidad calculada para ${monthKey}`)
      
    } catch (error) {
      console.error('Error loading day availability:', error)
    } finally {
      setLoadingCalendar(false)
    }
  }, [selectedService, currentMonth, monthAvailabilityCache])

  const loadAvailableSlots = useCallback(async (skipLoadingState = false) => {
    if (!skipLoadingState) setLoadingSlots(true)
    
    try {
      clearAvailableTimeSlotsCache(selectedDate)
      console.log(`🔄 Cache invalidado para ${selectedDate}`)

      const { data: freshBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          fecha_hora, 
          duracion_minutos,
          estado,
          created_at,
          services!inner(tipo, nombre)
        `)
        .gte('fecha_hora', `${selectedDate}T00:00:00`)
        .lt('fecha_hora', `${selectedDate}T23:59:59`)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })

      console.log(`📊 Reservas encontradas para ${selectedDate}:`, freshBookings?.length || 0)
      if (freshBookings && freshBookings.length > 0) {
        freshBookings.forEach(booking => {
          console.log(`   - ${booking.fecha_hora.substring(11, 16)} (${booking.services?.tipo}) ID:${booking.id}`)
        })
      }
        
      if (bookingsError) {
        console.error('Error obteniendo reservas:', bookingsError)
        setAvailableSlots([])
        return
      }
      
      const centerBookings = freshBookings?.filter(b => b.services?.tipo !== 'rehabilitacion_domicilio') || []
      const homeVisits = freshBookings?.filter(b => b.services?.tipo === 'rehabilitacion_domicilio') || []
      
      const freshSlots = await generateFilteredTimeSlots(
        selectedService, 
        selectedDate, 
        centerBookings,
        homeVisits
      )
      
      const filteredSlots = filterTodaySlots(freshSlots, selectedDate)
      
      setAvailableSlots(prevSlots => {
        const slotsChanged = JSON.stringify(prevSlots) !== JSON.stringify(filteredSlots)
        if (slotsChanged) {
          console.log(`🎯 Horarios actualizados: ${prevSlots.length} → ${filteredSlots.length}`)
        }
        return filteredSlots
      })
      
    } catch (error) {
      console.error('Error loading available slots:', error)
      toast.error(t('bookingSection.toasts.loadingSlots'))
      setAvailableSlots([])
    } finally {
      if (!skipLoadingState) setLoadingSlots(false)
    }
  }, [selectedDate, selectedService, t])

  useRealtimeBookingUpdates(selectedDate, selectedService, () => {
    const monthKey = format(currentMonth, 'yyyy-MM')
    setMonthAvailabilityCache(prev => {
      const newCache = { ...prev }
      delete newCache[monthKey]
      return newCache
    })
    
    loadAvailableSlots(true)
    
    if (selectedService) {
      loadDayAvailability(currentMonth)
    }
  })

  // 🆕 Escuchar cambios en configuración de horarios del admin
  useRealtimeAdminSlots(({ date, eventType }) => {
    console.log('🔔 [CLIENT] Admin cambió horarios:', { date, eventType })
    
    // Limpiar cache de configuración admin
    clearAvailableTimeSlotsCache()
    
    // Si afecta la fecha seleccionada, recargar slots
    if (selectedDate && date === selectedDate) {
      loadAvailableSlots(true)
    }
    
    // Limpiar cache del mes y recargar calendario
    const monthKey = format(currentMonth, 'yyyy-MM')
    setMonthAvailabilityCache(prev => {
      const newCache = { ...prev }
      delete newCache[monthKey]
      return newCache
    })
    
    if (selectedService) {
      loadDayAvailability(currentMonth)
    }
  })

  useEffect(() => {
    loadServices()
    loadUserDogs()
  }, [])

  useEffect(() => {
    if (selectedService) {
      loadDayAvailability(currentMonth)
    }
  }, [selectedService, currentMonth])

  useEffect(() => {
    if (selectedDate && selectedService) {
      loadAvailableSlots()
    }
  }, [selectedDate, selectedService, loadAvailableSlots])

  useEffect(() => {
    if (!selectedDate || !selectedService) return
    
    const interval = setInterval(() => {
      loadAvailableSlots(true)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [selectedDate, selectedService, loadAvailableSlots])

  useEffect(() => {
    const handleFocus = () => {
      if (selectedDate && selectedService) {
        console.log('🔄 Ventana recuperó focus - refrescando horarios')
        loadAvailableSlots(true)
      }
    }
    
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedDate && selectedService) {
        console.log('🔄 Tab se hizo visible - refrescando horarios')
        loadAvailableSlots(true)
      }
    }
    
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [selectedDate, selectedService, loadAvailableSlots])

  useEffect(() => {
    const handleBookingUpdate = (event) => {
      const { dateString, timestamp } = event.detail
      
      console.log('📡 Recibida actualización de reserva (legacy):', { dateString, timestamp })
      
      if (selectedDate && (!dateString || dateString === selectedDate)) {
        console.log('🔄 Actualizando horarios por cambio de reserva (legacy)')
        if (selectedDate && selectedService) {
          loadAvailableSlots(true)
        }
      }
      
      if (selectedService) {
        loadDayAvailability()
      }
    }
    
    window.addEventListener('booking-updated', handleBookingUpdate)
    
    return () => {
      window.removeEventListener('booking-updated', handleBookingUpdate)
    }
  }, [selectedDate, selectedService, loadAvailableSlots])

  const handleServiceSelect = (service) => {
    setSelectedService(service)
    setSelectedTime('')
    setSelectedDate('')
    setAvailableSlots([])
    setShowCalendar(false)
    
    loadDayAvailability(currentMonth)
  }

  const handleDateSelect = (date) => {
    const dayStr = format(date, 'yyyy-MM-dd')
    const availability = dayAvailability[dayStr]
    const isPastDay = isBefore(date, startOfDay(new Date()))
    
    if (isPastDay || availability === 'full') {
      return
    }
    
    const dateStr = format(date, 'yyyy-MM-dd')
    setSelectedDate(dateStr)
    setSelectedTime('')
    setShowCalendar(false)
  }

  const getDayStyle = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const availability = dayAvailability[dayStr]
    
    let baseClasses = 'w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm border border-transparent rounded-md flex items-center justify-center transition-colors'
    
    const isPastDay = isBefore(day, startOfDay(new Date()))
    const isFullyBooked = availability === 'full'
    
    if (isPastDay) {
      baseClasses += ' bg-gray-100 text-gray-400 cursor-not-allowed'
    } 
    else if (isFullyBooked) {
      baseClasses += ' bg-gray-100 text-gray-400 cursor-not-allowed'
    } 
    else if (availability === 'partial' || availability === 'available') {
      baseClasses += ' bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer'
    } 
    else {
      baseClasses += ' bg-white text-gray-700 hover:bg-gray-50 border-gray-200 cursor-pointer'
    }
    
    if (selectedDate && isSameDay(day, new Date(selectedDate)) && !isPastDay && !isFullyBooked) {
      baseClasses += ' !border-blue-500 !bg-blue-500 !text-white'
    }
    
    if (isToday(day)) {
      baseClasses += ' font-bold'
    }
    
    return baseClasses
  }

  const handleAddDog = () => {
    if (onNavigateToSection) {
      onNavigateToSection('my-dogs')
      toast.success(t('bookingSection.toasts.navigateToDogs'))
    } else {
      toast.error(t('bookingSection.toasts.cannotNavigate'))
    }
  }

  const handleSubmitBooking = async (e) => {
    e.preventDefault()
    
    if (!selectedService || !selectedDog || !selectedDate || !selectedTime) {
      toast.error(t('bookingSection.toasts.completeFields'))
      return
    }

    setLoading(true)

    try {
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
        toast.error(t('bookingSection.toasts.technicalError'))
        setLoading(false)
        return
      }

      if (ultimateCheck && ultimateCheck.length > 0) {
        const isBlocked = isTimeSlotBlocked(
          selectedTime,
          ultimateCheck.filter(b => b.services?.tipo !== 'rehabilitacion_domicilio'),
          ultimateCheck.filter(b => b.services?.tipo === 'rehabilitacion_domicilio'),
          selectedService.duracion_minutos,
          selectedService.tipo
        )
        
        if (isBlocked) {
          toast.error(t('bookingSection.toasts.slotTaken'), {
            duration: 4000,
          })
          setSelectedTime('')
          await loadAvailableSlots()
          setLoading(false)
          return
        }
      }

      const datetime = `${selectedDate}T${selectedTime}:00`
      const dogData = userDogs.find(dog => dog.id === parseInt(selectedDog))
      const spaceInfo = getSpaceInfo(selectedService.tipo)

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
        toast.error(t('bookingSection.toasts.technicalError'))
        return
      }

      if (!result.success) {
        if (result.error_code === 'SLOT_CONFLICT') {
          toast.error(t('bookingSection.toasts.slotConflict'), {
            duration: 4000,
          })

          await loadAvailableSlots()
          setSelectedTime('')
          return
        } else {
          toast.error(result.error || t('bookingSection.toasts.technicalError'))
          return
        }
      }

      // 🚨 NUEVA LÓGICA: Detectar si requiere confirmación del admin
      const needsConfirmation = requiresAdminConfirmation(selectedDate, selectedTime)

      if (needsConfirmation) {
        // Actualizar el estado de la reserva a 'pendiente_confirmacion'
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ estado: 'pendiente_confirmacion' })
          .eq('id', result.booking_id)

        if (updateError) {
          console.error('Error actualizando estado a pendiente_confirmacion:', updateError)
          // Continuar de todos modos, la reserva se creó
        }

        console.log('⚠️ Reserva creada con estado pendiente_confirmacion (ID:', result.booking_id, ')')
        toast.success(t('bookingSection.toasts.bookingPendingConfirmation'), {
          duration: 6000,
        })
      } else {
        toast.success(t('bookingSection.toasts.bookingSuccess'))
      }

      invalidateCacheAndNotify(selectedDate)
      console.log('🚨 Notificación enviada a todos los usuarios sobre nueva reserva')

      try {
        // Enviar emails diferentes según si requiere confirmación o no
        if (needsConfirmation) {
          // 🆕 Email al cliente: Reserva PENDIENTE de confirmación
          await sendPendingConfirmationEmail({
            to: profile.email || user.email,
            clientName: profile.nombre_completo,
            dogName: dogData.nombre,
            service: selectedService.nombre,
            date: selectedDate,
            time: selectedTime,
            duration: selectedService.duracion_minutos.toString(),
            price: selectedService.precio.toString()
          }, profile?.preferred_language, result.booking_id, user.id)

          // 🆕 Email al admin: Nueva reserva PENDIENTE de confirmar
          await sendAdminPendingConfirmationEmail({
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
          }, result.booking_id)
        } else {
          // Emails normales (reserva confirmada directamente)
          await notifyBookingConfirmed({
            pet_name: dogData.nombre,
            service_name: selectedService.nombre,
            fecha: selectedDate,
            hora: selectedTime,
            duracion: selectedService.duracion_minutos.toString(),
            precio: selectedService.precio.toString(),
            preferredLanguage: profile?.preferred_language
          })

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
        }
      } catch (emailError) {
        console.error('Error enviando notificaciones:', emailError)
      }

      // 🔔 Programar recordatorio 24h antes
      try {
        const { scheduleEmailReminder } = await import('../../utils/emailService')
        await scheduleEmailReminder({
          id: result.booking_id,
          user_id: user.id,
          fecha: selectedDate,
          hora: selectedTime,
          profiles: {
            nombre_completo: profile.nombre_completo,
            email: profile.email || user.email
          },
          pet_name: dogData.nombre,
          service_name: selectedService.nombre,
          duracion_minutos: selectedService.duracion_minutos.toString()
        })
        console.log('✅ Recordatorio programado para 24h antes')
      } catch (reminderError) {
        console.error('⚠️ Error programando recordatorio:', reminderError)
        // No bloqueamos la reserva si falla el recordatorio
      }

      setSelectedService(null)
      setSelectedDog('')
      setSelectedDate('')
      setSelectedTime('')
      setObservaciones('')
      setAvailableSlots([])
      setShowCalendar(false)
      
    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error(t('bookingSection.toasts.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

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

  const Calendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    const weekDays = t('bookingSection.calendar.weekDays', { returnObjects: true })

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mt-2 shadow-sm max-w-full overflow-hidden relative">
        <div className="flex justify-between items-center mb-4">
          <button
            type="button"
            onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            disabled={loadingCalendar}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: getDateLocale() })}
          </h2>
          <button
            type="button"
            onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            disabled={loadingCalendar}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>
        
        {loadingCalendar && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg z-10">
            <div className="flex flex-col items-center">
              <div className="loading-spinner mb-2"></div>
              <span className="text-sm text-gray-600">{t('bookingSection.calendar.loading')}</span>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(day => {
            const isPastDay = isBefore(day, startOfDay(new Date()))
            const dayStr = format(day, 'yyyy-MM-dd')
            const availability = dayAvailability[dayStr]
            const isDisabled = isPastDay || availability === 'full'
            const isCurrentMonth = isSameMonth(day, currentMonth)
            
            return (
              <button
                key={day.toString()}
                type="button"
                onClick={() => handleDateSelect(day)}
                disabled={isDisabled || !isCurrentMonth || loadingCalendar}
                className={`${getDayStyle(day)} ${!isCurrentMonth ? '!text-gray-300 !bg-transparent !cursor-default' : ''}`}
                title={
                  !isCurrentMonth ? t('bookingSection.calendar.tooltips.outOfMonth') :
                  isPastDay 
                    ? t('bookingSection.calendar.tooltips.pastDay')
                    : availability === 'full' 
                      ? t('bookingSection.calendar.tooltips.noSlots')
                      : availability === 'partial'
                        ? t('bookingSection.calendar.tooltips.partial')
                        : t('bookingSection.calendar.tooltips.available')
                }
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 rounded" style={{backgroundColor: '#DCFCE7'}}></div>
              <span className="text-gray-600">{t('bookingSection.calendar.legend.available')}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 rounded"></div>
              <span className="text-gray-600">{t('bookingSection.calendar.legend.noSlots')}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-6 sm:space-y-8">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-start space-x-2">
            <div className="text-amber-600 mt-0.5">{t('bookingSection.tip.icon')}</div>
            <div className="flex-1">
              <p className="text-sm text-amber-800">
                <strong>{t('bookingSection.tip.title')}</strong> {t('bookingSection.tip.message')}
              </p>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t('bookingSection.title')}</h2>
          <p className="text-sm sm:text-base text-gray-600">{t('bookingSection.subtitle')}</p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
          <div className="flex">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-purple-800 text-sm sm:text-base">{t('bookingSection.homeVisitInfo.title')}</h3>
              <p className="text-purple-700 text-xs sm:text-sm mt-1">
                {t('bookingSection.homeVisitInfo.message')}
                <strong> {t('bookingSection.homeVisitInfo.contact')} </strong>
                <a 
                  href="https://wa.me/34676262863" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  676 26 28 63
                </a>{" "}
                {t('bookingSection.homeVisitInfo.schedule')}
              </p>

            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">{t('bookingSection.steps.selectService')}</h3>
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
                      {getServiceName(service)}
                    </h4>
                    <p className="text-xs sm:text-sm mb-3 transition-colors duration-300 text-gray-600">
                      {t('bookingSection.service.duration', { minutes: service.duracion_minutos })}
                    </p>

                    <p className="text-xs sm:text-sm mb-3 transition-colors duration-300 text-gray-600">
                      {t('bookingSection.service.price', { price: service.precio })}
                    </p>
                    
                    {getServiceDescription(service) && (
                      <p className="text-xs mt-2 line-clamp-2 transition-colors duration-300 text-gray-500">
                        {getServiceDescription(service)}
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
                  {t('bookingSection.steps.selectDog')} *
                </label>
                <select
                  value={selectedDog}
                  onChange={(e) => setSelectedDog(e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">{t('bookingSection.dog.selectPlaceholder')}</option>
                  {userDogs.map((dog) => (
                    <option key={dog.id} value={dog.id}>
                      {dog.nombre} {dog.raza && `(${dog.raza})`}
                    </option>
                  ))}
                </select>
                {userDogs.length === 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    {t('bookingSection.dog.noDogs')}
                    <button 
                      type="button" 
                      onClick={handleAddDog}
                      className="text-primary-600 hover:text-primary-500 ml-1 underline"
                    >
                      {t('bookingSection.dog.addDog')}
                    </button>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('bookingSection.steps.selectDate')} *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedDate ? format(new Date(selectedDate), 'dd/MM/yyyy') : ''}
                    readOnly
                    placeholder={t('bookingSection.date.selectPlaceholder')}
                    className="input cursor-pointer w-full"
                    onClick={() => setShowCalendar(!showCalendar)}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                
                {showCalendar && <Calendar />}
              </div>
            </div>

            {selectedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  {t('bookingSection.steps.selectTime')} *
                </label>
                {loadingSlots ? (
                  <div className="flex justify-center py-8">
                    <div className="loading-spinner"></div>
                    <span className="ml-2 text-gray-600 text-sm">{t('bookingSection.time.loadingSlots')}</span>
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
                    <p className="text-sm font-medium">{t('bookingSection.time.noSlots.title')}</p>
                    <p className="text-xs mt-1">{t('bookingSection.time.noSlots.reason')}</p>
                    <p className="text-xs">{t('bookingSection.time.noSlots.suggestion')}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookingSection.steps.observations')}
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="input resize-none w-full"
                placeholder={t('bookingSection.observations.placeholder')}
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
                    {t('bookingSection.submit.processing')}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('bookingSection.submit.button')}
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