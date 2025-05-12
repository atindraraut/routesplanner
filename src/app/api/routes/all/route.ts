import { NextRequest, NextResponse } from 'next/server';
import Route from '@/src/lib/models/Route';
import connectMongoDB from '@/src/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    await connectMongoDB();
    const routes = await Route.find();
    return NextResponse.json(routes, { status: 200 });
  } catch (error) {
    console.error('Error fetching routes:', error);
    return NextResponse.json({ message: 'Error fetching routes' }, { status: 500 });
  }
}