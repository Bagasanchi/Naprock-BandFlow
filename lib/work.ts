export type SubtaskDetail = {
  id: string;
  description: string;
  status: 'pending' | 'active' | 'done';
  // True while the one step this step depends on is not done yet.
  locked?: boolean;
  order_index: number;
  started_at: string | null;
  completed_at: string | null;
};

export type WorkItem = {
  id: string;
  title: string;
  status: 'In Progress' | 'Review' | 'Done';
  priority: 'Low' | 'Medium' | 'High';
  due: string;
  progress: number;
  assignedTo: string;
  subtasks: string[];
  // Server-side subtask state (pending / on the watch / done); empty for work created offline.
  subtaskDetails?: SubtaskDetail[];
  // Priority matrix category, the same one the watch shows: do_first, schedule, delegate or eliminate.
  eisenhowerCategory?: string | null;
  // Who chose it: 'ai', 'rules' (the fallback without AI) or 'manual'.
  eisenhowerSource?: string | null;
};

export const eisenhowerLabels: Record<string, string> = { do_first: 'Do first', schedule: 'Schedule', delegate: 'Delegate', eliminate: 'Eliminate' };

// What POST /work reports about delivering the first subtask to the wristband.
export type BandDelivery = { sent: boolean; error?: string };
