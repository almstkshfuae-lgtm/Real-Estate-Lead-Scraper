import { NextResponse } from 'next/server';
import { trainModel } from '@/lib/ml/lead-model';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const wonCount = await prisma.lead.count({ where: { status: 'won' } });
    const lostCount = await prisma.lead.count({ where: { status: 'lost' } });
    const totalCount = wonCount + lostCount;

    return NextResponse.json({
      success: true,
      ready: totalCount >= 500,
      wonCount,
      lostCount,
      totalCount,
      requiredCount: 500
    });
  } catch (error) {
    console.error('ML Status Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve ML status' },
      { status: 500 }
    );
  }
}

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
