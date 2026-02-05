import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import axios from 'axios';
import { Map as MapIcon, Mic, List, RefreshCw } from 'lucide-react';
import Map from './components/Map';
import PostList from './components/PostList';
import ProcessingStatus from './components/ProcessingStatus';
import FeedPage from './pages/FeedPage';

// Home Page (Map View) - Only shows Processed Issues
function MapView() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/locations');
      // The API returns an array of formatted location objects
      setLocations(res.data.locations);
    } catch (err) {
      console.error("Error fetching locations:", err);
      setError("Failed to load map data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-hidden relative flex flex-col sm:flex-row h-full">
      {/* Map Container (2/3 width on desktop) */}
      <div className="w-full sm:w-2/3 h-1/2 sm:h-full relative order-2 sm:order-1">
        {loading && locations.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Map locations={locations} />
        )}
      </div>

      {/* Issues List Side Panel (1/3 width) - Only Processed Data */}
      <div className="w-full sm:w-1/3 h-1/2 sm:h-full bg-white border-l border-gray-200 flex flex-col order-1 sm:order-2">
        <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center shadow-sm z-10">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <MapIcon size={18} className="text-blue-600" />
            Mapped Issues
          </h2>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{locations.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : (
            <PostList posts={locations} />
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
        {/* Navigation Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Footpath Map
                  </span>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`
                    }
                  >
                    <MapIcon size={16} className="mr-2" /> Map & Issues
                  </NavLink>
                  <NavLink
                    to="/feed"
                    className={({ isActive }) =>
                      `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`
                    }
                  >
                    <List size={16} className="mr-2" /> Raw Feed
                  </NavLink>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="sm:hidden flex border-t border-gray-200 sticky top-0 z-50 bg-white">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${isActive ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500'
                }`
              }
            >
              <MapIcon size={18} /> Map
            </NavLink>
            <NavLink
              to="/feed"
              className={({ isActive }) =>
                `flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${isActive ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500'
                }`
              }
            >
              <List size={18} /> Feed
            </NavLink>
          </div>
        </header>

        {/* Processing Status Banner */}
        <ProcessingStatus />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <Routes>
            <Route path="/" element={<MapView />} />
            <Route path="/feed" element={<FeedPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
