import { json, error, type RequestHandler } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/rbac';
import { importProblemZip, ZipSecurityError } from '#lib/server/storage/zip-importer';

export const POST: RequestHandler = async (event) => {
  // Enforce Teacher or Admin role
  requireTeacher(event);

  const formData = await event.request.formData();
  const file = formData.get('file');
  const moduleOverride = formData.get('module') as string | null;
  const groupOverride = formData.get('group') as string | null;
  const codeOverride = formData.get('code') as string | null;

  if (!file || !(file instanceof File)) {
    throw error(400, 'A valid ZIP archive must be provided in the "file" form field.');
  }

  if (!file.name.endsWith('.zip') && file.type !== 'application/zip') {
    throw error(400, 'Uploaded file must be a .zip package.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const result = await importProblemZip(buffer, {
      moduleOverride: moduleOverride || undefined,
      groupOverride: groupOverride || undefined,
      codeOverride: codeOverride || undefined
    });

    return json({
      success: true,
      problem: result.problem,
      testcaseCount: result.testcaseCount,
      sampleCount: result.sampleCount
    });
  } catch (err: any) {
    if (err instanceof ZipSecurityError) {
      throw error(400, `ZIP validation rejected: ${err.message}`);
    }
    console.error('Problem ingestion failed:', err);
    throw error(500, `Ingestion failed: ${err.message || 'Internal server error'}`);
  }
};

