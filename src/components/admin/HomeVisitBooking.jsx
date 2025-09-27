import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format, addDays, startOfTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import { timeToMinutes, minutesToTime } from '../../utils/bookingUtils'

export default function HomeVisitBooking() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [homeVisits, setHomeVisits] = useState([])
  
  // Estados para crear nueva cita a domicilio
  const [newVisit, setNewVisit] = useState({
    client_id: '',
    dog_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    observaciones: '',
    direccion: ''
  })
  const [clientDogs, setClientDogs] = useState([])
  
  // Estados para modal de confirmación
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [visitToDelete, setVisitToDelete] = useState(null)

  useEffect(() => {
    loadClients()
    loadHomeVisits()
  }, [])

  useEffect(() => {
    if (newVisit.client_id) {
      loadClientDogs(newVisit.client_id)
    }
  }, [newVisit.client_id])

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre_completo, email, telefono')
        .eq('role', 'cliente')
        .order('nombre_completo')

      if (error) throw error
      setClients(data)
    } catch (error) {
      console.error('Error loading clients:', error)
      toast.error('Error cargando clientes')
    }
  }

  const loadClientDogs = async (clientId) => {
    try {
      const { data, error } = await supabase
        .from('dogs')
        .select('id, nombre, raza')
        .eq('owner_id', clientId)
        .eq('activo', true)
        .order('nombre')

      if (error) throw error
      setClientDogs(data)
    } catch (error) {
      console.error('Error loading client dogs:', error)
    }
  }

  const loadHomeVisits = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services!inner(nombre, tipo),
          dogs!inner(nombre, raza),
          profiles!bookings_client_id_fkey(nombre_completo, telefono, email)
        `)
        .eq('services.tipo', 'rehabilitacion_domicilio')
        .gte('fecha_hora', new Date().toISOString())
        .order('fecha_hora', { ascending: true })

      if (error) throw error
      setHomeVisits(data || [])
    } catch (error) {
      console.error('Error loading home visits:', error)
      toast.error('Error cargando visitas a domicilio')
    }
  }

  // Función para calcular duración y precio
  const calculateDurationAndPrice = (horaInicio, horaFin) => {
    if (!horaInicio || !horaFin) return { duracionMinutos: 0, precio: 0 }
    
    const inicioTotalMin = timeToMinutes(horaInicio)
    const finTotalMin = timeToMinutes(horaFin)
    
    if (finTotalMin <= inicioTotalMin) {
      return { duracionMinutos: 0, precio: 0, error: 'La hora de fin debe ser posterior a la de inicio' }
    }
    
    const duracionMinutos = finTotalMin - inicioTotalMin
    const duracionHoras = duracionMinutos / 60
    const precio = duracionHoras * 80 // €80 por hora
    
    return { duracionMinutos, precio, duracionHoras }
  }

  // Efecto para actualizar precio cuando cambian las horas
  const duracionInfo = calculateDurationAndPrice(newVisit.hora_inicio, newVisit.hora_fin)

  const createHomeVisit = async (e) => {
    e.preventDefault()
    
    if (!newVisit.client_id || !newVisit.dog_id || !newVisit.fecha || !newVisit.hora_inicio || !newVisit.hora_fin) {
      toast.error('Completa todos los campos obligatorios')
      return
    }

    if (duracionInfo.error) {
      toast.error(duracionInfo.error)
      return
    }

    if (duracionInfo.duracionMinutos < 30) {
      toast.error('La duración mínima es de 30 minutos')
      return
    }

    try {
      setLoading(true)
      
      // Obtener el servicio de rehabilitación a domicilio
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('tipo', 'rehabilitacion_domicilio')
        .single()

      if (serviceError) throw serviceError

      // Obtener el espacio de domicilio
      const { data: spaceData, error: spaceError } = await supabase
        .from('spaces')
        .select('*')
        .eq('tipo_de_servicio', 'rehabilitacion_domicilio')
        .single()

      if (spaceError) throw spaceError

      const datetime = `${newVisit.fecha}T${newVisit.hora_inicio}:00`

      const bookingData = {
        client_id: newVisit.client_id,
        dog_id: parseInt(newVisit.dog_id),
        service_id: serviceData.id,
        space_id: spaceData.id,
        fecha_hora: datetime,
        duracion_minutos: duracionInfo.duracionMinutos,
        precio: duracionInfo.precio,
        observaciones: newVisit.observaciones.trim() || null,
        estado: 'confirmada',
        // Campos específicos para visitas a domicilio
        direccion_domicilio: newVisit.direccion.trim(),
        es_visita_domicilio: true,
        bloquea_centro: true,
        spaces_display: 'Domicilio del Cliente',
        hora_fin_domicilio: newVisit.hora_fin
      }

      const { error } = await supabase
        .from('bookings')
        .insert(bookingData)

      if (error) throw error

      toast.success('Visita a domicilio programada correctamente')
      setShowCreateModal(false)
      setNewVisit({
        client_id: '',
        dog_id: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        observaciones: '',
        direccion: ''
      })
      setClientDogs([])
      await loadHomeVisits()
    } catch (error) {
      console.error('Error creating home visit:', error)
      toast.error('Error programando visita a domicilio')
    } finally {
      setLoading(false)
    }
  }

  const deleteHomeVisit = async () => {
    if (!visitToDelete) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', visitToDelete.id)

      if (error) throw error

      toast.success('Visita a domicilio eliminada')
      await loadHomeVisits()
    } catch (error) {
      console.error('Error deleting home visit:', error)
      toast.error('Error eliminando visita')
    } finally {
      setLoading(false)
      setShowDeleteModal(false)
      setVisitToDelete(null)
    }
  }

  const openDeleteModal = (visit) => {
    setVisitToDelete(visit)
    setShowDeleteModal(true)
  }

  // Generar horas disponibles (06:00 - 22:00, cada 15 minutos)
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = (hour === 6 ? 30 : 0); minute < 60; minute += 15) {
        // Parar exactamente a las 23:00
        if (hour === 23 && minute > 0) break
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
      }
    }
    return slots
  }

  // Filtrar horas de fin basadas en hora de inicio
  const getEndTimeSlots = () => {
    if (!newVisit.hora_inicio) return []
    
    const allSlots = generateTimeSlots()
    const inicioTotalMin = timeToMinutes(newVisit.hora_inicio)
    
    return allSlots.filter(slot => {
      const slotTotalMin = timeToMinutes(slot)
      return slotTotalMin > inicioTotalMin
    })
  }

  const timeSlots = generateTimeSlots()
  const endTimeSlots = getEndTimeSlots()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Rehabilitación a Domicilio</h2>
          <p className="text-gray-600">Gestiona las visitas a domicilio programadas</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nueva Visita a Domicilio
        </button>
      </div>

      {/* Info importante */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex">
          <svg className="w-6 h-6 text-orange-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h4 className="font-medium text-orange-800">Importante sobre el bloqueo de horarios</h4>
            <p className="text-orange-700 text-sm mt-1">
              Las citas a domicilio bloquean automáticamente los horarios en el centro para todos los servicios.
            </p>
            <p className="text-orange-700 text-sm mt-1">
              <strong>Tarifa:</strong> €80 por hora. Duración mínima: 30 minutos.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de visitas programadas */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Próximas Visitas a Domicilio ({homeVisits.length})</h3>
        </div>
        
        {homeVisits.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">🏠</div>
            <h4 className="text-lg font-medium text-gray-900">No hay visitas programadas</h4>
            <p className="text-gray-600">Programa tu primera visita a domicilio</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {homeVisits.map((visit) => {
              // Calcular duración para mostrar
              const inicioTime = visit.fecha_hora.substring(11, 16)
              const duracionHoras = visit.duracion_minutos / 60
              const finTime = minutesToTime(timeToMinutes(inicioTime) + visit.duracion_minutos)
              
              return (
                <div key={visit.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-3">🏠</span>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            {visit.profiles?.nombre_completo}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Perro: {visit.dogs?.nombre} {visit.dogs?.raza && `(${visit.dogs.raza})`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Fecha y Horario</p>
                          <p className="font-medium">
                            {format(new Date(visit.fecha_hora.substring(0, 10)), "EEEE d 'de' MMMM", { locale: es })}
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>{inicioTime} - {finTime}</strong> ({duracionHoras}h = {visit.duracion_minutos} min)
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Contacto</p>
                          <p className="font-medium">{visit.profiles?.telefono}</p>
                          <p className="text-sm text-gray-600">{visit.profiles?.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Precio</p>
                          <p className="text-lg font-semibold text-green-600">€{visit.precio}</p>
                          <p className="text-xs text-gray-500">€80/hora × {duracionHoras}h</p>
                        </div>
                      </div>

                      {visit.direccion_domicilio && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-500">Dirección</p>
                          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                            📍 {visit.direccion_domicilio}
                          </p>
                        </div>
                      )}

                      {visit.observaciones && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-500">Observaciones</p>
                          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                            {visit.observaciones}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => openDeleteModal(visit)}
                        className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50"
                        title="Eliminar visita"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal crear visita */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Nueva Visita a Domicilio</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={createHomeVisit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente *
                </label>
                <select
                  value={newVisit.client_id}
                  onChange={(e) => setNewVisit({...newVisit, client_id: e.target.value, dog_id: ''})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.nombre_completo} - {client.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Perro *
                </label>
                <select
                  value={newVisit.dog_id}
                  onChange={(e) => setNewVisit({...newVisit, dog_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                  disabled={!newVisit.client_id}
                >
                  <option value="">Selecciona un perro</option>
                  {clientDogs.map(dog => (
                    <option key={dog.id} value={dog.id}>
                      {dog.nombre} {dog.raza && `(${dog.raza})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={newVisit.fecha}
                  onChange={(e) => setNewVisit({...newVisit, fecha: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  min={format(startOfTomorrow(), 'yyyy-MM-dd')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora de Inicio *
                  </label>
                  <select
                    value={newVisit.hora_inicio}
                    onChange={(e) => setNewVisit({...newVisit, hora_inicio: e.target.value, hora_fin: ''})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Selecciona hora</option>
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora de Fin *
                  </label>
                  <select
                    value={newVisit.hora_fin}
                    onChange={(e) => setNewVisit({...newVisit, hora_fin: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                    disabled={!newVisit.hora_inicio}
                  >
                    <option value="">Selecciona hora fin</option>
                    {endTimeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mostrar duración y precio calculados */}
              {newVisit.hora_inicio && newVisit.hora_fin && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  {duracionInfo.error ? (
                    <p className="text-red-600 text-sm">{duracionInfo.error}</p>
                  ) : (
                    <div className="text-sm">
                      <p className="font-medium text-blue-800">
                        Duración: {duracionInfo.duracionHoras}h ({duracionInfo.duracionMinutos} min)
                      </p>
                      <p className="font-semibold text-green-700">
                        Precio total: €{duracionInfo.precio.toFixed(2)} (€80/hora)
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección del Domicilio *
                </label>
                <textarea
                  value={newVisit.direccion}
                  onChange={(e) => setNewVisit({...newVisit, direccion: e.target.value})}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Calle, número, piso, código postal, ciudad..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={newVisit.observaciones}
                  onChange={(e) => setNewVisit({...newVisit, observaciones: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Información adicional sobre la visita..."
                />
              </div>

              <div className="bg-orange-50 p-3 rounded">
                <p className="text-sm text-orange-800">
                  ⚠️ Esta visita bloqueará automáticamente los horarios en el centro para todos los servicios.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || duracionInfo.error || duracionInfo.duracionMinutos < 30}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Programando...' : 'Programar Visita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setVisitToDelete(null)
        }}
        onConfirm={deleteHomeVisit}
        title="Eliminar Visita a Domicilio"
        message="¿Estás seguro que quieres eliminar esta visita a domicilio? Esta acción no se puede deshacer."
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
  )
}