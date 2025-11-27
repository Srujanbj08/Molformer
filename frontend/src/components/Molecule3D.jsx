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
  const timeoutRef = useRef(null);

  const cleanSmiles = smiles ? smiles.split(/\s+/)[0] : 'CCO';

  useEffect(() => {
    let isMounted = true;
    let viewer = null;
    let rotateInterval = null;

    const loadMolecule = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setUseFallback(false);

        console.log('Starting 3D load for:', cleanSmiles);

        // Set a 6-second hard timeout
        timeoutRef.current = setTimeout(() => {
          console.warn('Loading timeout - switching to fallback');
          if (isMounted) {
            setUseFallback(true);
            setIsLoading(false);
          }
        }, 6000);

        // Wait for 3Dmol to be available
        let scriptAttempts = 0;
        while (!window.$3Dmol && scriptAttempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 100));
          scriptAttempts++;
        }

        if (!window.$3Dmol) {
          throw new Error('3Dmol library not loaded');
        }

        console.log('3Dmol loaded, waiting for container...');

        // Wait for container to be ready
        await new Promise(resolve => setTimeout(resolve, 200));

        if (!isMounted || !containerRef.current) {
          console.log('Component unmounted or no container');
          return;
        }

        // Clear and create viewer
        containerRef.current.innerHTML = '';
        viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: 'white',
          antialias: true,
        });
        viewerRef.current = viewer;

        console.log('Viewer created, fetching molecule data...');

        // Fetch molecule data with shorter timeout
        const molData = await Promise.race([
          fetchMoleculeData(cleanSmiles),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch timeout')), 5000)
          )
        ]);

        if (!isMounted) return;

        if (!molData) {
          console.log('No molecule data received');
          throw new Error('Could not load 3D structure');
        }

        console.log('Molecule data received, rendering...');

        // Add model and render
        viewer.addModel(molData, 'sdf');
        viewer.setStyle({}, {
          stick: { colorscheme: 'Jmol', radius: 0.15 },
          sphere: { scale: 0.25 }
        });
        viewer.zoomTo();
        viewer.render();

        console.log('Render complete!');

        // Clear timeout since we succeeded
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Rotation animation
        let angle = 0;
        rotateInterval = setInterval(() => {
          if (!isMounted || !viewer) {
            clearInterval(rotateInterval);
            return;
          }
          viewer.rotate(1, 'y');
          viewer.render();
          angle += 1;
          if (angle >= 360) clearInterval(rotateInterval);
        }, 50);

        // Fetch name (non-blocking)
        fetchMoleculeName(cleanSmiles);

        setIsLoading(false);

      } catch (err) {
        console.error('3D loading error:', err);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        if (isMounted) {
          setUseFallback(true);
          setIsLoading(false);
        }
      }
    };

    const fetchMoleculeData = async (smilesStr) => {
      // Try NCI Cactus first
      try {
        console.log('Attempting NCI Cactus...');
        const response = await fetch(
          `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smilesStr)}/file?format=sdf&get3d=true`
        );

        if (response.ok) {
          const data = await response.text();
          if (data && data.length > 100 && data.includes('V2000')) {
            console.log('✓ NCI Cactus success');
            return data;
          }
        }
        console.log('✗ NCI Cactus failed');
      } catch (err) {
        console.warn('NCI Cactus error:', err.message);
      }

      // Try PubChem
      try {
        console.log('Attempting PubChem...');
        const response = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smilesStr)}/record/SDF?record_type=3d`
        );

        if (response.ok) {
          const data = await response.text();
          if (data && data.length > 100) {
            console.log('✓ PubChem success');
            return data;
          }
        }
        console.log('✗ PubChem failed');
      } catch (err) {
        console.warn('PubChem error:', err.message);
      }

      return null;
    };

    const fetchMoleculeName = async (smilesStr) => {
      try {
        const response = await fetch(
          `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smilesStr)}/iupac_name`
        );
        if (response.ok) {
          const name = await response.text();
          if (name && !name.toLowerCase().includes('not found') && isMounted) {
            setMoleculeName(name.trim());
          }
        }
      } catch (err) {
        // Silent fail for name
      }
    };

    loadMolecule();

    return () => {
      isMounted = false;
      if (rotateInterval) clearInterval(rotateInterval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-gray-700 text-sm">3D viewer is temporarily unavailable or this molecule doesn't have 3D coordinates.</p>
              </div>
              
                href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(cleanSmiles)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <FiExternalLink />
                View on PubChem
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
