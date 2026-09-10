import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Webcam from 'react-webcam';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Camera, CheckCircle, Leaf, Upload, History, Clock, Truck, Gift, Trophy, Medal } from 'lucide-react';

export function HouseholdHome() {
  const { currentUser, logout } = useAuth();
  const [view, setView] = useState<'scan' | 'history' | 'leaderboard'>('scan');
  const [step, setStep] = useState<'camera' | 'analyzing' | 'result' | 'booked'>('camera');
  const [image, setImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ type: string; estimatedValue: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [impact, setImpact] = useState({ kgRecycled: 0, co2Saved: 0, points: 0 });
  const [historyPickups, setHistoryPickups] = useState<any[]>([]);
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [showPriceGuide, setShowPriceGuide] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'pickups'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalKg = 0;
      const items: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        items.push({ id: doc.id, ...data });
        if (data.status === 'collected') {
          totalKg += (data.actualWeight || 0);
        }
      });
      
      // Sort items descending by creation date client-side
      items.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });
      
      setHistoryPickups(items);
      setImpact({
        kgRecycled: totalKg,
        co2Saved: totalKg * 2.5,
        points: totalKg * 10
      });
    });

    return unsubscribe;
  }, [currentUser]);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImage(imageSrc);
      analyzeImage(imageSrc);
    } else {
      alert('Failed to capture image. Please ensure camera permissions are granted and the camera is ready.');
    }
  }, [webcamRef]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImage(base64String);
        analyzeImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setStep('analyzing');
    try {
      const res = await fetch('/api/analyze-waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image })
      });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      setAnalysisResult(data);
      setStep('result');
    } catch (err) {
      console.error(err);
      alert('Failed to analyze image. Please try again.');
      setStep('camera');
      setImage(null);
    }
  };

  const confirmPickup = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await addDoc(collection(db, 'pickups'), {
          userId: currentUser?.uid,
          status: 'pending',
          wasteType: analysisResult?.type || 'Unknown',
          estimatedValue: analysisResult?.estimatedValue || 0,
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          },
          scheduledFor: scheduledDate || 'immediate',
          imageUrl: image, // In a real app, upload to Storage first. We'll store base64 or a placeholder for prototyping if size permits, but Firestore has a 1MB limit. 
          createdAt: serverTimestamp()
        });
        setStep('booked');
      } catch (error) {
        console.error("Error booking pickup", error);
        alert('Failed to book pickup.');
      }
    }, (error) => {
      setLocationError('Unable to retrieve your location');
    });
  };

  const generateLeaderboard = () => {
    const mockNeighbors = [
      { id: '1', name: 'Rahul S.', points: 850, avatar: 'RS', isCurrentUser: false },
      { id: '2', name: 'Priya K.', points: 620, avatar: 'PK', isCurrentUser: false },
      { id: '3', name: 'Amit D.', points: 450, avatar: 'AD', isCurrentUser: false },
      { id: '4', name: 'Neha V.', points: 310, avatar: 'NV', isCurrentUser: false },
      { id: '5', name: 'Vikram M.', points: 120, avatar: 'VM', isCurrentUser: false },
    ];
    
    const userEntry = {
      id: currentUser?.uid || 'me',
      name: 'You',
      points: impact.points,
      avatar: 'Me',
      isCurrentUser: true
    };
    
    return [...mockNeighbors, userEntry].sort((a, b) => b.points - a.points);
  };
  
  const leaderboardData = generateLeaderboard();

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-4 py-3 shadow-sm flex flex-col z-10 sticky top-0">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-xl font-bold text-green-700">Remix Kabadiwala</h1>
          <button onClick={logout} className="text-sm text-gray-500 font-medium">Logout</button>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setView('scan')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${view === 'scan' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}
          >
            New Pickup
          </button>
          <button 
            onClick={() => setView('history')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${view === 'history' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}
          >
            History
          </button>
          <button 
            onClick={() => setView('leaderboard')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${view === 'leaderboard' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}
          >
            Leaderboard
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 flex flex-col">
        {view === 'scan' && (
          <>
            {impact.kgRecycled > 0 && step === 'camera' && (
          <div className="bg-green-600 text-white p-4 rounded-2xl mb-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Your Impact</p>
              <p className="text-xl font-bold">{impact.kgRecycled} kg Recycled</p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center justify-center bg-white/20 px-3 py-1 rounded-full mb-1">
                <Gift className="w-4 h-4 text-yellow-300 mr-2" />
                <span className="font-bold text-sm text-yellow-300">{impact.points} pts</span>
              </div>
              <p className="text-green-100 text-xs font-medium block">{impact.co2Saved} kg CO₂ saved</p>
            </div>
          </div>
        )}

        {step === 'camera' && (
          <div className="flex-1 flex flex-col">
            <p className="text-gray-600 mb-4 text-center">Take a photo of your scrap material to get an instant AI estimate.</p>
            <div className="flex-1 relative bg-black rounded-2xl overflow-hidden flex items-center justify-center">
              {/* @ts-ignore - react-webcam typing issue */}
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8">
                <button
                  onClick={capture}
                  className="w-16 h-16 bg-white rounded-full border-4 border-green-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <Camera className="w-8 h-8 text-green-600" />
                </button>
                <label className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-600" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
            
            <div className="mt-6">
              <button 
                onClick={() => setShowPriceGuide(!showPriceGuide)}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold mb-2 text-sm"
              >
                {showPriceGuide ? 'Hide Price Guide' : 'View Estimated Price Guide'}
              </button>
              {showPriceGuide && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-2">
                  <h3 className="font-bold text-gray-900 mb-3 text-sm">Estimated Market Rates</h3>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex justify-between"><span>Newspaper</span><span className="font-semibold">₹15/kg</span></li>
                    <li className="flex justify-between"><span>Cardboard</span><span className="font-semibold">₹8/kg</span></li>
                    <li className="flex justify-between"><span>Plastic Bottles (PET)</span><span className="font-semibold">₹20/kg</span></li>
                    <li className="flex justify-between"><span>Iron/Steel</span><span className="font-semibold">₹25/kg</span></li>
                    <li className="flex justify-between"><span>E-Waste</span><span className="font-semibold">Varies</span></li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-64 h-64 relative mb-8 rounded-2xl overflow-hidden">
              <img src={image!} alt="Captured" className="w-full h-full object-cover opacity-50" />
              <div className="absolute inset-0 border-4 border-green-500 border-t-transparent rounded-2xl animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Analyzing AI Model...</h2>
            <p className="text-gray-500">Identifying material type & value</p>
          </div>
        )}

        {step === 'result' && analysisResult && (
          <div className="flex-1 flex flex-col">
            <div className="w-full h-64 rounded-2xl overflow-hidden mb-6 shadow-sm">
              <img src={image!} alt="Scrap" className="w-full h-full object-cover" />
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm mb-auto">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Detected Material</h3>
              <p className="text-3xl font-bold text-gray-900 mb-6">{analysisResult.type}</p>
              
              <div className="flex items-center justify-between border-t border-gray-100 pt-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400">Estimated Rate</h3>
                  <p className="text-2xl font-bold text-green-600">₹{analysisResult.estimatedValue} <span className="text-sm text-gray-500 font-normal">/ kg</span></p>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Schedule Pickup (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {locationError && <p className="text-red-500 text-sm mt-4">{locationError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button 
                onClick={() => { setStep('camera'); setImage(null); }}
                className="py-3 px-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Retake
              </button>
              <button 
                onClick={confirmPickup}
                className="py-3 px-4 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
              >
                Confirm Pickup
              </button>
            </div>
          </div>
        )}

        {step === 'booked' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pickup Requested!</h2>
            <p className="text-gray-500 mb-8">Nearby Kabadiwalas have been notified. They will arrive soon.</p>
            <button 
              onClick={() => { setStep('camera'); setImage(null); }}
              className="py-3 px-8 rounded-xl font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
            >
              Book Another
            </button>
          </div>
        )}
        </>
      )}

      {view === 'history' && (
          <div className="flex-1 flex flex-col">
            <div className="bg-green-600 text-white p-6 rounded-2xl mb-6 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium mb-1">Total Impact</p>
                <p className="text-3xl font-bold">{impact.kgRecycled} <span className="text-xl font-normal opacity-80">kg</span></p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center justify-center bg-white/20 px-3 py-1.5 rounded-full mb-2">
                  <Gift className="w-5 h-5 text-yellow-300 mr-2" />
                  <span className="font-bold text-yellow-300 text-lg">{impact.points}</span>
                </div>
                <p className="text-green-100 text-xs font-medium block">{impact.co2Saved} kg CO₂ saved</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl mb-6 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-2xl">🏆</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {impact.kgRecycled >= 50 ? 'Gold Eco-Warrior' : impact.kgRecycled >= 20 ? 'Silver Recycler' : impact.kgRecycled >= 5 ? 'Bronze Starter' : 'Green Beginner'}
                </h3>
                <p className="text-sm text-gray-500">
                  {impact.kgRecycled >= 50 ? "You're a recycling champion!" : `Recycle ${impact.kgRecycled >= 20 ? 50 - impact.kgRecycled : impact.kgRecycled >= 5 ? 20 - impact.kgRecycled : 5 - impact.kgRecycled}kg more to rank up!`}
                </p>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900 mb-4">Past Pickups</h2>
            
            {historyPickups.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No pickups requested yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyPickups.map((pickup) => (
                  <div key={pickup.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      pickup.status === 'collected' ? 'bg-green-100 text-green-600' :
                      pickup.status === 'accepted' ? 'bg-blue-100 text-blue-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {pickup.status === 'collected' ? <CheckCircle className="w-6 h-6" /> :
                       pickup.status === 'accepted' ? <Truck className="w-6 h-6" /> :
                       <Clock className="w-6 h-6" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-gray-900 truncate pr-2">{pickup.wasteType}</h3>
                        <span className="font-semibold text-gray-900">
                          {pickup.status === 'collected' ? (pickup.actualWeight ? `${pickup.actualWeight} kg` : 'Done') : `₹${pickup.estimatedValue}`}
                        </span>
                      </div>
                      
                      {pickup.scheduledFor && pickup.scheduledFor !== 'immediate' && (
                        <p className="text-xs text-blue-600 font-medium mb-1 flex items-center">
                          <Clock className="w-3 h-3 mr-1" /> Scheduled: {new Date(pickup.scheduledFor).toLocaleString()}
                        </p>
                      )}
                      
                      <div className="flex items-center text-xs font-medium mt-1">
                        <span className={`px-2 py-0.5 rounded-full ${
                          pickup.status === 'collected' ? 'bg-green-50 text-green-700 border border-green-200' :
                          pickup.status === 'accepted' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          pickup.status === 'en_route' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          'bg-orange-50 text-orange-700 border border-orange-200'
                        }`}>
                          {pickup.status === 'en_route' ? 'On the Way' : pickup.status.charAt(0).toUpperCase() + pickup.status.slice(1)}
                        </span>
                        <span className="text-gray-400 ml-2">
                          {pickup.createdAt?.toDate ? pickup.createdAt.toDate().toLocaleDateString() : 'Just now'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'leaderboard' && (
          <div className="flex-1 flex flex-col">
            <div className="bg-gradient-to-br from-green-600 to-green-800 text-white p-6 rounded-2xl mb-6 shadow-sm flex flex-col items-center justify-center text-center">
              <Trophy className="w-12 h-12 text-yellow-300 mb-3" />
              <h2 className="text-xl font-bold mb-1">Community Leaderboard</h2>
              <p className="text-green-100 text-sm">See who is making the biggest impact in your neighborhood.</p>
            </div>

            <div className="space-y-3">
              {leaderboardData.map((user, index) => (
                <div 
                  key={user.id} 
                  className={`p-4 rounded-2xl flex items-center gap-4 ${
                    user.isCurrentUser ? 'bg-green-50 border-2 border-green-200 shadow-sm' : 'bg-white border border-gray-100 shadow-sm'
                  }`}
                >
                  <div className="w-8 flex justify-center shrink-0">
                    {index === 0 ? <Medal className="w-6 h-6 text-yellow-500" /> : 
                     index === 1 ? <Medal className="w-6 h-6 text-gray-400" /> : 
                     index === 2 ? <Medal className="w-6 h-6 text-amber-700" /> : 
                     <span className="text-lg font-bold text-gray-400">#{index + 1}</span>}
                  </div>
                  
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                    user.isCurrentUser ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {user.avatar}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold truncate ${user.isCurrentUser ? 'text-green-900' : 'text-gray-900'}`}>
                      {user.name} {user.isCurrentUser && '(You)'}
                    </h3>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <span className={`font-bold ${user.isCurrentUser ? 'text-green-700' : 'text-gray-900'}`}>
                      {user.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
