import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    console.log('🔔 Iniciando envío de recordatorios programados...')
    
    // Crear cliente de Supabase con service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date()
    
    // Obtener recordatorios pendientes que ya deberían enviarse
    const { data: pendingReminders, error: fetchError } = await supabase
      .from('scheduled_email_reminders')
      .select(`
        id,
        booking_id,
        user_id,
        email,
        scheduled_for,
        email_type,
        booking_data
      `)
      .eq('is_sent', false)
      .lte('scheduled_for', now.toISOString())
      .limit(50) // Procesar máximo 50 por ejecución
    
    if (fetchError) {
      console.error('❌ Error obteniendo recordatorios:', fetchError)
      throw fetchError
    }
    
    if (!pendingReminders || pendingReminders.length === 0) {
      console.log('✅ No hay recordatorios pendientes para enviar')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay recordatorios pendientes',
          sent: 0 
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }
    
    console.log(`📧 Encontrados ${pendingReminders.length} recordatorios para enviar`)
    
    const results = []
    
    // Enviar cada recordatorio
    for (const reminder of pendingReminders) {
      try {
        console.log(`📤 Enviando recordatorio ${reminder.id} a ${reminder.email}`)
        
        // Obtener idioma del usuario
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', reminder.user_id)
          .single()
        
        const language = userProfile?.preferred_language || 'es'
        
        // Mapear variables correctamente
        const emailData = {
          emailType: reminder.email_type || 'reminder_24h',
          to: reminder.email,
          language: language,
          clientName: reminder.booking_data.client_name,
          dogName: reminder.booking_data.pet_name,
          service: reminder.booking_data.service_name,
          date: reminder.booking_data.fecha,
          time: reminder.booking_data.hora,
          duration: reminder.booking_data.duracion_minutos
        }
        
        // Invocar función resend-email
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('resend-email', {
          body: emailData
        })
        
        if (emailError) {
          console.error(`❌ Error enviando email ${reminder.id}:`, emailError)
          results.push({
            id: reminder.id,
            success: false,
            error: emailError.message
          })
          continue
        }
        
        // Marcar como enviado
        const { error: updateError } = await supabase
          .from('scheduled_email_reminders')
          .update({ 
            is_sent: true,
            sent_at: now.toISOString()
          })
          .eq('id', reminder.id)
        
        if (updateError) {
          console.warn(`⚠️ Email enviado pero no se pudo actualizar registro ${reminder.id}:`, updateError)
        }
        
        console.log(`✅ Recordatorio ${reminder.id} enviado exitosamente`)
        results.push({
          id: reminder.id,
          success: true,
          emailId: emailResult?.emailId
        })
        
      } catch (error) {
        console.error(`❌ Error procesando recordatorio ${reminder.id}:`, error)
        results.push({
          id: reminder.id,
          success: false,
          error: error.message
        })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    console.log(`📊 Resumen: ${successCount} enviados, ${failCount} fallidos`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${successCount} recordatorios enviados, ${failCount} fallidos`,
        sent: successCount,
        failed: failCount,
        results: results
      }),
      { headers: { "Content-Type": "application/json" } }
    )
    
  } catch (error) {
    console.error('❌ Error general:', error)
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
