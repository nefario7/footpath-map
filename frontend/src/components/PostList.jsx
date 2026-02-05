import { ExternalLink, Image, MapPin } from 'lucide-react';

export default function PostList({ posts }) {
    if (!posts || posts.length === 0) {
        return (
            <div className="text-center p-8 text-gray-500">
                No posts found.
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 overflow-y-auto h-full">
            {posts.map((post) => (
                <div key={post.id} className="bg-white p-4 rounded-lg shadow border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-xs text-gray-500 font-medium">
                            {new Date(post.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>

                        {post.coordinates ? (
                            <span className="inline-flex items-center text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                                <MapPin size={12} className="mr-1" />
                                Mapped
                            </span>
                        ) : (
                            <span className="inline-flex items-center text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full">
                                No Coords
                            </span>
                        )}
                    </div>

                    <p className="text-gray-800 text-sm whitespace-pre-wrap mb-3 leading-relaxed">
                        {post.text}
                    </p>

                    {post.mediaUrls && post.mediaUrls.length > 0 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                            {post.mediaUrls.map((url, i) => (
                                <div key={i} className="flex-shrink-0 relative">
                                    <img
                                        src={url}
                                        alt="Tweet media"
                                        className="h-32 w-auto rounded-lg object-cover border border-gray-100"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end pt-2 border-t border-gray-50">
                        <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                        >
                            View on X <ExternalLink size={14} className="ml-1" />
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}
