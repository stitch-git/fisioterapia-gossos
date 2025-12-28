import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO } from 'date-fns'
import { es, ca } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

export default function ClientsManagement() {
  const { t, i18n } = useTranslation()
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
  const [viewMode, setViewMode] = useState('desktop')

  const [clientForm, setClientForm] = useState({
    nombre_completo: '',
    email: '',
    telefono: '',
    pais_codigo: '+34',
    email_notifications: true
  })

  const [showAddDogModal, setShowAddDogModal] = useState(false)
  const [dogForm, setDogForm] = useState({
    nombre: '',
    raza: '',
    edad: '',
    peso: '',
    observaciones: ''
  })

  // Determinar locale para date-fns según idioma actual
  const getDateLocale = () => i18n.language === 'ca' ? ca : es

  useEffect(() => {
    loadClients()
    
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
      toast.error(t('clientsManagement.toasts.errorLoadingClients'))
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
      toast.error(t('clientsManagement.toasts.errorLoadingBookings'))
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
      toast.error(t('clientsManagement.toasts.errorLoadingDogs'))
    }
  }

  const createClient = async (e) => {
    e.preventDefault()
    
    if (!clientForm.nombre_completo.trim() || !clientForm.email.trim()) {
      toast.error(t('clientsManagement.toasts.nameEmailRequired'))
      return
    }

    try {
      setUpdating(true)
      
      const tempId = crypto.randomUUID()
      
      const profileData = {
        id: tempId,
        nombre_completo: clientForm.nombre_completo.trim(),
        email: clientForm.email.trim(),
        telefono: clientForm.telefono.trim(),
        pais_codigo: clientForm.pais_codigo,
        email_notifications: clientForm.email_notifications,
        role: 'cliente',
        created_by_admin: true,
        account_status: 'pending_registration'
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)

      if (profileError) throw profileError

      toast.success(t('clientsManagement.toasts.clientCreated'))
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
        toast.error(t('clientsManagement.toasts.emailExists'))
      } else {
        toast.error(t('clientsManagement.toasts.errorCreatingClient') + ': ' + error.message)
      }
    } finally {
      setUpdating(false)
    }
  }

  const updateClient = async (e) => {
    e.preventDefault()
    
    if (!clientForm.nombre_completo.trim() || !clientForm.email.trim()) {
      toast.error(t('clientsManagement.toasts.nameEmailRequired'))
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

      toast.success(t('clientsManagement.toasts.clientUpdated'))
      setShowEditModal(false)
      setSelectedClient(null)
      await loadClients()
    } catch (error) {
      console.error('Error updating client:', error)
      toast.error(t('clientsManagement.toasts.errorUpdatingClient'))
    } finally {
      setUpdating(false)
    }
  }

  const createDog = async (e) => {
    e.preventDefault()
    
    if (!dogForm.nombre.trim()) {
      toast.error(t('clientsManagement.toasts.dogNameRequired'))
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

      toast.success(t('clientsManagement.toasts.dogAdded'))
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
      toast.error(t('clientsManagement.toasts.errorAddingDog'))
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

    const statusText = {
      pendiente: t('bookingsManagement.status.pending'),
      confirmada: 'Confirmada',
      completada: t('bookingsManagement.status.completed'),
      cancelada: t('bookingsManagement.status.cancelled')
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[estado] || 'bg-gray-100 text-gray-800'}`}>
        {statusText[estado] || estado}
      </span>
    )
  }

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
          title={t('common.edit')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
      
      <div className="text-xs text-gray-400">
        {t('clientsManagement.registered')}: {format(parseISO(client.created_at), 'dd/MM/yyyy', { locale: getDateLocale() })}
      </div>
    </div>
  )

  const filteredClients = getFilteredClients()

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">{t('clientsManagement.loadingClients')}</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t('clientsManagement.title')}</h2>
            <p className="text-sm sm:text-base text-gray-600">{t('clientsManagement.subtitle')}</p>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs sm:text-sm text-blue-800">
              {t('clientsManagement.registrationNote')}
            </p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('clientsManagement.searchPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="text-sm text-gray-600 text-center sm:text-left">
              {filteredClients.length} {filteredClients.length === 1 ? t('clientsManagement.client') : t('clientsManagement.clients')}
            </div>
            
            <div className="lg:hidden flex bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setViewMode('mobile')}
                className={`flex-1 px-3 py-1 text-xs rounded ${viewMode === 'mobile' ? 'bg-white shadow' : ''}`}
              >
                {t('clientsManagement.listView')}
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'mobile' ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('clientsManagement.clients')}</h3>
              {filteredClients.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border text-center py-8">
                  <div className="text-gray-400 text-4xl mb-2">👥</div>
                  <h4 className="text-lg font-medium text-gray-900">{t('clientsManagement.noClientsFound')}</h4>
                  <p className="text-gray-600">{t('clientsManagement.adjustSearch')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredClients.map(renderClientCard)}
                </div>
              )}
            </div>

            {selectedClient && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">{t('clientsManagement.clientInfo.title')}</h3>
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
                      <label className="text-sm font-medium text-gray-500">{t('clientsManagement.clientInfo.name')}</label>
                      <p className="text-gray-900">{selectedClient.nombre_completo}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('clientsManagement.clientInfo.email')}</label>
                      <p className="text-gray-900 text-sm break-all">{selectedClient.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('clientsManagement.clientInfo.phone')}</label>
                      <p className="text-gray-900">
                        {selectedClient.telefono ? `${selectedClient.pais_codigo} ${selectedClient.telefono}` : t('clientsManagement.clientInfo.notSpecified')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('clientsManagement.clientInfo.notifications')}</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs ${selectedClient.email_notifications ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          Email: {selectedClient.email_notifications ? t('clientsManagement.clientInfo.yes') : t('clientsManagement.clientInfo.no')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">{t('clientsManagement.dogs.title')} ({clientDogs.length})</h3>
                      <button
                        onClick={() => setShowAddDogModal(true)}
                        className="text-primary-600 hover:text-primary-800 flex items-center text-sm"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        {t('clientsManagement.dogs.add')}
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {clientDogs.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-gray-600 text-sm">{t('clientsManagement.dogs.noDogs')}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientDogs.map((dog) => (
                          <div key={dog.id} className="p-3 bg-gray-50 rounded border">
                            <h4 className="font-medium text-gray-900">
                              {dog.nombre}
                              {!dog.activo && <span className="text-red-500 text-sm ml-2">({t('clientsManagement.dogs.inactive')})</span>}
                            </h4>
                            {dog.raza && <p className="text-sm text-gray-600">{t('clientsManagement.dogs.breed')}: {dog.raza}</p>}
                            <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600">
                              {dog.edad && <span>{t('clientsManagement.dogs.age')}: {dog.edad} {t('clientsManagement.dogs.years')}</span>}
                              {dog.peso && <span>{t('clientsManagement.dogs.weight')}: {dog.peso} {t('clientsManagement.dogs.kg')}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-semibold text-gray-900">{t('clientsManagement.bookingHistory.title')} ({clientBookings.length})</h3>
                  </div>
                  
                  <div className="p-4">
                    {clientBookings.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-gray-600 text-sm">{t('clientsManagement.bookingHistory.noBookings')}</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {clientBookings.map((booking) => (
                          <div key={booking.id} className="p-3 border rounded">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 text-sm">{booking.services?.nombre}</h4>
                                <p className="text-sm text-gray-600">
                                  {t('clientsManagement.bookingHistory.dog')}: {booking.dogs?.nombre}
                                  {booking.dogs?.raza && ` (${booking.dogs.raza})`}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {format(parseISO(booking.fecha_hora), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() })} 
                                  ({booking.duracion_minutos} {t('clientsManagement.bookingHistory.minutes')})
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">{t('clientsManagement.clients')}</h3>
              </div>
              
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-4xl mb-2">👥</div>
                    <h4 className="text-lg font-medium text-gray-900">{t('clientsManagement.noClientsFound')}</h4>
                    <p className="text-gray-600">{t('clientsManagement.adjustSearch')}</p>
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
                            {t('clientsManagement.registered')}: {format(parseISO(client.created_at), 'dd/MM/yyyy', { locale: getDateLocale() })}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(client)
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title={t('common.edit')}
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

            <div className="space-y-6">
              {selectedClient ? (
                <>
                  <div className="bg-white rounded-lg shadow-sm border">
                    <div className="px-6 py-4 border-b">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">{t('clientsManagement.clientInfo.title')}</h3>
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
                        <label className="text-sm font-medium text-gray-500">{t('clientsManagement.clientInfo.name')}</label>
                        <p className="text-gray-900">{selectedClient.nombre_completo}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">{t('clientsManagement.clientInfo.email')}</label>
                        <p className="text-gray-900">{selectedClient.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">{t('clientsManagement.clientInfo.phone')}</label>
                        <p className="text-gray-900">
                          {selectedClient.telefono ? `${selectedClient.pais_codigo} ${selectedClient.telefono}` : t('clientsManagement.clientInfo.notSpecified')}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">{t('clientsManagement.clientInfo.notifications')}</label>
                        <div className="flex space-x-4 mt-1">
                          <span className={`px-2 py-1 rounded text-xs ${selectedClient.email_notifications ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            Email: {selectedClient.email_notifications ? t('clientsManagement.clientInfo.yes') : t('clientsManagement.clientInfo.no')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border">
                    <div className="px-6 py-4 border-b">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">{t('clientsManagement.dogs.title')} ({clientDogs.length})</h3>
                        <button
                          onClick={() => setShowAddDogModal(true)}
                          className="text-primary-600 hover:text-primary-800 flex items-center text-sm"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          {t('clientsManagement.dogs.addDog')}
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      {clientDogs.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-gray-600">{t('clientsManagement.dogs.noDogs')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {clientDogs.map((dog) => (
                            <div key={dog.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {dog.nombre}
                                  {!dog.activo && <span className="text-red-500 text-sm ml-2">({t('clientsManagement.dogs.inactive')})</span>}
                                </h4>
                                {dog.raza && <p className="text-sm text-gray-600">{t('clientsManagement.dogs.breed')}: {dog.raza}</p>}
                                {dog.edad && <p className="text-sm text-gray-600">{t('clientsManagement.dogs.age')}: {dog.edad} {t('clientsManagement.dogs.years')}</p>}
                                {dog.peso && <p className="text-sm text-gray-600">{t('clientsManagement.dogs.weight')}: {dog.peso} {t('clientsManagement.dogs.kg')}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border">
                    <div className="px-6 py-4 border-b">
                      <h3 className="text-lg font-semibold">{t('clientsManagement.bookingHistory.title')} ({clientBookings.length})</h3>
                    </div>
                    
                    <div className="p-6">
                      {clientBookings.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-gray-600">{t('clientsManagement.bookingHistory.noBookings')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {clientBookings.map((booking) => (
                            <div key={booking.id} className="p-3 border rounded">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-gray-900">{booking.services?.nombre}</h4>
                                  <p className="text-sm text-gray-600">
                                    {t('clientsManagement.bookingHistory.dog')}: {booking.dogs?.nombre}
                                    {booking.dogs?.raza && ` (${booking.dogs.raza})`}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {format(parseISO(booking.fecha_hora), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() })} 
                                    ({booking.duracion_minutos} {t('clientsManagement.bookingHistory.minutes')})
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
                  <h3 className="text-lg font-medium text-gray-900">{t('clientsManagement.selectClient')}</h3>
                  <p className="text-gray-600">{t('clientsManagement.selectClientMessage')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold">{t('clientsManagement.editModal.title')}</h3>
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
                    {t('clientsManagement.editModal.fullName')} *
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
                    {t('clientsManagement.editModal.email')} *
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
                      {t('clientsManagement.editModal.country')}
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
                      {t('clientsManagement.editModal.phone')}
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
                    {t('clientsManagement.editModal.notificationPreferences')}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={clientForm.email_notifications}
                        onChange={(e) => setClientForm({...clientForm, email_notifications: e.target.checked})}
                        className="mr-2"
                      />
                      <span className="text-sm">{t('clientsManagement.editModal.emailNotifications')}</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    {t('clientsManagement.editModal.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {updating ? t('clientsManagement.editModal.updating') : t('clientsManagement.editModal.update')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAddDogModal && selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold">{t('clientsManagement.addDogModal.title', { name: selectedClient.nombre_completo })}</h3>
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
                    {t('clientsManagement.addDogModal.dogName')} *
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
                    {t('clientsManagement.addDogModal.breed')}
                  </label>
                  <input
                    type="text"
                    value={dogForm.raza}
                    onChange={(e) => setDogForm({...dogForm, raza: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder={t('clientsManagement.addDogModal.breedPlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('clientsManagement.addDogModal.age')}
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
                      {t('clientsManagement.addDogModal.weight')}
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
                    {t('clientsManagement.addDogModal.observations')}
                  </label>
                  <textarea
                    value={dogForm.observaciones}
                    onChange={(e) => setDogForm({...dogForm, observaciones: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder={t('clientsManagement.addDogModal.observationsPlaceholder')}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddDogModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    {t('clientsManagement.addDogModal.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {updating ? t('clientsManagement.addDogModal.adding') : t('clientsManagement.addDogModal.addDog')}
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