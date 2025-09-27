// src/hooks/useNotifications.js
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export const useNotifications = () => {
  const [loading, setLoading] = useState(false)

  // Función base para enviar emails usando tu Edge Function
  const sendEmail = async (emailType, to, data) => {
    try {
      console.log(`📧 Enviando email tipo: ${emailType} a: ${to}`)

      const emailPayload = {
        emailType,
        to,
        clientName: data.clientName,
        subject: data.subject,
        ...data
      }

      const { data: response, error } = await supabase.functions.invoke('resend-email', {
        body: emailPayload
      })

      if (error) throw error
      
      console.log(`✅ Email ${emailType} enviado correctamente:`, response?.emailId)
      return { success: true, data: response }
      
    } catch (error) {
      console.error(`❌ Error enviando email ${emailType}:`, error)
      return { success: false, error: error.message }
    }
  }

  // ✅ NUEVA: Obtener email del administrador
  const getAdminEmail = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'admin')
        .single()

      if (error) {
        console.error('Error obteniendo email del admin:', error)
        return null
      }

      return data?.email || null
    } catch (error) {
      console.error('Error en getAdminEmail:', error)
      return null
    }
  }

  // 1. Email de bienvenida
  const sendWelcomeEmail = async (to, clientName) => {
    return await sendEmail('welcome', to, {
      clientName: clientName || to?.split('@')[0] || 'Usuario',
      subject: '¡Bienvenido a Fisioterapia Gossos!'
    })
  }

  // 2. Email confirmación de cita
  const sendBookingConfirmationEmail = async (bookingData) => {
    return await sendEmail('booking', bookingData.to, {
      clientName: bookingData.clientName,
      dogName: bookingData.dogName,
      service: bookingData.service,
      date: bookingData.date,
      time: bookingData.time,
      duration: bookingData.duration,
      price: bookingData.price,
      subject: '📅 Confirmación de cita - Fisioterapia Gossos'
    })
  }

  // 3. Email cancelación de cita
  const sendBookingCancellationEmail = async (bookingData) => {
    return await sendEmail('cancellation', bookingData.to, {
      clientName: bookingData.clientName,
      dogName: bookingData.dogName,
      service: bookingData.service,
      date: bookingData.date,
      time: bookingData.time,
      cancellationReason: bookingData.cancellationReason,
      subject: '❌ Cita cancelada - Fisioterapia Gossos'
    })
  }

  // 4. Email recordatorio 24h
  const sendReminderEmail = async (bookingData) => {
    return await sendEmail('reminder', bookingData.to, {
      clientName: bookingData.clientName,
      dogName: bookingData.dogName,
      service: bookingData.service,
      date: bookingData.date,
      time: bookingData.time,
      duration: bookingData.duration,
      subject: '🔔 Recordatorio de cita - Fisioterapia Gossos'
    })
  }

  // 5. Email reset de contraseña
  const sendPasswordResetEmail = async (to, resetData) => {
    return await sendEmail('password_reset', to, {
      clientName: resetData.clientName || to?.split('@')[0] || 'Usuario',
      resetUrl: resetData.resetUrl,
      expirationTime: resetData.expirationTime || '60 minutos',
      subject: '🔑 Restablece tu contraseña - Fisioterapia Gossos'
    })
  }

  // 6. Email confirmación de cambio de contraseña
  const sendPasswordChangedEmail = async (to, clientName) => {
    return await sendEmail('password_changed', to, {
      clientName: clientName || to?.split('@')[0] || 'Usuario',
      changeTime: new Date().toLocaleString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      subject: '✅ Contraseña actualizada - Fisioterapia Gossos'
    })
  }

  // ✅ 7. NUEVA: Email al admin sobre nueva reserva
  const sendAdminNewBookingEmail = async (bookingData) => {
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      console.warn('No se pudo obtener el email del administrador')
      return { success: false, error: 'Admin email not found' }
    }

    return await sendEmail('admin_new_booking', adminEmail, {
      clientName: bookingData.clientName,
      clientEmail: bookingData.clientEmail,
      dogName: bookingData.dogName,
      service: bookingData.service,
      date: bookingData.date,
      time: bookingData.time,
      duration: bookingData.duration,
      price: bookingData.price,
      spaces: bookingData.spaces,
      observations: bookingData.observations,
      subject: '🔔 Nueva reserva registrada - Fisioterapia Gossos'
    })
  }

  // ✅ 8. NUEVA: Email al admin sobre cancelación
  const sendAdminCancellationEmail = async (cancellationData) => {
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      console.warn('No se pudo obtener el email del administrador')
      return { success: false, error: 'Admin email not found' }
    }

    return await sendEmail('admin_booking_cancelled', adminEmail, {
      clientName: cancellationData.clientName,
      clientEmail: cancellationData.clientEmail,
      dogName: cancellationData.dogName,
      service: cancellationData.service,
      date: cancellationData.date,
      time: cancellationData.time,
      cancellationReason: cancellationData.cancellationReason,
      hasLateCharge: cancellationData.hasLateCharge || false,
      chargeAmount: cancellationData.chargeAmount || '0',
      subject: '❌ Cita cancelada - Fisioterapia Gossos'
    })
  }

  // Función para mostrar toast notifications
  const showToast = (type, message) => {
    switch (type) {
      case 'success':
        toast.success(message)
        break
      case 'error':
        toast.error(message)
        break
      case 'info':
        toast.info || toast(message)
        break
      default:
        toast(message)
    }
  }

  // Función mejorada: Reset de contraseña completo
  const handlePasswordReset = async (email, customResetUrl = null) => {
    try {
      setLoading(true)

      const resetUrl = customResetUrl || `${window.location.origin}/reset-password`
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      })

      if (error) throw error
      return { success: true }

    } catch (error) {
      console.error('Error en password reset:', error)
      return { success: false, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  // Función: Confirmar cambio de contraseña exitoso
  const confirmPasswordChanged = async (userEmail, userName) => {
    try {
      await sendPasswordChangedEmail(userEmail, userName)
      return { success: true }
    } catch (error) {
      console.error('Error enviando confirmación de cambio de contraseña:', error)
      return { success: false, error: error.message }
    }
  }

  // ✅ FUNCIONES COMPATIBLES con tu NotificationProvider existente
  const sendWelcome = async (userData) => {
    const displayName = userData.nombre_completo || userData.email?.split('@')[0] || 'Usuario'
    return await sendWelcomeEmail(userData.email, displayName)
  }

  const confirmBooking = async (bookingData) => {
    const emailData = {
      to: bookingData.cliente_email || bookingData.to,
      clientName: bookingData.cliente_nombre || bookingData.clientName,
      dogName: bookingData.pet_name || bookingData.dogName,
      service: bookingData.service_name || bookingData.service,
      date: formatDate(bookingData.fecha || bookingData.date),
      time: formatTime(bookingData.hora || bookingData.time),
      duration: bookingData.duracion || bookingData.duration || '60',
      price: bookingData.precio || bookingData.price || '0'
    }
    return await sendBookingConfirmationEmail(emailData)
  }

  const cancelBooking = async (cancelationData) => {
    const emailData = {
      to: cancelationData.cliente_email || cancelationData.to,
      clientName: cancelationData.cliente_nombre || cancelationData.clientName,
      dogName: cancelationData.pet_name || cancelationData.dogName,
      service: cancelationData.service_name || cancelationData.service,
      date: formatDate(cancelationData.fecha || cancelationData.date),
      time: formatTime(cancelationData.hora || cancelationData.time),
      cancellationReason: cancelationData.motivo_cancelacion || cancelationData.cancellationReason || 'Cancelación de cita'
    }
    return await sendBookingCancellationEmail(emailData)
  }

  const sendReminder = async (reminderData) => {
    const emailData = {
      to: reminderData.cliente_email || reminderData.to,
      clientName: reminderData.cliente_nombre || reminderData.clientName,
      dogName: reminderData.pet_name || reminderData.dogName,
      service: reminderData.service_name || reminderData.service,
      date: formatDate(reminderData.fecha || reminderData.date),
      time: formatTime(reminderData.hora || reminderData.time),
      duration: reminderData.duracion || reminderData.duration || '60'
    }
    return await sendReminderEmail(emailData)
  }

  // ✅ NUEVAS FUNCIONES DE ALTO NIVEL para usar en los componentes
  const notifyAdminNewBooking = async (bookingData) => {
    try {
      const adminEmailData = {
        clientName: bookingData.cliente_nombre || bookingData.clientName,
        clientEmail: bookingData.cliente_email || bookingData.clientEmail,
        dogName: bookingData.pet_name || bookingData.dogName,
        service: bookingData.service_name || bookingData.service,
        date: formatDate(bookingData.fecha || bookingData.date),
        time: formatTime(bookingData.hora || bookingData.time),
        duration: bookingData.duracion || bookingData.duration || '60',
        price: bookingData.precio || bookingData.price || '0',
        spaces: bookingData.spaces_display || bookingData.spaces,
        observations: bookingData.observaciones || bookingData.observations || null
      }

      const result = await sendAdminNewBookingEmail(adminEmailData)
      if (result.success) {
        console.log('✅ Notificación al admin enviada correctamente')
      }
      return result
    } catch (error) {
      console.error('Error notificando al admin sobre nueva reserva:', error)
      return { success: false, error: error.message }
    }
  }

  const notifyAdminCancellation = async (cancellationData) => {
    try {
      const adminEmailData = {
        clientName: cancellationData.cliente_nombre || cancellationData.clientName,
        clientEmail: cancellationData.cliente_email || cancellationData.clientEmail,
        dogName: cancellationData.pet_name || cancellationData.dogName,
        service: cancellationData.service_name || cancellationData.service,
        date: formatDate(cancellationData.fecha || cancellationData.date),
        time: formatTime(cancellationData.hora || cancellationData.time),
        cancellationReason: cancellationData.motivo_cancelacion || cancellationData.cancellationReason,
        hasLateCharge: cancellationData.has_late_charge || false,
        chargeAmount: cancellationData.recargo_cancelacion || '0'
      }

      const result = await sendAdminCancellationEmail(adminEmailData)
      if (result.success) {
        console.log('✅ Notificación de cancelación al admin enviada correctamente')
      }
      return result
    } catch (error) {
      console.error('Error notificando al admin sobre cancelación:', error)
      return { success: false, error: error.message }
    }
  }

  // Utilidades de formato
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

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    try {
      return timeStr.substring(0, 5) // HH:MM
    } catch (error) {
      console.error('Error formateando hora:', error)
      return timeStr
    }
  }

  // Función de testing para desarrollo
  const testEmailSystem = async (testEmail) => {
    if (process.env.NODE_ENV !== 'development') {
      console.log('⚠️ Test de emails solo disponible en desarrollo')
      return false
    }

    console.log('🧪 Iniciando test del sistema de emails...')

    const testData = {
      clientName: 'Juan Pérez',
      clientEmail: 'juan@test.com',
      dogName: 'Max',
      service: 'Hidroterapia',
      date: 'viernes, 20 de diciembre de 2024',
      time: '10:30',
      duration: '45',
      price: '40',
      spaces: 'Piscina (Hidroterapia/Aqua Agility)',
      observations: 'Test de observaciones'
    }

    const tests = [
      { 
        type: 'welcome', 
        func: () => sendWelcomeEmail(testEmail, 'Juan Pérez')
      },
      { 
        type: 'booking_confirmed', 
        func: () => sendBookingConfirmationEmail({ to: testEmail, ...testData })
      },
      { 
        type: 'reminder_24h', 
        func: () => sendReminderEmail({ to: testEmail, ...testData })
      },
      { 
        type: 'booking_cancelled', 
        func: () => sendBookingCancellationEmail({ 
          to: testEmail, 
          ...testData, 
          cancellationReason: 'Motivos personales' 
        })
      },
      { 
        type: 'password_reset', 
        func: () => sendPasswordResetEmail(testEmail, {
          clientName: 'Juan Pérez',
          resetUrl: `${window.location.origin}/reset-password?token=test123`,
          expirationTime: '60 minutos'
        })
      },
      { 
        type: 'password_changed', 
        func: () => sendPasswordChangedEmail(testEmail, 'Juan Pérez')
      },
      { 
        type: 'admin_new_booking', 
        func: () => sendAdminNewBookingEmail(testData)
      },
      { 
        type: 'admin_cancellation', 
        func: () => sendAdminCancellationEmail({
          ...testData,
          cancellationReason: 'Cancelación por parte del cliente',
          hasLateCharge: true,
          chargeAmount: '10'
        })
      }
    ]

    const results = []

    for (const test of tests) {
      console.log(`🔬 Testeando email tipo: ${test.type}`)
      const result = await test.func()
      results.push({ type: test.type, success: result.success })
      
      // Delay entre tests
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log('📋 Resultados del test:', results)
    return results
  }

  return {
    // Funciones principales de email
    sendWelcomeEmail,
    sendBookingConfirmationEmail,
    sendBookingCancellationEmail,
    sendReminderEmail,
    sendPasswordResetEmail,
    sendPasswordChangedEmail,
    sendAdminNewBookingEmail,        // ✅ NUEVO
    sendAdminCancellationEmail,      // ✅ NUEVO
    
    // Funciones de alto nivel
    handlePasswordReset,
    confirmPasswordChanged,
    notifyAdminNewBooking,           // ✅ NUEVO - Para usar en componentes
    notifyAdminCancellation,         // ✅ NUEVO - Para usar en componentes
    
    // Funciones compatibles con tu NotificationProvider
    sendWelcome,
    confirmBooking,
    cancelBooking,
    sendReminder,
    
    // Utilidades
    showToast,
    testEmailSystem,
    formatDate,
    formatTime,
    getAdminEmail,                   // ✅ NUEVO
    
    // Estado
    loading,
    
    // Función base para casos personalizados
    sendEmail
  }
}