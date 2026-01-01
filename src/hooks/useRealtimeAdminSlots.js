// hooks/useRealtimeAdminSlots.js
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook para escuchar cambios en tiempo real en la tabla available_time_slots
 */
export const useRealtimeAdminSlots = (onSlotsChanged) => {
  useEffect(() => {
    console.log('🔌 Conectando a cambios en available_time_slots...')
    
    const channel = supabase
      .channel('admin-slots-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'available_time_slots'
        },
        (payload) => {
          console.log('🔔 Admin cambió horarios:', payload)
          
          const eventType = payload.eventType
          const record = payload.new || payload.old
          const date = record?.date
          
          if (onSlotsChanged && typeof onSlotsChanged === 'function') {
            onSlotsChanged({ date, eventType, record })
          }
        }
      )
      .subscribe()
    
    return () => {
      console.log('🔌 Desconectando de cambios en available_time_slots')
      supabase.removeChannel(channel)
    }
  }, [onSlotsChanged])
}