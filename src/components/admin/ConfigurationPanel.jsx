import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isToday, addDays } from 'date-fns'
import { es, ca } from 'date-fns/locale'
import { invalidateTimeSlotsCache, timeToMinutes } from '../../utils/bookingUtils'
import { useTranslation } from 'react-i18next'

export default function ConfigurationPanel() {
  const { t, i18n } = useTranslation()
  
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [timeSlots, setTimeSlots] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [selectedDates, setSelectedDates] = useState([])
  
  const [newSlot, setNewSlot] = useState({
    start_hour: '',
    start_minute: '',
    end_hour: '',
    end_minute: ''
  })
  
  const [isAdminOnly, setIsAdminOnly] = useState(false)
  
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [slotToDelete, setSlotToDelete] = useState(null)
  const [viewMode, setViewMode] = useState('desktop')

  const [filterMode, setFilterMode] = useState('all')

  const [isEditMode, setIsEditMode] = useState(false)
  const [slotToEdit, setSlotToEdit] = useState(null)

  // Determinar locale para date-fns según idioma actual
  const getDateLocale = () => i18n.language === 'ca' ? ca : es

  useEffect(() => {
    loadWeekTimeSlots()
    
    const handleResize = () => {
      setViewMode(window.innerWidth < 1024 ? 'mobile' : 'desktop')
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [currentWeek])

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
      toast.error(t('configurationPanel.toasts.errorLoading'))
    } finally {
      setLoading(false)
    }
  }

  const toggleDateSelection = (dateStr) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dateObj = new Date(dateStr)
    dateObj.setHours(0, 0, 0, 0)

    if (dateObj < today) {
      toast.error(t('configurationPanel.toasts.cannotSelectPast'))
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

  const addTimeSlot = async () => {
    if (isEditMode) {
      updateTimeSlot()
      return
    }

    if (selectedDates.length === 0) {
      toast.error(t('configurationPanel.toasts.selectAtLeastOneDay'))
      return
    }
    
    if (!newSlot.start_hour || !newSlot.start_minute || !newSlot.end_hour || !newSlot.end_minute) {
      toast.error(t('configurationPanel.toasts.completeAllFields'))
      return
    }

    const start_time = `${newSlot.start_hour}:${newSlot.start_minute}:00`
    const end_time = `${newSlot.end_hour}:${newSlot.end_minute}:00`

    if (end_time <= start_time) {
      toast.error(t('configurationPanel.toasts.endAfterStart'), {
        duration: 4000,
      })
      return
    }

    const startMinutes = timeToMinutes(start_time)
    const endMinutes = timeToMinutes(end_time)
    const durationMinutes = endMinutes - startMinutes
    
    if (durationMinutes < 30) {
      toast.error(t('configurationPanel.toasts.minimumDuration'), {
        duration: 4000,
      })
      return
    }

    try {
      setSaving(true)
      
      const successfulInserts = []
      const errors = []
      
      for (const date of selectedDates) {
        try {
          const { data: exactMatch, error: exactMatchError } = await supabase
            .from('available_time_slots')
            .select('*')
            .eq('date', date)
            .eq('start_time', start_time)
            .eq('end_time', end_time)
            .eq('is_active', true)

          if (exactMatchError) {
            errors.push({
              date,
              error: `Error técnico al verificar horarios: ${exactMatchError.message}`
            })
            continue
          }

          if (exactMatch && exactMatch.length > 0) {
            errors.push({
              date,
              error: t('configurationPanel.toasts.alreadyExists', { 
                time: `${start_time.substring(0, 5)} - ${end_time.substring(0, 5)}` 
              })
            })
            continue
          }

          const { data: existingSlots, error: existingSlotsError } = await supabase
            .from('available_time_slots')
            .select('*')
            .eq('date', date)
            .eq('is_active', true)

          if (existingSlotsError) {
            errors.push({
              date,
              error: `Error técnico al verificar solapamientos: ${existingSlotsError.message}`
            })
            continue
          }

          let hasOverlap = false
          let overlappingSlot = null

          for (const existingSlot of existingSlots || []) {
            const existingStart = timeToMinutes(existingSlot.start_time.substring(0, 5))
            const existingEnd = timeToMinutes(existingSlot.end_time.substring(0, 5))
            const newStart = timeToMinutes(start_time.substring(0, 5))
            const newEnd = timeToMinutes(end_time.substring(0, 5))

            if (
              (newStart >= existingStart && newStart < existingEnd) ||
              (newEnd > existingStart && newEnd <= existingEnd) ||
              (newStart <= existingStart && newEnd >= existingEnd)
            ) {
              hasOverlap = true
              overlappingSlot = existingSlot
              break
            }
          }

          if (hasOverlap) {
            errors.push({
              date,
              error: t('configurationPanel.toasts.overlap', {
                newTime: `${start_time.substring(0, 5)} - ${end_time.substring(0, 5)}`,
                existingTime: `${overlappingSlot.start_time.substring(0, 5)} - ${overlappingSlot.end_time.substring(0, 5)}`
              })
            })
            continue
          }

          const singleSlot = {
            date: date,
            start_time: start_time,
            end_time: end_time,
            is_active: true,
            admin_only: isAdminOnly
          }

          const { data: insertResult, error: insertError } = await supabase
            .from('available_time_slots')
            .insert(singleSlot)
            .select()

          if (insertError) {
            if (insertError.code === '23505') {
              errors.push({
                date,
                error: 'Este horario ya existe en la base de datos (duplicado)'
              })
            } else if (insertError.code === '23503') {
              errors.push({
                date,
                error: 'Error de integridad: referencia inválida en la base de datos'
              })
            } else {
              errors.push({
                date,
                error: `Error al guardar: ${insertError.message}`
              })
            }
            continue
          }

          successfulInserts.push(...insertResult)

        } catch (unexpectedError) {
          errors.push({
            date,
            error: `Error inesperado: ${unexpectedError.message}`
          })
        }
      }

      if (successfulInserts.length > 0) {
        setTimeSlots(prev => {
          const updated = { ...prev }
          
          successfulInserts.forEach(slot => {
            const dateKey = slot.date
            if (!updated[dateKey]) {
              updated[dateKey] = []
            }
            
            const exists = updated[dateKey].some(existingSlot => 
              existingSlot.start_time === slot.start_time && 
              existingSlot.end_time === slot.end_time
            )
            
            if (!exists) {
              updated[dateKey].push(slot)
            }
            
            updated[dateKey].sort((a, b) => a.start_time.localeCompare(b.start_time))
          })
          
          return updated
        })

        setNewSlot({ 
          start_hour: '', 
          start_minute: '', 
          end_hour: '', 
          end_minute: '' 
        })
        setIsAdminOnly(false)
        
        invalidateTimeSlotsCache()

        const successCount = successfulInserts.length
        const errorCount = errors.length
        const totalCount = selectedDates.length

        if (errorCount === 0) {
          toast.success(t('configurationPanel.toasts.scheduleAdded', { count: successCount }), {
            duration: 3000,
          })
        } else {
          toast(t('configurationPanel.toasts.scheduleAddedPartial', { 
            success: successCount, 
            total: totalCount, 
            errors: errorCount 
          }), {
            duration: 5000,
            icon: '⚠️',
            style: {
              background: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #FCD34D',
            },
          })
        }
      } else {
        toast.error(t('configurationPanel.toasts.couldNotAdd'), {
          duration: 4000,
        })
      }

      if (errors.length > 0) {
        console.group('📋 Errores al añadir horarios:')
        errors.forEach(({ date, error }) => {
          console.error(`${format(new Date(date), 'dd/MM/yyyy')}: ${error}`)
          
          setTimeout(() => {
            toast.error(`${format(new Date(date), 'dd/MM')}: ${error}`, {
              duration: 5000,
            })
          }, 100)
        })
        console.groupEnd()
      }

    } catch (error) {
      console.error('💥 ERROR GENERAL:', error)
      toast.error(`❌ Error inesperado: ${error.message}`, {
        duration: 4000,
      })
    } finally {
      setSaving(false)
    }
  }

  const startEditTimeSlot = (slot) => {
    setNewSlot({
      start_hour: slot.start_time.substring(0, 2),
      start_minute: slot.start_time.substring(3, 5),
      end_hour: slot.end_time.substring(0, 2),
      end_minute: slot.end_time.substring(3, 5)
    })
    
    setIsAdminOnly(false)
    
    setSelectedDates([slot.date])
    
    setIsEditMode(true)
    setSlotToEdit(slot)
    
    const formElement = document.querySelector('#horario-form')
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    
    toast.info(t('configurationPanel.toasts.editingSchedule', { 
      time: `${slot.start_time.substring(0, 5)} - ${slot.end_time.substring(0, 5)}` 
    }))
  }

  const updateTimeSlot = async () => {
    if (!slotToEdit) return
    
    if (!newSlot.start_hour || !newSlot.start_minute || !newSlot.end_hour || !newSlot.end_minute) {
      toast.error(t('configurationPanel.toasts.completeAllFields'))
      return
    }

    const start_time = `${newSlot.start_hour}:${newSlot.start_minute}:00`
    const end_time = `${newSlot.end_hour}:${newSlot.end_minute}:00`

    if (end_time <= start_time) {
      toast.error(t('configurationPanel.toasts.endAfterStart'), {
        duration: 4000,
      })
      return
    }

    const startMinutes = timeToMinutes(start_time)
    const endMinutes = timeToMinutes(end_time)
    const durationMinutes = endMinutes - startMinutes
    
    if (durationMinutes < 30) {
      toast.error(t('configurationPanel.toasts.minimumDuration'), {
        duration: 4000,
      })
      return
    }

    try {
      setSaving(true)

      const { data: existingSlots, error: existingSlotsError } = await supabase
        .from('available_time_slots')
        .select('*')
        .eq('date', slotToEdit.date)
        .eq('is_active', true)
        .neq('id', slotToEdit.id)

      if (existingSlotsError) {
        throw existingSlotsError
      }

      for (const existingSlot of existingSlots || []) {
        const existingStart = timeToMinutes(existingSlot.start_time.substring(0, 5))
        const existingEnd = timeToMinutes(existingSlot.end_time.substring(0, 5))
        const newStart = timeToMinutes(start_time.substring(0, 5))
        const newEnd = timeToMinutes(end_time.substring(0, 5))

        if (
          (newStart >= existingStart && newStart < existingEnd) ||
          (newEnd > existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        ) {
          toast.error(t('configurationPanel.toasts.overlap', {
            newTime: `${start_time.substring(0, 5)} - ${end_time.substring(0, 5)}`,
            existingTime: `${existingSlot.start_time.substring(0, 5)} - ${existingSlot.end_time.substring(0, 5)}`
          }), {
            duration: 5000,
          })
          return
        }
      }

      const { error: updateError } = await supabase
        .from('available_time_slots')
        .update({
          start_time: start_time,
          end_time: end_time,
          admin_only: isAdminOnly,
          updated_at: new Date().toISOString()
        })
        .eq('id', slotToEdit.id)

      if (updateError) throw updateError

      setTimeSlots(prev => {
        const updated = { ...prev }
        const dateKey = slotToEdit.date
        
        if (updated[dateKey]) {
          updated[dateKey] = updated[dateKey].map(slot => 
            slot.id === slotToEdit.id 
              ? { ...slot, start_time, end_time, admin_only: isAdminOnly, updated_at: new Date().toISOString() }
              : slot
          )
          updated[dateKey].sort((a, b) => a.start_time.localeCompare(b.start_time))
        }
        
        return updated
      })

      cancelEdit()
      
      invalidateTimeSlotsCache(slotToEdit.date)
      
      toast.success(t('configurationPanel.toasts.scheduleUpdated'), {
        duration: 3000,
      })

    } catch (error) {
      console.error('Error updating time slot:', error)
      toast.error(t('configurationPanel.toasts.errorUpdating', { error: error.message }), {
        duration: 4000,
      })
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setIsEditMode(false)
    setSlotToEdit(null)
    setNewSlot({
      start_hour: '',
      start_minute: '',
      end_hour: '',
      end_minute: ''
    })
    setIsAdminOnly(false)
    setSelectedDates([])
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

      toast.success(t('configurationPanel.toasts.scheduleDeleted'))
      invalidateTimeSlotsCache()
    } catch (error) {
      console.error('Error deleting time slot:', error)
      toast.error(t('configurationPanel.toasts.errorDeleting'))
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
      toast.info(t('configurationPanel.toasts.noDaySchedules'))
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

      toast.success(t('configurationPanel.toasts.daySchedulesCleared', { 
        date: format(new Date(date), 'dd/MM/yyyy', { locale: getDateLocale() }) 
      }))
      invalidateTimeSlotsCache()
    } catch (error) {
      console.error('Error clearing day slots:', error)
      toast.error(t('configurationPanel.toasts.errorClearingDay'))
    } finally {
      setSaving(false)
    }
  }

  const clearSelectedDaysSlots = async () => {
    if (selectedDates.length === 0) {
      toast.error(t('configurationPanel.toasts.noSelectedDays'))
      return
    }

    const slotsToDelete = []
    selectedDates.forEach(date => {
      const daySlots = timeSlots[date] || []
      daySlots.forEach(slot => {
        slotsToDelete.push(slot.id)
      })
    })

    if (slotsToDelete.length === 0) {
      toast.info(t('configurationPanel.toasts.noDaysWithSchedules'))
      return
    }

    try {
      setSaving(true)
      
      const { error } = await supabase
        .from('available_time_slots')
        .update({ is_active: false })
        .in('id', slotsToDelete)

      if (error) throw error

      setTimeSlots(prev => {
        const updated = { ...prev }
        selectedDates.forEach(date => {
          delete updated[date]
        })
        return updated
      })

      const dayCount = selectedDates.length
      const slotCount = slotsToDelete.length
      toast.success(t('configurationPanel.toasts.selectedDaysCleared', { 
        slotCount, 
        dayCount 
      }))
      invalidateTimeSlotsCache()

      setSelectedDates([])
      
    } catch (error) {
      console.error('Error clearing selected days slots:', error)
      toast.error(t('configurationPanel.toasts.errorClearingSelected'))
    } finally {
      setSaving(false)
    }
  }

  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1))
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1))
  const goToCurrentWeek = () => setCurrentWeek(new Date())

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

  const renderDayCard = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const daySlots = timeSlots[dayStr] || []
    
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
                {format(day, 'EEEE', { locale: getDateLocale() })}
              </h3>
              <p className="text-sm text-gray-600">
                {format(day, 'dd MMM', { locale: getDateLocale() })}
                {isPastDay && <span className="text-red-500 ml-1">({t('configurationPanel.dayCard.past')})</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium text-gray-500">
              {t('configurationPanel.dayCard.schedules', { count: daySlots.length })}
            </span>
            {!isPastDay && daySlots.length > 0 && (
              <button
                onClick={() => clearDaySlots(dayStr)}
                disabled={saving}
                className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50"
              >
                {t('configurationPanel.dayCard.clear')}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {daySlots.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              {t('configurationPanel.dayCard.noSchedules')}
            </p>
          ) : (
            daySlots
              .filter(slot => {
                if (filterMode === 'all') return true
                if (filterMode === 'normal') return !slot.admin_only
                if (filterMode === 'admin_only') return slot.admin_only
                return true
              })
              .map(slot => (
              <div 
                key={slot.id} 
                className="flex justify-between items-center bg-gray-50 rounded px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-mono">
                    {formatTimeSlot(slot)}
                  </span>
                  {slot.admin_only && (
                    <span className="text-xs text-red-600 font-medium mt-0.5">
                      {t('configurationPanel.filters.adminOnly')}
                    </span>
                  )}
                </div>
                {!isPastDay && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditTimeSlot(slot)}
                      disabled={saving}
                      className="text-blue-500 hover:text-blue-700 disabled:opacity-50 transition-colors"
                      title={t('configurationPanel.dayCard.edit')}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => openDeleteModal(slot)}
                      disabled={saving}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                      title={t('configurationPanel.dayCard.delete')}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
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
        <div className="bg-white rounded-lg p-4 border">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('configurationPanel.mobile.selectedDays')} ({selectedDates.length})
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
            <p className="text-sm text-gray-500 mb-3">{t('configurationPanel.mobile.noDaysSelected')}</p>
          )}
          
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                toggleDateSelection(e.target.value)
                e.target.value = ""
              }
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">{t('configurationPanel.mobile.selectDay')}</option>
            {weekDays.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const isAlreadySelected = selectedDates.includes(dayStr)
              
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
                  {format(day, 'EEEE dd \'de\' MMMM', { locale: getDateLocale() })}
                  {isAlreadySelected ? ` (${t('configurationPanel.mobile.selected')})` : ''}
                  {isPastDay ? ` (${t('configurationPanel.mobile.past')})` : ''}
                </option>
              )
            })}
          </select>
        </div>

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
        <span className="text-gray-600">{t('configurationPanel.loadingConfig')}</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t('configurationPanel.title')}</h2>
            <p className="text-sm sm:text-base text-gray-600">
              {t('configurationPanel.subtitle')}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <button 
              onClick={goToPreviousWeek} 
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded w-full sm:w-auto justify-center sm:justify-start transition-colors"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm sm:text-base">{t('configurationPanel.previous')}</span>
            </button>
            
            <div className="text-center">
              <h3 className="text-sm sm:text-lg font-semibold">
                {t('configurationPanel.weekOf')} {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'd')} {t('configurationPanel.to')}{' '}
                {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'd \'de\' MMMM yyyy', { locale: getDateLocale() })}
              </h3>
              <button 
                onClick={goToCurrentWeek} 
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 mt-1 transition-colors"
              >
                {t('configurationPanel.goToCurrentWeek')}
              </button>
            </div>
            
            <button 
              onClick={goToNextWeek} 
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded w-full sm:w-auto justify-center sm:justify-start transition-colors"
            >
              <span className="text-sm sm:text-base">{t('configurationPanel.next')}</span>
              <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalSlots}</div>
            <div className="text-xs sm:text-sm text-gray-600">{t('configurationPanel.stats.totalSchedules')}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.totalDaysWithSlots}</div>
            <div className="text-xs sm:text-sm text-gray-600">{t('configurationPanel.stats.daysWithSchedules')}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h4 className="font-medium text-gray-900 mb-3">{t('configurationPanel.filters.title')}</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('configurationPanel.filters.all')}
            </button>
            <button
              onClick={() => setFilterMode('normal')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filterMode === 'normal'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('configurationPanel.filters.normal')}
            </button>
            <button
              onClick={() => setFilterMode('admin_only')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filterMode === 'admin_only'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('configurationPanel.filters.adminOnly')}
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border" id="horario-form">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">
              {isEditMode ? t('configurationPanel.form.edit') : t('configurationPanel.form.addNew')}
            </h3>
            {isEditMode && (
              <button
                onClick={cancelEdit}
                className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {t('configurationPanel.form.cancelEdit')}
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('configurationPanel.form.startHour')} *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="6"
                  max="22"
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
                  placeholder="06"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <span className="text-gray-400 text-sm">h</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">{t('configurationPanel.form.enter')} 06 - 22</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('configurationPanel.form.startMinute')} *
              </label>
              <div className="relative">
                <select
                  value={newSlot.start_minute}
                  onChange={(e) => setNewSlot({...newSlot, start_minute: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  required
                >
                  <option value="">--</option>
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">{t('configurationPanel.form.onlyIntervals')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('configurationPanel.form.endHour')} *
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
                  placeholder="23"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <span className="text-gray-400 text-sm">h</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">{t('configurationPanel.form.enter')} 06 - 23</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('configurationPanel.form.endMinute')} *
              </label>
              <div className="relative">
                <select
                  value={newSlot.end_minute}
                  onChange={(e) => setNewSlot({...newSlot, end_minute: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  required
                >
                  <option value="">--</option>
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">{t('configurationPanel.form.onlyIntervals')}</p>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="w-full">
                <label className="flex items-center gap-2 cursor-pointer bg-red-50 border border-red-200 rounded-md p-3 hover:bg-red-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={isAdminOnly}
                    onChange={(e) => setIsAdminOnly(e.target.checked)}
                    className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-red-700">{t('configurationPanel.form.adminOnlyLabel')}</span>
                    <p className="text-xs text-red-600 mt-0.5">{t('configurationPanel.form.adminOnlyDesc')}</p>
                  </div>
                </label>
              </div>
              
              <button
                onClick={(e) => {
                  e.preventDefault()
                  if (!saving) {
                    isEditMode ? updateTimeSlot() : addTimeSlot()
                  }
                }}
                disabled={saving || !isFormValid()}
                className={`w-full ${isEditMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm`}
              >
                {saving ? (
                  <div className="flex items-center justify-center">
                    <div className="loading-spinner mr-2"></div>
                    {isEditMode ? t('configurationPanel.form.updating') : t('configurationPanel.form.adding')}
                  </div>
                ) : (
                  isEditMode ? t('configurationPanel.form.update') : t('configurationPanel.form.add')
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 mr-2">{t('configurationPanel.form.quickSuggestions')}</span>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '08', start_minute: '00', end_hour: '12', end_minute: '00'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {t('configurationPanel.form.morning')}
              </button>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '14', start_minute: '00', end_hour: '18', end_minute: '00'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {t('configurationPanel.form.afternoon')}
              </button>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '08', start_minute: '00', end_hour: '18', end_minute: '00'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {t('configurationPanel.form.fullDay')}
              </button>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '09', start_minute: '00', end_hour: '09', end_minute: '30'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {t('configurationPanel.form.thirtyMin')}
              </button>
              
              <button
                type="button"
                onClick={() => setNewSlot({start_hour: '10', start_minute: '00', end_hour: '11', end_minute: '00'})}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {t('configurationPanel.form.oneHour')}
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">{t('configurationPanel.selection.title')}</h4>
                  <p className="text-sm text-gray-600">
                    {selectedDates.length === 0 
                      ? t('configurationPanel.selection.instruction')
                      : t('configurationPanel.selection.selected', { count: selectedDates.length })
                    }
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={selectAllWeek}
                    disabled={saving}
                    className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    {t('configurationPanel.selection.selectAll')}
                  </button>
                  
                  <button
                    onClick={clearSelection}
                    disabled={saving || selectedDates.length === 0}
                    className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    {t('configurationPanel.selection.clearSelection')}
                  </button>
                </div>
                <button
                    onClick={clearSelectedDaysSlots}
                    disabled={saving || selectedDates.length === 0}
                    className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                  >
                    {t('configurationPanel.selection.clearSchedules')}
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
              
              <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded mt-3">
                <strong>{t('configurationPanel.selection.howToUse')}</strong> {t('configurationPanel.selection.howToUseText')}
                {isEditMode && (
                  <div className="mt-2 text-green-700 bg-green-50 p-2 rounded">
                    <strong>{t('configurationPanel.selection.editMode')}</strong> {t('configurationPanel.selection.editModeText')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:hidden flex bg-gray-100 rounded-md p-1">
          <button
            onClick={() => setViewMode('mobile')}
            className={`flex-1 px-3 py-1 text-xs rounded transition-colors ${viewMode === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
          >
            {t('configurationPanel.viewToggle.byDay')}
          </button>
          <button
            onClick={() => setViewMode('desktop')}
            className={`flex-1 px-3 py-1 text-xs rounded transition-colors ${viewMode === 'desktop' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
          >
            {t('configurationPanel.viewToggle.complete')}
          </button>
        </div>

        {viewMode === 'mobile' ? renderMobileView() : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {getWeekDays().map(renderDayCard)}
          </div>
        )}

        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setSlotToDelete(null)
          }}
          onConfirm={deleteTimeSlot}
          title={t('configurationPanel.deleteModal.title')}
          message={t('configurationPanel.deleteModal.message', {
            slot: slotToDelete ? formatTimeSlot(slotToDelete) : '',
            date: slotToDelete ? format(new Date(slotToDelete.date), 'dd/MM/yyyy', { locale: getDateLocale() }) : ''
          })}
          confirmText={t('configurationPanel.deleteModal.confirm')}
          cancelText={t('configurationPanel.deleteModal.cancel')}
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