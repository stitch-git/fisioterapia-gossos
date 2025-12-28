// src/hooks/useRealtimeBookings.js
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearAvailableTimeSlotsCache } from '../utils/bookingUtils'

export const useRealtimeBookings = () => {
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const subscriptionRef = useRef(null)
  const updateTimeoutRef = useRef(null)

  useEffect(() => {
    // Configurar suscripción en tiempo real a la tabla bookings
    const setupRealtimeSubscription = () => {
      try {
        // Limpiar suscripción anterior si existe
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe()
        }

        // Crear nueva suscripción
        subscriptionRef.current = supabase
          .channel('bookings-realtime')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bookings'
            },
            (payload) => {
              console.log('🔴 REALTIME: Cambio detectado en bookings:', payload.eventType, payload.new?.id)
              
              // Extraer fecha de la reserva para cache targeting
              let affectedDate = null
              if (payload.new?.fecha_hora) {
                affectedDate = payload.new.fecha_hora.substring(0, 10)
              } else if (payload.old?.fecha_hora) {
                affectedDate = payload.old.fecha_hora.substring(0, 10)
              }

              // Limpiar cache específico
              if (affectedDate) {
                clearAvailableTimeSlotsCache(affectedDate)
                console.log(`🧹 Cache limpiado para fecha: ${affectedDate}`)
              } else {
                clearAvailableTimeSlotsCache() // Limpiar todo si no hay fecha específica
              }

              // Debounce múltiples updates que lleguen juntos
              if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current)
              }

              updateTimeoutRef.current = setTimeout(() => {
                // Disparar evento personalizado mejorado
                const updateEvent = new CustomEvent('realtime-booking-change', {
                  detail: {
                    eventType: payload.eventType,
                    bookingId: payload.new?.id || payload.old?.id,
                    affectedDate,
                    timestamp: Date.now(),
                    payload: payload
                  }
                })
                
                window.dispatchEvent(updateEvent)
                setLastUpdate(Date.now())
                
                console.log('📡 Evento realtime disparado para todos los componentes')
              }, 300) // 300ms debounce para evitar updates excesivos
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Suscripción realtime establecida correctamente')
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Error en canal realtime, reintentando...')
              // Reintentar después de un delay
              setTimeout(setupRealtimeSubscription, 2000)
            }
          })

      } catch (error) {
        console.error('Error configurando suscripción realtime:', error)
        // Reintentar después de un delay más largo
        setTimeout(setupRealtimeSubscription, 5000)
      }
    }

    // Inicializar suscripción
    setupRealtimeSubscription()

    // Cleanup
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      
      if (subscriptionRef.current) {
        console.log('🔌 Desconectando suscripción realtime')
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [])

  // Función para forzar actualización manual (backup)
  const forceUpdate = () => {
    clearAvailableTimeSlotsCache()
    setLastUpdate(Date.now())
    
    const manualUpdateEvent = new CustomEvent('realtime-booking-change', {
      detail: {
        eventType: 'MANUAL_REFRESH',
        timestamp: Date.now(),
        affectedDate: null
      }
    })
    
    window.dispatchEvent(manualUpdateEvent)
    console.log('🔄 Actualización manual forzada')
  }

  return {
    lastUpdate,
    forceUpdate,
    isRealtimeActive: !!subscriptionRef.current
  }
}

// Hook específico para componentes que necesitan responder a cambios
export const useRealtimeBookingUpdates = (selectedDate, selectedService, onUpdate) => {
  const { lastUpdate } = useRealtimeBookings()

  useEffect(() => {
    const handleRealtimeChange = (event) => {
      const { eventType, affectedDate, timestamp } = event.detail
      
      // Solo actualizar si es relevante para este componente
      const shouldUpdate = !affectedDate || 
                          !selectedDate || 
                          affectedDate === selectedDate ||
                          eventType === 'MANUAL_REFRESH'
      
      if (shouldUpdate && selectedDate && selectedService) {
        console.log(`🔄 Componente actualizando por realtime: ${eventType}`)
        
        // Llamar función de actualización con un pequeño delay para suavidad
        setTimeout(() => {
          onUpdate()
        }, 100)
      }
    }

    // Escuchar eventos realtime
    window.addEventListener('realtime-booking-change', handleRealtimeChange)
    
    return () => {
      window.removeEventListener('realtime-booking-change', handleRealtimeChange)
    }
  }, [selectedDate, selectedService, onUpdate])

  return { lastUpdate }
}