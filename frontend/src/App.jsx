import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSend, FiLoader } from 'react-icons/fi'
import ResultsCard from './components/ResultsCard'
import Molecule2D from './components/Molecule2D'
import Molecule3D from './components/Molecule3D'
import Header from './components/Header'
import ChemicalChatbot from './components/ChemicalChatbot'

function App() {
  const [smiles, setSmiles] = useState('')
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!smiles.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const cleanSmiles = smiles.trim().split(/\s+/)[0]

      const response = await fetch('https://molformer.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles: cleanSmiles })
      })

      if (!response.ok) throw new Error('Failed to get prediction')

      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Prediction failed')

      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <ChemicalChatbot />

      <main className="container mx-auto px-4 py-8">
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-12">
          <div className="flex shadow-lg rounded-full overflow-hidden bg-white">
            <input
              type="text"
              value={smiles}
              onChange={(e) => setSmiles(e.target.value)}
              placeholder="Enter SMILES string (e.g., CCO, CC(C)O, c1ccccc1)"
              className="flex-1 px-6 py-4 focus:outline-none text-gray-700"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <FiLoader className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <FiSend />
                  Analyze
                </>
              )}
            </button>
          </div>

          {/* Examples */}
          <div className="mt-3 text-center text-sm text-gray-600">
            <span className="font-medium">Examples: </span>
            <button
              type="button"
              onClick={() => setSmiles('CCO')}
              className="text-indigo-600 hover:text-indigo-800 hover:underline mx-1"
            >
              CCO
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setSmiles('c1ccccc1')}
              className="text-indigo-600 hover:text-indigo-800 hover:underline mx-1"
            >
              c1ccccc1
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setSmiles('CC(=O)O')}
              className="text-indigo-600 hover:text-indigo-800 hover:underline mx-1"
            >
              CC(=O)O
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-8 rounded-r-lg shadow-md"
          >
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </motion.div>
        )}

        {/* Results Grid */}
        <AnimatePresence mode="wait">
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="max-w-7xl mx-auto"
            >
              {/* Results Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                {/* Left: Molecular Properties */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="lg:col-span-1"
                >
                  <ResultsCard data={results} />
                </motion.div>

                {/* Center: 2D Structure */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="lg:col-span-1"
                >
                  <Molecule2D smiles={results.smiles} />
                </motion.div>

                {/* Right: 3D Structure */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="lg:col-span-1"
                >
                  <Molecule3D smiles={results.smiles} />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default App
