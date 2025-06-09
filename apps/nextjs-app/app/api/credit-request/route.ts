import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const resend = new Resend(process.env.AUTH_RESEND_KEY);

// Validation schema for the credit request form
const creditRequestSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z.string().email("Please enter a valid email address"),
  credits: z.number().min(1, "Credits must be at least 1"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the request body
    const validation = creditRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { name, email, credits } = validation.data;

    // Calculate total cost using the same logic as the pricing page
    const calculateTotalCost = (credits: number): number => {
      let total = 0;

      if (credits <= 0) return 0;

      // First tier: 1-9 credits at $19.99 each
      const tier1Credits = Math.min(credits, 9);
      total += tier1Credits * 19.99;
      credits -= tier1Credits;

      if (credits <= 0) return total;

      // Second tier: 10-19 credits at $14.99 each
      const tier2Credits = Math.min(credits, 10);
      total += tier2Credits * 14.99;
      credits -= tier2Credits;

      if (credits <= 0) return total;

      // Third tier: 20-49 credits at $9.99 each
      const tier3Credits = Math.min(credits, 30);
      total += tier3Credits * 9.99;
      credits -= tier3Credits;

      if (credits <= 0) return total;

      // Fourth tier: 50+ credits at $4.99 each
      total += credits * 4.99;

      return total;
    };

    const totalCost = calculateTotalCost(credits);

    // Send email to payments@askseer.ai
    const { data, error } = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: ["payments@askseer.ai"],
      subject: `Credit Purchase Request - ${name}`,
      html: `
        <h2>New Credit Purchase Request</h2>
        <p><strong>Customer Details:</strong></p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Credits Requested:</strong> ${credits}</li>
          <li><strong>Total Cost:</strong> $${totalCost.toFixed(2)}</li>
        </ul>
        <p>Please follow up with the customer to process their credit purchase.</p>
      `,
      text: `
        New Credit Purchase Request
        
        Customer Details:
        Name: ${name}
        Email: ${email}
        Credits Requested: ${credits}
        Total Cost: $${totalCost.toFixed(2)}
        
        Please follow up with the customer to process their credit purchase.
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Credit request submitted successfully",
      emailId: data?.id,
    });
  } catch (error) {
    console.error("Credit request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
