export type SubtaskDetail = {
  id: string;
  description: string;
  status: 'pending' | 'active' | 'done';
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
};

// What POST /work reports about delivering the first subtask to the wristband.
export type BandDelivery = { sent: boolean; error?: string };
