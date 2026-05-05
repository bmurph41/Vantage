import { valuationTimelineService } from './valuation-timeline-service';

export async function triggerValuationSnapshot(
  orgId: string,
  projectId: string,
  userId?: string,
  note?: string,
): Promise<void> {
  try {
    await valuationTimelineService.createSnapshot(
      { modelingProjectId: projectId, orgId, userId },
      'model_save',
      note,
    );
  } catch (e) {
    console.error(
      `[scenario-snapshot-hook] non-blocking failure for org=${orgId} project=${projectId}:`,
      e,
    );
  }
}
