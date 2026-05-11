import { NextResponse } from 'next/server';
import { trainModel } from '@/lib/ml/lead-model';

export async function POST(req: Request) {
  try {
    const result = await trainModel();
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: result.message, 
          leadsCount: result.leadsCount,
          readyToTrain: result.readyToTrain 
        }, 
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('ML Training Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to train ML model' },
      { status: 500 }
    );
  }
}
