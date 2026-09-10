import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapPin, Navigation, Package, CheckCircle, Clock } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

// Basic Haversine formula for distance calculation in km
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function KabadiwalaHome() {
  const { currentUser, logout } = useAuth();
  const [view, setView] = useState<'live' | 'earnings'>('live');
  const [pickups, setPickups] = useState<any[]>([]);
  const [collectedPickups, setCollectedPickups] = useState<any[]>([]);
  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    // Get kabadiwala's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Location error", err)
      );
    }

    // Query pending, accepted, en_route pickups
    const q = query(
      collection(db, 'pickups'),
      where('status', 'in', ['pending', 'accepted', 'en_route'])
    );

    const unsubscribeLive = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPickups(data);
    });

    // Query collected pickups for earnings
    const qCollected = query(
      collection(db, 'pickups'),
      where('kabadiwalaId', '==', currentUser?.uid),
      where('status', '==', 'collected')
    );

    const unsubscribeCollected = onSnapshot(qCollected, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCollectedPickups(data);
    });

    return () => {
      unsubscribeLive();
      unsubscribeCollected();
    };
  }, [currentUser]);

  const handleAccept = async (id: string) => {
    try {
      await updateDoc(doc(db, 'pickups', id), {
        status: 'accepted',
        kabadiwalaId: currentUser?.uid
      });
    } catch (err) {
      console.error(err);
      alert('Failed to accept pickup');
    }
  };

  const handleEnRoute = async (id: string) => {
    try {
      await updateDoc(doc(db, 'pickups', id), {
        status: 'en_route'
      });
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  const handleComplete = async (id: string) => {
    const weightStr = prompt("Enter actual weight collected (kg):", "1");
    if (!weightStr) return;
    const weight = parseFloat(weightStr);
    
    try {
      await updateDoc(doc(db, 'pickups', id), {
        status: 'collected',
        actualWeight: weight
      });
    } catch (err) {
      console.error(err);
      alert('Failed to complete pickup');
    }
  };

  const pendingPickups = pickups
    .filter(p => p.status === 'pending')
    .map(p => ({
      ...p,
      distance: myLocation && p.location ? getDistance(myLocation.lat, myLocation.lng, p.location.lat, p.location.lng) : null
    }))
    .sort((a, b) => (a.distance || 999) - (b.distance || 999));

  const myAcceptedPickups = pickups.filter(p => (p.status === 'accepted' || p.status === 'en_route') && p.kabadiwalaId === currentUser?.uid);

  const optimizeRouteUrl = () => {
    if (!myLocation || myAcceptedPickups.length === 0) return '#';
    const origin = `${myLocation.lat},${myLocation.lng}`;
    const sorted = [...myAcceptedPickups].sort((a, b) => {
      const d1 = getDistance(myLocation.lat, myLocation.lng, a.location?.lat, a.location?.lng);
      const d2 = getDistance(myLocation.lat, myLocation.lng, b.location?.lat, b.location?.lng);
      return d1 - d2;
    });
    
    if (sorted.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${sorted[0].location?.lat},${sorted[0].location?.lng}`;
    }

    const waypoints = sorted.slice(0, -1).map(p => `${p.location?.lat},${p.location?.lng}`).join('|');
    const destination = sorted[sorted.length - 1];
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&waypoints=${waypoints}&destination=${destination.location?.lat},${destination.location?.lng}`;
  };

  const totalEarnings = collectedPickups.reduce((acc, curr) => acc + (curr.actualWeight * (curr.estimatedValue || 10)), 0);
  const totalWeight = collectedPickups.reduce((acc, curr) => acc + (curr.actualWeight || 0), 0);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-4 py-3 shadow-sm flex flex-col sticky top-0 z-10">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-xl font-bold text-blue-700">Scrap Dealer</h1>
          <button onClick={logout} className="text-sm text-gray-500 font-medium">Logout</button>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setView('live')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${view === 'live' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}
          >
            Live Pickups
          </button>
          <button 
            onClick={() => setView('earnings')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${view === 'earnings' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}
          >
            Earnings
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 flex flex-col space-y-6">
        {view === 'live' && (
          <>
            {myAcceptedPickups.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" /> My Active Pickups
              </h2>
              {myAcceptedPickups.length > 1 && (
                <a href={optimizeRouteUrl()} target="_blank" rel="noreferrer" className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-200">
                  Optimize Route
                </a>
              )}
            </div>
            <div className="space-y-3">
              {myAcceptedPickups.map(p => (
                <div key={p.id} className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-1 rounded-md">{p.wasteType}</span>
                      <p className="font-bold text-gray-900 mt-2">Est. Value: ₹{p.estimatedValue}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {p.status === 'accepted' ? (
                      <button 
                        onClick={() => handleEnRoute(p.id)}
                        className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg font-semibold flex items-center justify-center hover:bg-gray-50"
                      >
                        <Navigation className="w-4 h-4 mr-2" /> Start Route
                      </button>
                    ) : (
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.location?.lat},${p.location?.lng}`}
                        target="_blank" rel="noreferrer"
                        className="flex-1 bg-purple-100 border border-purple-200 text-purple-700 py-2 rounded-lg font-semibold flex items-center justify-center hover:bg-purple-200"
                      >
                        <Navigation className="w-4 h-4 mr-2" /> Navigating...
                      </a>
                    )}
                    <button 
                      onClick={() => handleComplete(p.id)}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold flex items-center justify-center hover:bg-blue-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-gray-600" /> Live Request Map
          </h2>
          <div className="w-full h-64 bg-gray-200 rounded-2xl overflow-hidden mb-6 relative shadow-sm border border-gray-200">
            {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
              <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                <Map
                  mapId="DEMO_MAP_ID"
                  defaultCenter={myLocation || { lat: 28.6139, lng: 77.2090 }}
                  defaultZoom={12}
                  gestureHandling={'greedy'}
                  disableDefaultUI={true}
                  internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                >
                  {myLocation && (
                    <AdvancedMarker position={myLocation}>
                      <Pin background={'#2563eb'} borderColor={'#1d4ed8'} glyphColor={'#fff'} />
                    </AdvancedMarker>
                  )}
                  {pendingPickups.map(p => p.location && (
                    <AdvancedMarker key={p.id} position={p.location}>
                      <Pin background={'#16a34a'} borderColor={'#15803d'} glyphColor={'#fff'} />
                    </AdvancedMarker>
                  ))}
                </Map>
              </APIProvider>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gray-50">
                <MapPin className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm font-semibold text-gray-700">Google Maps API Key Missing</p>
                <p className="text-xs text-gray-500 mt-1">Please configure VITE_GOOGLE_MAPS_API_KEY in your secrets to view the live pickup map.</p>
              </div>
            )}
          </div>
          
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <Package className="w-5 h-5 mr-2 text-gray-600" /> Nearby Requests
          </h2>
          {pendingPickups.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No pending pickups nearby.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPickups.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-green-600 bg-green-100 px-2 py-1 rounded-md">{p.wasteType}</span>
                      <p className="text-lg font-bold text-gray-900 mt-1">₹{p.estimatedValue} <span className="text-sm font-normal text-gray-500">est.</span></p>
                    </div>
                    {p.distance !== null && (
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-600">{p.distance.toFixed(1)} km</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => handleAccept(p.id)}
                    className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Accept Request
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        </>
        )}
        
        {view === 'earnings' && (
          <section>
            <div className="bg-blue-600 text-white p-6 rounded-2xl mb-6 shadow-sm">
              <p className="text-blue-100 text-sm font-medium mb-1">Total Payout Volume</p>
              <p className="text-4xl font-bold mb-4">₹{totalEarnings.toFixed(0)}</p>
              
              <div className="grid grid-cols-2 gap-4 border-t border-blue-500 pt-4">
                <div>
                  <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Total Scraps</p>
                  <p className="text-xl font-bold">{totalWeight.toFixed(1)} kg</p>
                </div>
                <div>
                  <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Completed</p>
                  <p className="text-xl font-bold">{collectedPickups.length} Pickups</p>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900 mb-3">Recent Collections</h2>
            {collectedPickups.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No completed collections yet.</p>
            ) : (
              <div className="space-y-3">
                {collectedPickups.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900">{p.wasteType}</p>
                      <p className="text-sm text-gray-500">{p.createdAt?.toDate ? new Date(p.createdAt.toDate()).toLocaleDateString() : 'Just now'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">₹{(p.actualWeight * (p.estimatedValue || 10)).toFixed(0)}</p>
                      <p className="text-sm text-gray-500">{p.actualWeight} kg</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
