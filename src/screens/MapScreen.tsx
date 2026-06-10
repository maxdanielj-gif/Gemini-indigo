import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Map as MapIcon } from 'lucide-react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

const MapScreen: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      <div className="p-4 md:p-6 lg:p-8 flex-1 w-full max-w-6xl mx-auto flex flex-col">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-6">
          <MapIcon className="w-8 h-8 text-indigo-500" />
          Google Maps
        </h1>
        
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
          {!hasValidKey ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900 z-10 text-slate-800 dark:text-slate-200">
              <MapIcon className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-6" />
              <h2 className="text-xl font-bold mb-4">Google Maps API Key Required</h2>
              <p className="mb-2 max-w-md">To enable maps, open <strong>Settings</strong> (⚙️ gear icon, <strong>top-right corner</strong> of AI Studio), select <strong>Secrets</strong>, and add <code>GOOGLE_MAPS_PLATFORM_KEY</code> with your API key.</p>
              <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                The map will automatically refresh when you add the key.
              </p>
            </div>
          ) : (
            <APIProvider apiKey={API_KEY} version="weekly">
              <Map
                defaultCenter={{ lat: 37.42, lng: -122.08 }}
                defaultZoom={12}
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
              >
                <AdvancedMarker position={{ lat: 37.42, lng: -122.08 }}>
                  <Pin background="#4285F4" glyphColor="#fff" />
                </AdvancedMarker>
              </Map>
            </APIProvider>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapScreen;
