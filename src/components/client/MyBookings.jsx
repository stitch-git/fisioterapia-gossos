import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'
import { es, ca } from 'date-fns/locale'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import { useBookingNotifications } from '../NotificationProvider'
import { useTranslation } from 'react-i18next'

export default function MyBookings() {
  const { user, profile } = useAuth()
  const { t, i18n } = useTranslation()
  const getDateLocale = () => i18n.language === 'ca' ? ca : es
  const [bookings, setBookings] = useState([])
  const { notifyBookingCanceled, notifyAdminCancellation } = useBookingNotifications()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pendiente')
  const [cancellingBookings, setCancellingBookings] = useState(new Set())
  
  const [sortColumn, setSortColumn] = useState('fecha_hora')
  const [sortDirection, setSortDirection] = useState('asc')

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState(null)
  const [cancelModalData, setCancelModalData] = useState({
    title: '',
    message: '',
    hasLateCharge: false,
    hoursRemaining: 0
  })

  const getBookingSpaceDisplay = (booking) => {
    if (booking.spaces_display) {
      return booking.spaces_display
    }
    
    const serviceType = booking.services?.tipo
    switch (serviceType) {
      case 'hidroterapia_rehabilitacion':
        return t('myBookings.spaces.rehabCabinPool')
      case 'rehabilitacion':
        return t('myBookings.spaces.rehabCabin')
      case 'hidroterapia':
        return t('myBookings.spaces.pool')
      default:
        return booking.spaces?.nombre || t('myBookings.spaces.general')
    }
  }

  useEffect(() => {
    loadBookings()
    const interval = setInterval(checkAndUpdateCompletedBookings, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadBookings = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services (nombre, tipo, duracion_minutos),
          dogs (nombre, raza),
          spaces (nombre)
        `)
        .eq('client_id', user.id)
        .order('fecha_hora', { ascending: true })

      if (error) throw error
      setBookings(data)
    } catch (error) {
      console.error('Error loading bookings:', error)
      toast.error(t('myBookings.toasts.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const checkAndUpdateCompletedBookings = async () => {
    try {
      const now = new Date()
      const bookingsToUpdate = bookings.filter(booking => {
        if (!['pendiente', 'pendiente_confirmacion'].includes(booking.estado)) return false
        
        const bookingDateStr = booking.fecha_hora.substring(0, 10)
        const bookingTimeStr = booking.fecha_hora.substring(11, 16)
        const [hours, minutes] = bookingTimeStr.split(':').map(Number)

        const bookingDateTime = new Date()
        const [year, month, day] = bookingDateStr.split('-').map(Number)
        bookingDateTime.setFullYear(year, month - 1, day)
        bookingDateTime.setHours(hours, minutes, 0, 0)

        const bookingEndTime = new Date(bookingDateTime.getTime() + booking.duracion_minutos * 60000)
        
        return now >= bookingEndTime
      })

      if (bookingsToUpdate.length > 0) {
        for (const booking of bookingsToUpdate) {
          await supabase
            .from('bookings')
            .update({ 
              estado: 'completada',
              updated_at: new Date().toISOString()
            })
            .eq('id', booking.id)
        }
        
        loadBookings()
        toast.success(t('myBookings.toasts.autoCompleted', { count: bookingsToUpdate.length }))
      }
    } catch (error) {
      console.error('Error updating completed bookings:', error)
    }
  }

  const openCancelModal = (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId)
    
    const bookingDateStr = booking.fecha_hora.substring(0, 10)
    const bookingTimeStr = booking.fecha_hora.substring(11, 16)
    const [hours, minutes] = bookingTimeStr.split(':').map(Number)
    const [year, month, day] = bookingDateStr.split('-').map(Number)

    const bookingDate = new Date()
    bookingDate.setFullYear(year, month - 1, day)
    bookingDate.setHours(hours, minutes, 0, 0)

    const now = new Date()
    const hoursUntilBooking = (bookingDate - now) / (1000 * 60 * 60)

    let modalData
    if (hoursUntilBooking >= 24) {
      modalData = {
        title: t('myBookings.cancelModal.title'),
        message: t('myBookings.cancelModal.message'),
        hasLateCharge: false,
        hoursRemaining: Math.ceil(hoursUntilBooking)
      }
    } else {
      modalData = {
        title: t('myBookings.cancelModal.titleWithCharge'),
        message: t('myBookings.cancelModal.messageWithCharge'),
        hasLateCharge: true,
        hoursRemaining: Math.ceil(hoursUntilBooking)
      }
    }

    setBookingToCancel(booking)
    setCancelModalData(modalData)
    setShowCancelModal(true)
  }

  const cancelBooking = async () => {
    if (!bookingToCancel) return

    const booking = bookingToCancel
    const bookingId = booking.id
    
    const bookingDateStr = booking.fecha_hora.substring(0, 10)
    const bookingTimeStr = booking.fecha_hora.substring(11, 16)
    const [hours, minutes] = bookingTimeStr.split(':').map(Number)
    const [year, month, day] = bookingDateStr.split('-').map(Number)

    const bookingDate = new Date()
    bookingDate.setFullYear(year, month - 1, day)
    bookingDate.setHours(hours, minutes, 0, 0)

    const now = new Date()
    const hoursUntilBooking = (bookingDate - now) / (1000 * 60 * 60)

    try {
      setCancellingBookings(prev => new Set(prev).add(bookingId))

      console.log('Intentando cancelar booking:', bookingId)

      const updateData = {
        estado: 'cancelada',
        updated_at: new Date().toISOString()
      }

      if (hoursUntilBooking < 24) {
        updateData.recargo_cancelacion = booking.precio
        updateData.motivo_recargo = 'Cancelación con menos de 24 horas'
      }

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId)
        .eq('client_id', user.id)

      console.log('Resultado actualización error:', error)

      if (error) {
        console.error('Error específico:', error)
        throw error
      }

      try {
        await notifyBookingCanceled({
          cliente_nombre: user.nombre_completo,
          pet_name: booking.dogs?.nombre,
          service_name: booking.services?.nombre,
          fecha: booking.fecha_hora.substring(0, 10),
          hora: booking.fecha_hora.substring(11, 16),
          motivo_cancelacion: hoursUntilBooking < 24 ? 'Cancelación tardía por parte del cliente' : 'Cancelación por parte del cliente',
          preferredLanguage: profile?.preferred_language // Idioma del usuario
        })
      } catch (emailError) {
        console.error('Error enviando email de cancelación:', emailError)
      }

      try {
        await notifyAdminCancellation({
          clientName: user?.user_metadata?.nombre_completo || profile?.nombre_completo || 'Cliente',
          clientEmail: user?.email || profile?.email,
          dogName: booking.dogs?.nombre,
          service: booking.services?.nombre,
          fecha: booking.fecha_hora.substring(0, 10),
          hora: booking.fecha_hora.substring(11, 16),
          cancellationReason: hoursUntilBooking < 24 ? 'Cancelación tardía por parte del cliente' : 'Cancelación por parte del cliente',
          hasLateCharge: hoursUntilBooking < 24,
          chargeAmount: hoursUntilBooking < 24 ? booking.precio?.toString() || '0' : '0'
        })
        console.log('✅ Administrador notificado sobre cancelación')
      } catch (adminEmailError) {
        console.error('Error notificando al admin sobre cancelación:', adminEmailError)
      }

      setBookings(prevBookings => 
        prevBookings.map(booking => 
          booking.id === bookingId 
            ? { 
                ...booking, 
                estado: 'cancelada',
                updated_at: new Date().toISOString(),
                ...(hoursUntilBooking < 24 && {
                  motivo_recargo: 'Cancelación con menos de 24 horas'
                })
              }
            : booking
        )
      )

    } catch (error) {
      console.error('Error canceling booking:', error)
      toast.error(t('myBookings.toasts.cancelError'))
    } finally {
      setCancellingBookings(prev => {
        const newSet = new Set(prev)
        newSet.delete(bookingId)
        return newSet
      })
    }
  }

  const getStatusBadge = (estado) => {
    const statusClasses = {
      pendiente: 'status-pending',
      pendiente_confirmacion: 'status-pending-confirmation',
      confirmada: 'status-confirmed',
      completada: 'status-completed',
      cancelada: 'status-cancelled'
    }

    const statusText = {
      pendiente: t('myBookings.status.pending'),
      pendiente_confirmacion: t('myBookings.status.pendingConfirmation'),
      confirmada: t('myBookings.status.confirmed'),
      completada: t('myBookings.status.completed'),
      cancelada: t('myBookings.status.cancelled')
    }

    return (
      <span className={statusClasses[estado] || 'status-pending'}>
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
      default:
        return '⚕️'
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

  const filteredBookings = bookings
    .filter(booking => {
      if (filter === 'all') return true
      // Si el filtro es 'pendiente', incluir también 'pendiente_confirmacion'
      if (filter === 'pendiente') {
        return ['pendiente', 'pendiente_confirmacion'].includes(booking.estado)
      }
      return booking.estado === filter
    })
    .sort((a, b) => {
      let compareA, compareB

      switch (sortColumn) {
        case 'fecha_hora':
          compareA = new Date(a.fecha_hora)
          compareB = new Date(b.fecha_hora)
          break
        
        case 'servicio':
          compareA = a.services?.nombre?.toLowerCase() || ''
          compareB = b.services?.nombre?.toLowerCase() || ''
          break
        
        case 'perro':
          compareA = a.dogs?.nombre?.toLowerCase() || ''
          compareB = b.dogs?.nombre?.toLowerCase() || ''
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

  const canCancelBooking = (booking) => {
    return ['pendiente', 'pendiente_confirmacion'].includes(booking.estado)
  }

  const renderBookingAction = (booking) => {
    if (booking.estado === 'cancelada') {
      return (
        <div className="flex flex-col items-center pt-3 mt-3 border-t border-gray-100">
          <div className="px-3 py-2 bg-red-100 text-red-800 rounded-lg font-medium text-sm mb-2">
            {t('myBookings.booking.cancelled')}
          </div>
          {booking.recargo_cancelacion && (
            <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded text-xs">
              {t('myBookings.booking.chargeApplied')}
            </div>
          )}
        </div>
      )
    }

    if (booking.estado === 'completada') {
      return (
        <div className="flex flex-col items-center pt-3 mt-3 border-t border-gray-100">
          <div className="px-3 py-2 bg-green-100 text-green-800 rounded-lg font-medium text-sm">
            {t('myBookings.booking.completed')}
          </div>
        </div>
      )
    }

    if (canCancelBooking(booking)) {
      const isCancelling = cancellingBookings.has(booking.id)
      
      const bookingDateStr = booking.fecha_hora.substring(0, 10)
      const bookingTimeStr = booking.fecha_hora.substring(11, 16)
      const [hours, minutes] = bookingTimeStr.split(':').map(Number)
      const [year, month, day] = bookingDateStr.split('-').map(Number)

      const bookingDate = new Date()
      bookingDate.setFullYear(year, month - 1, day)
      bookingDate.setHours(hours, minutes, 0, 0)

      const now = new Date()
      const hoursUntilBooking = (bookingDate - now) / (1000 * 60 * 60)
      
      return (
        <div className="pt-3 mt-3 border-t border-gray-100">
          {hoursUntilBooking < 24 && hoursUntilBooking > 0 && (
            <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <div className="text-orange-600 mt-0.5">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm text-orange-800 font-medium">
                    {t('myBookings.booking.lateCancellation')}
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    {t('myBookings.booking.chargeWarning')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-center sm:justify-end">
            <button
              onClick={() => openCancelModal(booking.id)}
              disabled={isCancelling}
              className="w-full sm:w-auto btn btn-danger btn-sm"
            >
              {isCancelling ? (
                <>
                  <div className="loading-spinner mr-2"></div>
                  {t('myBookings.booking.cancelling')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('myBookings.booking.cancelButton')}
                </>
              )}
            </button>
          </div>
        </div>
      )
    }

    return null
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">{t('myBookings.loading')}</span>
      </div>
    )
  }

  const tabs = [
    { key: 'pendiente', label: t('myBookings.tabs.pending'), count: bookings.filter(b => ['pendiente', 'pendiente_confirmacion'].includes(b.estado)).length },
    { key: 'completada', label: t('myBookings.tabs.completed'), count: bookings.filter(b => b.estado === 'completada').length },
    { key: 'cancelada', label: t('myBookings.tabs.cancelled'), count: bookings.filter(b => b.estado === 'cancelada').length },
    { key: 'all', label: t('myBookings.tabs.all'), count: bookings.length }
  ]

  return (
    <>
      <div className="space-y-6">
        <div className="px-1">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('myBookings.title')}</h2>
          <p className="text-gray-600">{t('myBookings.subtitle')}</p>
        </div>

        <div className="border-b border-gray-200 -mx-4 sm:mx-0">
          <div className="overflow-x-auto scrollbar-hide">
            <nav className="flex px-4 sm:px-0 min-w-max sm:min-w-0">
              {tabs.map((tab, index) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex-shrink-0 py-3 px-3 sm:px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                    filter === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } ${index > 0 ? 'ml-6 sm:ml-8' : ''}`}
                >
                  <span>{tab.label}</span>
                  <span className="ml-1">({tab.count})</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {filteredBookings.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">{t('myBookings.sort.title')}</h3>
              <span className="text-xs text-gray-500">
                {filteredBookings.length} {t('myBookings.sort.appointment', { count: filteredBookings.length })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSort('fecha_hora')}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors hover:bg-gray-50 ${
                  sortColumn === 'fecha_hora' ? 'bg-blue-50 border-blue-500' : ''
                }`}
              >
                <span>{t('myBookings.sort.date')}</span>
                <SortIcon column="fecha_hora" />
              </button>
              <button
                onClick={() => handleSort('servicio')}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors hover:bg-gray-50 ${
                  sortColumn === 'servicio' ? 'bg-blue-50 border-blue-500' : ''
                }`}
              >
                <span>{t('myBookings.sort.service')}</span>
                <SortIcon column="servicio" />
              </button>
              <button
                onClick={() => handleSort('perro')}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors hover:bg-gray-50 ${
                  sortColumn === 'perro' ? 'bg-blue-50 border-blue-500' : ''
                }`}
              >
                <span>{t('myBookings.sort.dog')}</span>
                <SortIcon column="perro" />
              </button>
            </div>
          </div>
        )}

        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('myBookings.noBookings.title')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' ? t('myBookings.noBookings.all') : t('myBookings.noBookings.filtered', { status: filter })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="card hover:shadow-lg transition-shadow duration-200">
                <div className="card-body p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl flex-shrink-0">
                        {getServiceIcon(booking.services?.tipo)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {booking.services?.nombre}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">
                          {booking.dogs?.nombre} {booking.dogs?.raza && `(${booking.dogs.raza})`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end sm:text-right space-x-3 sm:space-x-0 sm:space-y-1">
                      {getStatusBadge(booking.estado)}
                      <div>
                        
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500 font-medium">{t('myBookings.booking.dateTime')}</p>
                      <p className="font-medium">
                        {format(new Date(booking.fecha_hora.substring(0, 10)), "EEEE d 'de' MMMM", { locale: getDateLocale() })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {booking.fecha_hora.substring(11, 16)} ({booking.services?.duracion_minutos} {t('myBookings.booking.minutes')})
                      </p>
                    </div>
                    
                    <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                      <p className="text-sm text-gray-500 font-medium">{t('myBookings.booking.createdOn')}</p>
                      <p className="font-medium">
                        {format(new Date(booking.created_at), 'd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                  </div>

                  {booking.observaciones && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 font-medium mb-2">{t('myBookings.booking.observations')}</p>
                      <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {booking.observaciones}
                      </div>
                    </div>
                  )}

                  {booking.motivo_recargo && (
                    <div className="mb-4">
                      <p className="text-sm text-orange-600 font-medium mb-2">{t('myBookings.booking.chargeReason')}</p>
                      <div className="text-sm text-orange-700 bg-orange-50 p-3 rounded-lg border border-orange-200">
                        {booking.motivo_recargo}
                      </div>
                    </div>
                  )}

                  {renderBookingAction(booking)}

                  {booking.estado === 'cancelada' && (
                    <div className="mt-3 text-xs text-gray-500 text-center sm:text-left">
                      {t('myBookings.booking.cancelledOn')} {format(new Date(booking.updated_at), 'd/MM/yyyy HH:mm')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <style jsx>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          
          .status-pending {
            background-color: #fef3c7;
            color: #92400e;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            display: inline-block;
          }


          .status-pending-confirmation {
            background-color: #fed7aa;
            color: #9a3412;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            display: inline-block;
          }

          .status-confirmed {
            background-color: #dbeafe;
            color: #1e40af;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            display: inline-block;
          }
          
          .status-completed {
            background-color: #dcfce7;
            color: #166534;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            display: inline-block;
          }
          
          .status-cancelled {
            background-color: #fee2e2;
            color: #991b1b;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            display: inline-block;
          }
        `}</style>
      </div>

      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false)
          setBookingToCancel(null)
        }}
        onConfirm={cancelBooking}
        title={cancelModalData.title}
        message={cancelModalData.message}
        confirmText={t('myBookings.cancelModal.confirm')}
        cancelText={t('myBookings.cancelModal.cancel')}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        icon={
          <div className={`flex items-center justify-center w-10 h-10 mx-auto rounded-full ${
            cancelModalData.hasLateCharge ? 'bg-orange-100' : 'bg-red-100'
          }`}>
            {cancelModalData.hasLateCharge ? (
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        }
      />
    </>
  )
}