import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import { useBookingNotifications } from '../NotificationProvider'

export default function MyBookings() {
  const { user, profile } = useAuth()
  const [bookings, setBookings] = useState([])
  const { notifyBookingCanceled, notifyAdminCancellation } = useBookingNotifications()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pendiente') // all, pendiente, completadas, canceladas
  const [cancellingBookings, setCancellingBookings] = useState(new Set()) // Track which bookings are being cancelled
  
  // Estados para el modal de cancelación
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState(null)
  const [cancelModalData, setCancelModalData] = useState({
    title: '',
    message: '',
    hasLateCharge: false,
    hoursRemaining: 0
  })

  // NUEVA FUNCIÓN: Obtener display de espacios
  const getBookingSpaceDisplay = (booking) => {
    // Si tenemos la información guardada directamente (nuevas reservas)
    if (booking.spaces_display) {
      return booking.spaces_display
    }
    
    // Fallback basado en tipo de servicio para reservas existentes
    const serviceType = booking.services?.tipo
    switch (serviceType) {
      case 'hidroterapia_rehabilitacion':
        return 'Caseta de Rehabilitación + Piscina (Hidroterapia/Aqua Agility)'
      case 'rehabilitacion':
        return 'Caseta de Rehabilitación'
      case 'hidroterapia':
      case 'aqua_agility':
        return 'Piscina (Hidroterapia/Aqua Agility)'
      default:
        return booking.spaces?.nombre || 'Espacio General'
    }
  }

  useEffect(() => {
    loadBookings()
    // Set up interval to check for completed bookings every minute
    const interval = setInterval(checkAndUpdateCompletedBookings, 60000) // 1 minute
    return () => clearInterval(interval)
  }, [])

  const loadBookings = async () => {
    try {
      setLoading(true)
      
      // MODIFICADO: Incluir spaces_display en la consulta
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
      toast.error('Error cargando citas')
    } finally {
      setLoading(false)
    }
  }

  // ACTUALIZADA - Check and update bookings that should be completed
  const checkAndUpdateCompletedBookings = async () => {
    try {
      const now = new Date()
      const bookingsToUpdate = bookings.filter(booking => {
        // ACTUALIZADO: Incluir pendiente para auto-completar
        if (!['pendiente'].includes(booking.estado)) return false
        
        // Extraer fecha y hora directamente del string para evitar problemas de zona horaria
        const bookingDateStr = booking.fecha_hora.substring(0, 10) // "2025-09-15"
        const bookingTimeStr = booking.fecha_hora.substring(11, 16) // "08:00"
        const [hours, minutes] = bookingTimeStr.split(':').map(Number)

        // Crear fecha local correcta
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
        
        // Reload bookings to reflect changes
        loadBookings()
        toast.success(`${bookingsToUpdate.length} cita(s) marcada(s) como completada(s)`)
      }
    } catch (error) {
      console.error('Error updating completed bookings:', error)
    }
  }

  // NUEVA función para abrir el modal de cancelación
  const openCancelModal = (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId)
    
    // Extraer fecha y hora correctamente para evitar problemas de zona horaria
    const bookingDateStr = booking.fecha_hora.substring(0, 10)
    const bookingTimeStr = booking.fecha_hora.substring(11, 16)
    const [hours, minutes] = bookingTimeStr.split(':').map(Number)
    const [year, month, day] = bookingDateStr.split('-').map(Number)

    const bookingDate = new Date()
    bookingDate.setFullYear(year, month - 1, day)
    bookingDate.setHours(hours, minutes, 0, 0)

    const now = new Date()
    const hoursUntilBooking = (bookingDate - now) / (1000 * 60 * 60)

    // Determinar datos del modal según las horas restantes
    let modalData
    if (hoursUntilBooking >= 24) {
      modalData = {
        title: 'Cancelar Cita',
        message: 'Estás seguro que quieres cancelar esta cita? No se aplicarán cargos adicionales.',
        hasLateCharge: false,
        hoursRemaining: Math.ceil(hoursUntilBooking)
      }
    } else {
      modalData = {
        title: 'Cancelar Cita - Recargo por Cancelación Tardía',
        message: `Estás seguro que quieres cancelar esta cita? Se aplicará el recargo correspondiente por cancelación con menos de 24 horas de anticipación.`,
        hasLateCharge: true,
        hoursRemaining: Math.ceil(hoursUntilBooking)
      }
    }

    setBookingToCancel(booking)
    setCancelModalData(modalData)
    setShowCancelModal(true)
  }

  // MODIFICADA función cancelBooking - sin confirm, solo lógica de cancelación
  const cancelBooking = async () => {
    if (!bookingToCancel) return

    const booking = bookingToCancel
    const bookingId = booking.id


    
    // Recalcular horas restantes
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

      // Preparar datos de actualización
      const updateData = {
        estado: 'cancelada',
        updated_at: new Date().toISOString()
      }

      // Si la cancelación es con menos de 24h, agregar recargo
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

      // ✅ AQUÍ AÑADIR EMAIL DE CANCELACIÓN
      try {
        await notifyBookingCanceled({
          cliente_nombre: user.nombre_completo, // o como se llame en tu contexto
          pet_name: booking.dogs?.nombre,
          service_name: booking.services?.nombre,
          fecha: booking.fecha_hora.substring(0, 10),
          hora: booking.fecha_hora.substring(11, 16),
          motivo_cancelacion: hoursUntilBooking < 24 ? 'Cancelación tardía por parte del cliente' : 'Cancelación por parte del cliente'
        })
      } catch (emailError) {
        console.error('Error enviando email de cancelación:', emailError)
        // No interrumpir el flujo si falla el email
      }

      // ✅ AGREGAR ESTE BLOQUE COMPLETO JUSTO DESPUÉS:
      // Notificar al administrador sobre la cancelación
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
        // No interrumpir el flujo si falla la notificación al admin
      }

      // Update local state immediately for better UX
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
      toast.error('Error cancelando la cita')
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
      completada: 'status-completed',
      cancelada: 'status-cancelled'
    }

    const statusText = {
      pendiente: 'Pendiente',
      completada: 'Completada',
      cancelada: 'Cancelada'
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
      case 'aqua_agility':
        return '🏊‍♂️'
      case 'hidroterapia_rehabilitacion':
        return '🏥💧'
      default:
        return '⚕️'
    }
  }

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true
    return booking.estado === filter
  })

  // ACTUALIZADA función canCancelBooking - permitir cancelar pendientes
  const canCancelBooking = (booking) => {
    // Permitir cancelar citas pendientes y confirmadas
    return ['pendiente'].includes(booking.estado)
  }

  // ACTUALIZADA función renderBookingAction - llamar openCancelModal en lugar de cancelBooking
  const renderBookingAction = (booking) => {
    if (booking.estado === 'cancelada') {
      return (
        <div className="flex flex-col items-center pt-3 mt-3 border-t border-gray-100">
          <div className="px-3 py-2 bg-red-100 text-red-800 rounded-lg font-medium text-sm mb-2">
            CITA CANCELADA
          </div>
          {booking.recargo_cancelacion && (
            <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded text-xs">
              Recargo correspondiente aplicado
            </div>
          )}
        </div>
      )
    }

    if (booking.estado === 'completada') {
      return (
        <div className="flex flex-col items-center pt-3 mt-3 border-t border-gray-100">
          <div className="px-3 py-2 bg-green-100 text-green-800 rounded-lg font-medium text-sm">
            CITA COMPLETADA
          </div>
        </div>
      )
    }

    if (canCancelBooking(booking)) {
      const isCancelling = cancellingBookings.has(booking.id)
      
      // Calcular horas restantes para mostrar información
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
          {/* NUEVO: Información del estado - responsive */}


          {/* Aviso de cancelación tardía - responsive */}
          {hoursUntilBooking < 24 && hoursUntilBooking > 0 && (
            <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <div className="text-orange-600 mt-0.5">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm text-orange-800 font-medium">
                    Cancelación tardía
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Se aplicará el recargo correspondiente
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Botón de cancelar - responsive */}
          <div className="flex justify-center sm:justify-end">
            <button
              onClick={() => openCancelModal(booking.id)}
              disabled={isCancelling}
              className="w-full sm:w-auto btn btn-danger btn-sm"
            >
              {isCancelling ? (
                <>
                  <div className="loading-spinner mr-2"></div>
                  Cancelando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancelar Cita
                </>
              )}
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">Cargando tus citas...</span>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="px-1">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Mis Citas</h2>
          <p className="text-gray-600">Gestiona tus reservas y revisa el historial</p>
        </div>

        {/* Filter Tabs - OPTIMIZADO RESPONSIVE */}
        <div className="border-b border-gray-200 -mx-4 sm:mx-0">
          <div className="overflow-x-auto scrollbar-hide">
            <nav className="flex px-4 sm:px-0 min-w-max sm:min-w-0">
              {[
                { key: 'pendiente', label: 'Pendientes', count: bookings.filter(b => b.estado === 'pendiente').length },
                { key: 'completada', label: 'Completadas', count: bookings.filter(b => b.estado === 'completada').length },
                { key: 'cancelada', label: 'Canceladas', count: bookings.filter(b => b.estado === 'cancelada').length },
                { key: 'all', label: 'Todas', count: bookings.length }
              ].map((tab, index) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex-shrink-0 py-3 px-3 sm:px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                    filter === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } ${index > 0 ? 'ml-6 sm:ml-8' : ''}`}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split('s')[0]}</span>
                  <span className="ml-1">({tab.count})</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay citas</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' ? 'No tienes citas registradas.' : `No tienes citas ${filter}.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="card hover:shadow-lg transition-shadow duration-200">
                <div className="card-body p-4 sm:p-6">
                  {/* Header optimizado responsive */}
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

                  {/* Grid de información - OPTIMIZADO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500 font-medium">Fecha y Hora</p>
                      <p className="font-medium">
                        {format(new Date(booking.fecha_hora.substring(0, 10)), "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {booking.fecha_hora.substring(11, 16)} ({booking.services?.duracion_minutos} min)
                      </p>
                    </div>
                    
                    <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                      <p className="text-sm text-gray-500 font-medium">Creada el</p>
                      <p className="font-medium">
                        {format(new Date(booking.created_at), 'd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                  </div>

                  {/* Observaciones - responsive */}
                  {booking.observaciones && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 font-medium mb-2">Observaciones</p>
                      <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {booking.observaciones}
                      </div>
                    </div>
                  )}

                  {/* Motivo de recargo - responsive */}
                  {booking.motivo_recargo && (
                    <div className="mb-4">
                      <p className="text-sm text-orange-600 font-medium mb-2">Motivo del recargo</p>
                      <div className="text-sm text-orange-700 bg-orange-50 p-3 rounded-lg border border-orange-200">
                        {booking.motivo_recargo}
                      </div>
                    </div>
                  )}

                  {/* Acciones - responsive */}
                  {renderBookingAction(booking)}

                  {/* Información de cancelación */}
                  {booking.estado === 'cancelada' && (
                    <div className="mt-3 text-xs text-gray-500 text-center sm:text-left">
                      Cancelada el {format(new Date(booking.updated_at), 'd/MM/yyyy HH:mm')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <style jsx>{`
          /* Scrollbar personalizado para móviles */
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          
          /* Status badges responsive */
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

      {/* Modal de confirmación de cancelación */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false)
          setBookingToCancel(null)
        }}
        onConfirm={cancelBooking}
        title={cancelModalData.title}
        message={cancelModalData.message}
        confirmText="Cancelar Cita"
        cancelText="Mantener Cita"
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