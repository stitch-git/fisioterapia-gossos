// src/hooks/useNotifications.js
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export const useNotifications = () => {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(false)

  // 🚨 FUNCIÓN PRINCIPAL ACTUALIZADA CON bookingId y userId
  const sendEmail = async (emailType, to, data, language = null, bookingId = null, userId = null) => {
    try {
      const emailLanguage = language || i18n.language || 'ca'

      console.log(`📧 Enviando email tipo: ${emailType} a: ${to}`, {
        idiomaSolicitado: language,
        idiomaI18n: i18n.language,
        idiomaFinal: emailLanguage,
        bookingId,
        userId
      })

      const emailPayload = {
        emailType,
        to,
        clientName: data.clientName,
        subject: data.subject,
        language: emailLanguage,
        bookingId, // 🚨 NUEVO
        userId, // 🚨 NUEVO
        ...data
      }

      const { data: response, error } = await supabase.functions.invoke('resend-email', {
        body: emailPayload
      })

      if (error) throw error

      console.log(`✅ Email ${emailType} enviado correctamente (${emailLanguage}):`, {
        emailId: response?.emailId,
        logId: response?.logId // 🚨 NUEVO: Log ID devuelto
      })
      
      return { success: true, data: response }
      
    } catch (error) {
      console.error(`❌ Error enviando email ${emailType}:`, error)
      return { success: false, error: error.message }
    }
  }

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

  const getUserLanguage = async (userEmail) => {
    try {
      // Implementar timeout de 5 segundos para la consulta
      const queryPromise = supabase
        .from('profiles')
        .select('preferred_language')
        .eq('email', userEmail)
        .single()

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout obteniendo idioma usuario')), 5000)
      )

      const { data, error } = await Promise.race([queryPromise, timeoutPromise])

      if (error || !data) {
        console.warn(`⚠️ No se pudo obtener idioma para ${userEmail}, usando fallback`, {
          error: error?.message,
          fallback: i18n.language || 'ca'
        })
        return i18n.language || 'ca'
      }

      const userLang = data.preferred_language || i18n.language || 'ca'
      console.log(`🌍 Idioma obtenido para ${userEmail}: ${userLang}`)
      return userLang
    } catch (error) {
      console.error('Error obteniendo idioma del usuario:', error.message, {
        fallback: i18n.language || 'ca'
      })
      return i18n.language || 'ca'
    }
  }

  // 🚨 ACTUALIZADA: Acepta userId
  const sendWelcomeEmail = async (to, clientName, userId = null) => {
    const userLanguage = await getUserLanguage(to)
    
    return await sendEmail('welcome', to, {
      clientName: clientName || to?.split('@')[0] || t('emailNotifications.fallbacks.user'),
      subject: t('emailNotifications.subjects.welcome')
    }, userLanguage, null, userId)
  }

  // 🚨 ACTUALIZADA: Acepta bookingId y userId
  const sendBookingConfirmationEmail = async (bookingData, preferredLanguage = null, bookingId = null, userId = null) => {
    const userLanguage = preferredLanguage || await getUserLanguage(bookingData.to)

    return await sendEmail('confirmation', bookingData.to, {
      clientName: bookingData.clientName,
      dogName: bookingData.dogName,
      service: bookingData.service,
      date: bookingData.date,
      time: bookingData.time,
      duration: bookingData.duration,
      price: bookingData.price,
      subject: t('emailNotifications.subjects.bookingConfirmation')
    }, userLanguage, bookingId, userId)
  }

  // 🚨 ACTUALIZADA: Acepta bookingId y userId
  const sendBookingCancellationEmail = async (bookingData, preferredLanguage = null, bookingId = null, userId = null) => {
    const userLanguage = preferredLanguage || await getUserLanguage(bookingData.to)

    return await sendEmail('cancellation', bookingData.to, {
      clientName: bookingData.clientName,
      dogName: bookingData.dogName,
      service: bookingData.service,
      date: bookingData.date,
      time: bookingData.time,
      cancellationReason: bookingData.cancellationReason,
      subject: t('emailNotifications.subjects.cancellation')
    }, userLanguage, bookingId, userId)
  }

  // 🚨 ACTUALIZADA: Acepta bookingId y userId
  const sendReminderEmail = async (bookingData, bookingId = null, userId = null) => {
    const userLanguage = await getUserLanguage(bookingData.to)
    
    return await sendEmail('reminder', bookingData.to, {
      clientName: bookingData.clientName,
      dogName: bookingData.dogName,
      service: bookingData.service,
      date: bookingData.date,
      time: bookingData.time,
      duration: bookingData.duration,
      subject: t('emailNotifications.subjects.reminder')
    }, userLanguage, bookingId, userId)
  }

  // 🚨 ACTUALIZADA: Acepta userId
  const sendPasswordResetEmail = async (to, resetData, userId = null) => {
    const userLanguage = await getUserLanguage(to)
    
    return await sendEmail('password_reset', to, {
      clientName: resetData.clientName || to?.split('@')[0] || t('emailNotifications.fallbacks.user'),
      resetUrl: resetData.resetUrl,
      expirationTime: resetData.expirationTime || '60 minutos',
      subject: t('emailNotifications.subjects.passwordReset')
    }, userLanguage, null, userId)
  }

  // 🚨 ACTUALIZADA: Acepta userId
  const sendPasswordChangedEmail = async (to, clientName, userId = null) => {
    const userLanguage = await getUserLanguage(to)
    const locale = userLanguage === 'ca' ? 'ca-ES' : 'es-ES'
    
    return await sendEmail('password_changed', to, {
      clientName: clientName || to?.split('@')[0] || t('emailNotifications.fallbacks.user'),
      changeTime: new Date().toLocaleString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      subject: t('emailNotifications.subjects.passwordChanged')
    }, userLanguage, null, userId)
  }

  // 🚨 ACTUALIZADA: Acepta bookingId
  const sendAdminNewBookingEmail = async (bookingData, bookingId = null) => {
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      console.warn('No se pudo obtener el email del administrador')
      return { success: false, error: 'Admin email not found' }
    }

    const adminLanguage = await getUserLanguage(adminEmail)

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
      subject: t('emailNotifications.subjects.adminNewBooking')
    }, adminLanguage, bookingId)
  }

  // 🚨 ACTUALIZADA: Acepta bookingId
  const sendAdminCancellationEmail = async (cancellationData, bookingId = null) => {
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      console.warn('No se pudo obtener el email del administrador')
      return { success: false, error: 'Admin email not found' }
    }

    const adminLanguage = await getUserLanguage(adminEmail)

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
      subject: t('emailNotifications.subjects.adminCancellation')
    }, adminLanguage, bookingId)
  }

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

  const confirmPasswordChanged = async (userEmail, userName) => {
    try {
      await sendPasswordChangedEmail(userEmail, userName)
      return { success: true }
    } catch (error) {
      console.error('Error enviando confirmación de cambio de contraseña:', error)
      return { success: false, error: error.message }
    }
  }

  const sendWelcome = async (userData) => {
    const displayName = userData.nombre_completo || userData.email?.split('@')[0] || t('emailNotifications.fallbacks.user')
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
      cancellationReason: cancelationData.motivo_cancelacion || cancelationData.cancellationReason || t('emailNotifications.fallbacks.defaultCancellationReason')
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

  // 🚨 ACTUALIZADA: Extrae y pasa bookingId
  const notifyAdminNewBooking = async (bookingData) => {
    try {
      const bookingId = bookingData.booking_id || bookingData.id || null

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

      const result = await sendAdminNewBookingEmail(adminEmailData, bookingId)
      if (result.success) {
        console.log('✅ Notificación al admin enviada correctamente')
      }
      return result
    } catch (error) {
      console.error('Error notificando al admin sobre nueva reserva:', error)
      return { success: false, error: error.message }
    }
  }

  // 🚨 ACTUALIZADA: Extrae y pasa bookingId
  const notifyAdminCancellation = async (cancellationData) => {
    try {
      const bookingId = cancellationData.booking_id || cancellationData.id || null

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

      const result = await sendAdminCancellationEmail(adminEmailData, bookingId)
      if (result.success) {
        console.log('✅ Notificación de cancelación al admin enviada correctamente')
      }
      return result
    } catch (error) {
      console.error('Error notificando al admin sobre cancelación:', error)
      return { success: false, error: error.message }
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const locale = i18n.language === 'ca' ? 'ca-ES' : 'es-ES'
      return date.toLocaleDateString(locale, {
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
      return timeStr.substring(0, 5)
    } catch (error) {
      console.error('Error formateando hora:', error)
      return timeStr
    }
  }

  const testEmailSystem = async (testEmail) => {
    if (process.env.NODE_ENV !== 'development') {
      console.log(t('emailNotifications.test.onlyInDevelopment'))
      return false
    }

    console.log(t('emailNotifications.test.startingTest'))

    const testData = {
      clientName: t('emailNotifications.test.testData.clientName'),
      clientEmail: 'juan@test.com',
      dogName: t('emailNotifications.test.testData.dogName'),
      service: t('emailNotifications.test.testData.service'),
      date: formatDate(new Date().toISOString()),
      time: '10:30',
      duration: '45',
      price: '40',
      spaces: 'Piscina (Hidroterapia/Aqua Agility)',
      observations: t('emailNotifications.test.testData.observations')
    }

    const tests = [
      { 
        type: 'welcome', 
        func: () => sendWelcomeEmail(testEmail, t('emailNotifications.test.testData.clientName'))
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
          cancellationReason: t('emailNotifications.test.testData.cancellationReason')
        })
      },
      { 
        type: 'password_reset', 
        func: () => sendPasswordResetEmail(testEmail, {
          clientName: t('emailNotifications.test.testData.clientName'),
          resetUrl: `${window.location.origin}/reset-password?token=test123`,
          expirationTime: '60 minutos'
        })
      },
      { 
        type: 'password_changed', 
        func: () => sendPasswordChangedEmail(testEmail, t('emailNotifications.test.testData.clientName'))
      },
      { 
        type: 'admin_new_booking', 
        func: () => sendAdminNewBookingEmail(testData)
      },
      { 
        type: 'admin_cancellation', 
        func: () => sendAdminCancellationEmail({
          ...testData,
          cancellationReason: t('emailNotifications.test.testData.adminCancellationReason'),
          hasLateCharge: true,
          chargeAmount: '10'
        })
      }
    ]

    const results = []

    for (const test of tests) {
      console.log(`${t('emailNotifications.test.testingType')} ${test.type}`)
      const result = await test.func()
      results.push({ type: test.type, success: result.success })
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log(t('emailNotifications.test.results'), results)
    return results
  }

  return {
    sendWelcomeEmail,
    sendBookingConfirmationEmail,
    sendBookingCancellationEmail,
    sendReminderEmail,
    sendPasswordResetEmail,
    sendPasswordChangedEmail,
    sendAdminNewBookingEmail,
    sendAdminCancellationEmail,
    handlePasswordReset,
    confirmPasswordChanged,
    notifyAdminNewBooking,
    notifyAdminCancellation,
    sendWelcome,
    confirmBooking,
    cancelBooking,
    sendReminder,
    showToast,
    testEmailSystem,
    formatDate,
    formatTime,
    getAdminEmail,
    getUserLanguage,
    loading,
    sendEmail
  }
}