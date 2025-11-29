import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiLayers, FiRotateCw } from 'react-icons/fi';

export default function Molecule3D({ smiles = 'CCO' }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [error, setError] = useState(null);
  const [moleculeName, setMoleculeName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const cleanSmiles = smiles ? smiles.split(/\s+/)[0] : 'CCO';

  useEffect(() => {
    if (!containerRef.current) {
      setIsLoading(false);
      return;
    }

    let viewer;
    let isMounted = true;

    const loadMolecule = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Dynamically load 3Dmol.js if not present
        if (!window.$3Dmol) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.1.0/3Dmol-min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        if (!isMounted || !containerRef.current) return;
        viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: 'white',
          antialias: true,
        });
        viewerRef.current = viewer;

        const molData = await tryMultipleSources(cleanSmiles);
        if (!molData) throw new Error('Could not fetch 3D structure from any source');
        if (!isMounted) return;

        viewer.addModel(molData, 'sdf');
        viewer.setStyle({}, {
          stick: { colorscheme: 'Jmol', radius: 0.15 },
          sphere: { scale: 0.25 }
        });
        viewer.zoomTo();
        viewer.render();

        let angle = 0;
        const rotateInterval = setInterval(() => {
          if (!isMounted || !viewer) {
            clearInterval(rotateInterval);
            return;
          }
          viewer.rotate(1, 'y');
          viewer.render();
          angle += 1;
          if (angle >= 360) clearInterval(rotateInterval);
        }, 50);

        fetchMoleculeName(cleanSmiles);

        setError(null);
        setIsLoading(false);
      } catch (err) {
        if (isMounted) {
          setError('Failed to load 3D structure');
          setIsLoading(false);
        }
      }
    };

    const tryMultipleSources = async (smilesStr) => {
      const sources = [
        {
          url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smilesStr)}/record/SDF?record_type=3d`,
          name: 'PubChem'
        },
        {
          url: `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smilesStr)}/file?format=sdf&get3d=true`,
          name: 'Cactus'
        }
      ];
      for (const source of sources) {
        try {
          const response = await fetch(source.url);
          if (response.ok) {
            const data = await response.text();
            if (data && (data.includes('V2000') || data.includes('V3000'))) {
              return data;
            }
          }
        } catch {}
      }
      return null;
    };

    const fetchMoleculeName = async (smilesStr) => {
      try {
        const nameResponse = await fetch(
          `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smilesStr)}/iupac_name`
        );
        if (nameResponse.ok) {
          const name = await nameResponse.text();
          if (name && !name.includes('Page not found') && isMounted) {
            setMoleculeName(name.trim());
          }
        }
      } catch {}
    };

    const timer = setTimeout(loadMolecule, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
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
      style={{ minHeight: '500px', maxHeight: '100%', justifyContent: 'stretch' }}
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
      <div className="flex-1 p-6 flex flex-col min-h-[400px]" style={{ justifyContent: 'center' }}>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading 3D structure...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-500 text-center px-4">
            <div>
              <p className="font-semibold mb-2">{error}</p>
              <p className="text-sm text-gray-600">Try a different molecule or check your connection</p>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className="flex-1 w-full rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 relative"
              style={{ minHeight: '300px', maxHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            />
            <div className="mt-4 text-center space-y-2 pt-4 border-t">
              {moleculeName && (
                <p className="text-sm font-medium text-gray-800">{moleculeName}</p>
              )}
              <p className="text-xs text-gray-600">
                <span className="font-semibold">SMILES:</span>{' '}
                <code className="bg-gray-100 px-2 py-1 rounded text-indigo-600 break-all">{cleanSmiles}</code>
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
