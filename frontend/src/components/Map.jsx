import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default marker icon in React-Leaflet
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function Map({ locations }) {
    const bangaloreCenter = [12.9716, 77.5946];

    return (
        <div className="h-full w-full rounded-lg overflow-hidden shadow-lg border border-gray-200">
            <MapContainer
                center={bangaloreCenter}
                zoom={12}
                style={{ height: "100%", width: "100%" }}
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />

                {locations.map((loc) => (
                    <Marker
                        key={loc.id}
                        position={[loc.coordinates.lat, loc.coordinates.lon]}
                    >
                        <Popup className="custom-popup">
                            <div className="max-w-xs">
                                <p className="text-sm font-medium mb-2">{loc.text}</p>
                                {loc.mediaUrls && loc.mediaUrls.length > 0 && (
                                    <div className="flex gap-1 overflow-x-auto pb-2">
                                        {loc.mediaUrls.map((url, i) => (
                                            <img key={i} src={url} alt="Issue" className="h-20 w-auto rounded object-cover" />
                                        ))}
                                    </div>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                    {new Date(loc.createdAt).toLocaleDateString()}
                                </div>
                                <a
                                    href={loc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline mt-1 block"
                                >
                                    View on Twitter
                                </a>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
