// ✅ NUEVO: Hook para capturar errores de usuarios automáticamente
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export const useErrorTracking = () => {
  const { user, profile } = useAuth()
  const [tracking, setTracking] = useState(false)

  // ✅ Función para capturar error automáticamente
  const captureError = useCallback(async (errorMessage, context = {}) => {
    if (!user || !errorMessage) return

    try {
      setTracking(true)

      const errorData = {
        user_id: user.id,
        user_email: user.email || profile?.email,
        user_role: profile?.role || 'cliente',
        error_message: errorMessage,
        error_context: {
          page: window.location.pathname,
          timestamp: new Date().toISOString(),
          language: document.documentElement.lang || 'ca',
          ...context
        },
        user_agent: navigator.userAgent,
        status: 'pending'
      }

      const { error } = await supabase
        .from('user_errors')
        .insert([errorData])

      if (error) {
        console.error('Error guardando user_error:', error)
      } else {
        console.log('✅ Error de usuario capturado:', errorMessage)
      }
    } catch (err) {
      console.error('Error en captureError:', err)
    } finally {
      setTracking(false)
    }
  }, [user, profile])

  return {
    captureError,
    tracking
  }
}

// ✅ Hook para gestionar errores en el dashboard SUPER
export const useUserErrors = () => {
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const loadErrors = useCallback(async (filters = {}) => {
    try {
      setLoading(true)

      let query = supabase
        .from('user_errors')
        .select('*', { count: 'exact' })

      // Filtros
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.userEmail) {
        query = query.ilike('user_email', `%${filters.userEmail}%`)
      }
      if (filters.userRole) {
        query = query.eq('user_role', filters.userRole)
      }
      if (filters.search) {
        query = query.ilike('error_message', `%${filters.search}%`)
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate)
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate)
      }

      const limit = filters.limit || 100
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)
      query = query.order('created_at', { ascending: false })

      const { data, error, count } = await query

      if (error) throw error

      setErrors(data || [])
      setTotalCount(count || 0)
      
    } catch (error) {
      console.error('Error loading user errors:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateErrorStatus = useCallback(async (errorId, status, reviewNotes = '') => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const updateData = {
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      }

      const { error } = await supabase
        .from('user_errors')
        .update(updateData)
        .eq('id', errorId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Error updating error status:', error)
      return { success: false, error }
    }
  }, [])

  const deleteError = useCallback(async (errorId) => {
    try {
      console.log('🗑️ Intentando eliminar error con ID:', errorId)
      
      const { data, error } = await supabase
        .from('user_errors')
        .delete()
        .eq('id', errorId)
        .select()  // ✅ NUEVO: Retorna el registro eliminado

      if (error) {
        console.error('❌ Error de Supabase:', error)
        throw error
      }

      console.log('✅ Registro eliminado:', data)
      
      if (!data || data.length === 0) {
        console.warn('⚠️ No se eliminó ningún registro')
        return { success: false, error: 'No se encontró el registro' }
      }
      
      return { success: true }
    } catch (error) {
      console.error('❌ Error deleting user error:', error)
      return { success: false, error }
    }
  }, [])

  return {
    errors,
    loading,
    totalCount,
    loadErrors,
    updateErrorStatus,
    deleteError
  }
}