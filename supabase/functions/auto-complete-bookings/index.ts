import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date()
    
    // Obtener citas pendientes cuya fecha ya pasó
    const { data: pastBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, fecha_hora, duracion_minutos')
      .eq('estado', 'pendiente')
      .lt('fecha_hora', now.toISOString())
    
    if (fetchError) throw fetchError
    
    if (!pastBookings || pastBookings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay citas pendientes que completar',
          updated: 0 
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }
    
    // Filtrar las que realmente terminaron (fecha + duración < ahora)
    const bookingsToComplete = pastBookings.filter(booking => {
      const bookingEnd = new Date(booking.fecha_hora)
      bookingEnd.setMinutes(bookingEnd.getMinutes() + booking.duracion_minutos)
      return bookingEnd < now
    })
    
    if (bookingsToComplete.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay citas que hayan terminado',
          updated: 0 
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }
    
    // Actualizar en lote
    const bookingIds = bookingsToComplete.map(b => b.id)
    
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        estado: 'completada',
        updated_at: now.toISOString()
      })
      .in('id', bookingIds)
    
    if (updateError) throw updateError
    
    console.log(`Citas completadas: ${bookingsToComplete.length}`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${bookingsToComplete.length} citas marcadas como completadas`,
        updated: bookingsToComplete.length,
        bookingIds: bookingIds
      }),
      { headers: { "Content-Type": "application/json" } }
    )
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" } 
      }
    )
  }
})