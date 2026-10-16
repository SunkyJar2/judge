import { json, error, type RequestHandler } from '@sveltejs/kit';
import { verifyWebhookSignature, processTestResult } from '#lib/server/judge/dispatcher';
import { fromBase64 } from '#lib/server/judge/client';

export const PUT: RequestHandler = async ({ request, url }) => {
  return handleWebhook(request, url);
};

export const POST: RequestHandler = async ({ request, url }) => {
  return handleWebhook(request, url);
};

async function handleWebhook(request: Request, url: URL) {
  const submissionId = url.searchParams.get('submissionId');
  const testcaseId = url.searchParams.get('testcaseId');
  const signature = url.searchParams.get('sig');

  if (!submissionId || !testcaseId || !signature) {
    throw error(400, 'Missing webhook signature or query identifiers.');
  }

  // Verify HMAC-SHA256 signature
  const isValid = verifyWebhookSignature(submissionId, testcaseId, signature);
  if (!isValid) {
    throw error(401, 'Invalid HMAC webhook signature.');
  }

  const body = await request.json();

  await processTestResult(submissionId, testcaseId, {
    status_id: body.status?.id ?? 13,
    time: body.time,
    memory: body.memory,
    stdout: fromBase64(body.stdout),
    stderr: fromBase64(body.stderr),
    compile_output: fromBase64(body.compile_output),
  });

  return json({ received: true });
}

