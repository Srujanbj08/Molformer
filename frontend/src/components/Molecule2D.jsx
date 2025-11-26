import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiImage, FiDownload } from 'react-icons/fi'

export default function Molecule2D({ smiles }) {
  const [imageUrl, setImageUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Extract clean SMILES
  const cleanSmiles = smiles ? smiles.split(/\s+/)[0] : ''

  useEffect(() => {
    if (!cleanSmiles) return

    const fetchImage = async () => {
      setIsLoading(true)
      setError(null)
     
      try {
        const encodedSMILES = encodeURIComponent(cleanSmiles)
        const response = await fetch(
          `https://cactus.nci.nih.gov/chemical/structure/${encodedSMILES}/image`,
          {
            method: 'GET',
            headers: {
              'Accept': 'image/png'
            }
          }
        )
        if (response.ok) {
          const imageBlob = await response.blob()
          const url = URL.createObjectURL(imageBlob)
          setImageUrl(url)
        } else {
          throw new Error('Failed to generate 2D image')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchImage()

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [cleanSmiles])

  const handleDownload = () => {
    if (!imageUrl) return
   
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `molecule_${cleanSmiles.substring(0, 10)}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col"
    >
      <div className="bg-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FiImage className="h-6 w-6 mr-2" />
            <h2 className="text-xl font-bold">2D Structure</h2>
          </div>
          <button
            onClick={handleDownload}
            disabled={!imageUrl}
            className="p-2 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Image"
          >
            <FiDownload />
          </button>
        </div>
      </div>
     
      <div className="flex-1 p-6 flex flex-col justify-between">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Generating 2D structure...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-500 text-center px-4">
            <div>
              <p className="font-semibold mb-2">{error}</p>
              <p className="text-sm text-gray-600">Unable to generate image</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <img
              src={imageUrl}
              alt={`2D structure of ${cleanSmiles}`}
              className="max-w-full max-h-64 object-contain"
            />
          </div>
        )}
       
        <div className="mt-4 text-center pt-4 border-t">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">SMILES:</span>{' '}
            <code className="bg-gray-100 px-2 py-1 rounded text-indigo-600 break-all">{cleanSmiles}</code>
          </p>
        </div>
      </div>
    </motion.div>
  )
}