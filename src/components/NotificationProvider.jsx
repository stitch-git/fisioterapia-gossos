// src/components/NotificationProvider.jsx
import React, { createContext, useContext, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../hooks/useNotifications'

const NotificationContext = createContext({})

export const useNotificationContext = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const { user, profile } = useAuth()
  const { 
    sendBookingConfirmationEmail, 
    sendBookingCancellationEmail,
    sendReminderEmail,
    sendWelcomeEmail,
    sendAdminCancellationEmail,
    showToast 
  } = useNotifications()

  // ✅ AGREGADO: Listener para evento de bienvenida
  useEffect(() => {
    const handleWelcomeEmail = async (event) => {
      console.log('🎉 Evento de bienvenida recibido:', event.detail)
      
      const { nombre_completo, email, user_id } = event.detail
      
      try {
        const result = await sendWelcomeEmail(email, nombre_completo)
        
        if (result.success) {
          console.log('✅ Email de bienvenida enviado correctamente')
          showToast('success', 'Email de bienvenida enviado')
        } else {
          console.error('❌ Error enviando email de bienvenida:', result.error)
          showToast('error', 'Error enviando email de bienvenida')
        }
      } catch (error) {
        console.error('❌ Error en handleWelcomeEmail:', error)
        showToast('error', 'Error procesando email de bienvenida')
      }
    }

    // Registrar el listener
    window.addEventListener('sendWelcomeEmail', handleWelcomeEmail)

    // Cleanup
    return () => {
      window.removeEventListener('sendWelcomeEmail', handleWelcomeEmail)
    }
  }, [sendWelcomeEmail, showToast])

  // ✅ AGREGADO: Debug del sistema
  useEffect(() => {
    console.log('🔧 NotificationProvider montado:', {
      sendWelcomeEmail: !!sendWelcomeEmail,
      showToast: !!showToast,
      userEmail: user?.email,
      profileEmailEnabled: profile?.email_notifications
    })
  }, [sendWelcomeEmail, showToast, user, profile])

  // Enviar email de bienvenida
  const sendWelcome = async (userData) => {
    if (!user?.email) return false

    try {
      const displayName = userData.nombre_completo || userData.email?.split('@')[0] || 'Usuario'
      
      const result = await sendWelcomeEmail(user.email, displayName)
      
      if (result.success) {
        console.log('Email de bienvenida enviado a:', user.email)
        return true
      } else {
        console.error('Error enviando email de bienvenida:', result.error)
        return false
      }
    } catch (error) {
      console.error('Error en sendWelcome:', error)
      return false
    }
  }

  // Confirmar cita por email
  // En NotificationProvider.jsx, reemplaza la función confirmBooking (línea ~81):

// Confirmar cita por email
const confirmBooking = async (bookingData) => {
  // 🔧 USAR EMAIL DEL CLIENTE si se proporciona, sino el del usuario actual
  const targetEmail = bookingData.client_email || user?.email
  const targetName = bookingData.client_name || profile?.nombre_completo || 'Cliente'
  
  if (!targetEmail) {
    console.error('No se pudo determinar email destino para confirmación')
    return false
  }

  // Solo verificar email_notifications si es el usuario actual
  const shouldCheckNotifications = targetEmail === user?.email
  if (shouldCheckNotifications && !profile?.email_notifications) {
    console.log('Usuario tiene notificaciones deshabilitadas')
    return false
  }

  try {
    const emailData = {
      to: targetEmail,  // 🔧 USAR EMAIL CORRECTO
      clientName: targetName,  // 🔧 USAR NOMBRE CORRECTO
      dogName: bookingData.pet_name || bookingData.petName || 'Mascota',
      service: bookingData.service_name || bookingData.serviceName || 'Servicio',
      date: formatDate(bookingData.fecha || bookingData.date),
      time: formatTime(bookingData.hora || bookingData.time),
      duration: bookingData.duracion || bookingData.duration || '60',
      price: bookingData.precio || bookingData.price || '0'
    }

    const result = await sendBookingConfirmationEmail(emailData)

    if (result.success) {
      console.log('Email de confirmación enviado a:', targetEmail)
      showToast('success', 'Confirmación enviada por email')
      return true
    } else {
      console.error('Error enviando confirmación:', result.error)
      showToast('error', 'Error enviando confirmación por email')
      return false
    }
  } catch (error) {
    console.error('Error en confirmBooking:', error)
    showToast('error', 'Error enviando confirmación')
    return false
  }
}

  // Cancelar cita por email
  const cancelBooking = async (cancelationData) => {
    const emailDestino = cancelationData.cliente_email || user?.email
    
    if (!emailDestino || !profile?.email_notifications) return false

    try {
      const userName = cancelationData.cliente_nombre || profile?.nombre_completo || 'Cliente'
      
      const emailData = {
        to: emailDestino,
        clientName: userName,
        dogName: cancelationData.pet_name,
        service: cancelationData.service_name,
        date: formatDate(cancelationData.fecha),
        time: formatTime(cancelationData.hora),
        cancellationReason: cancelationData.motivo_cancelacion || 'Cancelación de cita'
      }

      const result = await sendBookingCancellationEmail(emailData)

      if (result.success) {
        console.log('Email de cancelación enviado a:', emailDestino)
        showToast('success', 'Notificación de cancelación enviada por email')
        return true
      } else {
        console.error('Error enviando cancelación:', result.error)
        showToast('error', 'Error enviando notificación de cancelación')
        return false
      }
    } catch (error) {
      console.error('Error en cancelBooking:', error)
      showToast('error', 'Error enviando notificación de cancelación')
      return false
    }
  }

  // Enviar recordatorio de cita
  const sendReminder = async (reminderData) => {
    const emailDestino = reminderData.cliente_email || user?.email
    
    if (!emailDestino || !profile?.email_notifications) return false

    try {
      const userName = reminderData.cliente_nombre || profile?.nombre_completo || 'Cliente'
      
      const emailData = {
        to: emailDestino,
        clientName: userName,
        dogName: reminderData.pet_name,
        service: reminderData.service_name,
        date: formatDate(reminderData.fecha),
        time: formatTime(reminderData.hora),
        duration: reminderData.duracion || '60'
      }

      const result = await sendReminderEmail(emailData)

      if (result.success) {
        console.log('Email de recordatorio enviado a:', emailDestino)
        showToast('success', 'Recordatorio enviado por email')
        return true
      } else {
        console.error('Error enviando recordatorio:', result.error)
        showToast('error', 'Error enviando recordatorio')
        return false
      }
    } catch (error) {
      console.error('Error en sendReminder:', error)
      showToast('error', 'Error enviando recordatorio')
      return false
    }
  }

  // Notificar cancelación al admin
  const notifyAdminCancellation = async (cancelationData) => {
    try {
      const emailData = {
        clientName: cancelationData.clientName,
        clientEmail: cancelationData.clientEmail,
        dogName: cancelationData.dogName,
        service: cancelationData.service,
        date: formatDate(cancelationData.fecha),
        time: formatTime(cancelationData.hora),
        cancellationReason: cancelationData.cancellationReason,
        hasLateCharge: cancelationData.hasLateCharge || false,
        chargeAmount: cancelationData.chargeAmount || '0'
      }

      const result = await sendAdminCancellationEmail(emailData)  // ✅ Usar directamente

      if (result.success) {
        console.log('Notificación al admin enviada')
        return true
      } else {
        console.error('Error enviando notificación al admin:', result.error)
        return false
      }
    } catch (error) {
      console.error('Error en notifyAdminCancellation:', error)
      showToast('error', 'Error notificando al admin')
      return false
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

  // Estado del sistema
  const getStatus = () => {
    const canSendEmails = !!(user?.email && profile?.email_notifications)
    
    return {
      isReady: canSendEmails,
      userEmail: user?.email || null,
      emailEnabled: profile?.email_notifications || false,
      canSendNotifications: canSendEmails
    }
  }

  const value = {
    // Métodos principales
    sendWelcome,
    confirmBooking,
    cancelBooking,
    sendReminder,
    notifyAdminCancellation,

    
    // Estado
    getStatus,
    isReady: !!(user?.email && profile?.email_notifications),
    
    // Toast para feedback inmediato
    showToast
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

// Hook personalizado para reservas
export const useBookingNotifications = () => {
  const { confirmBooking, cancelBooking, sendReminder, notifyAdminCancellation, showToast } = useNotificationContext()
  
  return {
    notifyBookingConfirmed: confirmBooking,
    notifyBookingCanceled: cancelBooking,
    notifyBookingReminder: sendReminder,
    notifyAdminCancellation,
    showToast
  }
}

// Hook para registro/autenticación  
export const useAuthNotifications = () => {
  const { sendWelcome, showToast } = useNotificationContext()
  
  return {
    notifyWelcome: sendWelcome,
    showToast
  }
}

export default NotificationProvider