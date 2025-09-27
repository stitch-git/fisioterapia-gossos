import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

export default function MyDogs() {
  const { user } = useAuth()
  const [dogs, setDogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDog, setEditingDog] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    raza: '',
    edad: '',
    peso: '',
    patologias: '',
    observaciones: ''
  })

  // Estados para imagen
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Estados para el modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [dogToDelete, setDogToDelete] = useState(null)

  useEffect(() => {
    loadDogs()
  }, [])

  const loadDogs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('owner_id', user.id)
        .eq('activo', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDogs(data)
    } catch (error) {
      console.error('Error loading dogs:', error)
      toast.error('Error cargando perros')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nombre: '',
      raza: '',
      edad: '',
      peso: '',
      patologias: '',
      observaciones: ''
    })
    setEditingDog(null)
    setShowForm(false)
    setSelectedImage(null)
    setImagePreview(null)
  }

  const handleEdit = (dog) => {
    setFormData({
      nombre: dog.nombre || '',
      raza: dog.raza || '',
      edad: dog.edad || '',
      peso: dog.peso || '',
      patologias: dog.patologias || '',
      observaciones: dog.observaciones || ''
    })
    setEditingDog(dog)
    setShowForm(true)
    // Mostrar imagen actual si existe
    if (dog.imagen_url) {
      setImagePreview(dog.imagen_url)
    }
  }

  // Función para manejar la selección de imagen
  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida')
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 5MB')
      return
    }

    setSelectedImage(file)
    
    // Crear preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Función para subir imagen a Supabase Storage
  const uploadImage = async (file, dogId) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${dogId}/${Date.now()}.${fileExt}`
      const filePath = `dog-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('dog-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('dog-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      throw error
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.nombre.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    try {
      setUploadingImage(true)
      
      const dogData = {
        nombre: formData.nombre.trim(),
        raza: formData.raza.trim() || null,
        edad: formData.edad ? parseInt(formData.edad) : null,
        peso: formData.peso ? parseFloat(formData.peso) : null,
        patologias: formData.patologias.trim() || null,
        observaciones: formData.observaciones.trim() || null
      }

      let dogId
      let imageUrl = null

      if (editingDog) {
        // Update existing dog
        dogId = editingDog.id

        // Subir nueva imagen si se seleccionó una
        if (selectedImage) {
          // Eliminar imagen anterior si existe
          if (editingDog.imagen_url) {
            const oldPath = editingDog.imagen_url.split('/').slice(-3).join('/')
            await supabase.storage
              .from('dog-images')
              .remove([oldPath])
          }
          
          imageUrl = await uploadImage(selectedImage, dogId)
          dogData.imagen_url = imageUrl
        }

        const { error } = await supabase
          .from('dogs')
          .update(dogData)
          .eq('id', dogId)
          .eq('owner_id', user.id)

        if (error) throw error
        toast.success('Perro actualizado correctamente')
      } else {
        // Create new dog first to get ID
        const { data: newDog, error: insertError } = await supabase
          .from('dogs')
          .insert({
            ...dogData,
            owner_id: user.id
          })
          .select()
          .single()

        if (insertError) throw insertError
        
        dogId = newDog.id

        // Subir imagen si se seleccionó una
        if (selectedImage) {
          imageUrl = await uploadImage(selectedImage, dogId)
          
          // Actualizar el registro con la URL de la imagen
          const { error: updateError } = await supabase
            .from('dogs')
            .update({ imagen_url: imageUrl })
            .eq('id', dogId)

          if (updateError) throw updateError
        }

        toast.success('Perro registrado correctamente')
      }

      resetForm()
      loadDogs()
    } catch (error) {
      console.error('Error saving dog:', error)
      toast.error('Error guardando perro')
    } finally {
      setUploadingImage(false)
    }
  }

  // Función para abrir el modal de confirmación
  const openDeleteModal = (dog) => {
    setDogToDelete(dog)
    setShowDeleteModal(true)
  }

  // Función para eliminar perro
  const handleDelete = async () => {
    if (!dogToDelete) return

    try {
      // Eliminar imagen si existe
      if (dogToDelete.imagen_url) {
        const imagePath = dogToDelete.imagen_url.split('/').slice(-3).join('/')
        await supabase.storage
          .from('dog-images')
          .remove([imagePath])
      }

      const { error } = await supabase
        .from('dogs')
        .update({ activo: false })
        .eq('id', dogToDelete.id)
        .eq('owner_id', user.id)

      if (error) throw error
      
      toast.success(`${dogToDelete.nombre} eliminado correctamente`)
      loadDogs()
    } catch (error) {
      console.error('Error deleting dog:', error)
      toast.error('Error eliminando perro')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner mr-3"></div>
        <span className="text-gray-600">Cargando tus perros...</span>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Mis Perros 🐶</h2>
            <p className="text-gray-600">Gestiona la información de tus perros</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto btn btn-primary justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="sm:hidden">Añadir Nuevo Perro</span>
            <span className="hidden sm:inline">Añadir Perro</span>
          </button>
        </div>

        {/* Add/Edit Form - OPTIMIZADO RESPONSIVE */}
        {showForm && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">
                {editingDog ? `Editar ${editingDog.nombre}` : 'Añadir Nuevo Perro'}
              </h3>
            </div>
            <div className="card-body p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sección de imagen - OPTIMIZADA RESPONSIVE */}
                <div className="border-b border-gray-200 pb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Foto de Perfil
                  </label>
                  
                  {/* Layout responsive para imagen */}
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
                    {/* Preview de imagen - centrado en móvil */}
                    <div className="mx-auto sm:mx-0 h-24 w-24 sm:h-20 sm:w-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                      {imagePreview ? (
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Controles de imagen */}
                    <div className="flex-1 space-y-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      />
                      <p className="text-xs text-gray-500">
                        PNG, JPG, GIF hasta 5MB
                      </p>
                      
                      {/* Botón quitar imagen - full width en móvil */}
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null)
                            setImagePreview(null)
                          }}
                          className="w-full sm:w-auto text-center sm:text-left text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Quitar imagen
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Campos básicos - GRID RESPONSIVE OPTIMIZADO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      className="input"
                      placeholder="Nombre del perro"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Raza *
                    </label>
                    <input
                      type="text"
                      name="raza"
                      value={formData.raza}
                      onChange={handleChange}
                      className="input"
                      placeholder="Ej: Golden Retriever"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Edad (años) *
                    </label>
                    <input
                      type="number"
                      name="edad"
                      value={formData.edad}
                      onChange={handleChange}
                      className="input"
                      min="0"
                      max="25"
                      placeholder="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Peso (kg) *
                    </label>
                    <input
                      type="number"
                      name="peso"
                      value={formData.peso}
                      onChange={handleChange}
                      className="input"
                      min="0"
                      step="0.1"
                      placeholder="0.0"
                      required
                    />
                  </div>
                </div>
                
                {/* Textareas - OPTIMIZADAS */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Patologías *
                    </label>
                    <textarea
                      name="patologias"
                      value={formData.patologias}
                      onChange={handleChange}
                      rows={3}
                      className="input resize-none"
                      placeholder="Displasia de cadera, artritis, problemas cardíacos, etc."
                      required
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Especifica enfermedades o condiciones médicas diagnosticadas, en caso contrario, indica "No tiene"
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observaciones Generales
                    </label>
                    <textarea
                      name="observaciones"
                      value={formData.observaciones}
                      onChange={handleChange}
                      rows={3}
                      className="input resize-none"
                      placeholder="Comportamiento, alergias, medicamentos, cuidados especiales, etc."
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Información adicional relevante para el tratamiento
                    </p>
                  </div>
                </div>

                {/* Botones - RESPONSIVE */}
                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full sm:w-auto btn btn-secondary order-2 sm:order-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingImage}
                    className="w-full sm:w-auto btn btn-primary order-1 sm:order-2"
                  >
                    {uploadingImage ? (
                      <>
                        <div className="loading-spinner mr-2"></div>
                        {selectedImage ? 'Subiendo...' : 'Guardando...'}
                      </>
                    ) : (
                      `${editingDog ? 'Actualizar' : 'Guardar'} Perro`
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dogs List - OPTIMIZADA */}
        {dogs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay perros registrados</h3>
            <p className="mt-1 text-sm text-gray-500">
              Añade información sobre tus mascotas para poder hacer reservas.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 btn btn-primary"
            >
              Añadir Primer Perro
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {dogs.map((dog) => (
              <div key={dog.id} className="card hover:shadow-lg transition-shadow duration-200">
                <div className="card-body p-4 sm:p-6">
                  {/* Layout responsive para cada perro */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
                    {/* Información principal */}
                    <div className="flex items-start space-x-4">
                      {/* Imagen del perro */}
                      <div className="h-16 w-16 sm:h-16 sm:w-16 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center flex-shrink-0">
                        {dog.imagen_url ? (
                          <img 
                            src={dog.imagen_url} 
                            alt={dog.nombre}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        )}
                      </div>
                      
                      {/* Información del perro */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                          {dog.nombre}
                        </h3>
                        
                        {/* Grid responsive para datos básicos */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm text-gray-600 mb-4">
                          {dog.raza && (
                            <div className="flex flex-col sm:flex-row sm:items-center">
                              <span className="font-medium text-gray-700 mr-1">Raza:</span>
                              <span className="truncate">{dog.raza}</span>
                            </div>
                          )}
                          {dog.edad && (
                            <div className="flex flex-col sm:flex-row sm:items-center">
                              <span className="font-medium text-gray-700 mr-1">Edad:</span>
                              <span>{dog.edad} años</span>
                            </div>
                          )}
                          {dog.peso && (
                            <div className="flex flex-col sm:flex-row sm:items-center">
                              <span className="font-medium text-gray-700 mr-1">Peso:</span>
                              <span>{dog.peso} kg</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Patologías - responsive */}
                        {dog.patologias && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Patologías:</p>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                              {dog.patologias}
                            </div>
                          </div>
                        )}
                        
                        {/* Observaciones - responsive */}
                        {dog.observaciones && (
                          <div className="mb-2">
                            <p className="text-sm font-medium text-gray-700 mb-2">Observaciones generales:</p>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                              {dog.observaciones}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Botones de acción - RESPONSIVE */}
                    <div className="flex justify-center sm:justify-end space-x-2 sm:space-x-2 pt-2 sm:pt-0">
                      <button
                        onClick={() => handleEdit(dog)}
                        className="flex-1 sm:flex-none btn btn-secondary btn-sm px-3 sm:px-3"
                        title="Editar perro"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="ml-1 sm:hidden">Editar</span>
                      </button>
                      <button
                        onClick={() => openDeleteModal(dog)}
                        className="flex-1 sm:flex-none btn btn-danger btn-sm px-3 sm:px-3"
                        title="Eliminar perro"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="ml-1 sm:hidden">Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDogToDelete(null)
        }}
        onConfirm={handleDelete}
        title="Eliminar Perro"
        message={`¿Estás seguro que quieres eliminar a ${dogToDelete?.nombre}? Esta acción no se puede deshacer y se eliminarán todos los datos asociados.`}
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
    </>
  )
}