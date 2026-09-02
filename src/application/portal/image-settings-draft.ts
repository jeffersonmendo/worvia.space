export type SyncedTextDraft = {
  draft: string;
  source: string;
};

export function createSyncedTextDraft(source: string): SyncedTextDraft {
  return { draft: source, source };
}

export function editSyncedTextDraft(
  state: SyncedTextDraft,
  draft: string,
): SyncedTextDraft {
  return { ...state, draft };
}

export function handleSyncedTextDraftChange(
  setState: (update: (state: SyncedTextDraft) => SyncedTextDraft) => void,
  event: { currentTarget: { value: string } },
) {
  const value = event.currentTarget.value;
  setState((state) => editSyncedTextDraft(state, value));
}

export function syncTextDraftSource(
  state: SyncedTextDraft,
  source: string,
): SyncedTextDraft {
  return state.source === source ? state : { draft: source, source };
}
