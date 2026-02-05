import { useState, useEffect } from 'react';
import axios from 'axios';
import { Map as MapIcon, List, RefreshCw } from 'lucide-react';
import Map from './components/Map';
import PostList from './components/PostList';

function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [locations, setLocations] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, mapped: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch both locations (for map) and posts (for list)
      const [locRes, postsRes] = await Promise.all([
        axios.get('/api/locations'),
        axios.get('/api/posts')
      ]);

      setLocations(locRes.data.locations);

      // Combine with/missing coords for the list
      const allPosts = [
        ...postsRes.data.posts.withCoords,
        ...postsRes.data.posts.missingCoords
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setPosts(allPosts);

      setStats({
        total: postsRes.data.totalPosts,
        mapped: postsRes.data.postsWithCoords
      });

    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data from server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Bangalore Footpath Map
          </h1>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 hidden sm:flex">
          <span>{stats.mapped} Issues Mapped</span>
          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
          <span>{stats.total} Total Posts</span>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
          title="Refresh Data"
        >
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Mobile Tabs */}
      <div className="sm:hidden flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'map' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          <MapIcon size={18} /> Map
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          <List size={18} /> List
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex">
        {/* Desktop Split View: Map (Left) - List (Right) */}

        {/* Map Container */}
        <div className={`w-full sm:w-2/3 h-full relative ${activeTab === 'list' ? 'hidden sm:block' : 'block'}`}>
          {loading && locations.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Map locations={locations} />
          )}
        </div>

        {/* List Container */}
        <div className={`w-full sm:w-1/3 h-full bg-white border-l border-gray-200 flex flex-col ${activeTab === 'map' ? 'hidden sm:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Recent Updates</h2>
            <div className="flex gap-2">
              {/* Filters could go here */}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50/50">
            {error ? (
              <div className="p-8 text-center text-red-500">{error}</div>
            ) : (
              <PostList posts={posts} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
