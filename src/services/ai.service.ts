import { env } from '../config/env';

const OPENROUTER_URL = env.OPENROUTER_BASE_URL + '/chat/completions';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callOpenRouter(messages: Message[], model?: string): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.FRONTEND_URL,
      'X-Title': 'Pharmax Platform',
    },
    body: JSON.stringify({
      model: model || env.AI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json() as any;
  return data.choices[0].message.content;
}

export const aiService = {
  async summarizeVisit(visitData: {
    doctorName?: string;
    productsDiscussed: string[];
    notes?: string;
    objectionsRaised?: string;
    duration?: number;
  }): Promise<string> {
    if (!env.OPENROUTER_API_KEY) {
      return `Visit with ${visitData.doctorName || 'doctor'}. Products discussed: ${visitData.productsDiscussed.join(', ')}. Duration: ${visitData.duration} minutes.`;
    }

    const prompt = `You are a pharmaceutical sales assistant. Summarize this doctor visit concisely in 2-3 sentences for a sales manager:

Doctor: ${visitData.doctorName || 'N/A'}
Products Discussed: ${visitData.productsDiscussed.join(', ')}
Duration: ${visitData.duration || 0} minutes
Notes: ${visitData.notes || 'None'}
Objections: ${visitData.objectionsRaised || 'None'}

Provide a professional summary highlighting key outcomes and any follow-up needed.`;

    return callOpenRouter([{ role: 'user', content: prompt }]);
  },

  async nextBestAction(context: {
    doctorName: string;
    specialty: string;
    lastVisitDate?: string;
    productsDiscussed: string[];
    objections?: string;
    prescriptionPotential: number;
  }): Promise<string[]> {
    if (!env.OPENROUTER_API_KEY) {
      return [
        `Schedule follow-up visit with ${context.doctorName}`,
        'Present new clinical study data',
        'Address objections from last visit',
      ];
    }

    const prompt = `As a pharmaceutical sales coach, suggest 3 specific next-best actions for a medical representative visiting this doctor:

Doctor: ${context.doctorName} (${context.specialty})
Last Visit: ${context.lastVisitDate || 'No previous visit'}
Products Discussed: ${context.productsDiscussed.join(', ')}
Objections Raised: ${context.objections || 'None'}
Prescription Potential: ${context.prescriptionPotential}/10

Return exactly 3 actionable recommendations as a JSON array of strings. No other text.`;

    const result = await callOpenRouter([{ role: 'user', content: prompt }]);
    try {
      return JSON.parse(result);
    } catch {
      return result.split('\n').filter(Boolean).slice(0, 3);
    }
  },

  async chat(messages: Message[], userRole: string): Promise<string> {
    if (!env.OPENROUTER_API_KEY) {
      return 'AI features require an OpenRouter API key to be configured. Please add your OPENROUTER_API_KEY to the backend .env file.';
    }

    const systemPrompt = `You are Pharmax AI Copilot, an intelligent assistant for pharmaceutical sales professionals. 
You help ${userRole === 'ASM' || userRole === 'RSM' || userRole === 'ZM' || userRole === 'NSM' ? 'sales managers' : 'medical representatives'} 
with visit planning, doctor engagement strategies, product knowledge, and sales performance insights.
Be concise, professional, and actionable in your responses.`;

    return callOpenRouter([{ role: 'system', content: systemPrompt }, ...messages]);
  },

  async generateDailyPlan(context: {
    territory: string;
    pendingFollowUps: string[];
    missedDoctors: string[];
    monthTarget: number;
    achieved: number;
  }): Promise<string> {
    if (!env.OPENROUTER_API_KEY) {
      return `Suggested daily plan for ${context.territory}: Focus on ${context.pendingFollowUps.slice(0, 3).join(', ')}. Priority: high-potential doctors.`;
    }

    const prompt = `Create a prioritized daily visit plan for a medical representative:

Territory: ${context.territory}
Pending Follow-ups: ${context.pendingFollowUps.join(', ')}
Doctors Not Visited This Month: ${context.missedDoctors.join(', ')}
Monthly Target: ${context.monthTarget} visits
Achieved So Far: ${context.achieved} visits

Provide a structured daily plan with priorities and reasoning in 150 words or less.`;

    return callOpenRouter([{ role: 'user', content: prompt }]);
  },

  async generateEODReport(visits: Array<{
    doctorName: string;
    products: string[];
    outcome: string;
  }>): Promise<string> {
    if (!env.OPENROUTER_API_KEY) {
      return `End of Day Report: Completed ${visits.length} visits today. Key highlights from visits.`;
    }

    const visitSummary = visits.map(v => `- ${v.doctorName}: ${v.products.join(', ')} — ${v.outcome}`).join('\n');
    const prompt = `Generate a professional end-of-day report for a pharmaceutical sales rep based on today's visits:\n\n${visitSummary}\n\nWrite a concise, professional summary (200 words max) suitable for submission to a sales manager.`;

    return callOpenRouter([{ role: 'user', content: prompt }]);
  },
};
