import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function ClientsManagement() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDogsModal, setShowDogsModal] = useState(false)
  const [clientBookings, setClientBookings] = useState([])
  const [clientDogs, setClientDogs] = useState([])
  const [updating, setUpdating] = useState(false)
  const [viewMode, setViewMode] = useState('desktop') // 'desktop' o 'mobile'

  // Estados para crear/editar cliente
  const [clientForm, setClientForm] = useState({
    nombre_completo: '',
    email: '',
    telefono: '',
    pais_codigo: '+34',
    email_notifications: true
  })

  // Estados para gestión de perros
  const [showAddDogModal, setShowAddDogModal] = useState(false)
  const [dogForm, setDogForm] = useState({
    nombre: '',
    raza: '',
    edad: '',
    peso: '',
    observaciones: ''
  })

  useEffect(() => {
    loadClients()
    
    // Detectar tamaño de pantalla
    const handleResize = () => {
      setViewMode(window.innerWidth < 1024 ? 'mobile' : 'desktop')
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const loadClients = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          nombre_completo,
          email,
          telefono,
          pais_codigo,
          email_notifications,
          created_at,
          updated_at
        `)
        .eq('role', 'cliente')
        .order('nombre_completo')

      if (error) throw error
      setClients(data)
    } catch (error) {
      console.error('Error loading clients:', error)
      toast.error('Error cargando clientes')
    } finally {
      setLoading(false)
    }
  }

  const loadClientBookings = async (clientId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          fecha_hora,
          duracion_minutos,
          precio,
          estado,
          observaciones,
          services!inner(nombre, tipo),
          dogs!inner(nombre, raza)
        `)
        .eq('client_id', clientId)
        .order('fecha_hora', { ascending: false })

      if (error) throw error
      setClientBookings(data)
    } catch (error) {
      console.error('Error loading client bookings:', error)
      toast.error('Error cargando historial de citas')
    }
  }

  const loadClientDogs = async (clientId) => {
    try {
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('owner_id', clientId)
        .order('nombre')

      if (error) throw error
      setClientDogs(data)
    } catch (error) {
      console.error('Error loading client dogs:', error)
      toast.error('Error cargando perros del cliente')
    }
  }

  // MÉTODO CORREGIDO - Sin usar auth.admin
  const createClient = async (e) => {
    e.preventDefault()
    
    if (!clientForm.nombre_completo.trim() || !clientForm.email.trim()) {
      toast.error('Nombre completo y email son obligatorios')
      return
    }

    try {
      setUpdating(true)
      
      // MÉTODO ALTERNATIVO: Crear directamente en profiles sin crear usuario en auth
      // Generar un UUID temporal para el cliente
      const tempId = crypto.randomUUID()
      
      const profileData = {
        id: tempId,
        nombre_completo: clientForm.nombre_completo.trim(),
        email: clientForm.email.trim(),
        telefono: clientForm.telefono.trim(),
        pais_codigo: clientForm.pais_codigo,
        email_notifications: clientForm.email_notifications,
        role: 'cliente',
        // Marcar como perfil creado por admin (sin autenticación)
        created_by_admin: true,
        // El cliente deberá registrarse por sí mismo para activar su cuenta
        account_status: 'pending_registration'
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)

      if (profileError) throw profileError

      toast.success('Cliente creado correctamente. El cliente deberá registrarse en el sistema para activar su cuenta.')
      setShowCreateModal(false)
      setClientForm({
        nombre_completo: '',
        email: '',
        telefono: '',
        pais_codigo: '+34',
        email_notifications: true
      })
      await loadClients()
    } catch (error) {
      console.error('Error creating client:', error)
      if (error.code === '23505') {
        toast.error('Ya existe un cliente con este email')
      } else {
        toast.error('Error creando cliente: ' + error.message)
      }
    } finally {
      setUpdating(false)
    }
  }

  const updateClient = async (e) => {
    e.preventDefault()
    
    if (!clientForm.nombre_completo.trim() || !clientForm.email.trim()) {
      toast.error('Nombre completo y email son obligatorios')
      return
    }

    try {
      setUpdating(true)
      
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre_completo: clientForm.nombre_completo.trim(),
          email: clientForm.email.trim(),
          telefono: clientForm.telefono.trim(),
          pais_codigo: clientForm.pais_codigo,
          email_notifications: clientForm.email_notifications,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedClient.id)

      if (error) throw error

      toast.success('Cliente actualizado correctamente')
      setShowEditModal(false)
      setSelectedClient(null)
      await loadClients()
    } catch (error) {
      console.error('Error updating client:', error)
      toast.error('Error actualizando cliente')
    } finally {
      setUpdating(false)
    }
  }

  const createDog = async (e) => {
    e.preventDefault()
    
    if (!dogForm.nombre.trim()) {
      toast.error('El nombre del perro es obligatorio')
      return
    }

    try {
      setUpdating(true)
      
      const dogData = {
        owner_id: selectedClient.id,
        nombre: dogForm.nombre.trim(),
        raza: dogForm.raza.trim() || null,
        edad: dogForm.edad ? parseInt(dogForm.edad) : null,
        peso: dogForm.peso ? parseFloat(dogForm.peso) : null,
        observaciones: dogForm.observaciones.trim() || null,
        activo: true
      }

      const { error } = await supabase
        .from('dogs')
        .insert(dogData)

      if (error) throw error

      toast.success('Perro añadido correctamente')
      setShowAddDogModal(false)
      setDogForm({
        nombre: '',
        raza: '',
        edad: '',
        peso: '',
        observaciones: ''
      })
      await loadClientDogs(selectedClient.id)
    } catch (error) {
      console.error('Error creating dog:', error)
      toast.error('Error añadiendo perro')
    } finally {
      setUpdating(false)
    }
  }

  const handleClientSelect = async (client) => {
    setSelectedClient(client)
    await loadClientBookings(client.id)
    await loadClientDogs(client.id)
  }

  const openEditModal = (client) => {
    setSelectedClient(client)
    setClientForm({
      nombre_completo: client.nombre_completo,
      email: client.email,
      telefono: client.telefono || '',
      pais_codigo: client.pais_codigo || '+34',
      email_notifications: client.email_notifications
    })
    setShowEditModal(true)
  }

  const getFilteredClients = () => {
    if (!searchTerm) return clients
    
    const term = searchTerm.toLowerCase()
    return clients.filter(client =>
      client.nombre_completo?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.telefono?.includes(term)
    )
  }

  const getStatusBadge = (estado) => {
    const statusClasses = {
      pendiente: 'bg-yellow-100 text-yellow-800',
      confirmada: 'bg-blue-100 text-blue-800',
      completada: 'bg-green-100 text-green-800',
      cancelada: 'bg-red-100 text-red-800'
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[estado] || 'bg-gray-100 text-gray-800'}`}>
        {estado}
      </span>
    )
  }

  // Renderizar cliente como card para móviles
  const renderClientCard = (client) => (
    <div
      key={client.id}
      onClick={() => handleClientSelect(client)}
      className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
        selectedClient?.id === client.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{client.nombre_completo}</h3>
          <p className="text-sm text-gray-600 truncate">{client.email}</p>
          {client.telefono && (
            <p className="text-sm text-gray-500">{client.pais_codigo} {client.telefono}</p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            openEditModal(client)
          }}
          className="text-blue-600 hover:text-blue-800 p-1"
          title="Editar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
      
      <div className="text-xs text-gray-400">
        Registrado: {format(parseISO(client.created_at), 'dd/MM/yyyy')}
      </div>
    </div>
  )

  const filteredClients = getFilteredClients()

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">Cargando clientes...</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-4 sm:space-y-6">
        {/* Header responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Gestión de Clientes</h2>
            <p className="text-sm sm:text-base text-gray-600">Administra los clientes registrados y sus perros</p>
          </div>
          
          {/* Info note responsive */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs sm:text-sm text-blue-800">
              Los clientes deben registrarse directamente en el sistema usando el formulario de registro.
            </p>
          </div>
        </div>

        {/* Buscador responsive */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, email o teléfono..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="text-sm text-gray-600 text-center sm:text-left">
              {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
            </div>
            
            {/* Toggle vista móvil/desktop */}
            <div className="lg:hidden flex bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setViewMode('mobile')}
                className={`flex-1 px-3 py-1 text-xs rounded ${viewMode === 'mobile' ? 'bg-white shadow' : ''}`}
              >
                Lista
              </button>
              
            </div>
          </div>
        </div>

        {viewMode === 'mobile' ? (
          // Vista móvil - Layout de una sola columna
          <div className="space-y-6">
            {/* Lista de clientes como cards */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Clientes</h3>
              {filteredClients.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border text-center py-8">
                  <div className="text-gray-400 text-4xl mb-2">👥</div>
                  <h4 className="text-lg font-medium text-gray-900">No se encontraron clientes</h4>
                  <p className="text-gray-600">Ajusta la búsqueda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredClients.map(renderClientCard)}
                </div>
              )}
            </div>

            {/* Detalles del cliente seleccionado */}
            {selectedClient && (
              <div className="space-y-4">
                {/* Información del cliente */}
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">Información del Cliente</h3>
                      <button
                        onClick={() => openEditModal(selectedClient)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nombre</label>
                      <p className="text-gray-900">{selectedClient.nombre_completo}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-gray-900 text-sm break-all">{selectedClient.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Teléfono</label>
                      <p className="text-gray-900">
                        {selectedClient.telefono ? `${selectedClient.pais_codigo} ${selectedClient.telefono}` : 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Notificaciones</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs ${selectedClient.email_notifications ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          Email: {selectedClient.email_notifications ? 'Sí' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Perros del cliente */}
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">Perros ({clientDogs.length})</h3>
                      <button
                        onClick={() => setShowAddDogModal(true)}
                        className="text-primary-600 hover:text-primary-800 flex items-center text-sm"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Añadir
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {clientDogs.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-gray-600 text-sm">No hay perros registrados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientDogs.map((dog) => (
                          <div key={dog.id} className="p-3 bg-gray-50 rounded border">
                            <h4 className="font-medium text-gray-900">
                              {dog.nombre}
                              {!dog.activo && <span className="text-red-500 text-sm ml-2">(Inactivo)</span>}
                            </h4>
                            {dog.raza && <p className="text-sm text-gray-600">Raza: {dog.raza}</p>}
                            <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600">
                              {dog.edad && <span>Edad: {dog.edad} años</span>}
                              {dog.peso && <span>Peso: {dog.peso} kg</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Historial de citas */}
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-semibold text-gray-900">Historial de Citas ({clientBookings.length})</h3>
                  </div>
                  
                  <div className="p-4">
                    {clientBookings.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-gray-600 text-sm">No hay citas registradas</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {clientBookings.map((booking) => (
                          <div key={booking.id} className="p-3 border rounded">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 text-sm">{booking.services?.nombre}</h4>
                                <p className="text-sm text-gray-600">
                                  Perro: {booking.dogs?.nombre}
                                  {booking.dogs?.raza && ` (${booking.dogs.raza})`}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {format(parseISO(booking.fecha_hora), 'dd/MM/yyyy HH:mm')} 
                                  ({booking.duracion_minutos} min)
                                </p>
                                <p className="text-sm font-medium text-gray-900">€{booking.precio}</p>
                              </div>
                              <div className="ml-2">
                                {getStatusBadge(booking.estado)}
                              </div>
                            </div>
                            {booking.observaciones && (
                              <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                                {booking.observaciones}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Vista desktop - Layout de dos columnas
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de clientes */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">Clientes</h3>
              </div>
              
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-4xl mb-2">👥</div>
                    <h4 className="text-lg font-medium text-gray-900">No se encontraron clientes</h4>
                    <p className="text-gray-600">Ajusta la búsqueda o crea un nuevo cliente</p>
                  </div>
                ) : (
                  filteredClients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => handleClientSelect(client)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer ${
                        selectedClient?.id === client.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{client.nombre_completo}</h4>
                          <p className="text-sm text-gray-600">{client.email}</p>
                          {client.telefono && (
                            <p className="text-sm text-gray-500">{client.pais_codigo} {client.telefono}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Registrado: {format(parseISO(client.created_at), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(client)
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Detalles del cliente seleccionado */}
            <div className="space-y-6">
              {selectedClient ? (
                <>
                  {/* Información del cliente */}
                  <div className="bg-white rounded-lg shadow-sm border">
                    <div className="px-6 py-4 border-b">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Información del Cliente</h3>
                        <button
                          onClick={() => openEditModal(selectedClient)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Nombre</label>
                        <p className="text-gray-900">{selectedClient.nombre_completo}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-gray-900">{selectedClient.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Teléfono</label>
                        <p className="text-gray-900">
                          {selectedClient.telefono ? `${selectedClient.pais_codigo} ${selectedClient.telefono}` : 'No especificado'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Notificaciones</label>
                        <div className="flex space-x-4 mt-1">
                          <span className={`px-2 py-1 rounded text-xs ${selectedClient.email_notifications ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            Email: {selectedClient.email_notifications ? 'Sí' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Perros del cliente */}
                  <div className="bg-white rounded-lg shadow-sm border">
                    <div className="px-6 py-4 border-b">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Perros ({clientDogs.length})</h3>
                        <button
                          onClick={() => setShowAddDogModal(true)}
                          className="text-primary-600 hover:text-primary-800 flex items-center text-sm"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Añadir Perro
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      {clientDogs.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-gray-600">No hay perros registrados</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {clientDogs.map((dog) => (
                            <div key={dog.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {dog.nombre}
                                  {!dog.activo && <span className="text-red-500 text-sm ml-2">(Inactivo)</span>}
                                </h4>
                                {dog.raza && <p className="text-sm text-gray-600">Raza: {dog.raza}</p>}
                                {dog.edad && <p className="text-sm text-gray-600">Edad: {dog.edad} años</p>}
                                {dog.peso && <p className="text-sm text-gray-600">Peso: {dog.peso} kg</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Historial de citas */}
                  <div className="bg-white rounded-lg shadow-sm border">
                    <div className="px-6 py-4 border-b">
                      <h3 className="text-lg font-semibold">Historial de Citas ({clientBookings.length})</h3>
                    </div>
                    
                    <div className="p-6">
                      {clientBookings.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-gray-600">No hay citas registradas</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {clientBookings.map((booking) => (
                            <div key={booking.id} className="p-3 border rounded">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-gray-900">{booking.services?.nombre}</h4>
                                  <p className="text-sm text-gray-600">
                                    Perro: {booking.dogs?.nombre}
                                    {booking.dogs?.raza && ` (${booking.dogs.raza})`}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {format(parseISO(booking.fecha_hora), 'dd/MM/yyyy HH:mm')} 
                                    ({booking.duracion_minutos} min)
                                  </p>
                                  <p className="text-sm font-medium text-gray-900">€{booking.precio}</p>
                                </div>
                                <div>
                                  {getStatusBadge(booking.estado)}
                                </div>
                              </div>
                              {booking.observaciones && (
                                <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                                  {booking.observaciones}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                  <div className="text-gray-400 text-4xl mb-2">👤</div>
                  <h3 className="text-lg font-medium text-gray-900">Selecciona un cliente</h3>
                  <p className="text-gray-600">Haz clic en un cliente de la lista para ver sus detalles</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal editar cliente responsive */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Editar Cliente</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={updateClient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    value={clientForm.nombre_completo}
                    onChange={(e) => setClientForm({...clientForm, nombre_completo: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({...clientForm, email: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      País
                    </label>
                    <select
                      value={clientForm.pais_codigo}
                      onChange={(e) => setClientForm({...clientForm, pais_codigo: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+33">🇫🇷 +33</option>
                      <option value="+351">🇵🇹 +351</option>
                      <option value="+1">🇺🇸 +1</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={clientForm.telefono}
                      onChange={(e) => setClientForm({...clientForm, telefono: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="123456789"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferencias de notificación
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={clientForm.email_notifications}
                        onChange={(e) => setClientForm({...clientForm, email_notifications: e.target.checked})}
                        className="mr-2"
                      />
                      <span className="text-sm">Notificaciones por email</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {updating ? 'Actualizando...' : 'Actualizar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal añadir perro responsive */}
        {showAddDogModal && selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Añadir Perro a {selectedClient.nombre_completo}</h3>
                <button
                  onClick={() => setShowAddDogModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={createDog} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del perro *
                  </label>
                  <input
                    type="text"
                    value={dogForm.nombre}
                    onChange={(e) => setDogForm({...dogForm, nombre: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Raza
                  </label>
                  <input
                    type="text"
                    value={dogForm.raza}
                    onChange={(e) => setDogForm({...dogForm, raza: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Ej: Labrador, Pastor Alemán..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Edad (años)
                    </label>
                    <input
                      type="number"
                      value={dogForm.edad}
                      onChange={(e) => setDogForm({...dogForm, edad: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      min="0"
                      max="30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Peso (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={dogForm.peso}
                      onChange={(e) => setDogForm({...dogForm, peso: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observaciones
                  </label>
                  <textarea
                    value={dogForm.observaciones}
                    onChange={(e) => setDogForm({...dogForm, observaciones: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Alergias, problemas de salud, comportamiento..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddDogModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {updating ? 'Añadiendo...' : 'Añadir Perro'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}