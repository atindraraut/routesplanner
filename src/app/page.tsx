'use client'; // Required for map interactions

import { RoutePlanner } from '@/components/route-planner';

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <RoutePlanner />
    </div>
  );
}
