import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as tf from "@tensorflow/tfjs";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch leads that have a definitive outcome
    // Let's assume 'won' and 'lost' are the terminal statuses
    const leads = await prisma.lead.findMany({
      where: {
        status: { in: ['won', 'lost'] }
      },
      select: {
        score: true,
        tier: true,
        budgetMin: true,
        budgetMax: true,
        relocated: true,
        rentalFlag: true,
        status: true,
      }
    });

    if (leads.length < 500) {
      return NextResponse.json({ 
        message: "Insufficient data for training. At least 500 won/lost leads required.",
        currentCount: leads.length,
        requiredCount: 500
      }, { status: 400 });
    }

    // 2. Prepare data for TensorFlow
    // Features: [score, tier, hasBudget, budgetRange, isRelocated, isRental]
    const features: number[][] = [];
    const labels: number[][] = []; // [isWon]

    for (const lead of leads) {
      const budgetMin = lead.budgetMin || 0;
      const budgetMax = lead.budgetMax || 0;
      const hasBudget = budgetMin > 0 || budgetMax > 0 ? 1 : 0;
      const budgetRange = budgetMax - budgetMin;

      features.push([
        lead.score / 100, // Normalize 0-1
        lead.tier / 3,    // Normalize assuming tiers 1-3
        hasBudget,
        budgetRange > 0 ? 1 : 0, // Simplified feature
        lead.relocated ? 1 : 0,
        lead.rentalFlag ? 1 : 0
      ]);

      labels.push([lead.status === 'won' ? 1 : 0]);
    }

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);

    // 3. Define a simple model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 8, activation: 'relu', inputShape: [6] }));
    model.add(tf.layers.dense({ units: 4, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    // 4. Train the model
    await model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      shuffle: true,
      verbose: 0
    });

    // Extract weights to simulate adjusting base score weights
    const weights = model.layers[0].getWeights()[0].arraySync();
    
    // In a real scenario, we would save the model to Vercel Blob or DB
    // and use it to adjust scores of incoming leads.
    
    // Free tensors
    xs.dispose();
    ys.dispose();

    return NextResponse.json({ 
      success: true, 
      message: "Model trained successfully on lead outcomes.",
      data: {
        trainedLeadsCount: leads.length,
        extractedWeights: weights
      }
    }, { status: 200 });

  } catch (error) {
    console.error("ML Train error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
