import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import { useTranslation } from 'react-i18next'
import logError from '../../utils/errorLogger' // 🚀 NUEVO

export default function MyDogs() {
  const { user } = useAuth()
  const { t } = useTranslation()
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

  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

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
      
      // 🚀 LOGGING
      await logError({
        errorType: 'DOG_LOAD_ERROR',
        errorMessage: error.message || 'Error al cargar la lista de perros',
        errorCode: error.code || 'LOAD_ERROR',
        component: 'MyDogs - loadDogs',
        stackTrace: error.stack,
        additionalData: {
          userId: user?.id,
          userEmail: user?.email
        }
      })
      
      toast.error(t('myDogs.toasts.loadError'))
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
    if (dog.imagen_url) {
      setImagePreview(dog.imagen_url)
    }
  }

  const handleImageSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // 🚀 Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      const errorMsg = t('myDogs.toasts.invalidImage')
      toast.error(errorMsg)
      
      // 🚀 LOGGING
      await logError({
        errorType: 'IMAGE_VALIDATION_ERROR',
        errorMessage: 'Archivo no es una imagen válida',
        errorCode: 'INVALID_FILE_TYPE',
        component: 'MyDogs - handleImageSelect',
        additionalData: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          userId: user?.id
        }
      })
      
      return
    }

    // 🚀 Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
      const errorMsg = t('myDogs.toasts.imageTooLarge')
      toast.error(errorMsg)
      
      // 🚀 LOGGING
      await logError({
        errorType: 'IMAGE_VALIDATION_ERROR',
        errorMessage: `Imagen demasiado grande: ${fileSizeMB}MB (máximo 5MB)`,
        errorCode: 'IMAGE_TOO_LARGE',
        component: 'MyDogs - handleImageSelect',
        additionalData: {
          fileName: file.name,
          fileType: file.type,
          fileSizeMB: fileSizeMB,
          maxSizeMB: 5,
          userId: user?.id
        }
      })
      
      return
    }

    // ✅ Imagen válida, continuar
    setSelectedImage(file)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target.result)
    }
    reader.onerror = async (error) => {
      console.error('Error leyendo archivo:', error)
      toast.error('Error al cargar la vista previa de la imagen')
      
      // 🚀 LOGGING
      await logError({
        errorType: 'IMAGE_READ_ERROR',
        errorMessage: 'Error al leer el archivo de imagen con FileReader',
        errorCode: 'FILE_READER_ERROR',
        component: 'MyDogs - handleImageSelect',
        stackTrace: error?.toString(),
        additionalData: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          userId: user?.id
        }
      })
    }
    reader.readAsDataURL(file)
  }

  const uploadImage = async (file, dogId) => {
    try {
      console.log('📸 Iniciando subida de imagen:', {
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        fileType: file.type,
        dogId: dogId
      })

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${dogId}/${Date.now()}.${fileExt}`
      const filePath = `dog-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('dog-images')
        .upload(filePath, file)

      if (uploadError) {
        console.error('❌ Error en storage upload:', uploadError)
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('dog-images')
        .getPublicUrl(filePath)

      console.log('✅ Imagen subida correctamente:', publicUrl)
      return publicUrl
      
    } catch (error) {
      console.error('❌ Error completo en uploadImage:', error)
      
      // 🚀 LOGGING
      await logError({
        errorType: 'IMAGE_UPLOAD_ERROR',
        errorMessage: error.message || 'Error subiendo imagen al storage',
        errorCode: error.code || 'STORAGE_ERROR',
        component: 'MyDogs - uploadImage',
        stackTrace: error.stack,
        additionalData: {
          fileName: file.name,
          fileType: file.type,
          fileSizeMB: (file.size / 1024 / 1024).toFixed(2),
          dogId: dogId,
          userId: user.id,
          storageDetails: error.statusCode ? {
            statusCode: error.statusCode,
            statusText: error.statusText
          } : null
        }
      })
      
      throw error
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // ✅ Validación básica
    if (!formData.nombre.trim()) {
      toast.error(t('myDogs.toasts.nameRequired'))
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

      console.log('📝 Datos del perro a guardar:', dogData)

      let dogId
      let imageUrl = null

      if (editingDog) {
        // ========== ACTUALIZAR PERRO EXISTENTE ==========
        dogId = editingDog.id

        if (selectedImage) {
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

        if (error) {
          console.error('❌ Error en UPDATE:', error)
          console.error('Código de error:', error.code)
          console.error('Mensaje:', error.message)
          console.error('Detalles:', error.details)
          console.error('Hint:', error.hint)
          throw error
        }
        
        console.log('✅ Perro actualizado correctamente')
        toast.success(t('myDogs.toasts.dogUpdated'))
        
      } else {
        // ========== CREAR NUEVO PERRO ==========
        console.log('🐕 Insertando nuevo perro...')
        
        const { data: newDog, error: insertError } = await supabase
          .from('dogs')
          .insert({
            ...dogData,
            owner_id: user.id
          })
          .select()
          .single()

        if (insertError) {
          console.error('❌ Error en INSERT:', insertError)
          console.error('Código de error:', insertError.code)
          console.error('Mensaje:', insertError.message)
          console.error('Detalles:', insertError.details)
          console.error('Hint:', insertError.hint)
          throw insertError
        }
        
        console.log('✅ Perro insertado correctamente:', newDog)
        dogId = newDog.id

        if (selectedImage) {
          console.log('📸 Subiendo imagen...')
          imageUrl = await uploadImage(selectedImage, dogId)
          
          const { error: updateError } = await supabase
            .from('dogs')
            .update({ imagen_url: imageUrl })
            .eq('id', dogId)

          if (updateError) {
            console.error('❌ Error actualizando imagen:', updateError)
            throw updateError
          }
          console.log('✅ Imagen actualizada correctamente')
        }

        toast.success(t('myDogs.toasts.dogCreated'))
      }

      resetForm()
      loadDogs()
      
    } catch (error) {
      // 🚀 LOGGING DETALLADO DEL ERROR
      console.error('❌ Error completo guardando perro:', error)
      console.error('Código:', error.code)
      console.error('Mensaje:', error.message)
      console.error('Detalles:', error.details)
      console.error('Stack:', error.stack)
      
      // 📊 Guardar en base de datos
      await logError({
        errorType: 'DOG_SAVE_ERROR',
        errorMessage: error.message || 'Error al guardar el perro',
        errorCode: error.code,
        component: 'MyDogs - handleSubmit',
        stackTrace: error.stack,
        additionalData: {
          dogData: {
            nombre: formData.nombre,
            raza: formData.raza,
            edad: formData.edad,
            peso: formData.peso,
            hasPatologias: !!formData.patologias,
            hasObservaciones: !!formData.observaciones
          },
          editingDog: editingDog?.id || null,
          hasImage: !!selectedImage,
          userId: user?.id,
          errorDetails: error.details,
          errorHint: error.hint
        }
      })

      // 💬 MENSAJE ESPECÍFICO AL USUARIO
      let userMessage = t('myDogs.toasts.saveError')
      
      if (error.code === '23505') {
        userMessage = 'Ya existe un perro con ese nombre'
      } else if (error.code === '23502') {
        userMessage = 'Falta completar información obligatoria. Verifica todos los campos.'
      } else if (error.code === '22001') {
        userMessage = 'Uno de los campos es demasiado largo'
      } else if (error.code === '23503') {
        userMessage = 'Error de referencia en la base de datos. Contacta con soporte.'
      } else if (error.code === 'PGRST116') {
        userMessage = 'No se pudo crear el registro. Verifica los datos.'
      } else if (error.message?.includes('permission')) {
        userMessage = 'No tienes permisos para realizar esta acción'
      } else if (error.message?.includes('storage')) {
        userMessage = 'Error subiendo la imagen. Intenta con otra imagen.'
      } else if (error.message?.includes('violates')) {
        userMessage = 'Los datos no cumplen con las restricciones. Verifica la información.'
      } else if (error.message) {
        userMessage = `Error: ${error.message}`
      }
      
      toast.error(userMessage, { 
        duration: 6000,
        style: {
          maxWidth: '500px'
        }
      })
      
    } finally {
      setUploadingImage(false)
    }
  }

  const openDeleteModal = (dog) => {
    setDogToDelete(dog)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!dogToDelete) return

    try {
      console.log('🗑️ Eliminando perro:', dogToDelete.nombre)
      
      if (dogToDelete.imagen_url) {
        console.log('📸 Eliminando imagen del storage...')
        const imagePath = dogToDelete.imagen_url.split('/').slice(-3).join('/')
        const { error: storageError } = await supabase.storage
          .from('dog-images')
          .remove([imagePath])
        
        if (storageError) {
          console.error('⚠️ Error eliminando imagen (continuando):', storageError)
          
          // 🚀 LOGGING
          await logError({
            errorType: 'IMAGE_DELETE_ERROR',
            errorMessage: storageError.message || 'Error eliminando imagen del storage',
            errorCode: storageError.code || 'STORAGE_DELETE_ERROR',
            component: 'MyDogs - handleDelete',
            stackTrace: storageError.stack,
            additionalData: {
              dogId: dogToDelete.id,
              dogName: dogToDelete.nombre,
              imagePath: imagePath,
              userId: user?.id
            }
          })
        }
      }

      const { error } = await supabase
        .from('dogs')
        .update({ activo: false })
        .eq('id', dogToDelete.id)
        .eq('owner_id', user.id)

      if (error) {
        console.error('❌ Error marcando perro como inactivo:', error)
        throw error
      }
      
      console.log('✅ Perro eliminado correctamente')
      toast.success(t('myDogs.toasts.dogDeleted', { name: dogToDelete.nombre }))
      loadDogs()
      
    } catch (error) {
      console.error('❌ Error eliminando perro:', error)
      
      // 🚀 LOGGING
      await logError({
        errorType: 'DOG_DELETE_ERROR',
        errorMessage: error.message || 'Error al eliminar el perro',
        errorCode: error.code || 'DELETE_ERROR',
        component: 'MyDogs - handleDelete',
        stackTrace: error.stack,
        additionalData: {
          dogId: dogToDelete?.id,
          dogName: dogToDelete?.nombre,
          hasImage: !!dogToDelete?.imagen_url,
          userId: user?.id
        }
      })
      
      toast.error(t('myDogs.toasts.deleteError'))
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
        <span className="text-gray-600">{t('myDogs.loading')}</span>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('myDogs.title')}</h2>
            <p className="text-gray-600">{t('myDogs.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto btn btn-primary justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="sm:hidden">{t('myDogs.addButtonMobile')}</span>
            <span className="hidden sm:inline">{t('myDogs.addButton')}</span>
          </button>
        </div>

        {showForm && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">
                {editingDog ? t('myDogs.form.titleEdit', { name: editingDog.nombre }) : t('myDogs.form.titleAdd')}
              </h3>
            </div>
            <div className="card-body p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="border-b border-gray-200 pb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('myDogs.form.profilePhoto')}
                  </label>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
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
                    
                    <div className="flex-1 space-y-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      />
                      <p className="text-xs text-gray-500">
                        {t('myDogs.form.fileTypes')}
                      </p>
                      
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null)
                            setImagePreview(null)
                          }}
                          className="w-full sm:w-auto text-center sm:text-left text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          {t('myDogs.form.removeImage')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('myDogs.form.name')} {t('myDogs.form.required')}
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      className="input"
                      placeholder={t('myDogs.form.namePlaceholder')}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('myDogs.form.breed')} {t('myDogs.form.required')}
                    </label>
                    <input
                      type="text"
                      name="raza"
                      value={formData.raza}
                      onChange={handleChange}
                      className="input"
                      placeholder={t('myDogs.form.breedPlaceholder')}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('myDogs.form.age')} {t('myDogs.form.required')}
                    </label>
                    <input
                      type="number"
                      name="edad"
                      value={formData.edad}
                      onChange={handleChange}
                      className="input"
                      min="0"
                      max="25"
                      placeholder={t('myDogs.form.agePlaceholder')}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('myDogs.form.weight')} {t('myDogs.form.required')}
                    </label>
                    <input
                      type="number"
                      name="peso"
                      value={formData.peso}
                      onChange={handleChange}
                      className="input"
                      min="0"
                      step="0.1"
                      placeholder={t('myDogs.form.weightPlaceholder')}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('myDogs.form.pathologies')} {t('myDogs.form.required')}
                    </label>
                    <textarea
                      name="patologias"
                      value={formData.patologias}
                      onChange={handleChange}
                      rows={3}
                      className="input resize-none"
                      placeholder={t('myDogs.form.pathologiesPlaceholder')}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {t('myDogs.form.pathologiesHint')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('myDogs.form.observations')}
                    </label>
                    <textarea
                      name="observaciones"
                      value={formData.observaciones}
                      onChange={handleChange}
                      rows={3}
                      className="input resize-none"
                      placeholder={t('myDogs.form.observationsPlaceholder')}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {t('myDogs.form.observationsHint')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full sm:w-auto btn btn-secondary order-2 sm:order-1"
                  >
                    {t('myDogs.form.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingImage}
                    className="w-full sm:w-auto btn btn-primary order-1 sm:order-2"
                  >
                    {uploadingImage ? (
                      <>
                        <div className="loading-spinner mr-2"></div>
                        {selectedImage ? t('myDogs.form.uploading') : t('myDogs.form.saving')}
                      </>
                    ) : (
                      editingDog ? t('myDogs.form.update') : t('myDogs.form.save')
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {dogs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('myDogs.emptyState.title')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('myDogs.emptyState.message')}
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 btn btn-primary"
            >
              {t('myDogs.emptyState.button')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {dogs.map((dog) => (
              <div key={dog.id} className="card hover:shadow-lg transition-shadow duration-200">
                <div className="card-body p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
                    <div className="flex items-start space-x-4">
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
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                          {dog.nombre}
                        </h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm text-gray-600 mb-4">
                          {dog.raza && (
                            <div className="flex flex-col sm:flex-row sm:items-center">
                              <span className="font-medium text-gray-700 mr-1">{t('myDogs.dogCard.breed')}</span>
                              <span className="truncate">{dog.raza}</span>
                            </div>
                          )}
                          {dog.edad && (
                            <div className="flex flex-col sm:flex-row sm:items-center">
                              <span className="font-medium text-gray-700 mr-1">{t('myDogs.dogCard.age')}</span>
                              <span>{dog.edad} {t('myDogs.dogCard.years')}</span>
                            </div>
                          )}
                          {dog.peso && (
                            <div className="flex flex-col sm:flex-row sm:items-center">
                              <span className="font-medium text-gray-700 mr-1">{t('myDogs.dogCard.weight')}</span>
                              <span>{dog.peso} {t('myDogs.dogCard.kg')}</span>
                            </div>
                          )}
                        </div>
                        
                        {dog.patologias && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">{t('myDogs.dogCard.pathologies')}</p>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                              {dog.patologias}
                            </div>
                          </div>
                        )}
                        
                        {dog.observaciones && (
                          <div className="mb-2">
                            <p className="text-sm font-medium text-gray-700 mb-2">{t('myDogs.dogCard.observations')}</p>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                              {dog.observaciones}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-center sm:justify-end space-x-2 sm:space-x-2 pt-2 sm:pt-0">
                      <button
                        onClick={() => handleEdit(dog)}
                        className="flex-1 sm:flex-none btn btn-secondary btn-sm px-3 sm:px-3"
                        title={t('myDogs.dogCard.editTitle')}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="ml-1 sm:hidden">{t('myDogs.dogCard.edit')}</span>
                      </button>
                      <button
                        onClick={() => openDeleteModal(dog)}
                        className="flex-1 sm:flex-none btn btn-danger btn-sm px-3 sm:px-3"
                        title={t('myDogs.dogCard.deleteTitle')}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="ml-1 sm:hidden">{t('myDogs.dogCard.delete')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDogToDelete(null)
        }}
        onConfirm={handleDelete}
        title={t('myDogs.deleteModal.title')}
        message={t('myDogs.deleteModal.message', { name: dogToDelete?.nombre })}
        confirmText={t('myDogs.deleteModal.confirm')}
        cancelText={t('myDogs.deleteModal.cancel')}
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