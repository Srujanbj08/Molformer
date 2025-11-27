import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiLayers, FiRotateCw } from 'react-icons/fi';

export default function Molecule3D({ smiles = 'CCO' }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [error, setError] = useState(null);
  const [moleculeName, setMoleculeName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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
    let scriptCheckAttempts = 0;
    const maxScriptCheckAttempts = 50; // 5 seconds

    const checkScriptLoaded = () => {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          scriptCheckAttempts++;
          
          if (window.$3Dmol) {
            clearInterval(checkInterval);
            resolve(true);
          } else if (scriptCheckAttempts >= maxScriptCheckAttempts) {
            clearInterval(checkInterval);
            reject(new Error('3Dmol.js failed to load'));
          }
        }, 100);
      });
    };

    const loadMolecule = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Wait for script to load
        await checkScriptLoaded();
        
        if (!mountedRef.current) return;

        // Small delay to ensure container is ready
        await new Promise(resolve => setTimeout(resolve, 200));

        if (!mountedRef.current || !containerRef.current) return;

        // Verify container dimensions
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) {
          throw new Error('Container not properly sized');
        }

        // Clear container
        containerRef.current.innerHTML = '';

        // Create viewer with config
        const config = {
          backgroundColor: 'white',
          antialias: true,
        };

        viewer = window.$3Dmol.createViewer(containerRef.current, config);
        viewerRef.current = viewer;

        // Try to fetch 3D structure
        const molData = await fetchMoleculeData(cleanSmiles);
        
        if (!mountedRef.current) return;

        if (!molData) {
          throw new Error('Could not fetch 3D structure. The molecule may not have 3D coordinates available.');
        }

        // Add model
        viewer.addModel(molData, 'sdf');
        
        // Set style
        viewer.setStyle({}, {
          stick: { 
            colorscheme: 'Jmol', 
            radius: 0.15 
          },
          sphere: { 
            scale: 0.25 
          }
        });

        // Zoom and render
        viewer.zoomTo();
        viewer.render();

        // Animate rotation
        let angle = 0;
        rotateInterval = setInterval(() => {
          if (!mountedRef.current || !viewer) {
            clearInterval(rotateInterval);
            return;
          }
          viewer.rotate(1, 'y');
          viewer.render();
          angle += 1;
          if (angle >= 360) {
            clearInterval(rotateInterval);
          }
        }, 50);

        // Fetch name (non-blocking)
        fetchMoleculeName(cleanSmiles);

        setIsLoading(false);
        setError(null);

      } catch (err) {
        console.error('3D Molecule loading error:', err);
        if (mountedRef.current) {
          setError(err.message || 'Failed to load 3D structure');
          setIsLoading(false);
        }
      }
    };

    const fetchMoleculeData = async (smilesStr) => {
      const sources = [
        {
          url: `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smilesStr)}/file?format=sdf&get3d=true`,
          name: 'NCI Cactus'
        },
        {
          url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smilesStr)}/record/SDF?record_type=3d`,
          name: 'PubChem'
        }
      ];

      for (const source of sources) {
        try {
          console.log(`Trying to fetch from ${source.name}...`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(source.url, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.text();
            if (data && data.length > 100 && (data.includes('V2000') || data.includes('V3000'))) {
              console.log(`Successfully fetched from ${source.name}`);
              return data;
            }
          }
        } catch (err) {
          console.warn(`${source.name} failed:`, err.message);
        }
      }

      return null;
    };

    const fetchMoleculeName = async (smilesStr) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
          `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smilesStr)}/iupac_name`,
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const name = await response.text();
          if (name && !name.toLowerCase().includes('not found') && mountedRef.current) {
            setMoleculeName(name.trim());
          }
        }
      } catch (err) {
        console.warn('Failed to fetch molecule name:', err.message);
      }
    };

    loadMolecule();

    return () => {
      mountedRef.current = false;
      if (rotateInterval) clearInterval(rotateInterval);
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
          <button
            onClick={handleResetView}
            disabled={isLoading || error}
            className="p-2 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset View"
          >
            <FiRotateCw />
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col" style={{ minHeight: '400px' }}>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading 3D structure...</p>
              <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-500 text-center px-4">
            <div>
              <p className="font-semibold mb-2">{error}</p>
              <p className="text-sm text-gray-600">Some molecules may not have 3D data available</p>
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
