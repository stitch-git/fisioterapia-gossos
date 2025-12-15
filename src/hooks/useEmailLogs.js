// src/hooks/useEmailLogs.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'

export const useEmailLogs = (filters = {}) => {
  const { i18n } = useTranslation()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  // Cargar logs
  const loadLogs = async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('email_logs')
        .select(`
          *,
          bookings:booking_id (
            id,
            fecha_hora,
            services (nombre)
          ),
          profiles:user_id (
            nombre_completo,
            email
          )
        `)
        .order('created_at', { ascending: false })

      // Aplicar filtros
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.email_type) {
        query = query.eq('email_type', filters.email_type)
      }

      if (filters.recipient_email) {
        query = query.ilike('recipient_email', `%${filters.recipient_email}%`)
      }

      if (filters.start_date) {
        query = query.gte('created_at', filters.start_date)
      }

      if (filters.end_date) {
        query = query.lte('created_at', filters.end_date)
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error: queryError } = await query

      if (queryError) throw queryError

      setLogs(data || [])
      
    } catch (err) {
      console.error('Error cargando logs de emails:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Cargar estadísticas
  const loadStats = async (days = 30) => {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await supabase.rpc('get_email_stats', {
        start_date: startDate.toISOString(),
        end_date: new Date().toISOString()
      })

      if (error) throw error

      setStats(data[0] || null)
      
    } catch (err) {
      console.error('Error cargando estadísticas de emails:', err)
    }
  }

  // Reintentar email fallido
  const retryFailedEmail = async (logId) => {
    try {
      // Obtener datos del log
      const { data: log, error: logError } = await supabase
        .from('email_logs')
        .select('*')
        .eq('id', logId)
        .single()

      if (logError) throw logError

      // Reintentar envío
      const { data, error } = await supabase.functions.invoke('resend-email', {
        body: {
          emailType: log.email_type,
          to: log.recipient_email,
          language: log.language,
          bookingId: log.booking_id,
          userId: log.user_id,
          ...log.email_data
        }
      })

      if (error) throw error

      // Recargar logs
      await loadLogs()

      return { success: true }
      
    } catch (err) {
      console.error('Error reintentando email:', err)
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    loadLogs()
    loadStats()
  }, [JSON.stringify(filters)])

  return {
    logs,
    stats,
    loading,
    error,
    loadLogs,
    loadStats,
    retryFailedEmail
  }
}