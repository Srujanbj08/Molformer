import { motion } from 'framer-motion'
import { FiActivity, FiCheckCircle, FiBarChart2, FiInfo } from 'react-icons/fi'

export default function ResultsCard({ data }) {
  const getConfidenceColor = (confidence) => {
    if (confidence === 'High') return 'bg-green-100 text-green-800'
    if (confidence === 'Medium') return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  // Extract clean SMILES (remove any description text)
  const cleanSmiles = data.smiles.split(/\s+/)[0]

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white rounded-xl shadow-lg overflow-hidden h-full"
    >
      <div className="bg-indigo-600 p-4 text-white">
        <div className="flex items-center">
          <FiActivity className="h-6 w-6 mr-2" />
          <h2 className="text-xl font-bold">Molecular Properties</h2>
        </div>
        <p className="text-indigo-100 text-xs mt-1 font-mono break-all">{cleanSmiles}</p>
      </div>
      
      <div className="p-6">
        {/* Molecule Info */}
        {data.molecule_info && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <FiInfo className="mr-1" /> Molecule Information
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Formula:</span>
                <span className="font-medium ml-1">{data.molecule_info.formula}</span>
              </div>
              <div>
                <span className="text-gray-600">Weight:</span>
                <span className="font-medium ml-1">{data.molecule_info.molecular_weight}</span>
              </div>
              <div>
                <span className="text-gray-600">Atoms:</span>
                <span className="font-medium ml-1">{data.molecule_info.num_atoms}</span>
              </div>
              <div>
                <span className="text-gray-600">Bonds:</span>
                <span className="font-medium ml-1">{data.molecule_info.num_bonds}</span>
              </div>
              <div>
                <span className="text-gray-600">Rings:</span>
                <span className="font-medium ml-1">{data.molecule_info.num_rings}</span>
              </div>
              <div>
                <span className="text-gray-600">Aromatic:</span>
                <span className="font-medium ml-1">{data.molecule_info.aromatic ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Confidence */}
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Model Confidence</span>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getConfidenceColor(data.model_confidence)}`}>
              {data.model_confidence}
            </span>
          </div>
        </div>

        {/* Properties List */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          <h3 className="text-sm font-semibold text-gray-700 sticky top-0 bg-white py-2 border-b">
            Predicted Properties ({data.predictions.length})
          </h3>
          {data.predictions.map((prop, index) => (
            <div key={index} className="border-l-4 border-indigo-400 pl-3 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 mb-1">{prop.property_name}</p>
                  <p className="text-base font-bold text-indigo-600 break-all">
                    {prop.value.toFixed(4)} <span className="text-xs text-gray-500 font-normal">{prop.unit}</span>
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${getConfidenceColor(prop.confidence)}`}>
                  {prop.confidence}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}