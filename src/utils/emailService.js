// src/utils/emailService.js
import { supabase } from '../lib/supabase'

// Función base para enviar emails
const sendEmail = async (type, to, data) => {
  try {
    console.log(`📧 Enviando email tipo: ${type} a: ${to}`)

    const emailPayload = {
      type,
      to,
      ...data
    }

    const { data: response, error } = await supabase.functions.invoke('resend-email', {
      body: emailPayload
    })

    if (error) throw error
    
    console.log(`✅ Email ${type} enviado correctamente:`, response?.emailId)
    return { success: true, data: response }
    
  } catch (error) {
    console.error(`❌ Error enviando email ${type}:`, error)
    return { success: false, error: error.message }
  }
}

// 1. Email de bienvenida al registrarse
export const sendWelcomeEmail = async (userData) => {
  return sendEmail('welcome', userData.email, {
    clientName: userData.nombre_completo || userData.email?.split('@')[0] || 'Usuario'
  })
}

// 2. Email cuando se crea una cita
export const sendBookingCreatedEmail = async (bookingData) => {
  const emailData = {
    clientName: bookingData.profiles?.nombre_completo || bookingData.clientName,
    dogName: bookingData.pet_name || bookingData.dogName,
    service: bookingData.service_name || bookingData.service,
    date: formatDate(bookingData.fecha || bookingData.date),
    time: bookingData.hora || bookingData.time,
    duration: bookingData.duration || getServiceDuration(bookingData.service_name || bookingData.service),
    price: bookingData.price || getServicePrice(bookingData.service_name || bookingData.service)
  }

  return sendEmail('booking_created', bookingData.profiles?.email || bookingData.clientEmail, emailData)
}

// 3. Email recordatorio 24h antes
export const sendReminderEmail = async (bookingData) => {
  const emailData = {
    clientName: bookingData.profiles?.nombre_completo || bookingData.clientName,
    dogName: bookingData.pet_name || bookingData.dogName,
    service: bookingData.service_name || bookingData.service,
    date: formatDate(bookingData.fecha || bookingData.date),
    time: bookingData.hora || bookingData.time,
    duration: bookingData.duration || getServiceDuration(bookingData.service_name || bookingData.service)
  }

  return sendEmail('reminder_24h', bookingData.profiles?.email || bookingData.clientEmail, emailData)
}

// 4. Email cuando se cancela una cita
export const sendCancellationEmail = async (bookingData, canceledBy = 'client', reason = null) => {
  const emailData = {
    clientName: bookingData.profiles?.nombre_completo || bookingData.clientName,
    dogName: bookingData.pet_name || bookingData.dogName,
    service: bookingData.service_name || bookingData.service,
    date: formatDate(bookingData.fecha || bookingData.date),
    time: bookingData.hora || bookingData.time,
    canceledBy, // 'client' o 'admin'
    reason
  }

  return sendEmail('booking_cancelled', bookingData.profiles?.email || bookingData.clientEmail, emailData)
}

// 5. Email post-cita (especial para primera cita)
export const sendPostAppointmentEmail = async (bookingData, isFirstAppointment = false, notes = null) => {
  const emailData = {
    clientName: bookingData.profiles?.nombre_completo || bookingData.clientName,
    dogName: bookingData.pet_name || bookingData.dogName,
    service: bookingData.service_name || bookingData.service,
    date: formatDate(bookingData.fecha || bookingData.date),
    time: bookingData.hora || bookingData.time,
    duration: bookingData.duration || getServiceDuration(bookingData.service_name || bookingData.service),
    isFirstAppointment,
    notes
  }

  return sendEmail('post_appointment', bookingData.profiles?.email || bookingData.clientEmail, emailData)
}

// Funciones auxiliares para obtener datos de servicios
const getServiceDuration = (serviceName) => {
  const durations = {
    'Rehabilitación': 60,
    'Hidroterapia': 45,
    'Aqua Agility': 30,
    'Hidroterapia + Rehabilitación': 90,
    'Rehabilitación a Domicilio': 60
  }
  return durations[serviceName] || 60
}

const getServicePrice = (serviceName) => {
  const prices = {
    'Rehabilitación': 50,
    'Hidroterapia': 40,
    'Aqua Agility': 35,
    'Hidroterapia + Rehabilitación': 80,
    'Rehabilitación a Domicilio': 70
  }
  return prices[serviceName] || 50
}

// Función para formatear fechas
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch (error) {
    console.error('Error formateando fecha:', error)
    return dateStr
  }
}

// Función para verificar si es la primera cita del cliente
export const checkIfFirstAppointment = async (userId) => {
  try {
    const { data: completedBookings, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .limit(2) // Solo necesitamos saber si hay más de 1

    if (error) {
      console.error('Error verificando primera cita:', error)
      return false
    }

    // Es primera cita si solo hay 1 cita completada (la actual)
    return completedBookings?.length === 1
  } catch (error) {
    console.error('Error en checkIfFirstAppointment:', error)
    return false
  }
}

// Función para programar recordatorios automáticos
export const scheduleEmailReminder = async (bookingData) => {
  if (!bookingData.fecha || !bookingData.hora) return false

  try {
    // Calcular timestamp para 24h antes
    const bookingDateTime = new Date(`${bookingData.fecha}T${bookingData.hora}`)
    const reminderTime = new Date(bookingDateTime.getTime() - (24 * 60 * 60 * 1000))
    const now = new Date()

    // Solo programar si es en el futuro
    if (reminderTime <= now) {
      console.log('⚠️ La cita es en menos de 24h, enviando recordatorio inmediato')
      return await sendReminderEmail(bookingData)
    }

    // Guardar en tabla de recordatorios programados
    const { error } = await supabase
      .from('scheduled_email_reminders')
      .insert({
        booking_id: bookingData.id,
        user_id: bookingData.user_id,
        email: bookingData.profiles?.email || bookingData.clientEmail,
        scheduled_for: reminderTime.toISOString(),
        email_type: 'reminder_24h',
        booking_data: {
          clientName: bookingData.profiles?.nombre_completo || bookingData.clientName,
          dogName: bookingData.pet_name || bookingData.dogName,
          service: bookingData.service_name || bookingData.service,
          date: bookingData.fecha,
          time: bookingData.hora
        },
        is_sent: false,
        created_at: new Date().toISOString()
      })

    if (error) throw error

    console.log('⏰ Recordatorio por email programado para:', reminderTime.toLocaleString())
    return true

  } catch (error) {
    console.error('❌ Error programando recordatorio por email:', error)
    return false
  }
}

// Función para envío masivo (utilidad para administradores)
export const sendBulkEmails = async (type, recipients, commonData) => {
  const results = []
  
  for (const recipient of recipients) {
    const result = await sendEmail(type, recipient.email, {
      ...commonData,
      clientName: recipient.nombre_completo || recipient.email?.split('@')[0] || 'Usuario'
    })
    
    results.push({
      email: recipient.email,
      success: result.success,
      error: result.error
    })
  }

  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  console.log(`📊 Envío masivo completado: ${successful} exitosos, ${failed} fallidos`)
  
  return {
    total: recipients.length,
    successful,
    failed,
    results
  }
}

// Función de testing para desarrollo
export const testEmailSystem = async (testEmail) => {
  if (process.env.NODE_ENV !== 'development') {
    console.log('⚠️ Test de emails solo disponible en desarrollo')
    return false
  }

  console.log('🧪 Iniciando test del sistema de emails...')

  const testData = {
    clientName: 'Juan Pérez',
    dogName: 'Max',
    service: 'Hidroterapia',
    date: '2024-12-20',
    time: '10:30',
    duration: 45,
    price: 40
  }

  const tests = [
    { type: 'welcome', data: { clientName: 'Juan Pérez' } },
    { type: 'booking_created', data: testData },
    { type: 'reminder_24h', data: testData },
    { type: 'booking_cancelled', data: { ...testData, canceledBy: 'client', reason: 'Motivos personales' } },
    { type: 'post_appointment', data: { ...testData, isFirstAppointment: true, notes: 'Progreso excelente' } }
  ]

  const results = []

  for (const test of tests) {
    console.log(`🔬 Testeando email tipo: ${test.type}`)
    const result = await sendEmail(test.type, testEmail, test.data)
    results.push({ type: test.type, success: result.success })
    
    // Delay entre tests
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  console.log('📋 Resultados del test:', results)
  return results
}

// Exportar funciones principales
export {
  sendEmail as sendCustomEmail,
  formatDate,
  getServiceDuration,
  getServicePrice
}