import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, startOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { es, ca } from 'date-fns/locale'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import { useBookingNotifications } from "../NotificationProvider";
import { useNotifications } from '../../hooks/useNotifications'
import { useRealtimeBookings, useRealtimeBookingUpdates } from '../../hooks/useRealtimeBookings'
import { useTranslation } from 'react-i18next'

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

// Componente para mostrar razón específica de no disponibilidad
const NoSlotsReason = ({ fecha, serviceId, services }) => {
  const { t } = useTranslation()
  const [reason, setReason] = useState(null)
  
  useEffect(() => {
    const analyzeReason = async () => {
      const selectedService = services.find(s => s.id === parseInt(serviceId))
      const serviceDuration = selectedService?.duracion_minutos || 0
      
      // Verificar slots configurados
      const { data: configuredSlots } = await supabase
        .from('available_time_slots')
        .select('*')
        .eq('date', fecha)
        .eq('is_active', true)
      
      if (!configuredSlots || configuredSlots.length === 0) {
        setReason({
          title: t('bookingsManagement.noSlots.noSchedulesConfigured'),
          message: t('bookingsManagement.noSlots.noWorkHoursFor', { date: format(new Date(fecha), 'dd/MM/yyyy') }),
          suggestion: t('bookingsManagement.noSlots.configureSchedulesSuggestion')
        })
        return
      }
      
      // Calcular slot más grande disponible
      let maxSlot = null
      let maxDuration = 0
      
      configuredSlots.forEach(slot => {
        const slotStart = timeToMinutes(slot.start_time.substring(0, 5))
        const slotEnd = timeToMinutes(slot.end_time.substring(0, 5))
        const duration = slotEnd - slotStart
        
        if (duration > maxDuration) {
          maxDuration = duration
          maxSlot = slot
        }
      })
      
      if (serviceDuration > maxDuration) {
        setReason({
          title: t('bookingsManagement.noSlots.serviceTooLong'),
          message: t('bookingsManagement.noSlots.serviceTooLongMessage', {
            serviceName: selectedService.nombre,
            serviceDuration,
            maxDuration,
            startTime: maxSlot.start_time.substring(0, 5),
            endTime: maxSlot.end_time.substring(0, 5)
          }),
          suggestion: t('bookingsManagement.noSlots.serviceTooLongSuggestion')
        })
        return
      }
      
      // Si llegamos aquí, están todos ocupados
      setReason({
        title: t('bookingsManagement.noSlots.schedulesOccupied'),
        message: t('bookingsManagement.noSlots.schedulesOccupiedMessage'),
        suggestion: t('bookingsManagement.noSlots.schedulesOccupiedSuggestion')
      })
    }
    
    if (fecha && serviceId) {
      analyzeReason()
    }
  }, [fecha, serviceId, services, t])
  
  if (!reason) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="loading-spinner mr-2"></div>
        <span className="text-sm text-gray-600">{t('bookingsManagement.analyzingAvailability')}</span>
      </div>
    )
  }
  
  return (
    <div className="text-center py-8 bg-amber-50 rounded-lg border border-amber-200">
      <div className="mb-2">❌</div>
      <p className="text-sm font-bold text-amber-800 mb-2">{reason.title}</p>
      <p className="text-sm text-amber-700 mb-3 px-4">{reason.message}</p>
      <p className="text-xs text-amber-600 italic px-4">💡 {reason.suggestion}</p>
    </div>
  )
}

export default function BookingsManagement() {
  const { t, i18n } = useTranslation()
  const { forceUpdate } = useRealtimeBookings()
  
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pendiente')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [updating, setUpdating] = useState(new Set())
  const [viewMode, setViewMode] = useState('desktop')
  const { notifyBookingConfirmed, notifyBookingCanceled } = useBookingNotifications()
  const [sortColumn, setSortColumn] = useState('fecha_hora')
  const [sortDirection, setSortDirection] = useState('desc')
  const { notifyAdminCancellation } = useNotifications()
  const [dateRangeStart, setDateRangeStart] = useState(new Date())
  const [dateRangeEnd, setDateRangeEnd] = useState(new Date())
  const [showDateRangePicker, setShowDateRangePicker] = useState(false)
  const [selectingStartDate, setSelectingStartDate] = useState(true)
  const [selectedService, setSelectedService] = useState(null);

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

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState(null)

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const [availableSlots, setAvailableSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [dayAvailability, setDayAvailability] = useState({})
  const [endTimeSlots, setEndTimeSlots] = useState([])

  // Determinar locale para date-fns según idioma actual
  const getDateLocale = () => i18n.language === 'ca' ? ca : es

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
      
      setBookings(prevBookings => {
        const bookingsChanged = JSON.stringify(prevBookings) !== JSON.stringify(data)
        if (bookingsChanged) {
          console.log(`📊 Admin - ${t('bookingsManagement.bookingsUpdated')}: ${prevBookings.length} → ${data?.length || 0}`)
        }
        return data || []
      })
      
    } catch (error) {
      console.error('Error loading bookings:', error)
      if (!skipLoadingState) {
        toast.error(t('bookingsManagement.errors.loadingBookings'))
      }
    } finally {
      if (!skipLoadingState) setLoading(false)
    }
  }, [t])

  useRealtimeBookingUpdates(newBooking.fecha, selectedService, () => {
    loadBookings(true)
    
    if (newBooking.fecha && newBooking.service_id) {
      loadAvailableSlots(true)
    }
    
    loadMonthAvailability()
  })

  useEffect(() => {
    loadBookings()
    loadClients()
    loadServices()
    
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'mobile' : 'desktop')
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [loadBookings])

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

  useEffect(() => {
    if (newBooking.fecha && newBooking.service_id) {
      const interval = setInterval(() => {
        loadAvailableSlots(true)
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [newBooking.fecha, newBooking.service_id])

  useEffect(() => {
    if (newBooking.fecha && newBooking.service_id) {
      console.log('📅 Admin - ' + t('bookingsManagement.loadingSchedulesFor'), newBooking.fecha)
      loadAvailableSlots()
    } else {
      setAvailableSlots([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBooking.fecha, newBooking.service_id])

  useEffect(() => {
    const handleFocus = () => {
      if (newBooking.fecha && newBooking.service_id) {
        console.log('🔄 Admin - ' + t('bookingsManagement.refreshingSchedules'))
        loadAvailableSlots(true)
      }
      loadBookings(true)
    }
    
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [newBooking.fecha, newBooking.service_id, loadBookings, t])

  useEffect(() => {
    if (newBooking.client_id) {
      loadClientDogs(newBooking.client_id)
    }
  }, [newBooking.client_id])

  useEffect(() => {
    loadMonthAvailability()
  }, [currentMonth, services, bookings])

  useEffect(() => {
    const handleBookingUpdate = (event) => {
      const { dateString, timestamp } = event.detail
      
      console.log('📡 Admin ' + t('bookingsManagement.receivedBookingUpdate') + ' (legacy):', { dateString, timestamp })
      
      loadBookings(true)
      
      if (newBooking.fecha && (!dateString || dateString === newBooking.fecha)) {
        loadAvailableSlots(true)
      }
      
      loadMonthAvailability()
    }
    
    window.addEventListener('booking-updated', handleBookingUpdate)
    
    return () => {
      window.removeEventListener('booking-updated', handleBookingUpdate)
    }
  }, [newBooking.fecha, loadBookings, t])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDateRangePicker && !event.target.closest('.relative')) {
        setShowDateRangePicker(false)
        setSelectingStartDate(true)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDateRangePicker])

  const calculateMonthAvailability = async (monthStart, monthEnd) => {
    try {
      const availability = {}
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
      
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

      const { data: configuredSlots, error: slotsError } = await supabase
        .from('available_time_slots')
        .select('*')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .eq('is_active', true)

      if (slotsError) throw slotsError

      for (const day of days) {
        const dayStr = format(day, 'yyyy-MM-dd')
        const isPastDay = isBefore(day, startOfDay(new Date()))
        
        if (isPastDay) {
          availability[dayStr] = 'past'
          continue
        }

        const dayBookings = monthBookings?.filter(booking => 
          booking.fecha_hora.substring(0, 10) === dayStr
        ) || []

        const dayHomeVisits = dayBookings.filter(booking => 
          booking.services?.tipo === 'rehabilitacion_domicilio'
        )

        const dayConfiguredSlots = configuredSlots?.filter(slot => slot.date === dayStr) || []

        if (dayConfiguredSlots.length === 0) {
          availability[dayStr] = 'unavailable'
          continue
        }

        let hasAvailableSlots = false

        for (const service of services) {
          if (service.tipo === 'rehabilitacion_domicilio') continue
          
          try {
            const availableSlots = await generateFilteredTimeSlots(
              service, 
              dayStr, 
              dayBookings, 
              dayHomeVisits,
              true
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

  const loadMonthAvailability = async () => {
    if (services.length === 0) return
    
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

  const isHomeVisitService = () => {
    const selectedService = services.find(s => s.id === parseInt(newBooking.service_id))
    return selectedService?.tipo === 'rehabilitacion_domicilio'
  }

  const calculateHomeVisitData = () => {
    if (!newBooking.hora_inicio_domicilio || !newBooking.hora_fin_domicilio) {
      return { duracionMinutos: 0, precio: 0, error: null }
    }
    
    const inicioTotalMin = timeToMinutes(newBooking.hora_inicio_domicilio)
    const finTotalMin = timeToMinutes(newBooking.hora_fin_domicilio)
    
    if (finTotalMin <= inicioTotalMin) {
      return { duracionMinutos: 0, precio: 0, error: t('bookingsManagement.errors.endTimeMustBeAfterStart') }
    }
    
    const duracionMinutos = finTotalMin - inicioTotalMin
    const duracionHoras = duracionMinutos / 60
    const precio = duracionHoras * 80
    
    return { duracionMinutos, precio, duracionHoras, error: null }
  }

  const getEndTimeSlots = async () => {
    if (!newBooking.hora_inicio_domicilio || !newBooking.fecha) return []
    
    try {
      // 1. Obtener slots configurados por admin
      const { data: configuredSlots, error } = await supabase
        .from('available_time_slots')
        .select('*')
        .eq('date', newBooking.fecha)
        .eq('is_active', true)
        .order('start_time')

      if (error) throw error

      // 2. Obtener reservas existentes del día
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          fecha_hora, 
          duracion_minutos,
          services!inner(tipo)
        `)
        .gte('fecha_hora', `${newBooking.fecha}T00:00:00`)
        .lt('fecha_hora', `${newBooking.fecha}T23:59:59`)
        .eq('estado', 'pendiente')

      if (bookingsError) throw bookingsError

      const startMinutes = timeToMinutes(newBooking.hora_inicio_domicilio)
      const allEndSlots = []
      
      // 3. Generar slots candidatos basados en configuración admin
      configuredSlots.forEach(slot => {
        const slotStartMinutes = timeToMinutes(slot.start_time.substring(0, 5))
        const slotEndMinutes = timeToMinutes(slot.end_time.substring(0, 5))
        
        if (startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes) {
          for (let minutes = startMinutes + 30; minutes <= slotEndMinutes; minutes += 5) {
            const timeString = minutesToTime(minutes)
            
            // 4. Verificar si este rango (inicio -> fin) se solapa con alguna reserva
            const proposedEndMinutes = timeToMinutes(timeString)
            let hasConflict = false
            
            for (const booking of existingBookings || []) {
              const bookingTime = booking.fecha_hora.substring(11, 16)
              const bookingStartMinutes = timeToMinutes(bookingTime)
              const bookingEndMinutes = bookingStartMinutes + booking.duracion_minutos
              
              // Verificar solapamiento: el rango (startMinutes -> proposedEndMinutes) 
              // se solapa con (bookingStartMinutes -> bookingEndMinutes)
              const hasOverlap = (
                startMinutes < bookingEndMinutes && 
                proposedEndMinutes > bookingStartMinutes
              )
              
              if (hasOverlap) {
                hasConflict = true
                console.log(`❌ Hora fin ${timeString} bloqueada - conflicto con reserva ${bookingTime} (${booking.services?.tipo})`)
                break
              }
            }
            
            // Solo agregar si NO hay conflicto
            if (!hasConflict) {
              allEndSlots.push(timeString)
            }
          }
        }
      })
      
      return allEndSlots.sort()
    } catch (error) {
      console.error('Error getting end time slots:', error)
      return []
    }
  }

  const loadAvailableSlots = useCallback(async (skipLoadingState = false) => {
    if (!skipLoadingState) setLoadingSlots(true)
    
    try {
      const selectedService = services.find(s => s.id === parseInt(newBooking.service_id))
      if (!selectedService) return
      
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
      
      console.log(`📊 Admin - ${t('bookingsManagement.centerBookings')}: ${centerBookings.length}, ${t('bookingsManagement.homeVisits')}: ${homeVisits.length}`)
      
      const available = await generateFilteredTimeSlots(
        selectedService, 
        newBooking.fecha, 
        centerBookings,
        homeVisits,
        true
      )
      
      setAvailableSlots(prevSlots => {
        const slotsChanged = JSON.stringify(prevSlots) !== JSON.stringify(available)
        if (slotsChanged) {
          console.log(`✅ Admin - ${t('bookingsManagement.schedulesUpdated')}: ${prevSlots.length} → ${available.length}`)
        }
        return available
      })
      
    } catch (error) {
      console.error('Error loading available slots:', error)
      if (!skipLoadingState) {
        toast.error(t('bookingsManagement.errors.loadingAvailableSchedules'))
      }
    } finally {
      if (!skipLoadingState) setLoadingSlots(false)
    }
  }, [newBooking.fecha, newBooking.service_id, services, t])

  const handleDateSelect = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    setNewBooking({...newBooking, fecha: dateStr, hora: ''})
    setShowCalendar(false)
  }

  const getDayStyle = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const availability = dayAvailability[dayStr]
    
    let baseClasses = 'w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm border border-transparent rounded-md flex items-center justify-center cursor-pointer transition-colors'
    
    const isPastDay = isBefore(day, startOfDay(new Date()))
    
    if (isPastDay) {
      baseClasses += ' bg-gray-100 text-gray-400 cursor-not-allowed'
    } else if (availability === 'available') {
      baseClasses += ' bg-green-100 text-green-800 hover:bg-green-200 border-green-200'
    } else {
      baseClasses += ' bg-gray-100 text-gray-500 cursor-not-allowed'
    }
    
    const isSelected = newBooking.fecha && isSameDay(day, new Date(newBooking.fecha))
    if (isSelected && availability === 'available' && !isPastDay) {
      baseClasses += ' !border-blue-500 !bg-blue-500 !text-white'
    }
    
    if (isToday(day)) {
      baseClasses += ' font-bold'
    }
    
    return baseClasses
  }

  const AdminCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

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
            {format(currentMonth, 'MMMM yyyy', { locale: getDateLocale() })}
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
          {t('bookingsManagement.weekDaysShort', { returnObjects: true }).map((day, index) => (
            <div key={index} className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const availability = dayAvailability[dayStr]
            const isPastDay = isBefore(day, startOfDay(new Date()))
            const isFullyBooked = availability === 'full'
            const isUnavailable = availability === 'unavailable'
            const isCurrentMonth = isSameMonth(day, currentMonth)
            
            return (
              <button
                key={day.toString()}
                type="button"
                onClick={() => {
                  if (!isPastDay && !isFullyBooked && !isUnavailable && isCurrentMonth) {
                    handleDateSelect(day)
                  }
                }}
                disabled={isPastDay || isFullyBooked || isUnavailable || !isCurrentMonth}
                className={`${getDayStyle(day)} ${!isCurrentMonth ? '!text-gray-300 !bg-transparent !cursor-default' : ''}`}
                title={
                  !isCurrentMonth ? t('bookingsManagement.calendar.outOfMonth') :
                  isPastDay ? t('bookingsManagement.calendar.pastDay') :
                  isFullyBooked ? t('bookingsManagement.calendar.fullyBooked') :
                  isUnavailable ? t('bookingsManagement.calendar.noSchedulesConfigured') :
                  t('bookingsManagement.calendar.available')
                }
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
              <span className="text-gray-600">{t('bookingsManagement.calendar.available')}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 rounded"></div>
              <span className="text-gray-600">{t('bookingsManagement.calendar.notAvailable')}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const DateRangePicker = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    const handleDateClick = (day) => {
      if (selectingStartDate) {
        setDateRangeStart(day)
        setDateRangeEnd(day)
        setSelectingStartDate(false)
      } else {
        if (isBefore(day, dateRangeStart)) {
          setDateRangeEnd(dateRangeStart)
          setDateRangeStart(day)
        } else {
          setDateRangeEnd(day)
        }
        setSelectingStartDate(true)
        setShowDateRangePicker(false)
      }
    }

    const isInRange = (day) => {
      if (!dateRangeStart || !dateRangeEnd) return false
      return day >= dateRangeStart && day <= dateRangeEnd
    }

    const getRangeDayStyle = (day) => {
      const isCurrentMonth = isSameMonth(day, currentMonth)
      const isStart = isSameDay(day, dateRangeStart)
      const isEnd = isSameDay(day, dateRangeEnd)
      const inRange = isInRange(day)
      
      let classes = 'w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm rounded-md flex items-center justify-center cursor-pointer transition-colors'
      
      if (!isCurrentMonth) {
        classes += ' text-gray-300 bg-transparent cursor-default'
      } else if (isStart || isEnd) {
        classes += ' bg-blue-600 text-white font-bold'
      } else if (inRange) {
        classes += ' bg-blue-100 text-blue-800'
      } else if (isToday(day)) {
        classes += ' bg-gray-200 text-gray-900 font-bold'
      } else {
        classes += ' text-gray-700 hover:bg-gray-100'
      }
      
      return classes
    }

    return (
      <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-lg z-50 min-w-[280px]">
        <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-800">
          {selectingStartDate ? t('bookingsManagement.dateRangePicker.selectStartDate') : t('bookingsManagement.dateRangePicker.selectEndDate')}
        </div>

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
            {format(currentMonth, 'MMMM yyyy', { locale: getDateLocale() })}
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
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {t('bookingsManagement.weekDaysShort', { returnObjects: true }).map((day, index) => (
            <div key={index} className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(day => (
            <button
              key={day.toString()}
              type="button"
              onClick={() => handleDateClick(day)}
              disabled={!isSameMonth(day, currentMonth)}
              className={getRangeDayStyle(day)}
            >
              {format(day, 'd')}
            </button>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
          <button
            type="button"
            onClick={() => {
              const today = new Date()
              setDateRangeStart(today)
              setDateRangeEnd(today)
              setSelectingStartDate(true)
            }}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {t('bookingsManagement.dateRangePicker.today')}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDateRangePicker(false)
              setSelectingStartDate(true)
            }}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t('bookingsManagement.dateRangePicker.close')}
          </button>
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
            motivo_cancelacion: t('bookingsManagement.cancellationByCenterReason')
          }

          await notifyBookingCanceled(cancelationData)
          await notifyAdminCancellation(cancelationData)
          
        } catch (emailError) {
          console.error('Error enviando emails de cancelación:', emailError)
        }
      }

      setBookings(prev => 
        prev.map(booking => 
          booking.id === bookingId 
            ? { ...booking, estado: newStatus, updated_at: new Date().toISOString() }
            : booking
        )
      )

      toast.success(newStatus === 'cancelada' ? t('bookingsManagement.toasts.bookingCancelled') : t('bookingsManagement.toasts.bookingUpdated'))
    } catch (error) {
      console.error('Error updating booking:', error)
      toast.error(t('bookingsManagement.errors.updatingBooking'))
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
      toast.success(t('bookingsManagement.toasts.bookingDeleted'))
    } catch (error) {
      console.error('Error deleting booking:', error)
      toast.error(t('bookingsManagement.errors.deletingBooking'))
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
      toast.error(t('bookingsManagement.errors.completeRequiredFields'))
      return
    }

    if (isHomeVisit) {
      if (!newBooking.hora_inicio_domicilio || !newBooking.hora_fin_domicilio || !newBooking.direccion_domicilio) {
        toast.error(t('bookingsManagement.errors.completeHomeVisitFields'))
        return
      }
      
      const homeVisitData = calculateHomeVisitData()
      if (homeVisitData.error) {
        toast.error(homeVisitData.error)
        return
      }
      
      if (homeVisitData.duracionMinutos < 30) {
        toast.error(t('bookingsManagement.errors.minimumDuration30'))
        return
      }
    } else {
      if (!newBooking.hora) {
        toast.error(t('bookingsManagement.errors.selectTime'))
        return
      }
    }

    try {
      setLoading(true)

      console.log('🔒 Admin - ' + t('bookingsManagement.finalVerification'))
      
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
        toast.error(t('bookingsManagement.errors.verifyingAvailability'))
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
          toast.error(t('bookingsManagement.errors.conflictDetected'), {
            duration: 4000,
          })
          await loadAvailableSlots()
          setLoading(false)
          return
        }
      }
      
      const getSpaceForService = (serviceType) => {
        switch (serviceType) {
          case 'rehabilitacion_domicilio':
            return { space_id: null, spaces_display: t('bookingsManagement.spaces.clientHome') }
          case 'hidroterapia_rehabilitacion':
            return { space_id: 1, spaces_display: t('bookingsManagement.spaces.rehabCabinPool') }
          case 'rehabilitacion':
            return { space_id: 1, spaces_display: t('bookingsManagement.spaces.rehabCabin') }
          case 'hidroterapia':
            return { space_id: 2, spaces_display: t('bookingsManagement.spaces.pool') }
          default:
            return { space_id: 1, spaces_display: t('bookingsManagement.spaces.generalSpace') }
        }
      }

      const spaceInfo = getSpaceForService(selectedService.tipo)
      
      let datetime, duracionMinutos, precio
      
      if (isHomeVisit) {
        datetime = `${newBooking.fecha}T${newBooking.hora_inicio_domicilio}:00`
        const homeVisitData = calculateHomeVisitData()
        duracionMinutos = homeVisitData.duracionMinutos
        precio = homeVisitData.precio
      } else {
        datetime = `${newBooking.fecha}T${newBooking.hora}:00`
        duracionMinutos = selectedService.duracion_minutos
        precio = selectedService.precio
      }

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
        toast.error(t('bookingsManagement.errors.technicalError'))
        return
      }

      if (!result.success) {
        if (result.error_code === 'SLOT_CONFLICT') {
          toast.error(t('bookingsManagement.errors.conflictDetected'))
        } else {
          toast.error(result.error || t('bookingsManagement.errors.creatingBooking'))
        }
        return
      }

      toast.success(t('bookingsManagement.toasts.bookingCreated'))

      invalidateCacheAndNotify(newBooking.fecha)
      console.log('🚨 Admin ' + t('bookingsManagement.notifiedNewBooking'))

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
      toast.error(t('bookingsManagement.errors.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getFilteredBookings = () => {
    let filtered = bookings

    if (filter !== 'all') {
      filtered = filtered.filter(booking => booking.estado === filter)
    }

    if (dateRangeStart && dateRangeEnd) {
      const startDay = startOfDay(dateRangeStart)
      const endDay = startOfDay(addDays(dateRangeEnd, 1))
      
      filtered = filtered.filter(booking => {
        const bookingDate = new Date(booking.fecha_hora)
        return bookingDate >= startDay && bookingDate < endDay
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

    filtered.sort((a, b) => {
      let compareA, compareB

      switch (sortColumn) {
        case 'fecha_hora':
          compareA = new Date(a.fecha_hora)
          compareB = new Date(b.fecha_hora)
          break
        
        case 'cliente':
          compareA = a.profiles?.nombre_completo?.toLowerCase() || ''
          compareB = b.profiles?.nombre_completo?.toLowerCase() || ''
          break
        
        case 'perro':
          compareA = a.dogs?.nombre?.toLowerCase() || ''
          compareB = b.dogs?.nombre?.toLowerCase() || ''
          break
        
        case 'servicio':
          compareA = a.services?.nombre?.toLowerCase() || ''
          compareB = b.services?.nombre?.toLowerCase() || ''
          break
        
        case 'estado':
          compareA = a.estado || ''
          compareB = b.estado || ''
          break
        
        default:
          return 0
      }

      if (compareA < compareB) {
        return sortDirection === 'asc' ? -1 : 1
      }
      if (compareA > compareB) {
        return sortDirection === 'asc' ? 1 : -1
      }
      return 0
    })

    return filtered
  }

  const getStatsForDateRange = () => {
    let filtered = bookings

    if (dateRangeStart && dateRangeEnd) {
      const startDay = startOfDay(dateRangeStart)
      const endDay = startOfDay(addDays(dateRangeEnd, 1))
      
      filtered = filtered.filter(booking => {
        const bookingDate = new Date(booking.fecha_hora)
        return bookingDate >= startDay && bookingDate < endDay
      })
    }

    return {
      pendientes: filtered.filter(b => b.estado === 'pendiente').length,
      completadas: filtered.filter(b => b.estado === 'completada').length,
      canceladas: filtered.filter(b => b.estado === 'cancelada').length,
      total: filtered.length
    }
  }

  const getStatusBadge = (estado) => {
    const statusClasses = {
      pendiente: 'bg-yellow-100 text-yellow-800',
      completada: 'bg-green-100 text-green-800',
      cancelada: 'bg-red-100 text-red-800'
    }

    const statusText = {
      pendiente: t('bookingsManagement.status.pending'),
      completada: t('bookingsManagement.status.completed'),
      cancelada: t('bookingsManagement.status.cancelled')
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[estado] || 'bg-gray-100 text-gray-800'}`}>
        {statusText[estado] || estado}
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

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }

    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

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
          <span className="text-gray-600">{t('bookingsManagement.client')}:</span>
          <span className="font-medium text-gray-900">{booking.profiles?.nombre_completo}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{t('bookingsManagement.dog')}:</span>
          <span className="text-gray-900">{booking.dogs?.nombre}</span>
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        {(booking.estado === 'pendiente') && (
          <button
            onClick={() => updateBookingStatus(booking.id, 'cancelada')}
            disabled={updating.has(booking.id)}
            className="text-red-600 hover:text-red-900 disabled:opacity-50 p-1"
            title={t('bookingsManagement.actions.cancel')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        <button
          onClick={() => setSelectedBooking(booking)}
          className="text-blue-600 hover:text-blue-900 p-1"
          title={t('bookingsManagement.actions.viewDetails')}
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
        <span className="text-gray-600">{t('bookingsManagement.loadingBookings')}</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t('bookingsManagement.title')}</h2>
            <p className="text-sm sm:text-base text-gray-600">{t('bookingsManagement.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-white px-4 py-2 rounded-md flex items-center justify-center sm:justify-start hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#2563EB' }}
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t('bookingsManagement.newBooking')}
          </button>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('bookingsManagement.filters.status')}</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">{t('bookingsManagement.filters.allStatuses')}</option>
                <option value="pendiente">{t('bookingsManagement.status.pending')}</option>
                <option value="completada">{t('bookingsManagement.status.completed')}</option>
                <option value="cancelada">{t('bookingsManagement.status.cancelled')}</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('bookingsManagement.filters.period')}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-left flex justify-between items-center hover:bg-gray-50"
                >
                  <span>
                    {isSameDay(dateRangeStart, dateRangeEnd) 
                      ? format(dateRangeStart, 'dd/MM/yyyy')
                      : `${format(dateRangeStart, 'dd/MM/yyyy')} - ${format(dateRangeEnd, 'dd/MM/yyyy')}`
                    }
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </button>
                
                {showDateRangePicker && <DateRangePicker />}
              </div>
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('bookingsManagement.filters.search')}</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('bookingsManagement.filters.searchPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          
          <div className="mt-3 sm:hidden flex bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('mobile')}
              className={`flex-1 px-3 py-1 text-xs rounded ${viewMode === 'mobile' ? 'bg-white shadow' : ''}`}
            >
              {t('bookingsManagement.listView')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">
              {getStatsForDateRange().pendientes}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">{t('bookingsManagement.stats.pending')}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-lg sm:text-2xl font-bold text-gray-600">
              {getStatsForDateRange().completadas}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">{t('bookingsManagement.stats.completed')}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-lg sm:text-2xl font-bold text-red-600">
              {getStatsForDateRange().canceladas}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">{t('bookingsManagement.stats.cancelled')}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-4 sm:px-6 py-4 border-b">
            <h3 className="text-base sm:text-lg font-semibold">
              {t('bookingsManagement.bookingsList')} ({filteredBookings.length})
            </h3>
          </div>
          
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-4xl mb-2">📅</div>
              <h4 className="text-lg font-medium text-gray-900">{t('bookingsManagement.noBookingsFound')}</h4>
              <p className="text-gray-600">{t('bookingsManagement.adjustFilters')}</p>
            </div>
          ) : viewMode === 'mobile' ? (
            <div className="p-4 space-y-4">
              {filteredBookings.map(renderMobileBookingCard)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      onClick={() => handleSort('fecha_hora')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('bookingsManagement.table.dateTime')}</span>
                        <SortIcon column="fecha_hora" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('cliente')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('bookingsManagement.table.client')}</span>
                        <SortIcon column="cliente" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('perro')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('bookingsManagement.table.dog')}</span>
                        <SortIcon column="perro" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('servicio')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('bookingsManagement.table.service')}</span>
                        <SortIcon column="servicio" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('estado')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('bookingsManagement.table.status')}</span>
                        <SortIcon column="estado" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('bookingsManagement.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {format(new Date(booking.fecha_hora.substring(0, 10)), 'dd/MM/yyyy', { locale: getDateLocale() })}
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
                              <div className="text-xs text-purple-600 font-medium">{t('bookingsManagement.homeVisit')}</div>
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
                              title={t('bookingsManagement.actions.cancel')}
                            >
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="text-blue-600 hover:text-blue-900"
                            title={t('bookingsManagement.actions.viewDetails')}
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

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg p-3 sm:p-4 md:p-6 w-full max-w-2xl mx-2 sm:mx-4 max-h-[95vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold">{t('bookingsManagement.modal.newBooking')}</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={createBooking} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('bookingsManagement.modal.client')} *
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
                      <option value="">{t('bookingsManagement.modal.selectClient')}</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.nombre_completo} - {client.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('bookingsManagement.modal.dog')} *
                    </label>
                    <select
                      value={newBooking.dog_id}
                      onChange={(e) => setNewBooking({...newBooking, dog_id: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      required
                      disabled={!newBooking.client_id}
                    >
                      <option value="">{t('bookingsManagement.modal.selectDog')}</option>
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
                    {t('bookingsManagement.modal.service')} *
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
                    <option value="">{t('bookingsManagement.modal.selectService')}</option>
                    {services.map(service => (
                      <option key={service.id} value={service.id}>
                        {getServiceIcon(service.tipo)} {service.nombre}
                        {service.tipo === 'rehabilitacion_domicilio' ? `/${t('bookingsManagement.modal.perHour')}` : ` - ${service.duracion_minutos}min`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('bookingsManagement.modal.date')} *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newBooking.fecha ? format(new Date(newBooking.fecha), 'dd/MM/yyyy') : ''}
                      readOnly
                      placeholder={t('bookingsManagement.modal.selectDate')}
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

                {isHomeVisitService() ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('bookingsManagement.modal.startTime')} *
                        </label>
                        <select
                          value={newBooking.hora_inicio_domicilio}
                          onChange={(e) => setNewBooking({...newBooking, hora_inicio_domicilio: e.target.value, hora_fin_domicilio: ''})}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          required
                        >
                          <option value="">{t('bookingsManagement.modal.selectTime')}</option>
                          {newBooking.fecha && newBooking.service_id ? (
                            loadingSlots ? (
                              <option disabled>{t('bookingsManagement.modal.loading')}</option>
                            ) : (
                              availableSlots.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))
                            )
                          ) : (
                            <option disabled>{t('bookingsManagement.modal.selectDateServiceFirst')}</option>
                          )}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('bookingsManagement.modal.endTime')} *
                        </label>
                        <select
                          value={newBooking.hora_fin_domicilio}
                          onChange={(e) => setNewBooking({...newBooking, hora_fin_domicilio: e.target.value})}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          required
                          disabled={!newBooking.hora_inicio_domicilio}
                        >
                          <option value="">{t('bookingsManagement.modal.selectEndTime')}</option>
                          {endTimeSlots.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {newBooking.hora_inicio_domicilio && newBooking.hora_fin_domicilio && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        {(() => {
                          const homeVisitData = calculateHomeVisitData()
                          return homeVisitData.error ? (
                            <p className="text-red-600 text-sm">{homeVisitData.error}</p>
                          ) : (
                            <div className="text-sm">
                              <p className="font-medium text-blue-800">
                                {t('bookingsManagement.modal.duration')}: {homeVisitData.duracionHoras}h ({homeVisitData.duracionMinutos} min)
                              </p>
                              <p className="font-semibold text-green-700">
                                {t('bookingsManagement.modal.price')}: €{homeVisitData.precio.toFixed(2)}
                              </p>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('bookingsManagement.modal.homeAddress')} *
                      </label>
                      <textarea
                        value={newBooking.direccion_domicilio}
                        onChange={(e) => setNewBooking({...newBooking, direccion_domicilio: e.target.value})}
                        rows={2}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        placeholder={t('bookingsManagement.modal.addressPlaceholder')}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      {t('bookingsManagement.modal.time')} *
                    </label>
                    {newBooking.fecha && newBooking.service_id ? (
                      loadingSlots ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="loading-spinner mr-2"></div>
                          <span className="text-sm text-gray-600">{t('bookingsManagement.modal.loadingAvailableSchedules')}</span>
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <NoSlotsReason 
                          fecha={newBooking.fecha} 
                          serviceId={newBooking.service_id} 
                          services={services}
                       />
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
                        <p className="text-sm text-gray-500">{t('bookingsManagement.modal.selectDateServiceFirst')}</p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('bookingsManagement.modal.observations')}
                  </label>
                  <textarea
                    value={newBooking.observaciones}
                    onChange={(e) => setNewBooking({...newBooking, observaciones: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder={t('bookingsManagement.modal.observationsPlaceholder')}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    {t('bookingsManagement.modal.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {loading ? t('bookingsManagement.modal.creating') : t('bookingsManagement.modal.createBooking')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold">{t('bookingsManagement.detailsModal.title')}</h3>
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
                    <label className="text-sm font-medium text-gray-500">{t('bookingsManagement.detailsModal.client')}</label>
                    <p className="text-gray-900">{selectedBooking.profiles?.nombre_completo}</p>
                    <p className="text-sm text-gray-600">{selectedBooking.profiles?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('bookingsManagement.detailsModal.dog')}</label>
                    <p className="text-gray-900">{selectedBooking.dogs?.nombre}</p>
                    {selectedBooking.dogs?.raza && (
                      <p className="text-sm text-gray-600">{selectedBooking.dogs.raza}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('bookingsManagement.detailsModal.service')}</label>
                    <p className="text-gray-900 flex items-center">
                      <span className="mr-2">{getServiceIcon(selectedBooking.services?.tipo)}</span>
                      {selectedBooking.services?.nombre}
                    </p>
                    {selectedBooking.services?.tipo === 'rehabilitacion_domicilio' && (
                      <p className="text-xs text-purple-600 font-medium mt-1">{t('bookingsManagement.homeVisit')}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('bookingsManagement.detailsModal.dateTime')}</label>
                    <p className="text-gray-900">
                      {format(new Date(selectedBooking.fecha_hora.substring(0, 10)), 'EEEE d \'de\' MMMM \'de\' yyyy', { locale: getDateLocale() })}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedBooking.fecha_hora.substring(11, 16)} ({selectedBooking.duracion_minutos} {t('bookingsManagement.detailsModal.minutes')})
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('bookingsManagement.detailsModal.status')}</label>
                    <div className="mt-1">
                      {getStatusBadge(selectedBooking.estado)}
                    </div>
                  </div>
                </div>
                
                {selectedBooking.observaciones && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('bookingsManagement.detailsModal.observations')}</label>
                    <p className="text-gray-900 bg-gray-50 p-2 rounded text-sm">
                      {selectedBooking.observaciones}
                    </p>
                  </div>
                )}
                
                <div className="text-xs text-gray-500 border-t pt-2">
                  <p>{t('bookingsManagement.detailsModal.created')}: {format(parseISO(selectedBooking.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  {selectedBooking.updated_at !== selectedBooking.created_at && (
                    <p>{t('bookingsManagement.detailsModal.updated')}: {format(parseISO(selectedBooking.updated_at), 'dd/MM/yyyy HH:mm')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setBookingToDelete(null)
          }}
          onConfirm={deleteBooking}
          title={t('bookingsManagement.deleteModal.title'
          )}
          message={t('bookingsManagement.deleteModal.message')}
          confirmText={t('bookingsManagement.deleteModal.confirm')}
          cancelText={t('bookingsManagement.deleteModal.cancel')}
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
      </div>
    </div>
  )
}