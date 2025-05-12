// src/app/routes/page.tsx

import { useEffect, useState } from 'react';

interface Route {
  _id: string;
  name: string;
  origin: string;
  destination: string;
  waypoints: string[]; // Assuming waypoints is an array of strings
}

const RoutesPage = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await fetch('/api/routes/all');
        if (!response.ok) {
          throw new Error(`Error fetching routes: ${response.statusText}`);
        }
        const data: Route[] = await response.json();
        setRoutes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, []);

  if (loading) {
    return <div>Loading routes...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">All Routes</h1>
      {routes.length === 0 ? (
        <p>No routes found.</p>
      ) : (
        <ul>
          {routes.map((route) => (
            <li key={route._id} className="border p-4 mb-4 rounded shadow">
              <h2 className="text-xl font-semibold">{route.name}</h2>
              <p><strong>Origin:</strong> {route.origin}</p>
              <p><strong>Destination:</strong> {route.destination}</p>
              {/* You can add more details here if needed */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RoutesPage;