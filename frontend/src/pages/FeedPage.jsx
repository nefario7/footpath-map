import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ExternalLink, Image, Search } from 'lucide-react';

export default function FeedPage() {
    const [posts, setPosts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/posts');
            // Flatten the lists: we just want ALL posts sorted by date
            const allPosts = [
                ...res.data.posts.withCoords,
                ...res.data.posts.missingCoords
            ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setPosts(allPosts);
        } catch (err) {
            console.error("Error fetching posts:", err);
            setError("Failed to load tweets.");
        } finally {
            setLoading(false);
        }
    };

    const filteredPosts = useMemo(() => {
        return posts.filter(post =>
            post.text.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [posts, searchQuery]);

    if (loading) return <div className="p-8 text-center">Loading feed...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="h-full overflow-y-auto bg-gray-50">
            <div className="max-w-2xl mx-auto p-4 space-y-6">

                {/* Header & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sticky top-0 bg-gray-50 pt-2 pb-2 z-10 backdrop-blur-sm bg-opacity-90">
                    <h1 className="text-2xl font-bold text-gray-900">Raw Twitter Feed</h1>
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search tweets..."
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-64 shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {filteredPosts.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-gray-200">
                        No tweets found matching "{searchQuery}"
                    </div>
                ) : (
                    filteredPosts.map((post) => (
                        <div key={post.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className="text-sm text-gray-500">
                                    {new Date(post.createdAt).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                                {post.coordinates && (
                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                                        Processed
                                    </span>
                                )}
                            </div>

                            <p className="text-gray-800 whitespace-pre-wrap mb-4 font-normal text-base leading-relaxed">
                                {post.text}
                            </p>

                            {/* Media Grid */}
                            {post.mediaUrls && post.mediaUrls.length > 0 && (
                                <div className={`grid gap-2 mb-4 ${post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                                    }`}>
                                    {post.mediaUrls.map((url, index) => (
                                        <div key={index} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                            <img
                                                src={url}
                                                alt={`Attachment ${index + 1}`}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400"><span class="text-xs">Image load failed</span></div>';
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-end pt-3 border-t border-gray-50">
                                <a
                                    href={post.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1 font-medium"
                                >
                                    View on X <ExternalLink size={14} />
                                </a>
                            </div>
                        </div>
                    ))
                )}

                <div className="text-center text-sm text-gray-400 py-6">
                    End of feed
                </div>
            </div>
        </div>
    );
}
