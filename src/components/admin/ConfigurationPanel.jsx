import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isToday, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { invalidateTimeSlotsCache } from '../../utils/bookingUtils'

export default function ConfigurationPanel() {
  // Estados principales
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [timeSlots, setTimeSlots] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Estados de selección
  const [selectedDates, setSelectedDates] = useState([])
  
  // Estado del formulario
  const [newSlot, setNewSlot] = useState({
    start_hour: '',
    start_minute: '',
    end_hour: '',
    end_minute: ''
  })
  
  // Estados del modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [slotToDelete, setSlotToDelete] = useState(null)
  const [viewMode, setViewMode] = useState('desktop')

  // Effects
  useEffect(() => {
    loadWeekTimeSlots()
    
    const handleResize = () => {
      setViewMode(window.innerWidth < 1024 ? 'mobile' : 'desktop')
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [currentWeek])

  // Funciones principales
  const getWeekDays = () => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 })
    const end = endOfWeek(currentWeek, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }

  const loadWeekTimeSlots = async () => {
    try {
      setLoading(true)
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })

      const { data, error } = await supabase
        .from('available_time_slots')
        .select('*')
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('is_active', true)
        .order('date')
        .order('start_time')

      if (error) throw error

      const slotsByDate = {}
      if (data) {
        data.forEach(slot => {
          const dateKey = slot.date
          if (!slotsByDate[dateKey]) {
            slotsByDate[dateKey] = []
          }
          slotsByDate[dateKey].push(slot)
        })
      }

      setTimeSlots(slotsByDate)
    } catch (error) {
      console.error('Error loading time slots:', error)
      toast.error('Error cargando configuración de horarios')
    } finally {
      setLoading(false)
    }
  }

  // Funciones de selección múltiple
  const toggleDateSelection = (dateStr) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dateObj = new Date(dateStr)
    dateObj.setHours(0, 0, 0, 0)

    if (dateObj < today) {
      toast.error("No puedes seleccionar un día anterior a hoy")
      return
    }

    setSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr)
      } else {
        return [...prev, dateStr]
      }
    })
  }

  const selectAllWeek = () => {
    const weekDays = getWeekDays()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Filtrar solo días de hoy en adelante
    const validDates = weekDays
      .filter(day => {
        const dayDate = new Date(day)
        dayDate.setHours(0, 0, 0, 0)
        return dayDate >= today
      })
      .map(day => format(day, 'yyyy-MM-dd'))
      
    setSelectedDates(validDates)
  }

  const clearSelection = () => {
    setSelectedDates([])
  }

  // Funciones de horarios
  const addTimeSlot = async () => {
    if (selectedDates.length === 0 || !newSlot.start_hour || !newSlot.start_minute || !newSlot.end_hour || !newSlot.end_minute) {
      toast.error('Selecciona al menos un día y completa todos los campos de horario')
      return
    }

    const start_time = `${newSlot.start_hour}:${newSlot.start_minute}:00`
    const end_time = `${newSlot.end_hour}:${newSlot.end_minute}:00`

    console.log('🚀 Iniciando addTimeSlot:', {
      selectedDates,
      start_time,
      end_time,
      newSlot
    })

    if (end_time <= start_time) {
      toast.error('La hora de fin debe ser posterior a la hora de inicio')
      return
    }

    try {
      setSaving(true)
      
      // PASO 1: Verificar datos existentes de forma exhaustiva
      console.log('🔍 PASO 1: Verificando datos existentes...')
      
      for (const date of selectedDates) {
        console.log(`📅 Verificando fecha: ${date}`)
        
        // Verificar TODOS los registros (activos e inactivos)
        const { data: allSlots, error: allSlotsError } = await supabase
          .from('available_time_slots')
          .select('*')
          .eq('date', date)
        
        console.log(`  📊 TODOS los registros para ${date}:`, allSlots)
        
        // Verificar solo activos
        const { data: activeSlots, error: activeSlotsError } = await supabase
          .from('available_time_slots')
          .select('*')
          .eq('date', date)
          .eq('is_active', true)
        
        console.log(`  ✅ Registros ACTIVOS para ${date}:`, activeSlots)
        
        if (allSlotsError) console.error(`  ❌ Error obteniendo todos los slots: `, allSlotsError)
        if (activeSlotsError) console.error(`  ❌ Error obteniendo slots activos: `, activeSlotsError)
      }

      // PASO 2: Intentar insert UNO POR UNO para identificar cuál falla
      console.log('🔍 PASO 2: Insertando uno por uno...')
      
      const successfulInserts = []
      
      for (const date of selectedDates) {
        console.log(`📤 Intentando insertar para fecha: ${date}`)
        
        const singleSlot = {
          date: date,
          start_time: start_time,
          end_time: end_time,
          is_active: true
        }
        
        console.log(`  📋 Datos a insertar:`, singleSlot)
        
        try {
          const { data: insertResult, error: insertError } = await supabase
            .from('available_time_slots')
            .insert(singleSlot)
            .select()
          
          if (insertError) {
            console.error(`  ❌ ERROR ESPECÍFICO para ${date}:`, {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
              singleSlot
            })
            
            // Mostrar error específico al usuario
            toast.error(`Error en ${date}: ${insertError.message}`)
            continue
          }
          
          console.log(`  ✅ INSERT EXITOSO para ${date}:`, insertResult)
          successfulInserts.push(...insertResult)
          
        } catch (unexpectedError) {
          console.error(`  💥 ERROR INESPERADO para ${date}:`, unexpectedError)
          toast.error(`Error inesperado en ${date}: ${unexpectedError.message}`)
        }
      }

      // PASO 3: Actualizar estado local solo con inserts exitosos
      if (successfulInserts.length > 0) {
        console.log('✅ PASO 3: Actualizando estado local con inserts exitosos:', successfulInserts)
        
        setTimeSlots(prev => {
          const updated = { ...prev }
          
          successfulInserts.forEach(slot => {
            const dateKey = slot.date
            if (!updated[dateKey]) {
              updated[dateKey] = []
            }
            
            // Verificar que no existe ya antes de añadir
            const exists = updated[dateKey].some(existingSlot => 
              existingSlot.start_time === slot.start_time && 
              existingSlot.end_time === slot.end_time
            )
            
            if (!exists) {
              updated[dateKey].push(slot)
            }
            
            // Ordenar por hora
            updated[dateKey].sort((a, b) => a.start_time.localeCompare(b.start_time))
          })
          
          return updated
        })

        // Limpiar formulario solo si hubo al menos un éxito
        setNewSlot({ 
          start_hour: '', 
          start_minute: '', 
          end_hour: '', 
          end_minute: '' 
        })
        
        const successCount = successfulInserts.length
        const totalCount = selectedDates.length
        
        if (successCount === totalCount) {
          toast.success(`Horario agregado a ${successCount} día${successCount !== 1 ? 's' : ''} correctamente`)
        } else {
          toast.warning(`Horario agregado a ${successCount} de ${totalCount} días. Revisa los errores en consola.`)
        }
        
        invalidateTimeSlotsCache()
      } else {
        console.error('❌ No se pudo insertar en ninguna fecha')
        toast.error('No se pudo añadir el horario en ninguna fecha. Revisa los errores en consola.')
      }

    } catch (error) {
      console.error('💥 ERROR GENERAL en addTimeSlot:', error)
      toast.error('Error general: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteTimeSlot = async () => {
    if (!slotToDelete) return

    try {
      setSaving(true)
      
      const { error } = await supabase
        .from('available_time_slots')
        .update({ is_active: false })
        .eq('id', slotToDelete.id)

      if (error) throw error

      setTimeSlots(prev => {
        const dateKey = slotToDelete.date
        const updated = { ...prev }
        if (updated[dateKey]) {
          updated[dateKey] = updated[dateKey].filter(slot => slot.id !== slotToDelete.id)
          if (updated[dateKey].length === 0) {
            delete updated[dateKey]
          }
        }
        return updated
      })

      toast.success('Horario eliminado correctamente')
      invalidateTimeSlotsCache()
    } catch (error) {
      console.error('Error deleting time slot:', error)
      toast.error('Error eliminando horario')
    } finally {
      setSaving(false)
      setShowDeleteModal(false)
      setSlotToDelete(null)
    }
  }

  const openDeleteModal = (slot) => {
    setSlotToDelete(slot)
    setShowDeleteModal(true)
  }

  const clearDaySlots = async (date) => {
    const daySlots = timeSlots[date] || []
    if (daySlots.length === 0) {
      toast.info('No hay horarios para eliminar en este día')
      return
    }

    try {
      setSaving(true)
      
      const slotIds = daySlots.map(slot => slot.id)
      const { error } = await supabase
        .from('available_time_slots')
        .update({ is_active: false })
        .in('id', slotIds)

      if (error) throw error

      setTimeSlots(prev => {
        const updated = { ...prev }
        delete updated[date]
        return updated
      })

      toast.success(`Todos los horarios del ${format(new Date(date), 'dd/MM/yyyy')} han sido eliminados`)
      invalidateTimeSlotsCache()
    } catch (error) {
      console.error('Error clearing day slots:', error)
      toast.error('Error eliminando horarios del día')
    } finally {
      setSaving(false)
    }
  }

  const clearSelectedDaysSlots = async () => {
    if (selectedDates.length === 0) {
      toast.error('No hay días seleccionados para limpiar')
      return
    }

    // Verificar si hay horarios en los días seleccionados
    const slotsToDelete = []
    selectedDates.forEach(date => {
      const daySlots = timeSlots[date] || []
      daySlots.forEach(slot => {
        slotsToDelete.push(slot.id)
      })
    })

    if (slotsToDelete.length === 0) {
      toast.info('No hay horarios para eliminar en los días seleccionados')
      return
    }

    try {
      setSaving(true)
      
      const { error } = await supabase
        .from('available_time_slots')
        .update({ is_active: false })
        .in('id', slotsToDelete)

      if (error) throw error

      // Actualizar estado local
      setTimeSlots(prev => {
        const updated = { ...prev }
        selectedDates.forEach(date => {
          delete updated[date]
        })
        return updated
      })

      const dayCount = selectedDates.length
      const slotCount = slotsToDelete.length
      toast.success(`${slotCount} horario${slotCount !== 1 ? 's' : ''} eliminado${slotCount !== 1 ? 's' : ''} de ${dayCount} día${dayCount !== 1 ? 's' : ''}`)
      invalidateTimeSlotsCache()

      // Limpiar selección después de la operación
      setSelectedDates([])
      
    } catch (error) {
      console.error('Error clearing selected days slots:', error)
      toast.error('Error eliminando horarios de los días seleccionados')
    } finally {
      setSaving(false)
    }
  }

  // Navegación
  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1))
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1))
  const goToCurrentWeek = () => setCurrentWeek(new Date())

  // Utilidades
  const formatTimeSlot = (slot) => {
    return `${slot.start_time.substring(0, 5)} - ${slot.end_time.substring(0, 5)}`
  }

  const getStats = () => {
    let totalSlots = 0
    let totalDaysWithSlots = 0
    
    Object.values(timeSlots).forEach(daySlots => {
      if (daySlots.length > 0) {
        totalDaysWithSlots++
        totalSlots += daySlots.length
      }
    })

    return { totalSlots, totalDaysWithSlots }
  }

  const isFormValid = () => {
    return selectedDates.length > 0 && 
           newSlot.start_hour && 
           newSlot.start_minute && 
           newSlot.end_hour && 
           newSlot.end_minute
  }

  // Componentes de renderizado
  const renderDayCard = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const daySlots = timeSlots[dayStr] || []
    
    // Calcular si es día pasado
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayDate = new Date(day)
    dayDate.setHours(0, 0, 0, 0)
    const isPastDay = dayDate < today
    
    const isSelected = selectedDates.includes(dayStr)

    return (
      <div 
        key={dayStr} 
        className={`bg-white border-2 rounded-lg p-4 transition-all duration-200 ${
          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
        } ${isPastDay ? 'opacity-60' : ''}`}
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            {!isPastDay && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleDateSelection(dayStr)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
            )}
            <div>
              <h3 className={`font-semibold ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>
                {format(day, 'EEEE', { locale: es })}
              </h3>
              <p className="text-sm text-gray-600">
                {format(day, 'dd MMM', { locale: es })}
                {isPastDay && <span className="text-red-500 ml-1">(pasado)</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium text-gray-500">
              {daySlots.length} horario{daySlots.length !== 1 ? 's' : ''}
            </span>
            {!isPastDay && daySlots.length > 0 && (
              <button
                onClick={() => clearDaySlots(dayStr)}
                disabled={saving}
                className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {daySlots.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              Sin horarios configurados
            </p>
          ) : (
            daySlots.map(slot => (
              <div 
                key={slot.id} 
                className="flex justify-between items-center bg-gray-50 rounded px-3 py-2"
              >
                <span className="text-sm font-mono">
                  {formatTimeSlot(slot)}
                </span>
                {!isPastDay && (
                  <button
                    onClick={() => openDeleteModal(slot)}
                    disabled={saving}
                    className="text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  const renderMobileView = () => {
    const weekDays = getWeekDays()

    return (
      <div className="space-y-4">
        {/* Selector múltiple para móvil */}
        <div className="bg-white rounded-lg p-4 border">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Días seleccionados ({selectedDates.length})
          </label>
          {selectedDates.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedDates.map(date => (
                <span 
                  key={date} 
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                >
                  {format(new Date(date), 'dd/MM')}
                  <button
                    onClick={() => toggleDateSelection(date)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-3">Ningún día seleccionado</p>
          )}
          
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                toggleDateSelection(e.target.value)
                e.target.value = "" // Reset del select
              }
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Seleccionar día...</option>
            {weekDays.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const isAlreadySelected = selectedDates.includes(dayStr)
              
              // Verificar si es un día pasado
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const dayDate = new Date(day)
              dayDate.setHours(0, 0, 0, 0)
              const isPastDay = dayDate < today
              
              return (
                <option 
                  key={dayStr} 
                  value={dayStr}
                  disabled={isAlreadySelected || isPastDay}
                >
                  {format(day, 'EEEE dd \'de\' MMMM', { locale: es })}
                  {isAlreadySelected ? ' (seleccionado)' : ''}
                  {isPastDay ? ' (pasado)' : ''}
                </option>
              )
            })}
          </select>
        </div>

        {/* Cards de todos los días de la semana */}
        <div className="space-y-3">
          {getWeekDays().map(renderDayCard)}
        </div>
      </div>
    )
  }

  const stats = getStats()

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">Cargando configuración...</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Configuración de Horarios</h2>
            <p className="text-sm sm:text-base text-gray-600">
              Define horarios disponibles por fecha específica
            </p>
          </div>
        </div>

        {/* Navegación de semanas */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <button 
              onClick={goToPreviousWeek} 
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded w-full sm:w-auto justify-center sm:justify-start transition-colors"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm sm:text-base">Anterior</span>
            </button>
            
            <div className="text-center">
              <h3 className="text-sm sm:text-lg font-semibold">
                Semana del {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'd')} al{' '}
                {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'd \'de\' MMMM yyyy', { locale: es })}
              </h3>
              <button 
                onClick={goToCurrentWeek} 
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 mt-1 transition-colors"
              >
                Ir a semana actual
              </button>
            </div>
            
            <button 
              onClick={goToNextWeek} 
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded w-full sm:w-auto justify-center sm:justify-start transition-colors"
            >
              <span className="text-sm sm:text-base">Siguiente</span>
              <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalSlots}</div>
            <div className="text-xs sm:text-sm text-gray-600">Total horarios configurados</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.totalDaysWithSlots}</div>
            <div className="text-xs sm:text-sm text-gray-600">Días con horarios</div>
          </div>
        </div>

        {/* Formulario para añadir horarios */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-4">Añadir Nuevo Horario</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora inicio *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="6"
                  max="23"
                  value={newSlot.start_hour}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '' || value.length <= 2) {
                      setNewSlot({...newSlot, start_hour: value})
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value
                    if (value && !isNaN(value)) {
                      const hour = parseInt(value)
                      if (hour >= 6 && hour <= 23) {
                        setNewSlot({...newSlot, start_hour: hour.toString().padStart(2, '0')})
                      } else {
                        const validHour = hour < 6 ? 6 : 23
                        setNewSlot({...newSlot, start_hour: validHour.toString().padStart(2, '0')})
                      }
                    }
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="08"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <span className="text-gray-400 text-sm">h</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">Introducir 06 - 23</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minuto de inicio *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  value={newSlot.start_minute}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
                      setNewSlot({...newSlot, start_minute: value})
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value && !isNaN(e.target.value)) {
                      setNewSlot({...newSlot, start_minute: parseInt(e.target.value).toString().padStart(2, '0')})
                    }
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="00"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <span className="text-gray-400 text-sm">m</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">Introducir 00 - 59</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora fin *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="6"
                  max="23"
                  value={newSlot.end_hour}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '' || value.length <= 2) {
                      setNewSlot({...newSlot, end_hour: value})
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value
                    if (value && !isNaN(value)) {
                      const hour = parseInt(value)
                      if (hour >= 6 && hour <= 23) {
                        setNewSlot({...newSlot, end_hour: hour.toString().padStart(2, '0')})
                      } else {
                        const validHour = hour < 6 ? 6 : 23
                        setNewSlot({...newSlot, end_hour: validHour.toString().padStart(2, '0')})
                      }
                    }
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="21"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <span className="text-gray-400 text-sm">h</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">Introducir 06 - 23</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minuto fin *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  value={newSlot.end_minute}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
                      setNewSlot({...newSlot, end_minute: value})
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value && !isNaN(e.target.value)) {
                      setNewSlot({...newSlot, end_minute: parseInt(e.target.value).toString().padStart(2, '0')})
                    }
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="00"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <span className="text-gray-400 text-sm">m</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">Introducir 00 - 59</p>
            </div>
            
            <div className="flex flex-col items-end">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  if (!saving) {
                    addTimeSlot()
                  }
                }}
                disabled={saving || !isFormValid()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-6"
              >
                {saving ? (
                  <div className="flex items-center justify-center">
                    <div className="loading-spinner mr-2"></div>
                    Añadiendo...
                  </div>
                ) : (
                  'Añadir'
                )}
              </button>
            </div>
          </div>

          {/* Sugerencias rápidas de horarios comunes */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 mr-2">Sugerencias rápidas:</span>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '08', start_minute: '00', end_hour: '12', end_minute: '00'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Mañana (08:00-12:00)
              </button>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '14', start_minute: '00', end_hour: '18', end_minute: '00'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Tarde (14:00-18:00)
              </button>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '08', start_minute: '00', end_hour: '18', end_minute: '00'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Jornada completa (08:00-18:00)
              </button>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '09', start_minute: '00', end_hour: '09', end_minute: '30'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                30 min (09:00-09:30)
              </button>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '10', start_minute: '00', end_hour: '11', end_minute: '00'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                1 hora (10:00-11:00)
              </button>
            </div>
          </div>

          {/* Panel de selección múltiple */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">Selección de Días</h4>
                  <p className="text-sm text-gray-600">
                    {selectedDates.length === 0 
                      ? 'Selecciona los días donde quieres añadir el horario' 
                      : `${selectedDates.length} día${selectedDates.length !== 1 ? 's' : ''} seleccionado${selectedDates.length !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={selectAllWeek}
                    disabled={saving}
                    className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    Seleccionar todos
                  </button>
                  
                  <button
                    onClick={clearSelection}
                    disabled={saving || selectedDates.length === 0}
                    className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Limpiar selección
                  </button>
                </div>
                <button
                    onClick={clearSelectedDaysSlots}
                    disabled={saving || selectedDates.length === 0}
                    className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                  >
                    Limpiar horarios días seleccionados
                  </button>
              </div>
              
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedDates.map(date => (
                    <span 
                      key={date} 
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {format(new Date(date), 'dd/MM')}
                      <button
                        onClick={() => toggleDateSelection(date)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {/* Ayuda contextual */}
              <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded mt-3">
                <strong>Cómo usar:</strong> Marca los días con los checkboxes azules, configura el horario y haz clic en "Añadir" para aplicarlo a todos los días seleccionados.
              </div>
            </div>
          </div>
        </div>

        {/* Toggle vista móvil/desktop */}
        <div className="lg:hidden flex bg-gray-100 rounded-md p-1">
          <button
            onClick={() => setViewMode('mobile')}
            className={`flex-1 px-3 py-1 text-xs rounded transition-colors ${viewMode === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
          >
            Vista por Día
          </button>
          <button
            onClick={() => setViewMode('desktop')}
            className={`flex-1 px-3 py-1 text-xs rounded transition-colors ${viewMode === 'desktop' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
          >
            Vista Completa
          </button>
        </div>

        {/* Configuración de horarios - Vista adaptativa */}
        {viewMode === 'mobile' ? renderMobileView() : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {getWeekDays().map(renderDayCard)}
          </div>
        )}

        {/* Modal de confirmación para eliminar */}
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setSlotToDelete(null)
          }}
          onConfirm={deleteTimeSlot}
          title="Eliminar Horario"
          message={`¿Estás seguro que quieres eliminar el horario ${slotToDelete ? formatTimeSlot(slotToDelete) : ''} del ${slotToDelete ? format(new Date(slotToDelete.date), 'dd/MM/yyyy') : ''}?`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          icon={
            <div className="flex items-center justify-center w-10 h-10 mx-auto bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
          }
        />
      </div>
    </div>
  )
}