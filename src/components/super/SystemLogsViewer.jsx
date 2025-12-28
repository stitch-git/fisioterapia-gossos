import React, { useState, useEffect } from 'react'
import { useSystemLogs } from '../../hooks/useSystemLogs'
import { useUserErrors } from '../../hooks/useErrorTracking' // ✅ NUEVO
import { format } from 'date-fns'
import { es, ca } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

export default function SystemLogsViewer() {
  const { t, i18n } = useTranslation()
  
  // ✅ Logs técnicos del sistema
  const { logs, loading, totalCount, loadLogs, deleteLog, clearAllLogs } = useSystemLogs()
  
  // ✅ NUEVO: Errores de usuarios
  const { 
    errors: userErrors, 
    loading: userErrorsLoading,
    totalCount: userErrorsCount,
    loadErrors: loadUserErrors,
    updateErrorStatus,
    deleteError: deleteUserError
  } = useUserErrors()
  
  const [selectedLog, setSelectedLog] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [logToDelete, setLogToDelete] = useState(null)

  // ✅ NUEVO: Estados para errores de usuarios
  const [activeTab, setActiveTab] = useState('user_errors')
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedError, setSelectedError] = useState(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewStatus, setReviewStatus] = useState('valid')

  const [filters, setFilters] = useState({
    search: '',
    errorType: '',
    component: '',
    errorCode: '',
    userEmail: '',
    startDate: '',
    endDate: ''
  })

  // ✅ NUEVO: Filtros para errores de usuarios
  const [userErrorFilters, setUserErrorFilters] = useState({
    search: '',
    status: '',
    userEmail: '',
    userRole: '',
    startDate: '',
    endDate: ''
  })

  const getDateLocale = () => i18n.language === 'ca' ? ca : es

  // ✅ Cargar logs técnicos
  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // ✅ NUEVO: Cargar errores de usuarios
  useEffect(() => {
    loadUserErrors(userErrorFilters)  // ← Con filtros
  }, [loadUserErrors, userErrorFilters])

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    loadLogs(newFilters)
  }

  // ✅ NUEVO: Manejar filtros de errores de usuarios
  const handleUserErrorFilterChange = (key, value) => {
    const newFilters = { ...userErrorFilters, [key]: value }
    setUserErrorFilters(newFilters)
    loadUserErrors(newFilters)
  }

  const handleClearFilters = () => {
    const emptyFilters = {
      search: '',
      errorType: '',
      component: '',
      errorCode: '',
      userEmail: '',
      startDate: '',
      endDate: ''
    }
    setFilters(emptyFilters)
    loadLogs(emptyFilters)
  }

  // ✅ NUEVO: Limpiar filtros de errores de usuarios
  const handleClearUserErrorFilters = () => {
    const emptyFilters = {
      search: '',
      status: '',
      userEmail: '',
      userRole: '',
      startDate: '',
      endDate: ''
    }
    setUserErrorFilters(emptyFilters)
    loadUserErrors(emptyFilters)
  }

  const openDetailsModal = (log) => {
    setSelectedLog(log)
    setShowDetailsModal(true)
  }

  const openDeleteModal = (log) => {
    setLogToDelete(log)
    setShowDeleteModal(true)
  }

  const handleDeleteLog = async () => {
    if (!logToDelete) return
    await deleteLog(logToDelete.id)
    setShowDeleteModal(false)
    setLogToDelete(null)
    // ✅ NUEVO: Recargar con filtros actuales
    loadLogs(filters)
  }

  const handleClearAll = async () => {
    await clearAllLogs()
    setShowClearModal(false)
    // ✅ NUEVO: Recargar con filtros actuales
    loadLogs(filters)
  }

  // ✅ NUEVO: Abrir modal de revisión de error
  const openReviewModal = (error) => {
    setSelectedError(error)
    setReviewNotes(error.review_notes || '')
    setReviewStatus(error.status === 'pending' ? 'valid' : error.status)
    setReviewModalOpen(true)
  }

  // ✅ NUEVO: Guardar revisión
  const handleSaveReview = async () => {
    if (!selectedError) return

    const result = await updateErrorStatus(selectedError.id, reviewStatus, reviewNotes)
    
    if (result.success) {
      toast.success('Error actualizado correctamente')
      loadUserErrors(userErrorFilters)
      setReviewModalOpen(false)
      setSelectedError(null)
      setReviewNotes('')
    } else {
      toast.error('Error actualizando estado')
    }
  }

  // ✅ NUEVO: Eliminar error de usuario
  const handleDeleteUserError = async (errorId) => {
    const result = await deleteUserError(errorId)
    
    if (result.success) {
      toast.success('Error eliminado correctamente')
      loadUserErrors(userErrorFilters)
    } else {
      // 🔄 MODIFICADO: Mostrar error detallado
      const errorMsg = result.error || 'Error eliminando registro'
      toast.error(`❌ ${errorMsg}`)
      console.error('Error completo:', result)
    }
  }

  const getErrorTypeColor = (errorType) => {
    const colors = {
      'DATABASE_ERROR': 'bg-red-100 text-red-800',
      'DOG_SAVE_ERROR': 'bg-orange-100 text-orange-800',
      'IMAGE_VALIDATION_ERROR': 'bg-yellow-100 text-yellow-800',
      'IMAGE_UPLOAD_ERROR': 'bg-purple-100 text-purple-800',
      'BOOKING_ERROR': 'bg-pink-100 text-pink-800',
      'AUTH_ERROR': 'bg-blue-100 text-blue-800',
    }
    return colors[errorType] || 'bg-gray-100 text-gray-800'
  }

  const exportToJSON = () => {
    const dataStr = JSON.stringify(logs, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `system-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`
    link.click()
  }

  const exportToCSV = () => {
    const headers = ['ID', 'Fecha', 'Usuario', 'Tipo', 'Código', 'Mensaje', 'Componente']
    const rows = logs.map(log => [
      log.id,
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user_email || 'N/A',
      log.error_type,
      log.error_code || 'N/A',
      log.error_message,
      log.component
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `system-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`
    link.click()
  }

  if (loading && logs.length === 0 && userErrorsLoading && userErrors.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">Cargando logs del sistema...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ✅ NUEVO: Pestañas */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('user_errors')}
            className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'user_errors'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🚨 Errores de Usuarios ({userErrorsCount})
          </button>
          <button
            onClick={() => setActiveTab('system_logs')}
            className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'system_logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ⚙️ Logs Técnicos ({totalCount})
          </button>
        </nav>
      </div>

      {/* ✅ NUEVO: Contenido según pestaña */}
      {activeTab === 'user_errors' ? (
        <>
          {/* Header Errores de Usuarios */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">🚨 Errores de Usuarios</h2>
              <p className="text-gray-600">
                Total de errores capturados: <span className="font-semibold">{userErrorsCount}</span>
              </p>
            </div>
          </div>

          {/* Filtros Errores de Usuarios */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Búsqueda</label>
                <input
                  type="text"
                  value={userErrorFilters.search}
                  onChange={(e) => handleUserErrorFilterChange('search', e.target.value)}
                  placeholder="Buscar en mensaje..."
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Usuario</label>
                <input
                  type="text"
                  value={userErrorFilters.userEmail}
                  onChange={(e) => handleUserErrorFilterChange('userEmail', e.target.value)}
                  placeholder="usuario@email.com"
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={userErrorFilters.status}
                  onChange={(e) => handleUserErrorFilterChange('status', e.target.value)}
                  className="input text-sm"
                >
                  <option value="">Todos</option>
                  <option value="pending">Pendiente</option>
                  <option value="valid">Error Válido</option>
                  <option value="needs_review">Necesita Revisión</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={userErrorFilters.userRole}
                  onChange={(e) => handleUserErrorFilterChange('userRole', e.target.value)}
                  className="input text-sm"
                >
                  <option value="">Todos</option>
                  <option value="cliente">Cliente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
                <input
                  type="datetime-local"
                  value={userErrorFilters.startDate}
                  onChange={(e) => handleUserErrorFilterChange('startDate', e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
                <input
                  type="datetime-local"
                  value={userErrorFilters.endDate}
                  onChange={(e) => handleUserErrorFilterChange('endDate', e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div className="flex items-end col-span-2">
                <button
                  onClick={handleClearUserErrorFilters}
                  className="w-full btn btn-secondary btn-sm"
                >
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Tabla Errores de Usuarios */}
          <UserErrorsTable 
            errors={userErrors}
            loading={userErrorsLoading}
            onReview={openReviewModal}
            onDelete={handleDeleteUserError}
            getDateLocale={getDateLocale}
          />
        </>
      ) : (
        <>
          {/* Header Logs Técnicos */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">⚙️ Logs Técnicos del Sistema</h2>
              <p className="text-gray-600">
                Total de registros: <span className="font-semibold">{totalCount}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportToJSON}
                className="btn btn-secondary btn-sm"
                disabled={logs.length === 0}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                JSON
              </button>
              <button
                onClick={exportToCSV}
                className="btn btn-secondary btn-sm"
                disabled={logs.length === 0}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
              <button
                onClick={() => setShowClearModal(true)}
                className="btn btn-danger btn-sm"
                disabled={logs.length === 0}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Limpiar Todo
              </button>
            </div>
          </div>

          {/* Filtros Logs Técnicos */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Búsqueda General</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Buscar en mensaje, componente..."
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Usuario</label>
                <input
                  type="text"
                  value={filters.userEmail}
                  onChange={(e) => handleFilterChange('userEmail', e.target.value)}
                  placeholder="usuario@email.com"
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Error</label>
                <input
                  type="text"
                  value={filters.errorType}
                  onChange={(e) => handleFilterChange('errorType', e.target.value)}
                  placeholder="DATABASE_ERROR, DOG_SAVE_ERROR..."
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Componente</label>
                <input
                  type="text"
                  value={filters.component}
                  onChange={(e) => handleFilterChange('component', e.target.value)}
                  placeholder="MyDogs, BookingsManagement..."
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código Error</label>
                <input
                  type="text"
                  value={filters.errorCode}
                  onChange={(e) => handleFilterChange('errorCode', e.target.value)}
                  placeholder="23505, 23502..."
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
                <input
                  type="datetime-local"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
                <input
                  type="datetime-local"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="w-full btn btn-secondary btn-sm"
                >
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de logs técnicos */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-4xl mb-2">📝</div>
                <h4 className="text-lg font-medium text-gray-900">No hay logs disponibles</h4>
                <p className="text-gray-600">Los errores del sistema aparecerán aquí</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mensaje</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Componente</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          #{log.id}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: getDateLocale() })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="text-gray-900 font-medium">{log.user_email || 'N/A'}</div>
                          <div className="text-gray-500 text-xs">{log.user_id?.substring(0, 8) || 'Sin ID'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getErrorTypeColor(log.error_type)}`}>
                            {log.error_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                          {log.error_code || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                          {log.error_message}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {log.component}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openDetailsModal(log)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            title="Ver detalles"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteModal(log)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal de Detalles Log Técnico */}
          {showDetailsModal && selectedLog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Detalles del Log #{selectedLog.id}</h3>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Fecha y Hora</label>
                      <p className="text-sm text-gray-900 mt-1">
                        {format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: getDateLocale() })}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Usuario</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedLog.user_email || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Tipo de Error</label>
                      <p className="mt-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getErrorTypeColor(selectedLog.error_type)}`}>
                          {selectedLog.error_type}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Código</label>
                      <p className="text-sm font-mono text-gray-900 mt-1">{selectedLog.error_code || 'N/A'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Componente</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedLog.component}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Mensaje de Error</label>
                    <p className="text-sm text-gray-900 mt-1 bg-red-50 p-3 rounded border border-red-200">
                      {selectedLog.error_message}
                    </p>
                  </div>

                  {selectedLog.stack_trace && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Stack Trace</label>
                      <pre className="text-xs text-gray-900 mt-1 bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
                        {selectedLog.stack_trace}
                      </pre>
                    </div>
                  )}

                  {selectedLog.additional_data && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Datos Adicionales</label>
                      <pre className="text-xs text-gray-900 mt-1 bg-blue-50 p-3 rounded border border-blue-200 overflow-x-auto">
                        {JSON.stringify(selectedLog.additional_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">User Agent</label>
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                      {selectedLog.user_agent || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Confirmar Eliminar */}
          <ConfirmModal
            isOpen={showDeleteModal}
            onClose={() => {
              setShowDeleteModal(false)
              setLogToDelete(null)
            }}
            onConfirm={handleDeleteLog}
            title="Eliminar Log"
            message={`¿Estás seguro de que quieres eliminar el log #${logToDelete?.id}?`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            confirmButtonClass="bg-red-600 hover:bg-red-700"
          />

          {/* Modal Confirmar Limpiar Todo */}
          <ConfirmModal
            isOpen={showClearModal}
            onClose={() => setShowClearModal(false)}
            onConfirm={handleClearAll}
            title="⚠️ Limpiar Todos los Logs"
            message="¿Estás seguro de que quieres eliminar TODOS los logs del sistema? Esta acción NO se puede deshacer."
            confirmText="Sí, eliminar todo"
            cancelText="Cancelar"
            confirmButtonClass="bg-red-600 hover:bg-red-700"
          />
        </>
      )}

      {/* ✅ NUEVO: Modal de revisión de error */}
      {reviewModalOpen && selectedError && (
        <ReviewModal
          error={selectedError}
          notes={reviewNotes}
          status={reviewStatus}
          onNotesChange={setReviewNotes}
          onStatusChange={setReviewStatus}
          onSave={handleSaveReview}
          onClose={() => {
            setReviewModalOpen(false)
            setSelectedError(null)
            setReviewNotes('')
          }}
          getDateLocale={getDateLocale}
        />
      )}
    </div>
  )
}

// ✅ NUEVO: Componente tabla de errores de usuarios
function UserErrorsTable({ errors, loading, onReview, onDelete, getDateLocale }) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">Cargando errores...</span>
      </div>
    )
  }

  if (errors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
        <div className="text-gray-400 text-4xl mb-2">✅</div>
        <h4 className="text-lg font-medium text-gray-900">No hay errores registrados</h4>
        <p className="text-gray-600 mt-1">Los errores que vean los usuarios aparecerán aquí automáticamente</p>
      </div>
    )
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Pendiente' },
      valid: { bg: 'bg-green-100', text: 'text-green-800', label: '✅ Error válido' },
      needs_review: { bg: 'bg-orange-100', text: 'text-orange-800', label: '🔍 Revisar' }
    }
    const badge = badges[status] || badges.pending
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Página</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {errors.map((error) => (
              <tr key={error.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{error.user_email}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 text-xs rounded font-medium ${
                    error.user_role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {error.user_role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                  {error.error_message}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {error.error_context?.page || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {format(new Date(error.created_at), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {getStatusBadge(error.status)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">
                  <button
                    onClick={() => onReview(error)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    title="Revisar"
                  >
                    📝
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('¿Eliminar este error?')) {
                        onDelete(error.id)
                      }
                    }}
                    className="text-red-600 hover:text-red-900"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ✅ NUEVO: Modal para revisar error
function ReviewModal({ error, notes, status, onNotesChange, onStatusChange, onSave, onClose, getDateLocale }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Revisar Error de Usuario</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Usuario</label>
              <p className="text-sm text-gray-900 mt-1">{error.user_email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Rol</label>
              <p className="text-sm text-gray-900 mt-1">
                <span className={`px-2 py-1 text-xs rounded font-medium ${
                  error.user_role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {error.user_role}
                </span>
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Fecha</label>
            <p className="text-sm text-gray-900 mt-1">
              {format(new Date(error.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: getDateLocale() })}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Mensaje de Error</label>
            <p className="text-sm text-gray-900 mt-1 bg-red-50 p-3 rounded border border-red-200">
              {error.error_message}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Contexto</label>
            <pre className="text-xs text-gray-900 mt-1 bg-gray-50 p-3 rounded border overflow-x-auto max-h-40">
              {JSON.stringify(error.error_context, null, 2)}
            </pre>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Estado del Error</label>
            <div className="flex gap-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="valid"
                  checked={status === 'valid'}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">✅ Error Válido</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="needs_review"
                  checked={status === 'needs_review'}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">🔍 Necesita Revisión</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Notas de Revisión</label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={4}
              className="mt-1 w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Agrega notas sobre este error: por qué es válido, qué debe mejorarse, etc."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 btn btn-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              className="flex-1 btn btn-primary"
            >
              Guardar Revisión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}