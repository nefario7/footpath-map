import { useState, useEffect } from 'react';
import axios from 'axios';
import { ExternalLink, Image } from 'lucide-react';

export default function FeedPage() {
    const [posts, setPosts] = useState([]);
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

    if (loading) return <div className="p-8 text-center">Loading feed...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-6">
            <h1 className="text-2xl font-bold mb-6">Raw Twitter Feed</h1>

            {posts.map((post) => (
                <div key={post.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
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
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
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
                                <div key={index} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
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
                            className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1"
                        >
                            View on X <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}
