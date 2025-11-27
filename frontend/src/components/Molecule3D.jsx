import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiLayers, FiRotateCw, FiExternalLink } from 'react-icons/fi';

export default function Molecule3D({ smiles = 'CCO' }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [error, setError] = useState(null);
  const [moleculeName, setMoleculeName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);
  const mountedRef = useRef(true);

  const cleanSmiles = smiles ? smiles.split(/\s+/)[0] : 'CCO';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer;
    let rotateInterval;
    let loadingTimeout;

    const loadMolecule = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setUseFallback(false);

        // Set a timeout - if loading takes too long, show fallback
        loadingTimeout = setTimeout(() => {
          if (mountedRef.current && isLoading) {
            console.warn('3D loading timeout, switching to fallback');
            setUseFallback(true);
            setIsLoading(false);
          }
        }, 8000);

        // Check if 3Dmol is available
        let attempts = 0;
        while (!window.$3Dmol && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.$3Dmol) {
          console.error('3Dmol.js not loaded');
          throw new Error('3D visualization library not available');
        }

        if (!mountedRef.current) return;

        // Wait for container
        await new Promise(resolve => setTimeout(resolve, 300));

        if (!mountedRef.current || !containerRef.current) return;

        // Clear container
        containerRef.current.innerHTML = '';

        // Create viewer
        viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: 'white',
          antialias: true,
        });
        viewerRef.current = viewer;

        console.log('Fetching molecule data for:', cleanSmiles);

        // Fetch 3D structure
        const molData = await fetchMoleculeData(cleanSmiles);

        if (!mountedRef.current) return;

        if (!molData) {
          throw new Error('3D structure not available for this molecule');
        }

        // Add and style model
        viewer.addModel(molData, 'sdf');
        viewer.setStyle({}, {
          stick: { colorscheme: 'Jmol', radius: 0.15 },
          sphere: { scale: 0.25 }
        });
        viewer.zoomTo();
        viewer.render();

        clearTimeout(loadingTimeout);

        // Rotation animation
        let angle = 0;
        rotateInterval = setInterval(() => {
          if (!mountedRef.current || !viewer) {
            clearInterval(rotateInterval);
            return;
          }
          viewer.rotate(1, 'y');
          viewer.render();
          angle += 1;
          if (angle >= 360) clearInterval(rotateInterval);
        }, 50);

        // Fetch name
        fetchMoleculeName(cleanSmiles);

        setIsLoading(false);
        setError(null);

      } catch (err) {
        console.error('3D loading error:', err);
        clearTimeout(loadingTimeout);
        if (mountedRef.current) {
          setUseFallback(true);
          setIsLoading(false);
        }
      }
    };

    const fetchMoleculeData = async (smilesStr) => {
      // Try NCI Cactus first (usually more reliable)
      try {
        console.log('Trying NCI Cactus...');
        const response = await fetch(
          `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smilesStr)}/file?format=sdf&get3d=true`,
          { 
            signal: AbortSignal.timeout(8000),
            mode: 'cors'
          }
        );

        if (response.ok) {
          const data = await response.text();
          if (data && data.length > 100 && data.includes('V2000')) {
            console.log('Success from NCI Cactus');
            return data;
          }
        }
      } catch (err) {
        console.warn('NCI Cactus failed:', err.message);
      }

      // Try PubChem as fallback
      try {
        console.log('Trying PubChem...');
        const response = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smilesStr)}/record/SDF?record_type=3d`,
          { 
            signal: AbortSignal.timeout(8000),
            mode: 'cors'
          }
        );

        if (response.ok) {
          const data = await response.text();
          if (data && data.length > 100) {
            console.log('Success from PubChem');
            return data;
          }
        }
      } catch (err) {
        console.warn('PubChem failed:', err.message);
      }

      return null;
    };

    const fetchMoleculeName = async (smilesStr) => {
      try {
        const response = await fetch(
          `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smilesStr)}/iupac_name`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (response.ok) {
          const name = await response.text();
          if (name && !name.toLowerCase().includes('not found') && mountedRef.current) {
            setMoleculeName(name.trim());
          }
        }
      } catch (err) {
        console.warn('Name fetch failed');
      }
    };

    loadMolecule();

    return () => {
      mountedRef.current = false;
      if (rotateInterval) clearInterval(rotateInterval);
      if (loadingTimeout) clearTimeout(loadingTimeout);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      viewerRef.current = null;
    };
  }, [cleanSmiles]);

  const handleResetView = () => {
    if (viewerRef.current) {
      viewerRef.current.zoomTo();
      viewerRef.current.render();
    }
  };

  const handleOpenExternal = () => {
    window.open(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(cleanSmiles)}/record/SDF?record_type=3d`, '_blank');
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col"
      style={{ minHeight: '500px' }}
    >
      <div className="bg-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FiLayers className="h-6 w-6 mr-2" />
            <h2 className="text-xl font-bold">3D Structure</h2>
          </div>
          <div className="flex gap-2">
            {!useFallback && (
              <button
                onClick={handleResetView}
                disabled={isLoading}
                className="p-2 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50"
                title="Reset View"
              >
                <FiRotateCw />
              </button>
            )}
            
              href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(cleanSmiles)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full hover:bg-indigo-700 transition-colors"
              title="View on PubChem"
            >
              <FiExternalLink />
            </a>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col" style={{ minHeight: '400px' }}>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading 3D structure...</p>
            </div>
          </div>
        ) : useFallback ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="max-w-md">
              <p className="text-gray-700 mb-4">Interactive 3D viewer temporarily unavailable</p>
              
                href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(cleanSmiles)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <FiExternalLink />
                View 3D Structure on PubChem
              </a>
              <div className="mt-6 pt-4 border-t">
                {moleculeName && (
                  <p className="text-sm font-medium text-gray-800 mb-2">{moleculeName}</p>
                )}
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">SMILES:</span>{' '}
                  <code className="bg-gray-100 px-2 py-1 rounded text-indigo-600 break-all">
                    {cleanSmiles}
                  </code>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className="flex-1 w-full rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200"
              style={{ minHeight: '300px' }}
            />
            <div className="mt-4 text-center space-y-2 pt-4 border-t">
              {moleculeName && (
                <p className="text-sm font-medium text-gray-800">{moleculeName}</p>
              )}
              <p className="text-xs text-gray-600">
                <span className="font-semibold">SMILES:</span>{' '}
                <code className="bg-gray-100 px-2 py-1 rounded text-indigo-600 break-all">
                  {cleanSmiles}
                </code>
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
