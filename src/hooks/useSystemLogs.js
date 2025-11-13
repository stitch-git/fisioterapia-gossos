import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export const useSystemLogs = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const loadLogs = useCallback(async (filters = {}) => {
    try {
      setLoading(true)

      let query = supabase
        .from('error_logs')
        .select('*', { count: 'exact' })

      // Filtro por fecha
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate)
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate)
      }

      // Filtro por usuario
      if (filters.userEmail) {
        query = query.ilike('user_email', `%${filters.userEmail}%`)
      }

      // Filtro por tipo de error
      if (filters.errorType) {
        query = query.eq('error_type', filters.errorType)
      }

      // Filtro por componente
      if (filters.component) {
        query = query.ilike('component', `%${filters.component}%`)
      }

      // Filtro por código de error
      if (filters.errorCode) {
        query = query.eq('error_code', filters.errorCode)
      }

      // Búsqueda general
      if (filters.search) {
        query = query.or(`error_message.ilike.%${filters.search}%,component.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%`)
      }

      // Paginación
      const limit = filters.limit || 50
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      // Ordenar por fecha (más recientes primero)
      query = query.order('created_at', { ascending: false })

      const { data, error, count } = await query

      if (error) throw error

      setLogs(data || [])
      setTotalCount(count || 0)
      
    } catch (error) {
      console.error('Error loading logs:', error)
      toast.error('Error cargando logs del sistema')
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteLog = async (logId) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .delete()
        .eq('id', logId)

      if (error) throw error

      toast.success('Log eliminado correctamente')
      // ✅ CORREGIDO: Ya no llama a loadLogs() aquí
      // El componente se encarga de recargar con los filtros correctos
    } catch (error) {
      console.error('Error deleting log:', error)
      toast.error('Error eliminando log')
    }
  }

  const clearAllLogs = async () => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .delete()
        .neq('id', 0) // Elimina todos

      if (error) throw error

      toast.success('Todos los logs han sido eliminados')
      // ✅ CORREGIDO: Ya no llama a loadLogs() aquí
      // El componente se encarga de recargar con los filtros correctos
    } catch (error) {
      console.error('Error clearing logs:', error)
      toast.error('Error eliminando todos los logs')
    }
  }

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  return {
    logs,
    loading,
    totalCount,
    loadLogs,
    deleteLog,
    clearAllLogs
  }
}